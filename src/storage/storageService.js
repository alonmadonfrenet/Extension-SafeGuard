// Storage keys
export const KEYS = {
  SETTINGS: 'sg_settings',
  PROFILES: 'sg_profiles',
  ACTIVE_PROFILE: 'sg_active_profile',
  ACTIVITY_LOG: 'sg_activity_log',
  FILTERS: 'sg_filters',
  AUTH: 'sg_auth',
  SETUP_DONE: 'sg_setup_done',
  AI_FEEDBACK: 'sg_ai_feedback',
  SESSION: 'sg_session',
  TEMP_ALLOWED: 'sg_temp_allowed',
};

// Default settings
export const DEFAULT_SETTINGS = {
  language: 'en',
  theme: 'light',
  notifyBlocked: true,
  notifyAttempts: true,
  protectionEnabled: true,
  sessionTimeout: 15,
  aiThreshold: 0.75,
  version: '1.0.0',
};

export const DEFAULT_FILTERS = {
  blockedKeywords: [],
  blockedDomains: [],
  allowedDomains: [],
  categories: {
    violence: { blocked: true },
    adult_content: { blocked: true },
    gambling: { blocked: true },
    drugs: { blocked: true },
    hate_speech: { blocked: true },
    social_media: { blocked: false },
    gaming: { blocked: false },
    news: { blocked: false },
    education: { blocked: false },
  },
};

// Profile presets — applied when creating a new profile
export const RESTRICTION_PRESETS = {
  child: {
    categories: {
      violence: { blocked: true },
      adult_content: { blocked: true },
      gambling: { blocked: true },
      drugs: { blocked: true },
      hate_speech: { blocked: true },
      social_media: { blocked: true },
      gaming: { blocked: false },
      news: { blocked: false },
      education: { blocked: false },
    },
    aiThreshold: 0.65,
  },
  teenager: {
    categories: {
      violence: { blocked: true },
      adult_content: { blocked: true },
      gambling: { blocked: true },
      drugs: { blocked: true },
      hate_speech: { blocked: true },
      social_media: { blocked: false },
      gaming: { blocked: false },
      news: { blocked: false },
      education: { blocked: false },
    },
    aiThreshold: 0.75,
  },
  adult: {
    categories: {
      violence: { blocked: false },
      adult_content: { blocked: false },
      gambling: { blocked: false },
      drugs: { blocked: false },
      hate_speech: { blocked: true },
      social_media: { blocked: false },
      gaming: { blocked: false },
      news: { blocked: false },
      education: { blocked: false },
    },
    aiThreshold: 0.90,
  },
};

// Storage abstraction - works both in extension and standalone contexts
const isExtension = typeof chrome !== 'undefined' && chrome.storage;

async function chromeGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

async function chromeSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

async function chromeRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

export const storageGet = async (key) => {
  if (isExtension) {
    const result = await chromeGet([key]);
    return result[key];
  }
  const item = localStorage.getItem(key);
  try { return item ? JSON.parse(item) : undefined; }
  catch { return item; }
};

export const storageSet = async (key, value) => {
  if (isExtension) {
    await chromeSet({ [key]: value });
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

export const storageRemove = async (key) => {
  if (isExtension) {
    await chromeRemove([key]);
  } else {
    localStorage.removeItem(key);
  }
};

// Settings
export const getSettings = async () => {
  const saved = await storageGet(KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...saved };
};

export const saveSettings = async (settings) => {
  await storageSet(KEYS.SETTINGS, settings);
};

// Profiles
export const getProfiles = async () => {
  return (await storageGet(KEYS.PROFILES)) || [];
};

export const saveProfiles = async (profiles) => {
  await storageSet(KEYS.PROFILES, profiles);
};

export const getActiveProfileId = async () => {
  return await storageGet(KEYS.ACTIVE_PROFILE);
};

export const setActiveProfile = async (profileId) => {
  await storageSet(KEYS.ACTIVE_PROFILE, profileId);
};

// Activity Log
export const getActivityLog = async () => {
  return (await storageGet(KEYS.ACTIVITY_LOG)) || [];
};

export const addActivityEntry = async (entry) => {
  const log = await getActivityLog();
  const newEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  // Keep last 1000 entries
  const updated = [newEntry, ...log].slice(0, 1000);
  await storageSet(KEYS.ACTIVITY_LOG, updated);
  return newEntry;
};

export const clearActivityLog = async () => {
  await storageSet(KEYS.ACTIVITY_LOG, []);
};

// Filters per profile
export const getFilters = async (profileId) => {
  const allFilters = (await storageGet(KEYS.FILTERS)) || {};
  return { ...DEFAULT_FILTERS, ...(allFilters[profileId] || {}) };
};

export const saveFilters = async (profileId, filters) => {
  const allFilters = (await storageGet(KEYS.FILTERS)) || {};
  allFilters[profileId] = filters;
  await storageSet(KEYS.FILTERS, allFilters);
};

// Auth
export const getAuth = async () => {
  return await storageGet(KEYS.AUTH);
};

export const saveAuth = async (auth) => {
  await storageSet(KEYS.AUTH, auth);
};

// Setup
export const isSetupDone = async () => {
  return !!(await storageGet(KEYS.SETUP_DONE));
};

export const markSetupDone = async () => {
  await storageSet(KEYS.SETUP_DONE, true);
};

// AI Feedback
export const getAIFeedback = async () => {
  return (await storageGet(KEYS.AI_FEEDBACK)) || [];
};

export const addAIFeedback = async (feedback) => {
  const list = await getAIFeedback();
  const updated = [...list, { ...feedback, timestamp: new Date().toISOString() }].slice(-500);
  await storageSet(KEYS.AI_FEEDBACK, updated);
};

// Session management
export const getSession = async () => {
  return await storageGet(KEYS.SESSION);
};

export const createSession = async (timeoutMinutes = 15) => {
  const session = {
    createdAt: Date.now(),
    expiresAt: Date.now() + (timeoutMinutes * 60 * 1000),
  };
  await storageSet(KEYS.SESSION, session);
  return session;
};

export const clearSession = async () => {
  await storageRemove(KEYS.SESSION);
};

export const isSessionValid = async () => {
  const session = await getSession();
  if (!session) return false;
  return Date.now() < session.expiresAt;
};

// Temporarily allowed sites
export const getTempAllowed = async () => {
  return (await storageGet(KEYS.TEMP_ALLOWED)) || [];
};

export const addTempAllowed = async (domain) => {
  const list = await getTempAllowed();
  if (!list.includes(domain)) {
    await storageSet(KEYS.TEMP_ALLOWED, [...list, domain]);
  }
};

export const clearTempAllowed = async () => {
  await storageSet(KEYS.TEMP_ALLOWED, []);
};
