// 離線快取：App 檔案先從快取讀（秒開、沒網路也能用），同時在背景抓新版更新快取。
// 只處理同網域的 GET；AI Worker（跨網域）一律直接走網路，不快取。
// 發佈新版時把 VERSION 改掉，舊快取會被清除。

const VERSION = 'star-2026-11-23-1';

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
  './js/views/fortune.js',
  './js/views/match.js',
  './js/views/me.js',
  './js/views/tarot.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
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

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
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
      return new Response('離線中，且此檔案尚未快取。', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }),
  );
});
