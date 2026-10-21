import {
  getAuth as _getAuth,
  saveAuth,
  getSettings,
  getSession,
  createSession,
  clearSession,
  isSessionValid,
} from '../storage/storageService.js';

export async function getAuth() { return _getAuth(); }

// ── Password hashing ──────────────────────────────────────────────────────────

function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// v2: PBKDF2 + random salt (current)
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// v1: SHA-256 + static salt — kept only for migrating existing stored passwords
async function hashPasswordLegacy(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'safeguard_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function setupPassword(password) {
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  const auth = (await _getAuth()) || {};
  auth.passwordHash = hash;
  auth.passwordSalt = salt;
  auth.hashVersion = 2;
  await saveAuth(auth);
}

export async function verifyPassword(password) {
  const auth = await _getAuth();
  if (!auth?.passwordHash) return false;

  if (auth.hashVersion === 2 && auth.passwordSalt) {
    const hash = await hashPassword(password, auth.passwordSalt);
    return hash === auth.passwordHash;
  }
  // Legacy v1 path
  const hash = await hashPasswordLegacy(password);
  return hash === auth.passwordHash;
}

export async function changePassword(currentPassword, newPassword) {
  const valid = await verifyPassword(currentPassword);
  if (!valid) return false;
  await setupPassword(newPassword); // Always upgrades to v2
  return true;
}

// ── TOTP 2FA (RFC 6238) ───────────────────────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(str) {
  const s = str.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0;
  const output = [];
  for (let i = 0; i < s.length; i++) {
    const idx = BASE32_CHARS.indexOf(s[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

function base32Encode(bytes) {
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
  while (output.length % 8 !== 0) output += '=';
  return output;
}

export function generateTOTPSecret() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

async function hmacSHA1(keyBytes, messageBytes) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBytes);
  return new Uint8Array(signature);
}

async function computeTOTP(secret, counterOffset = 0, timeStep = 30) {
  const keyBytes = base32Decode(secret);
  const timeCounter = Math.floor(Date.now() / 1000 / timeStep) + counterOffset;

  const messageBuffer = new ArrayBuffer(8);
  new DataView(messageBuffer).setUint32(4, timeCounter, false);
  const messageBytes = new Uint8Array(messageBuffer);

  const hmac = await hmacSHA1(keyBytes, messageBytes);
  const offset = hmac[19] & 0x0f;
  const code = (
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8)  |
     (hmac[offset + 3] & 0xff)
  ) % 1000000;
  return code.toString().padStart(6, '0');
}

export async function verifyTOTP(secret, token) {
  // Allow ±1 time window to tolerate clock drift
  for (let delta = -1; delta <= 1; delta++) {
    const code = await computeTOTP(secret, delta);
    if (code === token.trim()) return true;
  }
  return false;
}

export function getOTPAuthURL(secret, issuer = 'SafeGuard', account = 'Parent') {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

// ── 2FA lifecycle ─────────────────────────────────────────────────────────────

export async function setup2FA() {
  const secret = generateTOTPSecret();
  const auth = (await _getAuth()) || {};
  auth.totpSecret = secret;
  auth.totpEnabled = false;
  await saveAuth(auth);
  return secret;
}

export async function enable2FA(token) {
  const auth = await _getAuth();
  if (!auth?.totpSecret) return false;
  const valid = await verifyTOTP(auth.totpSecret, token);
  if (valid) {
    auth.totpEnabled = true;
    await saveAuth(auth);
  }
  return valid;
}

export async function disable2FA(password) {
  const valid = await verifyPassword(password);
  if (!valid) return false;
  const auth = await _getAuth();
  if (auth) {
    auth.totpEnabled = false;
    auth.totpSecret = null;
    await saveAuth(auth);
  }
  return true;
}

export async function is2FAEnabled() {
  const auth = await _getAuth();
  return !!(auth?.totpEnabled && auth?.totpSecret);
}

// ── Session management ────────────────────────────────────────────────────────

export async function authenticate(password, totpToken = null) {
  const valid = await verifyPassword(password);
  if (!valid) return { success: false, reason: 'wrong_password' };

  const twoFAEnabled = await is2FAEnabled();
  if (twoFAEnabled) {
    if (!totpToken) return { success: false, reason: 'need_2fa' };
    const auth = await _getAuth();
    const totpValid = await verifyTOTP(auth.totpSecret, totpToken);
    if (!totpValid) return { success: false, reason: 'invalid_totp' };
  }

  const settings = await getSettings();
  await createSession(settings.sessionTimeout || 15);
  return { success: true };
}

export async function logout() {
  await clearSession();
}

export async function checkSession() {
  return await isSessionValid();
}

export async function hasPassword() {
  const auth = await _getAuth();
  return !!auth?.passwordHash;
}
