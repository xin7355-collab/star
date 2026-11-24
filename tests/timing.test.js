// 時機：吉時表、擇日、逆行、日月食、月相、換流月、近期提醒。日期以台灣時間對照公開的天文年曆。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hourGuide, hourSummary, chooseDays, personalDay, retrogradePeriods, eclipsesBetween, moonPhasesBetween, monthChangesBetween, upcoming, attentionSummary, ACTIVITIES } from '../js/core/timing.js';
import { buildBazi } from '../js/core/bazi.js';
import { isoDate } from '../js/core/date.js';

const INPUT = { date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: { lon: 121.5, lat: 25.04 }, fold: null };
const BAZI = buildBazi(INPUT, { gender: '男', today: { y: 2026, m: 11, d: 24 } });
const DAY = { y: 2026, m: 11, d: 24 };
const iso = (d) => isoDate(d);

test('吉時表：13 個時段（含早子、晚子），白虎時諸事不宜，子時沖屬馬', () => {
  const hours = hourGuide(DAY, BAZI);
  assert.equal(hours.length, 13);
  assert.equal(hours[0].start, '00:00');
  assert.equal(hours[12].start, '23:00');
  const noon = hours.find((h) => h.start === '11:00');
  assert.equal(noon.tianShen, '白虎');
  assert.ok(noon.ji.includes('諸事不宜'));
  assert.equal(hours[0].clashMe, true); // 屬馬遇子時
  assert.ok(hours.every((h) => h.advice.length > 5));
});

test('吉時摘要只推薦醒著的時段，並列出要避開的', () => {
  const lines = hourSummary(hourGuide(DAY, BAZI));
  assert.ok(lines[0].startsWith('好時段：'));
  assert.ok(!lines[0].includes('01:00'));
  assert.ok(lines.some((l) => l.includes('11:00–12:59')));
});

test('沒有命盤也能用（只是不算沖生肖）', () => {
  const hours = hourGuide(DAY, null);
  assert.ok(hours.every((h) => h.clashMe === false));
});

test('流日：子日沖屬馬', () => {
  const p = personalDay({ y: 2026, m: 12, d: 4 }, BAZI);
  assert.equal(p.ganzhi[1], '子');
  assert.ok(p.clash.includes('生肖'));
  assert.ok(p.notes[0].includes('屬馬'));
});

test('擇日：每種活動都能排出 30 天、分數 0–100、最佳日由高到低', () => {
  for (const act of ACTIVITIES) {
    const r = chooseDays(act.id, { from: DAY, days: 30, bazi: BAZI, signIndex: 4, gender: '男' });
    assert.equal(r.days.length, 30);
    assert.ok(r.days.every((d) => d.score >= 0 && d.score <= 100 && d.reasons.length >= 1));
    for (let i = 1; i < r.best.length; i += 1) assert.ok(r.best[i - 1].score >= r.best[i].score);
  }
  const move = chooseDays('move', { from: DAY, days: 30, bazi: BAZI, signIndex: 4, gender: '男' });
  const clashDay = move.days.find((d) => d.iso === '2026-12-04');
  assert.ok(clashDay.reasons.some((r) => r.text === '這天沖你的生肖'));
  assert.throws(() => chooseDays('nope', { from: DAY }), /不認得/);
});

test('逆行：與天文年曆一致（台灣日期）', () => {
  const merc = retrogradePeriods('Mercury', { y: 2026, m: 10, d: 1 }, 200);
  assert.deepEqual(merc.map((p) => [iso(p.start), iso(p.end)]), [['2026-10-24', '2026-11-14'], ['2027-02-10', '2027-03-03']]);
  const mars = retrogradePeriods('Mars', { y: 2026, m: 12, d: 1 }, 60);
  assert.deepEqual(mars.map((p) => [iso(p.start), iso(p.end)]), [['2027-01-10', '2027-04-01']]);
  // 期間開始時已在逆行中，也要找得到
  const during = retrogradePeriods('Mercury', { y: 2026, m: 11, d: 1 }, 5);
  assert.equal(iso(during[0].start), '2026-10-24');
});

test('日月食：2026-03-03 月全食、2026-08-13 日全食（台灣時間）', () => {
  const e = eclipsesBetween({ y: 2026, m: 1, d: 1 }, 365);
  const find = (kind, date) => e.find((x) => x.kind === kind && iso(x.date) === date);
  assert.equal(find('lunar', '2026-03-03').type, '全');
  assert.equal(find('solar', '2026-08-13').type, '全');
  assert.equal(find('solar', '2026-02-17').type, '環');
});

test('月相：2026-11-24 滿月、2026-12-09 新月', () => {
  const m = moonPhasesBetween({ y: 2026, m: 11, d: 20 }, 25);
  assert.ok(m.some((x) => x.kind === 'full' && iso(x.date) === '2026-11-24'));
  assert.ok(m.some((x) => x.kind === 'new' && iso(x.date) === '2026-12-09'));
});

test('換流月：大雪 12/7 進庚子月、小寒 1/5 進辛丑月', () => {
  const mc = monthChangesBetween(DAY, 45);
  assert.deepEqual(mc.map((x) => [x.name, iso(x.date), x.monthGanZhi]), [['大雪', '2026-12-07', '庚子'], ['小寒', '2027-01-05', '辛丑']]);
});

test('近期提醒：依日期排序、有白話與依據，摘要最多 5 句', () => {
  const items = upcoming({ from: DAY, days: 45, bazi: BAZI, birth: INPUT.date });
  assert.ok(items.length >= 5);
  for (let i = 1; i < items.length; i += 1) assert.ok(iso(items[i - 1].date) <= iso(items[i].date));
  assert.ok(items.every((x) => x.title && x.text && x.basis && ['warn', 'good', 'info'].includes(x.level)));
  assert.ok(items.some((x) => x.kind === 'month' && x.text.includes('偏印')));
  const summary = attentionSummary(items, DAY);
  assert.ok(summary.length >= 1 && summary.length <= 5);
  // 水逆期間要出現提醒
  const during = upcoming({ from: { y: 2026, m: 11, d: 1 }, days: 10 });
  assert.ok(during.some((x) => x.kind === 'retro' && x.title.startsWith('水星逆行中')));
});
