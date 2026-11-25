// 主程式：分頁切換、名單／紀錄狀態、提示訊息與分享面板。
// 五個分頁：今日（預設）、時運、命盤、占卜、我的。時運、命盤、占卜第一次打開才載入，讓開 App 更快。

import { $, clear, h, fill } from './ui/dom.js';
import { load, save } from './ui/storage.js';
import { readRaw } from './ui/birthform.js';
import { buildNatal } from './core/natal.js';
import { sharePoster, shareFile } from './ui/poster.js';
import { anonymizeSpec, namesOf } from './core/privacy.js';
import * as store from './ui/records-store.js';
import { mountMe } from './views/me.js';
import { mountToday } from './views/today.js';
import { startUpdateWatcher } from './ui/update.js';
import { enterView, applyMotion } from './ui/motion.js';
import { zoneToday, DEFAULT_TZ } from './core/tz.js';

const VIEWS = ['today', 'fortune', 'destiny', 'oracle', 'me'];
const TITLES = { today: '今日', fortune: '時運', destiny: '命盤', oracle: '占卜', me: '我的' };
// 第一次打開才載入的分頁
const LAZY = {
  fortune: () => import('./views/fortune.js').then((m) => m.mountFortune),
  destiny: () => import('./views/destiny.js').then((m) => m.mountDestiny),
  oracle: () => import('./views/oracle.js').then((m) => m.mountOracle),
};
const viewApis = {};

let state = store.loadAll();
applyMotion(state.settings.motion);
const natalCache = new Map();
const profileListeners = [];
// 目前顯示的分頁（頁首的切換人、go() 都要看；放在最前面，載入時就呼叫也不會碰到還沒宣告的 let）
let current = null;
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
let sheetOpener = null;
const sheet = {
  body: $('#sheet-body'),
  open(onClose) {
    onSheetClose = onClose;
    sheetOpener = document.activeElement;
    sheetEl.hidden = false;
    $('#sheet-close').focus();
  },
  close() {
    sheetEl.hidden = true;
    onSheetClose?.();
    onSheetClose = null;
    // 關掉後焦點回到剛才按的按鈕，鍵盤、螢幕閱讀器使用者才不會被丟回頁首
    if (sheetOpener && sheetOpener.isConnected) sheetOpener.focus({ preventScroll: true });
    sheetOpener = null;
  },
};
$('#sheet-close').addEventListener('click', () => sheet.close());
sheetEl.addEventListener('click', (e) => {
  if (e.target === sheetEl) sheet.close();
});
// 對話框慣例：Esc 關閉（外接鍵盤、電腦上用）
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sheetEl.hidden) sheet.close();
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

// 頁首的「目前查看的人」：每一頁同一個位置，改的是全域的 activeId，今日、時運、命盤、占卜一起換。
// 之前命盤有自己的「看誰」，只換命盤一頁，回到今日還是原本的人。2 人以上才出現；「我的」頁有自己的切換，不重複放。
function paintWho() {
  const sel = $('#who');
  const show = state.people.length >= 2 && current !== 'me';
  sel.hidden = !show;
  if (!show) return;
  fill(sel, ...state.people.map((p) => h('option', { value: p.id, text: p.self ? `${p.name}（我）` : p.name })));
  sel.value = activePerson()?.id || state.people[0].id;
}

function commit(kind) {
  if (!store.persist(state)) toast('手機儲存空間不足或被瀏覽器封鎖，資料沒有存成功。請先匯出備份。');
  if (kind === 'profile' || kind === 'all') {
    natalCache.clear();
    paintWho();
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
  if (mounted.has(view)) return viewApis[view];
  mounted.add(view);
  const el = $(`#view-${view}`);
  if (LAZY[view]) {
    clear(el);
    const loading = document.createElement('p');
    loading.className = 'muted center';
    loading.textContent = '載入中…';
    el.append(loading);
    try {
      const mount = await LAZY[view]();
      clear(el);
      viewApis[view] = mount(el, ctx) || {};
    } catch {
      mounted.delete(view);
      el.textContent = '載入失敗，請確認網路後重新開啟 App。';
    }
  }
  return viewApis[view];
}

async function go(view, opts) {
  if (!VIEWS.includes(view)) view = state.people.length ? 'today' : 'me';
  const changed = view !== current;
  current = view;
  VIEWS.forEach((v, i) => {
    $(`#view-${v}`).hidden = v !== view;
    const tab = $(`.tabbar [data-view="${v}"]`);
    if (v === view) {
      tab.setAttribute('aria-current', 'page');
      $('.tabbar').style.setProperty('--tab', String(i));
    } else tab.removeAttribute('aria-current');
  });
  $('#page-title').textContent = TITLES[view];
  $('#page-sub').textContent = view === 'today' ? todayLabel() : '';
  document.body.dataset.view = view;
  paintWho();
  save('view', view);
  window.scrollTo(0, 0);
  if (changed) enterView($(`#view-${view}`));
  const api = await ensureMounted(view);
  if (opts && api && api.open) api.open(opts);
}
document.querySelectorAll('.tabbar [data-view]').forEach((btn) => btn.addEventListener('click', () => go(btn.dataset.view)));
$('#who').addEventListener('change', (e) => ctx.setActive(e.target.value));

// 頁首日期和「今日」內容用同一個時區（台灣）：用手機本地時間的話，人在國外時頁首和內容會差一天
function todayLabel() {
  const t = zoneToday(DEFAULT_TZ);
  return `${t.m}/${t.d}（${'日一二三四五六'[new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay()]}）`;
}

const ctx = {
  getPeople: () => state.people,
  getActive: activePerson,
  getNatal: () => natalOf(activePerson()),
  natalOf,
  inputOf,
  getSettings: () => state.settings,
  saveSettings(patch) {
    state = { ...state, settings: { ...state.settings, ...patch } };
    applyMotion(state.settings.motion);
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
    // 自訂牌組的圖在 IndexedDB，也要一起清掉（「清除這支手機上的全部資料」不能漏）
    import('./ui/deck-store.js').then((m) => m.clearDeck()).catch(() => {});
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
    // 匿名版要藏的名字：名單上每個人的暱稱、本名、藝名（配對、家人的圖卡會出現別人的名字）
    const anonymize = (s) => anonymizeSpec(s, namesOf(state.people));
    sharePoster(spec, { filename, sheet, anonymize, notify: toast }).catch((err) => toast(err.message || '圖卡產生失敗，請再試一次'));
  },
};

mountMe($('#view-me'), ctx);
viewApis.today = mountToday($('#view-today'), ctx);
['me', 'today'].forEach((v) => mounted.add(v));

// 有資料就打開上次看的分頁（預設「今日」）；沒有就先填生日
const lastView = load('view');
go(state.people.length ? (VIEWS.includes(lastView) && lastView !== 'me' ? lastView : 'today') : 'me');

// 離線快取（只在 https 或 localhost 註冊）＋偵測新版自動更新
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    startUpdateWatcher({ onUpdating: () => toast('發現新版本，更新中…') });
  });
}
