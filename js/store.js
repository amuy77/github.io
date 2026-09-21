// localStorage ベースの永続化。データはすべて端末内に留まる。
const KEY = 'review-inbox:v1';

const DEFAULTS = {
  items: {},       // id -> 分類済みアイテム(本文は保存しない。snippet と抽出結果のみ)
  caseState: {},   // caseKey -> { hostReviewDone, replied, archived, note, draft }
  settings: {
    clientId: '',
    days: 60,
    query: 'from:(airbnb.com OR booking.com)',
    hostName: '',
    lastSync: '',
  },
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw);
    return {
      items: data.items || {},
      caseState: data.caseState || {},
      settings: { ...DEFAULTS.settings, ...(data.settings || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('保存に失敗', e);
    return false;
  }
}

export function exportJson(state) {
  return JSON.stringify(state, null, 2);
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('形式が不正です');
  return {
    items: data.items || {},
    caseState: data.caseState || {},
    settings: { ...DEFAULTS.settings, ...(data.settings || {}) },
  };
}

export function clearAll() {
  localStorage.removeItem(KEY);
}
