// 離線快取：App 檔案先從快取讀（秒開、沒網路也能用），同時在背景抓新版更新快取。
// 只處理同網域的 GET；AI Worker（跨網域）一律直接走網路，不快取。
// 發佈新版時 VERSION 要跟 js/version.js 的 APP_VER、version.json 一致（tests/pwa.test.js 會檢查），
// 舊快取會在新版啟用時清除。

const VERSION = '2026.11.24-2';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './vendor/astronomy.min.js',
  './js/app.js',
  './js/config.js',
  './js/version.js',
  './js/core/astro.js',
  './js/core/date.js',
  './js/core/fortune.js',
  './js/core/natal.js',
  './js/core/places.js',
  './js/core/synastry.js',
  './js/core/tarot.js',
  './js/core/tz.js',
  './js/core/zodiac.js',
  './js/ui/ai.js',
  './js/ui/birthform.js',
  './js/ui/dom.js',
  './js/ui/poster.js',
  './js/ui/storage.js',
  './js/ui/update.js',
  './js/views/fortune.js',
  './js/views/match.js',
  './js/views/me.js',
  './js/views/tarot.js',
];

// version.json 用來偵測新版，必須每次都問伺服器，不能被快取住
const NETWORK_ONLY = ['version.json'];

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
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NETWORK_ONLY.some((name) => url.pathname.endsWith(`/${name}`))) return;

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
