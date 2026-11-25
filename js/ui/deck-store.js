// 自訂牌組的圖片倉庫：只存在這支手機的 IndexedDB，不上傳、也不放進備份檔（圖太大）。
// 匯入時一張一張處理、先縮成最高 720px 的 JPEG：一次解開幾十張 iPhone 原圖會把記憶體吃光。
// 私密瀏覽或空間不足時給能照做的錯誤訊息，不會讓塔羅壞掉（缺的牌照常用內建牌面）。

import { matchCardFile } from '../core/tarot-deck.js';
import { DECK } from '../core/tarot.js';

const DB_NAME = 'star-deck';
const STORE = 'cards';
// 放大看牌時，iPhone 上的牌約 236 點寬（3 倍螢幕 ≈ 700 像素）：600×1000 夠清楚，一張約 150～250KB
const MAX_W = 600;
const MAX_H = 1000;
const VALID_IDS = new Set([...DECK.map((d) => d.id), 'back']);
const MAX_FILE = 30 * 1024 * 1024;

let urls = new Map(); // 牌 id（或 back）→ object URL，給牌面用

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('這個瀏覽器不能存圖片（可能是私密瀏覽），自訂牌組無法使用；內建牌面照常可以抽。'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('手機的瀏覽器拒絕存圖片（可能是私密瀏覽或空間不足），自訂牌組無法使用。'));
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      let result;
      Promise.resolve(fn(store)).then((r) => { result = r; });
      t.oncomplete = () => resolve(result);
      t.onabort = () => reject(t.error && t.error.name === 'QuotaExceededError' ? new Error('手機空間不足，存不下更多牌圖。請先清掉一些照片或 App 資料再試。') : new Error('存圖片失敗，請再試一次。'));
      t.onerror = () => {};
    });
  } finally {
    db.close();
  }
}
const reqP = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/** 縮圖：一次只解一張；回傳 JPEG Blob */
async function shrink(file) {
  if (file.size > MAX_FILE) throw new Error('檔案超過 30MB');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('圖片打不開'));
      im.src = url;
    });
    const k = Math.min(1, MAX_W / img.naturalWidth, MAX_H / img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    img.removeAttribute('src');
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    canvas.width = 0;
    if (!blob) throw new Error('圖片轉檔失敗');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 匯入一批圖檔：檔名對到牌才存；同一張牌後面的檔案覆蓋前面的（使用者重新匯入就是要換圖）。
 * @returns {Promise<{saved:number, unknown:string[], failed:{name:string, reason:string}[]}>}
 */
export async function importFiles(files, { onProgress } = {}) {
  const list = [...files];
  const unknown = [];
  const failed = [];
  let saved = 0;
  for (let i = 0; i < list.length; i += 1) {
    const file = list[i];
    onProgress?.(i + 1, list.length);
    const m = matchCardFile(file.name);
    if (!m) {
      unknown.push(file.name);
      continue;
    }
    try {
      const blob = await shrink(file);
      // 存 ArrayBuffer 不存 Blob：Safari 無痕瀏覽的 IndexedDB 存不了 Blob（會整筆失敗），ArrayBuffer 可以
      const data = await blob.arrayBuffer();
      await tx('readwrite', (store) => { store.put({ type: blob.type || 'image/jpeg', data }, m.back ? 'back' : m.id); });
      saved += 1;
    } catch (err) {
      failed.push({ name: file.name, reason: err.message || '讀不進來' });
      // 空間不足時後面的也存不進去，直接停
      if (/空間不足/.test(err.message || '')) break;
    }
  }
  return { saved, unknown, failed };
}

/** 逐張換圖：直接指定是哪張牌（不用靠檔名，iPhone 相簿裡的照片改不了檔名） */
export async function saveCardImage(id, file) {
  if (!VALID_IDS.has(id)) throw new Error('不認得這張牌');
  const blob = await shrink(file);
  const data = await blob.arrayBuffer();
  await tx('readwrite', (store) => { store.put({ type: blob.type || 'image/jpeg', data }, id); });
}

/** 拿掉一張牌的自訂圖，改回內建牌面 */
export async function removeCard(id) {
  await tx('readwrite', (store) => { store.delete(id); });
}

/** 匯出用：所有自訂圖的 { id, type, data }（舊格式的 Blob 也一起轉成位元組） */
export async function readAll() {
  const entries = await tx('readonly', async (store) => {
    const [keys, values] = await Promise.all([reqP(store.getAllKeys()), reqP(store.getAll())]);
    return keys.map((k, i) => [String(k), values[i]]);
  });
  const out = [];
  for (const [id, v] of entries || []) {
    if (v instanceof Blob) out.push({ id, type: v.type || 'image/jpeg', data: new Uint8Array(await v.arrayBuffer()) });
    else if (v && v.data instanceof ArrayBuffer) out.push({ id, type: v.type || 'image/jpeg', data: new Uint8Array(v.data) });
  }
  return out;
}

/** 讀出所有牌圖，換成 object URL（舊的先釋放） */
export async function loadDeck() {
  const entries = await tx('readonly', async (store) => {
    const [keys, values] = await Promise.all([reqP(store.getAllKeys()), reqP(store.getAll())]);
    return keys.map((k, i) => [String(k), values[i]]);
  });
  for (const u of urls.values()) URL.revokeObjectURL(u);
  const toBlob = (v) => (v instanceof Blob ? v : v && v.data instanceof ArrayBuffer ? new Blob([v.data], { type: v.type || 'image/jpeg' }) : null);
  urls = new Map((entries || []).map(([k, v]) => [k, toBlob(v)]).filter(([, b]) => b).map(([k, b]) => [k, URL.createObjectURL(b)]));
  return urls;
}

/** 目前載入的牌圖（沒載入或沒有就是空的） */
export function deckUrls() {
  return urls;
}

/** 清掉整個自訂牌組 */
export async function clearDeck() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls = new Map();
  if (typeof indexedDB === 'undefined') return;
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
