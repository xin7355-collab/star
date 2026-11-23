import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBirthDate, parseTime, addDays, isoWeek, isoWeekday, daysInMonth } from '../js/core/date.js';
import { localToUtc, localToUtcLenient, offsetMinutes, zoneToday, formatZoneTime } from '../js/core/tz.js';

test('民國年轉西元', () => {
  assert.deepEqual(parseBirthDate({ era: 'roc', year: '89', month: '3', day: '21' }), { ok: true, value: { y: 2000, m: 3, d: 21 } });
  assert.deepEqual(parseBirthDate({ era: 'ad', year: '2000', month: 3, day: 21 }), { ok: true, value: { y: 2000, m: 3, d: 21 } });
});

test('全形數字也能輸入', () => {
  assert.deepEqual(parseBirthDate({ era: 'roc', year: '８９', month: '３', day: '２１' }).value, { y: 2000, m: 3, d: 21 });
});

test('不存在的日期會被擋下', () => {
  assert.equal(parseBirthDate({ era: 'ad', year: 2023, month: 2, day: 29 }).ok, false);
  assert.equal(parseBirthDate({ era: 'ad', year: 2024, month: 2, day: 29 }).ok, true);
  assert.equal(parseBirthDate({ era: 'ad', year: 1900, month: 2, day: 29 }).ok, false); // 1900 不是閏年
  assert.equal(parseBirthDate({ era: 'roc', year: 0, month: 1, day: 1 }).ok, false);
  assert.equal(parseBirthDate({ era: 'ad', year: 1899, month: 1, day: 1 }).ok, false);
  assert.equal(parseBirthDate({ era: 'ad', year: 'abc', month: 1, day: 1 }).ok, false);
});

test('生日解析不受裝置時區影響（V1 的 new Date 錯誤不會發生）', () => {
  // 不論 TZ 為何，parseBirthDate 只做字串拆解
  const r = parseBirthDate({ era: 'ad', year: 2000, month: 3, day: 21 });
  assert.deepEqual(r.value, { y: 2000, m: 3, d: 21 });
});

test('時間解析', () => {
  assert.deepEqual(parseTime('08:30').value, { h: 8, mi: 30 });
  assert.deepEqual(parseTime('23:59:00').value, { h: 23, mi: 59 });
  assert.equal(parseTime('24:00').ok, false);
  assert.equal(parseTime('').ok, false);
});

test('日期工具', () => {
  assert.deepEqual(addDays({ y: 2024, m: 2, d: 28 }, 1), { y: 2024, m: 2, d: 29 });
  assert.deepEqual(addDays({ y: 2024, m: 12, d: 31 }, 1), { y: 2025, m: 1, d: 1 });
  assert.equal(isoWeekday({ y: 2026, m: 11, d: 23 }), 1); // 星期一
  assert.deepEqual(isoWeek({ y: 2021, m: 1, d: 3 }), { year: 2020, week: 53 });
  assert.equal(daysInMonth(2026, 2), 28);
});

test('台灣一般時期是 UTC+8', () => {
  const r = localToUtc({ y: 2000, m: 1, d: 1, h: 12, mi: 0 }, 'Asia/Taipei');
  assert.equal(r.status, 'ok');
  assert.equal(offsetMinutes(r.utcMs, 'Asia/Taipei'), 480);
});

test('台灣 1975 年日光節約時間是 UTC+9（不能寫死 +8）', () => {
  const r = localToUtc({ y: 1975, m: 7, d: 1, h: 12, mi: 0 }, 'Asia/Taipei');
  assert.equal(r.status, 'ok');
  assert.equal(offsetMinutes(r.utcMs, 'Asia/Taipei'), 540);
  assert.equal(new Date(r.utcMs).toISOString(), '1975-07-01T03:00:00.000Z');
});

test('日光節約開始：被跳過的時刻回報不存在', () => {
  assert.equal(localToUtc({ y: 1979, m: 7, d: 1, h: 0, mi: 30 }, 'Asia/Taipei').status, 'nonexistent');
  assert.equal(localToUtc({ y: 2021, m: 3, d: 14, h: 2, mi: 30 }, 'America/New_York').status, 'nonexistent');
});

test('日光節約結束：重複的時刻要使用者選第一次或第二次', () => {
  const r = localToUtc({ y: 2021, m: 11, d: 7, h: 1, mi: 30 }, 'America/New_York');
  assert.equal(r.status, 'ambiguous');
  assert.equal(new Date(r.candidates[0]).toISOString(), '2021-11-07T05:30:00.000Z');
  assert.equal(new Date(r.candidates[1]).toISOString(), '2021-11-07T06:30:00.000Z');
  const second = localToUtc({ y: 2021, m: 11, d: 7, h: 1, mi: 30 }, 'America/New_York', 1);
  assert.equal(second.utcMs, r.candidates[1]);
  assert.equal(localToUtc({ y: 1979, m: 9, d: 30, h: 23, mi: 30 }, 'Asia/Taipei').status, 'ambiguous');
});

test('寬鬆換算會跳過不存在的午夜', () => {
  const ms = localToUtcLenient({ y: 1979, m: 7, d: 1, h: 0, mi: 0 }, 'Asia/Taipei');
  assert.equal(formatZoneTime(ms, 'Asia/Taipei'), '01:00');
});

test('台灣日期用台灣時區計算（修正 mastra 用 UTC 導致早上 8 點前拿到昨天）', () => {
  const sevenAmTaipei = Date.parse('2026-11-23T07:00:00+08:00');
  assert.deepEqual(zoneToday('Asia/Taipei', sevenAmTaipei), { y: 2026, m: 11, d: 23 });
  assert.equal(new Date(sevenAmTaipei).toISOString().slice(0, 10), '2026-11-22'); // UTC 會是前一天
});
