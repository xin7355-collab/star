// 最小的 ZIP 打包（只「儲存」不壓縮）：自訂牌組匯出成一個檔，方便整副傳給別人或上傳。
// 為什麼不壓縮：牌圖已經是 JPEG，再壓也省不了多少；只儲存就不用帶壓縮函式庫，iPhone「檔案」App 點一下就能解開。
// 檔名用 UTF-8（旗標 bit 11），中文牌名在 iPhone、Windows、Mac 都顯示正常。純函式，可在 Node 測試。

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32（ZIP 用的那一種）；檢查值：「123456789」→ 0xCBF43926 */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 日期 → DOS 格式的時間、日期（ZIP 檔頭用；1980 年以前一律當 1980-01-01） */
function dosTime(date) {
  const y = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((y - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * 打包成 ZIP。回傳一段一段的 Uint8Array（給 new Blob(parts) 用，不必在記憶體裡再接成一大塊）。
 * @param {{name:string, data:Uint8Array}[]} entries 檔名不能重複
 * @param {Date} [date] 檔案時間（測試時固定）
 */
export function zipStore(entries, date = new Date()) {
  const enc = new TextEncoder();
  const { time, day } = dosTime(date);
  const parts = [];
  const central = [];
  let offset = 0;
  const seen = new Set();
  for (const { name, data } of entries) {
    if (seen.has(name)) throw new Error(`檔名重複：${name}`);
    seen.add(name);
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const head = new Uint8Array(30 + nameBytes.length);
    const v = new DataView(head.buffer);
    v.setUint32(0, 0x04034b50, true); // 本機檔頭
    v.setUint16(4, 20, true); // 需要的版本 2.0
    v.setUint16(6, 0x0800, true); // 檔名是 UTF-8
    v.setUint16(8, 0, true); // 只儲存
    v.setUint16(10, time, true);
    v.setUint16(12, day, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, 0, true);
    head.set(nameBytes, 30);
    parts.push(head, data);
    const cd = new Uint8Array(46 + nameBytes.length);
    const w = new DataView(cd.buffer);
    w.setUint32(0, 0x02014b50, true); // 中央目錄
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(8, 0x0800, true);
    w.setUint16(10, 0, true);
    w.setUint16(12, time, true);
    w.setUint16(14, day, true);
    w.setUint32(16, crc, true);
    w.setUint32(20, data.length, true);
    w.setUint32(24, data.length, true);
    w.setUint16(28, nameBytes.length, true);
    w.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);
    offset += head.length + data.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); // 中央目錄結尾
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, cdSize, true);
  e.setUint32(16, offset, true);
  return [...parts, ...central, end];
}
