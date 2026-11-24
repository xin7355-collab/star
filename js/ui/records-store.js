// 名單、紀錄、設定的讀寫（localStorage，只在這支手機）。資料規則在 js/core/records.js。
// 舊版只存一份「profile」，第一次開新版時自動搬進名單，當作「我」。

import { load, save, remove, removeAll } from './storage.js';
import {
  sanitizePerson, sanitizeHistory, sanitizeSettings, addHistory, exportData, validateBackup, mergeData, newId, LIMITS,
} from '../core/records.js';

export function loadAll() {
  let people = (load('people') || []).map(sanitizePerson).filter(Boolean);
  const history = (load('history') || []).map(sanitizeHistory).filter(Boolean);
  const settings = sanitizeSettings(load('settings'));
  const legacy = load('profile');
  if (legacy && people.length === 0) {
    const me = sanitizePerson({ id: newId('p'), name: '我', self: true, raw: { ...legacy, calendar: 'solar' } });
    if (me) {
      people = [me];
      settings.activeId = me.id;
      save('people', people);
      save('settings', settings);
    }
    remove('profile');
  }
  if (!people.some((p) => p.id === settings.activeId)) settings.activeId = people[0]?.id || null;
  return { people, history, settings };
}

/** 寫入；回傳 false 代表儲存空間不足或被瀏覽器擋下 */
export function persist(state) {
  const ok1 = save('people', state.people);
  const ok2 = save('history', state.history);
  const ok3 = save('settings', state.settings);
  return ok1 && ok2 && ok3;
}

export function upsertPerson(state, person) {
  const clean = sanitizePerson(person);
  if (!clean) return { ok: false, error: '資料不完整，沒有存成功' };
  const exists = state.people.some((p) => p.id === clean.id);
  if (!exists && state.people.length >= LIMITS.people) return { ok: false, error: `名單最多 ${LIMITS.people} 人` };
  const people = exists ? state.people.map((p) => (p.id === clean.id ? clean : p)) : [...state.people, clean];
  return { ok: true, state: { ...state, people }, person: clean };
}

export function deletePerson(state, id) {
  const people = state.people.filter((p) => p.id !== id);
  const settings = { ...state.settings, activeId: state.settings.activeId === id ? people[0]?.id || null : state.settings.activeId };
  const history = state.history.map((h) => (h.personId === id ? { ...h, personId: null } : h));
  return { ...state, people, settings, history };
}

export function appendHistory(state, entry) {
  return { ...state, history: addHistory(state.history, { id: newId('h'), ...entry }) };
}

export function backupJson(state) {
  return JSON.stringify(exportData(state), null, 2);
}

/** 解析匯入檔；mode = 'merge' 合併、'replace' 取代 */
export function importBackup(state, text, mode) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: '檔案不是有效的 JSON 備份檔' };
  }
  const v = validateBackup(data);
  if (!v.ok) return v;
  const next = mode === 'replace' ? v.value : mergeData(state, v.value);
  if (!next.people.some((p) => p.id === next.settings.activeId)) next.settings = { ...next.settings, activeId: next.people[0]?.id || null };
  return { ok: true, state: next, skipped: v.skipped, counts: { people: v.value.people.length, history: v.value.history.length } };
}

export function wipeAll() {
  removeAll();
  return { people: [], history: [], settings: sanitizeSettings(null) };
}
