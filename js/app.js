// 主程式：分頁切換、名單／紀錄狀態、提示訊息與分享面板。
// 命理分頁（八字、紫微等）用到才載入，讓第一次開啟更快。

import { $ } from './ui/dom.js';
import { load, save } from './ui/storage.js';
import { readRaw } from './ui/birthform.js';
import { buildNatal } from './core/natal.js';
import { sharePoster, shareFile } from './ui/poster.js';
import * as store from './ui/records-store.js';
import { mountMe } from './views/me.js';
import { mountFortune } from './views/fortune.js';
import { mountMatch } from './views/match.js';
import { mountTarot } from './views/tarot.js';
import { startUpdateWatcher } from './ui/update.js';

const VIEWS = ['me', 'fortune', 'destiny', 'match', 'tarot'];
const TITLES = { me: '我的', fortune: '運勢', destiny: '命理', match: '配對', tarot: '塔羅' };

let state = store.loadAll();
const natalCache = new Map();
const profileListeners = [];
const historyListeners = [];

// ── 提示訊息
let toastTimer = null;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3500);
}

// ── 分享面板
const sheetEl = $('#sheet');
let onSheetClose = null;
const sheet = {
  body: $('#sheet-body'),
  open(onClose) {
    onSheetClose = onClose;
    sheetEl.hidden = false;
    $('#sheet-close').focus();
  },
  close() {
    sheetEl.hidden = true;
    onSheetClose?.();
    onSheetClose = null;
  },
};
$('#sheet-close').addEventListener('click', () => sheet.close());
sheetEl.addEventListener('click', (e) => {
  if (e.target === sheetEl) sheet.close();
});

// ── 狀態
function inputOf(person) {
  const r = person ? readRaw(person.raw) : { ok: false };
  return r.ok ? r.value : null;
}

function natalOf(person) {
  if (!person) return null;
  const key = `${person.id}|${JSON.stringify(person.raw)}`;
  if (!natalCache.has(key)) {
    const input = inputOf(person);
    const n = input ? buildNatal(input) : null;
    natalCache.set(key, n && n.ok ? n : null);
  }
  return natalCache.get(key);
}

function activePerson() {
  return state.people.find((p) => p.id === state.settings.activeId) || null;
}

function commit(kind) {
  if (!store.persist(state)) toast('手機儲存空間不足或被瀏覽器封鎖，資料沒有存成功。請先匯出備份。');
  if (kind === 'profile' || kind === 'all') {
    natalCache.clear();
    profileListeners.forEach((fn) => fn());
  }
  if (kind === 'history' || kind === 'all') historyListeners.forEach((fn) => fn());
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// ── 分頁
const mounted = new Set();
async function ensureMounted(view) {
  if (mounted.has(view)) return;
  mounted.add(view);
  const el = $(`#view-${view}`);
  if (view === 'destiny') {
    el.textContent = '載入中…';
    try {
      const { mountDestiny } = await import('./views/destiny.js');
      el.textContent = '';
      mountDestiny(el, ctx);
    } catch {
      mounted.delete(view);
      el.textContent = '載入失敗，請確認網路後重新開啟 App。';
    }
  }
}

function go(view) {
  if (!VIEWS.includes(view)) view = 'me';
  for (const v of VIEWS) {
    $(`#view-${v}`).hidden = v !== view;
    const tab = $(`.tabbar [data-view="${v}"]`);
    if (v === view) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  $('#page-title').textContent = TITLES[view];
  document.body.dataset.view = view;
  save('view', view);
  window.scrollTo(0, 0);
  ensureMounted(view);
}
document.querySelectorAll('.tabbar [data-view]').forEach((btn) => btn.addEventListener('click', () => go(btn.dataset.view)));

const ctx = {
  getPeople: () => state.people,
  getActive: activePerson,
  getNatal: () => natalOf(activePerson()),
  natalOf,
  inputOf,
  getSettings: () => state.settings,
  saveSettings(patch) {
    state = { ...state, settings: { ...state.settings, ...patch } };
    commit('profile');
  },
  savePerson(person, { activate = false } = {}) {
    const r = store.upsertPerson(state, person);
    if (!r.ok) return r;
    state = r.state;
    if (activate || !state.settings.activeId) state = { ...state, settings: { ...state.settings, activeId: r.person.id } };
    commit('profile');
    navigator.storage?.persist?.().catch(() => {});
    return r;
  },
  deletePerson(id) {
    state = store.deletePerson(state, id);
    commit('all');
  },
  setActive(id) {
    if (!state.people.some((p) => p.id === id)) return;
    state = { ...state, settings: { ...state.settings, activeId: id } };
    commit('profile');
  },
  getHistory: () => state.history,
  addHistory(entry) {
    state = store.appendHistory(state, { personId: state.settings.activeId, ...entry });
    commit('history');
  },
  deleteHistory(id) {
    state = { ...state, history: state.history.filter((h) => h.id !== id) };
    commit('history');
  },
  clearHistory() {
    state = { ...state, history: [] };
    commit('history');
  },
  exportBackup() {
    const blob = new Blob([store.backupJson(state)], { type: 'application/json' });
    shareFile(blob, `star-backup-${todayStamp()}.json`, { sheet, hint: '備份檔請存到「檔案」或雲端硬碟，換手機時用「匯入備份檔」還原。' })
      .catch(() => toast('匯出失敗'));
  },
  importBackup(text, mode) {
    const r = store.importBackup(state, text, mode);
    if (r.ok) {
      state = r.state;
      commit('all');
    }
    return r;
  },
  wipeAll() {
    state = store.wipeAll();
    commit('all');
    go('me');
  },
  onProfile(fn) {
    profileListeners.push(fn);
  },
  onHistory(fn) {
    historyListeners.push(fn);
  },
  go,
  toast,
  sheet,
  share(spec, filename) {
    sharePoster(spec, { filename, sheet }).catch((err) => toast(err.message || '分享失敗'));
  },
};

mountMe($('#view-me'), ctx);
mountFortune($('#view-fortune'), ctx);
mountMatch($('#view-match'), ctx);
mountTarot($('#view-tarot'), ctx);
['me', 'fortune', 'match', 'tarot'].forEach((v) => mounted.add(v));

// 有資料就直接看運勢；沒有就先填生日
const lastView = load('view');
go(state.people.length ? (VIEWS.includes(lastView) && lastView !== 'me' ? lastView : 'fortune') : 'me');

// 離線快取（只在 https 或 localhost 註冊）＋偵測新版自動更新
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    startUpdateWatcher({ onUpdating: () => toast('發現新版本，更新中…') });
  });
}
