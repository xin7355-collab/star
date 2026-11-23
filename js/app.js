// 主程式：分頁切換、共用的提示訊息與分享面板、記住使用者資料。

import { $ } from './ui/dom.js';
import { load, save, removeAll } from './ui/storage.js';
import { readRaw } from './ui/birthform.js';
import { buildNatal } from './core/natal.js';
import { sharePoster } from './ui/poster.js';
import { mountMe } from './views/me.js';
import { mountFortune } from './views/fortune.js';
import { mountMatch } from './views/match.js';
import { mountTarot } from './views/tarot.js';

const VIEWS = ['me', 'fortune', 'match', 'tarot'];
const TITLES = { me: '我的星盤', fortune: '運勢', match: '配對', tarot: '塔羅' };

let profile = load('profile');
let natal = null;
const listeners = [];

function computeNatal(raw) {
  const r = readRaw(raw);
  if (!r.ok) return null;
  const n = buildNatal(r.value);
  return n.ok ? n : null;
}

if (profile) {
  natal = computeNatal(profile);
  if (!natal) profile = null; // 舊資料無效時當作沒填
}

// ── 提示訊息
let toastTimer = null;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3200);
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

// ── 分頁
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
}
document.querySelectorAll('.tabbar [data-view]').forEach((btn) => btn.addEventListener('click', () => go(btn.dataset.view)));

const ctx = {
  getProfile: () => profile,
  getNatal: () => natal,
  setProfile(raw, n) {
    profile = raw;
    natal = n;
    save('profile', raw);
    listeners.forEach((fn) => fn());
  },
  clearProfile() {
    profile = null;
    natal = null;
    removeAll();
    listeners.forEach((fn) => fn());
  },
  onProfile(fn) {
    listeners.push(fn);
  },
  go,
  toast,
  share(spec, filename) {
    sharePoster(spec, { filename, sheet }).catch((err) => toast(err.message || '分享失敗'));
  },
};

mountMe($('#view-me'), ctx);
mountFortune($('#view-fortune'), ctx);
mountMatch($('#view-match'), ctx);
mountTarot($('#view-tarot'), ctx);

// 有資料就直接看自己的運勢；沒有就先填生日
const lastView = load('view');
go(profile ? (VIEWS.includes(lastView) && lastView !== 'me' ? lastView : 'fortune') : 'me');

// 離線快取（只在 https 或 localhost 註冊）
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
