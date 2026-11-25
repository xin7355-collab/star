// 把行事曆檔（.ics）交給手機的行事曆。
// 為什麼不直接用 blob 下載：iPhone 的 Safari 只有在「網址的回應是 text/calendar」時才會問要不要加入行事曆，
// blob／data 網址常被當成「未知的文件」。所以檔案在手機上產生後先放進快取，再由 service worker 在
// cal/reminders.ics 這個網址回給瀏覽器（sw.js 的 ICS_CACHE、ICS_PATH 要和這裡一致，tests/pwa.test.js 會檢查）。
// 個資不出手機：網址只有固定檔名，伺服器上沒有這個檔，service worker 也不會為它連網路。
// 沒有 service worker 控制這一頁（第一次打開、私密瀏覽）時退回一般下載。

export const ICS_CACHE = 'star-ics';
export const ICS_PATH = 'cal/reminders.ics';
export const ICS_NAME = 'star-reminders.ics';

const icsUrl = () => new URL(ICS_PATH, document.baseURI).href;

/** 放進快取，成功回傳 true；不能用（沒有 service worker、快取被擋）回傳 false */
export async function stageIcs(text) {
  try {
    if (!('caches' in window) || !navigator.serviceWorker || !navigator.serviceWorker.controller) return false;
    const cache = await caches.open(ICS_CACHE);
    await cache.put(icsUrl(), new Response(text, {
      headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="${ICS_NAME}"` },
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * 打開行事曆檔（要在點擊當下呼叫）。放好了就前往那個網址：Safari 會問要不要加入行事曆，
 * 其他瀏覽器會下載，頁面都留在原地；沒放好就用一般下載。
 * @returns {'navigate'|'download'}
 */
export function openIcs(text, staged) {
  if (staged) {
    window.location.assign(icsUrl());
    return 'navigate';
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: ICS_NAME, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  // 下載是非同步開始的，馬上釋放網址會讓有些瀏覽器抓不到檔案
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'download';
}
