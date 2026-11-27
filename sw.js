// 離線快取：App 檔案先從快取讀（秒開、沒網路也能用），同時在背景抓新版更新快取。
// 只處理同網域的 GET；AI Worker（跨網域）一律直接走網路，不快取。
// 發佈新版時 VERSION 要跟 js/version.js 的 APP_VER、version.json 一致（tests/pwa.test.js 會檢查），
// 舊快取會在新版啟用時清除。

const VERSION = '2026.11.27-10';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './vendor/astronomy.min.js',
  './vendor/lunar.js',
  './vendor/iztro.js',
  './vendor/shared-chunk.js',
  './js/app.js',
  './js/config.js',
  './js/version.js',
  './js/core/astro.js',
  './js/core/bazi.js',
  './js/core/calendar.js',
  './js/core/chenggu.js',
  './js/core/maya.js',
  './js/core/maya-kin.js',
  './js/core/lifeline.js',
  './js/core/lifeline-texts.js',
  './js/core/ics.js',
  './js/core/reminders.js',
  './js/core/compass.js',
  './js/core/couple.js',
  './js/core/jobs.js',
  './js/core/occupations.js',
  './js/core/work-profile.js',
  './js/core/wages.js',
  './js/core/quiz.js',
  './js/core/hour-windows.js',
  './js/core/hours.js',
  './js/core/trait-check.js',
  './js/core/maya-master.js',
  './js/core/master-texts.js',
  './js/core/sky.js',
  './js/core/palm-lines.js',
  './js/core/emerging.js',
  './js/core/ziwei-summary.js',
  './js/core/speech.js',
  './js/ui/speak.js',
  './js/ui/ics-export.js',
  './js/ui/compass-live.js',
  './js/ui/master.js',
  './js/ui/orientation.js',
  './js/ui/ar-sky.js',
  './js/ui/hand-detect.js',
  './js/core/maya-texts.js',
  './js/core/privacy.js',
  './js/core/numerology.js',
  './js/core/records.js',
  './js/core/ziwei.js',
  './js/core/name.js',
  './js/core/name-texts.js',
  './js/core/zhuyin.js',
  './js/core/kangxi-data.js',
  './js/core/timing.js',
  './js/core/windfall.js',
  './js/core/reading.js',
  './js/core/reading-texts.js',
  './js/core/daily.js',
  './js/core/blood.js',
  './js/core/career.js',
  './js/core/fengshui.js',
  './js/core/fengshui-fix.js',
  './js/core/geju.js',
  './js/core/ziwei-pattern.js',
  './js/core/tarot-reading.js',
  './js/core/palm.js',
  './js/core/undo.js',
  './js/core/palm-texts.js',
  './js/core/tarot-deck.js',
  './js/core/zip.js',
  './js/core/family.js',
  './js/core/iching.js',
  './js/core/liuyao.js',
  './js/core/iching-texts.js',
  './js/core/jiehuo.js',
  './js/core/date.js',
  './js/core/fortune.js',
  './js/core/natal.js',
  './js/core/places.js',
  './js/core/synastry.js',
  './js/core/tarot.js',
  './js/core/tz.js',
  './js/core/zodiac.js',
  './js/core/zh.js',
  './js/core/zh-data.js',
  './js/ui/ai.js',
  './js/ui/birthform.js',
  './js/ui/dom.js',
  './js/ui/charts.js',
  './js/ui/palm-chart.js',
  './js/ui/palm-photo.js',
  './js/ui/maya-glyphs.js',
  './js/ui/tarot-art.js',
  './js/ui/tarot-ritual.js',
  './js/ui/deck-store.js',
  './js/ui/palette.js',
  './js/ui/poster.js',
  './js/ui/records-store.js',
  './js/ui/storage.js',
  './js/ui/update.js',
  './js/ui/motion.js',
  './js/ui/icons.js',
  './js/ui/widgets.js',
  './js/views/destiny.js',
  './js/views/fortune.js',
  './js/views/match.js',
  './js/views/me.js',
  './js/views/tarot.js',
  './js/views/today.js',
  './js/views/oracle.js',
  './js/views/jiehuo.js',
  './js/views/profile.js',
  './js/views/tool-blood.js',
  './js/views/tool-palm.js',
  './js/views/tool-career.js',
  './js/views/tool-hours.js',
  './js/views/job-picker.js',
  './js/views/multi-picker.js',
  './js/views/quiz-card.js',
  './js/views/tool-fengshui.js',
  './js/views/tool-family.js',
  './js/views/lotto.js',
];

// version.json 用來偵測新版，必須每次都問伺服器，不能被快取住
const NETWORK_ONLY = ['version.json'];

// 行事曆檔：頁面在手機上產生後放進這個快取（js/ui/ics-export.js），這裡用 text/calendar 回給瀏覽器，
// iPhone 的 Safari 才會問要不要加入行事曆。換版時不能清掉；一律不連網路（伺服器上沒有這個檔，內容只在手機上）。
const ICS_CACHE = 'star-ics';
const ICS_PATH = '/cal/reminders.ics';
// 掌紋自動定位的辨識模型與程式（vendor/mediapipe，約 22MB）：不放進上面的預先快取（每個人安裝都要多抓 22MB），
// 按了才下載，存進這個獨立快取，App 換版也不重抓；MediaPipe 換版本時改這個名稱，舊的會在啟用時清掉。
const MP_CACHE = 'star-mediapipe-1.2.2';
const MP_DIR = '/vendor/mediapipe/';
const icsMissing = () => new Response(
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<meta name="robots" content="noindex, nofollow"><title>行事曆提醒</title>'
  + '<p style="font:17px/1.6 system-ui,sans-serif;padding:24px">提醒檔已經過期了。請回到 App 的「人生時間軸」，再按一次「加到行事曆」。</p>'
  + '<p style="font:17px/1.6 system-ui,sans-serif;padding:0 24px"><a href="../">回到 App</a></p>',
  { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // cache: 'reload' 跳過瀏覽器 HTTP 快取（GitHub Pages 會快取 10 分鐘），確保存進來的是新版檔案
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== ICS_CACHE && k !== MP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NETWORK_ONLY.some((name) => url.pathname.endsWith(`/${name}`))) return;
  if (url.pathname.includes(MP_DIR)) {
    event.respondWith(caches.open(MP_CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req); // guardrails: ignore（同網域靜態檔，失敗時頁面會說明並讓使用者手動點）
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.pathname.endsWith(ICS_PATH)) {
    event.respondWith(caches.open(ICS_CACHE).then((c) => c.match(req, { ignoreSearch: true })).then((res) => res || icsMissing()));
    return;
  }

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      // 背景更新快取；失敗不重試：使用者手上已有快取版本，下次開啟會再抓，重試只會拖慢離線時的回應
      const network = fetch(req) // guardrails: ignore（同網域靜態檔，快取優先，不需退避）
        .then((res) => {
          if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return new Response('離線中，且此檔案尚未快取。請連上網路後重新開啟。', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }),
  );
});
