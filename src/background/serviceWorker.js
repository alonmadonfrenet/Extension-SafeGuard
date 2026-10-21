// Service Worker — SafeGuard background logic (Manifest V3)
import {
  getSettings, saveSettings, getProfiles, getActiveProfileId,
  getFilters, addActivityEntry, getTempAllowed,
} from '../storage/storageService.js';
import { classifyContent, shouldBlock, loadToxicityModel } from '../ai/classifier.js';

// Pre-load AI on startup
loadToxicityModel().catch(() => {});


// ── Schedule enforcement ──────────────────────────────────────────────────────
async function isWithinSchedule(profile) {
  if (!profile?.schedule || Object.keys(profile.schedule).length === 0) return true;
  const now  = new Date();
  const day  = (now.getDay() + 6) % 7; // 0=Mon ... 6=Sun
  const range = profile.schedule[day];
  if (!range) return true; // day not restricted
  const [fh, fm] = range.from.split(':').map(Number);
  const [th, tm] = range.to.split(':').map(Number);
  const nowMin  = now.getHours() * 60 + now.getMinutes();
  const fromMin = fh * 60 + fm;
  const toMin   = th * 60 + tm;
  return nowMin >= fromMin && nowMin <= toMin;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getActiveProfileInfo() {
  const pid      = await getActiveProfileId();
  const profiles = await getProfiles();
  const profile  = profiles.find(p => p.id === pid) || null;
  return { profileId: pid, profileName: profile?.name || null };
}

// ── URL check (before page load) ──────────────────────────────────────────────
async function checkURL(url) {
  try {
    const settings = await getSettings();
    if (!settings.protectionEnabled) return { block: false, reason: 'protection_disabled' };

    let hostname;
    try { hostname = new URL(url).hostname.replace(/^www\./, ''); }
    catch { return { block: false, reason: 'invalid_url' }; }

    const { profileId } = await getActiveProfileInfo();
    if (!profileId) return { block: false, reason: 'no_active_profile' };

    // Schedule enforcement
    const profiles = await getProfiles();
    const activeProfile = profiles.find(p => p.id === profileId);
    const withinSchedule = await isWithinSchedule(activeProfile);
    if (!withinSchedule) {
      return { block: true, reason: 'schedule', category: 'schedule', confidence: 1.0 };
    }

    const filters = await getFilters(profileId);

    // Temp-allowed
    const tempAllowed = await getTempAllowed();
    if (tempAllowed.includes(hostname)) return { block: false, reason: 'temp_allowed' };

    // Whitelist
    if (filters.allowedDomains?.some(d => hostname.includes(d)))
      return { block: false, reason: 'whitelisted' };

    // Blacklist
    if (filters.blockedDomains?.some(d => hostname.includes(d)))
      return { block: true, reason: 'blacklisted', category: 'manual', confidence: 1.0 };

    return { block: false, reason: 'pass_to_content' };
  } catch (e) {
    return { block: false, reason: 'error' };
  }
}

// ── Content analysis ──────────────────────────────────────────────────────────
async function analyzeContent(data) {
  try {
    const { url, text, title } = data;
    const settings = await getSettings();
    if (!settings.protectionEnabled) return { block: false };

    const { profileId, profileName } = await getActiveProfileInfo();
    if (!profileId) return { block: false };

    const filters = await getFilters(profileId);
    let hostname;
    try { hostname = new URL(url).hostname.replace(/^www\./, ''); }
    catch { return { block: false }; }

    // Domain blacklist
    if (filters.blockedDomains?.some(d => hostname.includes(d))) {
      await addActivityEntry({
        url, title, category: 'manual', decision: 'blocked',
        confidence: 1.0, reason: 'blacklisted',
        profileId, profileName,
      });
      return { block: true, reason: 'blacklisted', category: 'manual', confidence: 1.0 };
    }

    // Keyword filter
    const lowerText = (text + ' ' + title).toLowerCase();
    const matchedKw = filters.blockedKeywords?.find(kw => lowerText.includes(kw.toLowerCase()));
    if (matchedKw) {
      await addActivityEntry({
        url, title, category: 'keyword', decision: 'blocked',
        confidence: 1.0, reason: `keyword: ${matchedKw}`,
        profileId, profileName,
      });
      return { block: true, reason: 'keyword', keyword: matchedKw, category: 'keyword', confidence: 1.0 };
    }

    // AI analysis
    const result = await classifyContent({ text, url, title });
    const decision = shouldBlock(result, filters, settings);

    await addActivityEntry({
      url, title,
      category:    result.category,
      decision:    decision.block ? 'blocked' : 'allowed',
      confidence:  result.confidence,
      reason:      decision.reason || 'ai_analysis',
      explanation: result.explanation,
      language:    result.language,
      profileId, profileName,
    });

    if (decision.block && settings.notifyBlocked) {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: 'SafeGuard — Content Blocked',
          message: `${title || hostname}\n${result.category} · ${Math.round(result.confidence * 100)}%`,
        });
      } catch (_) {}
    }

    return {
      block:       decision.block,
      category:    result.category,
      confidence:  result.confidence,
      explanation: result.explanation,
      reason:      decision.reason,
      language:    result.language,
    };
  } catch (e) {
    console.error('[SafeGuard SW] analyzeContent error:', e);
    return { block: false, reason: 'error' };
  }
}

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, data } = message;

  switch (action) {
    case 'CHECK_URL':
      checkURL(data.url).then(sendResponse);
      return true;

    case 'ANALYZE_CONTENT':
      analyzeContent({ ...data, tabId: sender.tab?.id }).then(sendResponse);
      return true;

    case 'GET_STATUS':
      (async () => {
        const s = await getSettings();
        const { profileId, profileName } = await getActiveProfileInfo();
        sendResponse({
          protectionEnabled: s.protectionEnabled,
          aiReady:    true,
          profileId,  profileName,
        });
      })();
      return true;

    case 'TOGGLE_PROTECTION':
      (async () => {
        const s = await getSettings();
        s.protectionEnabled = !s.protectionEnabled;
        await saveSettings(s);
        sendResponse({ protectionEnabled: s.protectionEnabled });
      })();
      return true;

    case 'RECORD_BYPASS_ATTEMPT':
      (async () => {
        const { profileId, profileName } = await getActiveProfileInfo();
        await addActivityEntry({
          url:      data.url,
          title:    data.title || data.url,
          category: 'bypass_attempt',
          decision: 'blocked',
          confidence: 1.0,
          reason:   'bypass_attempt',
          profileId, profileName,
        });
        const s = await getSettings();
        if (s.notifyAttempts) {
          try {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: chrome.runtime.getURL('icons/icon48.png'),
              title: 'SafeGuard — Bypass Attempt Detected',
              message: `${profileName || 'Child'} tried to access: ${data.url}`,
            });
          } catch (_) {}
        }
        sendResponse({ ok: true });
      })();
      return true;

    case 'RELOAD_AI':
      loadToxicityModel().then(loaded => sendResponse({ loaded }));
      return true;
  }
});

// ── Web navigation listener ───────────────────────────────────────────────────
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!details.url.startsWith('http')) return;

  const blockPage = chrome.runtime.getURL('block.html');
  if (details.url.startsWith(blockPage)) return;

  const settings = await getSettings();
  if (!settings.protectionEnabled) return;

  const result = await checkURL(details.url);
  if (result.block) {
    const { profileName } = await getActiveProfileInfo();
    const params = new URLSearchParams({
      url:        details.url,
      reason:     result.reason || 'blocked',
      category:   result.category || 'manual',
      confidence: String(result.confidence || 1),
      profile:    profileName || '',
    });
    chrome.tabs.update(details.tabId, { url: `${blockPage}?${params}` });
  }
});

console.log('[SafeGuard SW] v1.0 — Service Worker ready');
