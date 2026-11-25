// ZIP 打包（自訂牌組匯出用）：CRC-32 檢查值、檔頭結構、中文檔名、可以照中央目錄把每個檔案讀回來。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, zipStore } from '../js/core/zip.js';

const concat = (parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

test('CRC-32：標準檢查值與空資料', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('打包後照中央目錄讀回每個檔：檔名（中文）、大小、CRC、內容都一致', () => {
  const enc = new TextEncoder();
  const files = [
    { name: '愚者.jpg', data: enc.encode('fool-image-bytes') },
    { name: '聖杯三.jpg', data: new Uint8Array([0, 255, 1, 254, 2, 253]) },
    { name: 'back.jpg', data: new Uint8Array(0) },
  ];
  const zip = concat(zipStore(files, new Date(2026, 10, 25, 9, 30, 0)));
  const v = new DataView(zip.buffer);
  // 結尾紀錄在最後 22 bytes
  const end = zip.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50);
  assert.equal(v.getUint16(end + 10, true), 3);
  let p = v.getUint32(end + 16, true);
  const dec = new TextDecoder();
  for (const f of files) {
    assert.equal(v.getUint32(p, true), 0x02014b50);
    assert.equal(v.getUint16(p + 8, true) & 0x0800, 0x0800); // UTF-8 檔名
    const size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    assert.equal(dec.decode(zip.subarray(p + 46, p + 46 + nameLen)), f.name);
    assert.equal(size, f.data.length);
    assert.equal(v.getUint32(p + 16, true), crc32(f.data));
    // 本機檔頭後面接的就是原始內容
    assert.equal(v.getUint32(local, true), 0x04034b50);
    const lname = v.getUint16(local + 26, true);
    assert.deepEqual([...zip.subarray(local + 30 + lname, local + 30 + lname + size)], [...f.data]);
    p += 46 + nameLen;
  }
  // DOS 日期：2026-11-25
  const day = v.getUint16(12, true);
  assert.deepEqual([(day >> 9) + 1980, (day >> 5) & 15, day & 31], [2026, 11, 25]);
});

test('檔名重複會擋下（同一張牌不能出現兩次）', () => {
  assert.throws(() => zipStore([{ name: 'a.jpg', data: new Uint8Array(1) }, { name: 'a.jpg', data: new Uint8Array(1) }]), /重複/);
});
