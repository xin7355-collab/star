// 時機：吉時表、擇日、逆行、日月食、月相、換流月、近期提醒。日期以台灣時間對照公開的天文年曆。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hourGuide, hourSummary, chooseDays, personalDay, retrogradePeriods, eclipsesBetween, moonPhasesBetween, monthChangesBetween, upcoming, attentionSummary, ACTIVITIES, badDayMarks } from '../js/core/timing.js';
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

test('擇日：歲破、月破、四離、四絕（年以立春、月以節為界）', () => {
  assert.deepEqual(badDayMarks({ y: 2026, m: 12, d: 4 }), ['歲破日（這天沖太歲）']); // 丙午年、壬子日
  assert.deepEqual(badDayMarks({ y: 2027, m: 1, d: 9 }), ['歲破日（這天沖太歲）']); // 立春前仍是丙午年
  assert.deepEqual(badDayMarks({ y: 2026, m: 2, d: 3 }), ['四絕日（立春前一天）']);
  assert.deepEqual(badDayMarks({ y: 2026, m: 3, d: 19 }), ['四離日（春分前一天）']);
  assert.deepEqual(badDayMarks({ y: 2026, m: 2, d: 2 }), ['月破日（這天沖月建）']); // 丑月未日
  assert.deepEqual(badDayMarks({ y: 2026, m: 12, d: 6 }), []);
});

test('擇日：大事排除歲破等日子並說明排除了幾天；看醫生只扣分不排除', () => {
  // 修正前：2026-12-04（歲破）搬家 70 分進前五名、2026-02-03（四絕）簽約 70 分並列最高
  const move = chooseDays('move', { from: { y: 2026, m: 12, d: 1 }, days: 60 });
  assert.ok(!move.best.some((d) => d.iso === '2026-12-04'));
  assert.ok(move.excluded >= 1);
  const dec4 = move.days.find((d) => d.iso === '2026-12-04');
  assert.ok(dec4.score <= 20);
  assert.match(dec4.reasons[0].text, /歲破日.*不用來辦這件事/);
  const deal = chooseDays('deal', { from: { y: 2026, m: 2, d: 1 }, days: 5 });
  assert.ok(!deal.best.some((d) => d.iso === '2026-02-03'));
  const health = chooseDays('health', { from: { y: 2026, m: 12, d: 1 }, days: 60 });
  assert.equal(health.excluded, 0);
  assert.match(health.days.find((d) => d.iso === '2026-12-04').reasons[0].text, /能改期就改期/);
});

test('近期提醒與拜拜擇日：台灣常見的節日、神明生日', () => {
  const items = upcoming({ from: { y: 2026, m: 8, d: 20 }, days: 14 });
  assert.ok(items.some((x) => x.kind === 'folk' && x.title.startsWith('中元節（普渡）・8/27')));
  const pray = chooseDays('pray', { from: { y: 2026, m: 5, d: 1 }, days: 20 });
  assert.ok(pray.days.find((d) => d.iso === '2026-05-09').reasons.some((x) => x.text === '這天是媽祖生'));
});

test('擇日的民俗忌日與吉神：楊公忌扣分、三娘煞只忌嫁娶、天赦加分，都寫出原因', () => {
  const from = { y: 2026, m: 11, d: 25 };
  const deal = chooseDays('deal', { from, days: 30 });
  const yg = deal.days.find((x) => x.iso === '2026-12-01'); // 農曆十月廿三：楊公忌
  assert.ok(yg.reasons.some((r) => r.text.startsWith('楊公忌日')));
  const wedding = chooseDays('wedding', { from, days: 30 });
  const sn = wedding.days.filter((x) => x.reasons.some((r) => r.text.startsWith('三娘煞')));
  assert.ok(sn.length >= 4, `三娘煞 ${sn.length} 天`); // 一個月六天，30 天內至少四天
  assert.ok(!deal.days.some((x) => x.reasons.some((r) => r.text.startsWith('三娘煞'))), '簽約不看三娘煞');
  const ts = deal.days.find((x) => x.iso === '2026-12-16'); // 天赦日
  assert.ok(ts.reasons.some((r) => r.text.includes('天赦')));
  // 看醫生不是大事，楊公忌不扣
  assert.ok(!chooseDays('health', { from, days: 30 }).days.find((x) => x.iso === '2026-12-01').reasons.some((r) => r.text.startsWith('楊公忌')));
});

test('近期提醒：行星換座與新月滿月寫出落在哪一座、你的第幾宮（以太陽星座起算）', async () => {
  const { ingressesBetween } = await import('../js/core/timing.js');
  const ig = ingressesBetween({ y: 2026, m: 11, d: 24 }, 30);
  const mars = ig.find((x) => x.key === 'Mars');
  assert.deepEqual([mars.sign, mars.date.m, mars.date.d], [5, 11, 26]); // 火星 11/26 進處女座
  const items = upcoming({ from: { y: 2026, m: 11, d: 24 }, days: 30, signIndex: 4 });
  const nm = items.find((x) => x.kind === 'moon' && x.title.startsWith('射手座新月'));
  assert.ok(nm, '12/9 射手座新月');
  assert.match(nm.text, /你的第 5 宮：戀愛、創作、子女/); // 獅子座的第 5 宮是射手
  assert.ok(items.some((x) => x.kind === 'ingress' && x.title.startsWith('火星進入處女座')));
  // 沒有太陽星座：照樣列出，只是不講宮位
  assert.ok(!upcoming({ from: { y: 2026, m: 11, d: 24 }, days: 30 }).some((x) => /你的第 \d+ 宮/.test(x.text)));
});
