// 版本自動更新：手機上開著舊版頁面時，偵測到 version.json 的版本不同，就請 service worker 更新並重載一次。
// 為什麼要這樣：service worker 先用快取開啟（秒開、離線可用），不主動檢查的話使用者會一直看到舊版。
// 防止無限重載：同一個新版本在這個分頁只重載一次（sessionStorage 記住）。

import { APP_VER } from '../version.js';

const RELOAD_KEY = 'star.reloadedFor';

async function fetchRemoteVersion() {
  if (navigator.onLine === false) return null; // 離線時不必問，也避免瀏覽器記一筆失敗請求
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null; // 離線或暫時連不上：照用目前版本，不打擾使用者
  }
}

function alreadyReloadedFor(version) {
  try {
    return sessionStorage.getItem(RELOAD_KEY) === version;
  } catch {
    return false;
  }
}

function markReloaded(version) {
  try {
    sessionStorage.setItem(RELOAD_KEY, version);
  } catch {
    /* 無法記錄時寧可不重載，避免迴圈 */
  }
}

export async function checkForUpdate({ onUpdating } = {}) {
  const remote = await fetchRemoteVersion();
  if (!remote || remote === APP_VER || alreadyReloadedFor(remote)) return false;
  markReloaded(remote);
  onUpdating?.(remote);
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
  if (reg) {
    // 新版 service worker 安裝後會 skipWaiting + clients.claim，接手時觸發 controllerchange 再重載
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    try {
      await reg.update();
    } catch {
      window.location.reload();
      return true;
    }
    // 保險：20 秒內沒接手就直接重載；新版安裝完成後下次開啟就是新版（不會因此無限重載）
    setTimeout(() => window.location.reload(), 20000);
  } else {
    window.location.reload();
  }
  return true;
}

export function startUpdateWatcher(options) {
  checkForUpdate(options);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate(options);
  });
}
