import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUR_SLOTS, HOUR_WINDOWS, slotOfHour, sanitizeHourWindow } from '../js/core/hour-windows.js';
import { hourCandidates, summarizeHours, slotNames, knownSlot, isDstDay, HOUR_FIELDS } from '../js/core/hours.js';
import { sanitizePerson } from '../js/core/records.js';

const base = { time: null, tz: 'Asia/Taipei', place: null, fold: null };
const TAIPEI = { lat: 25.04, lon: 121.51 };
const at = (y, m, d) => ({ ...base, date: { y, m, d } });
const field = (s, key) => s.stable.find((f) => f.key === key) || s.vary.find((f) => f.key === key);

test('13 個候選：子時分成早子（0–1 點）和晚子（23–24 點）；每個候選的時間落在自己的時辰正中間；大概時段只收清單裡的代碼', () => {
  assert.equal(HOUR_SLOTS.length, 13);
  assert.equal(new Set(HOUR_SLOTS.map((s) => s.id)).size, 13);
  for (const s of HOUR_SLOTS) assert.equal(slotOfHour(s.h), s.id, s.id);
  assert.equal(slotOfHour(0), 'zi0');
  assert.equal(slotOfHour(23), 'zi1');
  assert.equal(slotOfHour(1), 'chou');
  assert.equal(slotOfHour(22), 'hai');
  for (const w of HOUR_WINDOWS) {
    assert.ok(w.slots.length && w.slots.every((id) => HOUR_SLOTS.some((s) => s.id === id)), w.id);
  }
  assert.equal(new Set(HOUR_WINDOWS.map((w) => w.id)).size, HOUR_WINDOWS.length);
  assert.equal(sanitizeHourWindow('morning'), 'morning');
  assert.equal(sanitizeHourWindow('亂填'), '');
  assert.equal(sanitizeHourWindow(3), '');
  const pick = (...ids) => HOUR_SLOTS.filter((s) => ids.includes(s.id));
  assert.equal(slotNames(pick('zi0', 'chou')), '早子、丑時');
  // 連續三個以上合併；早子、晚子分在一天的頭尾，不連續
  assert.equal(slotNames(HOUR_SLOTS.slice(0, 12)), '早子～亥時');
  assert.equal(slotNames(pick('chen', 'si', 'shen', 'you')), '辰、巳、申、酉時');
  assert.equal(slotNames(pick('zi1', 'zi0')), '早子、晚子時');
  assert.equal(slotNames(pick('yin', 'mao', 'chen', 'xu')), '寅～辰、戌時');
});

test('沒有時間：年月柱、喜用、太陽月亮都一樣；時柱 13 種；23 點換日的派別只有晚子時日柱不同，0 點換日就都一樣', () => {
  const c = hourCandidates(at(1990, 8, 15), { gender: '男', sect: 1, place: TAIPEI });
  assert.equal(c.length, 13);
  const s = summarizeHours(c);
  assert.equal(s.count, 13);
  const stable = s.stable.map((f) => f.key);
  for (const k of ['year', 'month', 'ys', 'sun', 'moon']) assert.ok(stable.includes(k), k);
  assert.equal(field(s, 'year').value, '庚午');
  assert.equal(field(s, 'sun').value, '獅子座');
  assert.equal(field(s, 'hour').groups.length, 13);
  // 23 點換日：晚子時算隔天，日柱不同；其他 12 個一樣
  const day = field(s, 'day');
  assert.deepEqual(day.groups.map((g) => g.slots.length), [12, 1]);
  assert.deepEqual(day.groups[1].slots.map((x) => x.id), ['zi1']);
  const s2 = summarizeHours(hourCandidates(at(1990, 8, 15), { sect: 2 }));
  assert.ok(s2.stable.some((f) => f.key === 'day'), '0 點換日：日柱 13 個時辰都一樣');
  // 上升、紫微命宮跟著時辰變
  assert.ok(field(s, 'rising').groups.length >= 10);
  assert.ok(field(s, 'ming').groups.length >= 10);
  assert.ok(s.vary.some((f) => f.key === 'gu'));
});

test('沒有性別不排紫微、沒有出生地不算上升：這兩項整個不列，不是算成「都一樣」', () => {
  const s = summarizeHours(hourCandidates(at(1990, 8, 15), {}));
  for (const k of ['ming', 'body', 'ju', 'rising']) assert.equal(field(s, k), undefined, k);
  assert.ok(HOUR_FIELDS.every((f) => typeof f.get === 'function'));
});

test('出生當天交節氣（2024-02-04 立春 16:27）：年柱、月柱以申時、酉時為界分成兩種', () => {
  const s = summarizeHours(hourCandidates(at(2024, 2, 4), {}));
  for (const k of ['year', 'month']) {
    const f = field(s, k);
    assert.equal(f.groups.length, 2, k);
    assert.ok(f.groups.find((g) => g.slots.some((x) => x.id === 'shen')).slots.every((x) => !['you', 'xu', 'hai', 'zi1'].includes(x.id)));
  }
  assert.equal(field(s, 'year').groups.find((g) => g.slots.some((x) => x.id === 'wu')).value, '癸卯');
  assert.equal(field(s, 'year').groups.find((g) => g.slots.some((x) => x.id === 'you')).value, '甲辰');
});

test('月亮當天換星座（1990-08-03）：列出兩種和各自的時辰', () => {
  const f = field(summarizeHours(hourCandidates(at(1990, 8, 3), {})), 'moon');
  assert.deepEqual(f.groups.map((g) => g.value).sort(), ['射手座', '摩羯座']);
});

test('日光節約時間那天（1975-07-01）：候選換成當時的鐘面時間再排，0 點換日時 13 個時辰的日柱都是同一天', () => {
  assert.equal(isDstDay(at(1975, 7, 1)), true);
  assert.equal(isDstDay(at(1990, 8, 15)), false);
  const c = hourCandidates(at(1975, 7, 1), { sect: 2 });
  assert.equal(new Set(c.map((x) => x.bazi.day)).size, 1);
  // 時柱地支照子丑寅…亥子排，沒有被夏令時間推到隔壁時辰
  assert.deepEqual(c.map((x) => x.bazi.hour[1]).join(''), '子丑寅卯辰巳午未申酉戌亥子');
});

test('縮小範圍：只看家人記得的時段；已知時間落在哪個時辰', () => {
  const c = hourCandidates(at(1990, 8, 15), { gender: '女', place: TAIPEI });
  const morning = HOUR_WINDOWS.find((w) => w.id === 'morning');
  const s = summarizeHours(c, morning.slots);
  assert.equal(s.count, 2);
  assert.deepEqual(field(s, 'hour').groups.map((g) => g.value), ['甲辰', '乙巳']);
  const t = (h, mi) => knownSlot({ ...at(1990, 8, 15), time: { h, mi } });
  assert.equal(t(23, 40), 'zi1');
  assert.equal(t(0, 10), 'zi0');
  assert.equal(t(13, 5), 'wei');
  assert.equal(t(12, 59), 'wu');
  assert.equal(knownSlot(at(1990, 8, 15)), null);
});

test('名單存檔：沒填時間才存大概時段；填了時間、亂填的代碼都不存', () => {
  const raw = { calendar: 'solar', era: 'ad', year: 1990, month: 8, day: 15, knowTime: false, time: '', placeId: 'taipei', tz: 'Asia/Taipei' };
  assert.equal(sanitizePerson({ name: '媽媽', raw, hourWindow: 'morning' }).hourWindow, 'morning');
  assert.equal('hourWindow' in sanitizePerson({ name: '媽媽', raw, hourWindow: 'xx' }), false);
  assert.equal('hourWindow' in sanitizePerson({ name: '媽媽', raw: { ...raw, knowTime: true, time: '08:30' }, hourWindow: 'morning' }), false);
});
