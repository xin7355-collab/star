// 行事曆檔：RFC 5545 格式（跳脫、75 位元組折行不切字、CRLF、全天事件 DTEND 隔天、提醒時間）與提醒清單內容。離線可跑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, escapeText, foldLine } from '../js/core/ics.js';
import { reminderEvents, lichunOf, REMINDER_KINDS } from '../js/core/reminders.js';
import { buildBazi } from '../js/core/bazi.js';
import { buildNatal } from '../js/core/natal.js';

const enc = new TextEncoder();

test('跳脫：反斜線、分號、逗號、換行', () => {
  assert.equal(escapeText('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne');
});

test('折行：每行不超過 75 位元組、後面的行空一格開頭、不把中文字切開、接回來和原文一樣', () => {
  const line = `DESCRIPTION:${'水星逆行期間溝通合約交通容易出包，'.repeat(8)}`;
  const folded = foldLine(line);
  const rows = folded.split('\r\n');
  assert.ok(rows.length > 3);
  for (const [i, r] of rows.entries()) {
    assert.ok(enc.encode(r).length <= 75, `${i}：${enc.encode(r).length}`);
    if (i > 0) assert.ok(r.startsWith(' '));
    assert.ok(!r.includes('�'));
  }
  assert.equal(rows.map((r, i) => (i ? r.slice(1) : r)).join(''), line);
  assert.equal(foldLine('SUMMARY:短'), 'SUMMARY:短');
});

test('全天事件：DTEND 是最後一天的隔天（跨月、跨年）、提醒在當天或前一天早上 9 點、CRLF 結尾', () => {
  const ics = buildIcs([
    { id: 'a', date: { y: 2027, m: 2, d: 10 }, end: { y: 2027, m: 2, d: 28 }, title: '水星逆行', desc: '合約, 多看一次', alarm: 'dayBefore' },
    { id: 'b', date: { y: 2027, m: 12, d: 31 }, title: '月食；年底', alarm: 'morning' },
  ], { now: Date.UTC(2026, 10, 25, 3, 4, 5), calName: '星座手帳・我' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), '每個換行都要是 CRLF');
  assert.match(ics, /DTSTART;VALUE=DATE:20270210\r\nDTEND;VALUE=DATE:20270301\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20271231\r\nDTEND;VALUE=DATE:20280101\r\n/);
  assert.match(ics, /DESCRIPTION:合約\\, 多看一次/);
  assert.match(ics, /SUMMARY:月食\\；年底|SUMMARY:月食；年底/);
  assert.match(ics, /TRIGGER:-PT15H/);
  assert.match(ics, /TRIGGER:PT9H/);
  assert.match(ics, /DTSTAMP:20261125T030405Z/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.equal((ics.match(/END:VALARM/g) || []).length, 2);
});

test('提醒清單：1990/8/15 卯時男命、2026/11/25 起——月份、水逆、日月食、銀河生日、注意年份（立春）、交大運都在，日期正確', () => {
  const input = { date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: { lon: 121.5, lat: 25.04 }, fold: null };
  const today = { y: 2026, m: 11, d: 25 };
  const bazi = buildBazi(input, { gender: '男', today });
  const ev = reminderEvents({ bazi, natal: buildNatal(input), birth: input.date, today, gender: '男', personId: 'p-1' });
  const has = (kind, iso, re) => ev.some((e) => e.kind === kind && `${e.date.y}-${String(e.date.m).padStart(2, '0')}-${String(e.date.d).padStart(2, '0')}` === iso && re.test(e.title));
  assert.ok(has('kin', '2026-12-13', /銀河生日：KIN 109 超頻紅月/));
  assert.ok(has('mercury', '2027-02-10', /水星逆行/));
  assert.ok(ev.find((e) => e.kind === 'mercury').end.d === 3);
  assert.ok(has('eclipse', '2027-08-02', /全日食/));
  assert.ok(has('months', '2026-12-07', /本月小心：庚子月/));
  assert.ok(has('years', '2028-08-10', /交大運：戊子（七殺）/)); // 1998/8/10 起運，每 10 年一步
  assert.ok(has('years', '2032-02-04', /2032 年小心：伏吟、沖太歲/));
  // 只有今天以後、依日期排序、id 不重複
  for (let i = 1; i < ev.length; i += 1) assert.ok(`${ev[i - 1].date.y}${ev[i - 1].date.m}`.length && Date.UTC(ev[i].date.y, ev[i].date.m - 1, ev[i].date.d) >= Date.UTC(ev[i - 1].date.y, ev[i - 1].date.m - 1, ev[i - 1].date.d));
  assert.equal(new Set(ev.map((e) => e.id)).size, ev.length);
  assert.ok(ev.every((e) => Date.UTC(e.date.y, e.date.m - 1, e.date.d) >= Date.UTC(2026, 10, 25)));
  // 只選某幾類；別人的提醒標題加名字；內容不含生日
  const some = reminderEvents({ bazi, birth: input.date, today, kinds: ['kin'], self: false, name: '媽媽' });
  assert.ok(some.length >= 1 && some.every((e) => e.kind === 'kin' && e.title.includes('（媽媽）')));
  assert.ok(!buildIcs(ev).includes('1990'));
  assert.equal(REMINDER_KINDS.length, 5);
});

test('立春：2027 是 2/4、2029 是 2/3', () => {
  assert.deepEqual(lichunOf(2027), { y: 2027, m: 2, d: 4 });
  assert.deepEqual(lichunOf(2029), { y: 2029, m: 2, d: 3 });
});
