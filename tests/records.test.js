import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePerson, sanitizeRaw, sanitizeSettings, validateBackup, mergeData, addHistory, exportData, LIMITS, newId } from '../js/core/records.js';

const raw = { calendar: 'solar', era: 'roc', year: '79', month: '8', day: '15', knowTime: true, time: '06:20', placeId: 'taipei', tz: 'Asia/Taipei' };

test('名單：白名單欄位、名字長度與控制字元', () => {
  const p = sanitizePerson({ name: '小明\u0000\u0007<script>alert(1)</script>超過二十個字超過二十個字', gender: '男', raw, evil: 'x', __proto__: { polluted: true } });
  assert.ok(p.name.length <= LIMITS.name);
  assert.ok(!/[\u0000-\u001f]/.test(p.name));
  assert.equal('evil' in p, false);
  assert.equal({}.polluted, undefined);
  assert.equal(p.raw.year, 79);
  assert.equal(p.gender, '男');
});

test('出生資料：農曆生日要帶換算好的國曆；時間格式錯就當沒填', () => {
  assert.equal(sanitizeRaw({ ...raw, calendar: 'lunar', leap: true }), null);
  const ok = sanitizeRaw({ ...raw, calendar: 'lunar', leap: true, solar: { y: 2023, m: 4, d: 5 } });
  assert.deepEqual(ok.solar, { y: 2023, m: 4, d: 5 });
  assert.equal(ok.leap, true);
  assert.equal(sanitizeRaw({ ...raw, time: '25:99' }).knowTime, false);
  assert.equal(sanitizeRaw({ ...raw, tz: '../../etc' }).tz, 'Asia/Taipei');
});

test('備份檔驗證：拒絕非本 App 的檔案、版本不符與異常資料量', () => {
  assert.equal(validateBackup(null).ok, false);
  assert.equal(validateBackup([]).ok, false);
  assert.equal(validateBackup({ app: 'other', schema: 1 }).ok, false);
  assert.equal(validateBackup({ app: 'star', schema: 99 }).ok, false);
  assert.equal(validateBackup({ app: 'star', schema: 1, people: new Array(1000).fill({}) }).ok, false);
});

test('備份檔驗證：壞掉的資料略過並回報數量', () => {
  const data = exportData({
    people: [{ id: 'p-0123456789abcdef', name: 'A', raw }, { name: 'bad' }],
    history: [{ type: 'tarot', at: '2026-11-24T00:00:00Z', title: 'x' }, { type: 'hack', at: 'x' }],
    settings: { activeId: 'p-0123456789abcdef', sect: 2 },
  });
  const r = validateBackup(JSON.parse(JSON.stringify(data)));
  assert.equal(r.ok, true);
  assert.equal(r.value.people.length, 1);
  assert.equal(r.value.history.length, 1);
  assert.equal(r.skipped, 2);
  assert.equal(r.value.settings.sect, 2);
});

test('紀錄：新的放最前面、超過上限丟最舊；過大的細節不存', () => {
  let list = [];
  for (let i = 0; i < LIMITS.history + 5; i += 1) list = addHistory(list, { type: 'tarot', title: `#${i}` });
  assert.equal(list.length, LIMITS.history);
  assert.equal(list[0].title, `#${LIMITS.history + 4}`);
  const big = addHistory([], { type: 'match', title: 'big', detail: { s: 'x'.repeat(LIMITS.detailBytes + 10) } });
  assert.equal(big[0].detail, null);
});

test('合併匯入：同 id 以手機上的為準，紀錄依時間排序', () => {
  const a = sanitizePerson({ id: 'p-aaaaaaaaaaaaaaaa', name: '手機上的', raw });
  const a2 = sanitizePerson({ id: 'p-aaaaaaaaaaaaaaaa', name: '備份裡的', raw });
  const b = sanitizePerson({ id: 'p-bbbbbbbbbbbbbbbb', name: 'B', raw });
  const merged = mergeData(
    { people: [a], history: [{ id: 'h-1111111111111111', type: 'tarot', at: '2026-01-01T00:00:00.000Z' }], settings: {} },
    { people: [a2, b], history: [{ id: 'h-2222222222222222', type: 'match', at: '2026-06-01T00:00:00.000Z' }] },
  );
  assert.deepEqual(merged.people.map((p) => p.name), ['手機上的', 'B']);
  assert.equal(merged.history[0].id, 'h-2222222222222222');
});

test('id 是隨機的', () => {
  assert.match(newId('p'), /^p-[0-9a-f]{16}$/);
  assert.notEqual(newId('h'), newId('h'));
});

test('本名與多胞胎順序：只收中文 2～6 字、順序 0～5；舊備份沒有這兩欄也能讀', () => {
  const ok = sanitizePerson({ name: '妹妹', fullName: ' 王小美 ', birthOrder: 2, raw });
  assert.equal(ok.fullName, '王小美');
  assert.equal(ok.birthOrder, 2);
  const bad = sanitizePerson({ name: 'x', fullName: 'Amy<script>', birthOrder: 9, raw });
  assert.equal(bad.fullName, '');
  assert.equal(bad.birthOrder, 0);
  const old = sanitizePerson({ name: '舊資料', raw });
  assert.equal(old.fullName, '');
  assert.equal(old.birthOrder, 0);
  assert.equal(sanitizeSettings({ twinMethod: 'travel' }).twinMethod, 'travel');
  assert.equal(sanitizeSettings({ twinMethod: 'x' }).twinMethod, 'sibling');
});

test('血型：只收 A、B、O、AB，其他（含小寫、Rh 寫法、物件）一律存成沒填', () => {
  for (const t of ['A', 'B', 'O', 'AB']) assert.equal(sanitizePerson({ name: 'x', bloodType: t, raw }).bloodType, t);
  for (const t of ['a', 'A+', 'O型', 'ab', '', null, 42, { t: 'A' }]) assert.equal(sanitizePerson({ name: 'x', bloodType: t, raw }).bloodType, '');
  assert.equal(sanitizePerson({ name: '舊資料', raw }).bloodType, '');
});
