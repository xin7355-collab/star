// 偏財指數與樂透號碼：分數範圍、各系統依據、號碼合法、可重現、加權有效、機率正確。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windfallDay, windfallOutlook, natalWealth, ziweiWealth, personalDayNumber, luckyNumbers, luckyProfile, GAMES } from '../js/core/windfall.js';
import { buildBazi, yongShen } from '../js/core/bazi.js';
import { buildZiwei } from '../js/core/ziwei.js';

const INPUT = { date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: { lon: 121.5, lat: 25.04 }, fold: null };
const BAZI = buildBazi(INPUT, { gender: '男', today: { y: 2026, m: 11, d: 24 } });
const ZIWEI = buildZiwei(INPUT, { gender: '男', at: { y: 2026, m: 11, d: 24 } });
const DAY = { y: 2026, m: 11, d: 24 };

test('偏財指數：四個系統都有依據，分數在 5–95', () => {
  const r = windfallDay(DAY, { bazi: BAZI, ziwei: ZIWEI, signIndex: 4, birth: INPUT.date });
  assert.ok(r.score >= 5 && r.score <= 95);
  assert.deepEqual(r.parts.map((p) => p.system), ['八字', '八字本命', '紫微', '星座', '生命靈數']);
  assert.ok(r.parts.every((p) => p.text.length > 8));
  assert.ok(['偏財旺', '小有偏財', '平穩', '保守為宜'].includes(r.level));
  assert.ok(r.caiPosition.length >= 2); // 財神方位
});

test('沒有命盤時只用有的資料，不會出錯', () => {
  const r = windfallDay(DAY, {});
  assert.equal(r.parts.length, 0);
  assert.equal(r.score, 50);
});

test('本命偏財與「身能擔財」說明', () => {
  const n = natalWealth(BAZI);
  assert.ok(n.lines.length === 2);
  assert.ok(typeof n.pian === 'number');
  const z = ziweiWealth(ZIWEI);
  assert.ok(z.lines.some((l) => l.includes('財帛宮')));
  assert.ok(z.lines.some((l) => l.includes('化忌'))); // 這張盤財帛宮是天同化忌
});

test('流日數：8/15 生在 2026-11-24 是 5', () => {
  assert.equal(personalDayNumber({ m: 8, d: 15 }, DAY), 5);
});

test('未來 7 天走勢與最好的一天', () => {
  const o = windfallOutlook(DAY, 7, { bazi: BAZI, signIndex: 4, birth: INPUT.date });
  assert.equal(o.list.length, 7);
  assert.ok(o.list.every((d) => d.score <= o.best.score));
});

test('頭獎機率與組合數一致', () => {
  const C = (n, k) => { let r = 1; for (let i = 0; i < k; i += 1) r = (r * (n - i)) / (i + 1); return Math.round(r); };
  assert.equal(GAMES.lotto649.odds, C(49, 6));
  assert.equal(GAMES.superlotto638.odds, C(38, 6) * 8);
  assert.equal(GAMES.dailycash.odds, C(39, 5));
});

test('號碼合法：不重複、在範圍內、由小到大；威力彩有第二區', () => {
  for (const id of Object.keys(GAMES)) {
    for (let i = 0; i < 200; i += 1) {
      const r = luckyNumbers(id, { random: true, profile: { digits: [1, 6], birthDay: 15, lifePath: 6 } });
      const g = GAMES[id];
      assert.equal(r.main.length, g.pick);
      assert.equal(new Set(r.main).size, g.pick);
      assert.ok(r.main.every((n) => n >= 1 && n <= g.max));
      assert.deepEqual(r.main, [...r.main].sort((a, b) => a - b));
      if (g.second) assert.ok(r.second >= 1 && r.second <= 8);
      else assert.equal(r.second, null);
      assert.ok(r.disclaimer.includes('機率都一樣'));
    }
  }
});

test('今日號碼可重現：同人同日同彩券固定，換一天就不同', () => {
  const a = luckyNumbers('lotto649', { seedKey: 'p-abc', date: DAY });
  const b = luckyNumbers('lotto649', { seedKey: 'p-abc', date: DAY });
  const c = luckyNumbers('lotto649', { seedKey: 'p-abc', date: { y: 2026, m: 11, d: 25 } });
  assert.deepEqual(a.main, b.main);
  assert.notDeepEqual(a.main, c.main);
});

test('加權有效：幸運尾數出現得比較多（統計檢查）', () => {
  const profile = luckyProfile({ bazi: BAZI, birth: INPUT.date, lifePathNumber: 6 });
  // 幸運五行和開運佈置、姓名搭配一樣取喜用神（這個命盤身強取財＝火）
  assert.equal(profile.element, '火');
  assert.deepEqual(profile.digits, [2, 7]);
  let lucky = 0;
  let other = 0;
  for (let i = 0; i < 3000; i += 1) {
    for (const n of luckyNumbers('dailycash', { random: true, profile: { digits: profile.digits } }).main) {
      if (profile.digits.includes(n % 10)) lucky += 1;
      else other += 1;
    }
  }
  // 39 個號碼裡幸運尾數約 8 個：不加權時約占 20%，加權 2 倍後應明顯更高
  assert.ok(lucky / (lucky + other) > 0.3, `幸運尾數占 ${(lucky / (lucky + other)).toFixed(2)}`);
});

test('身強身弱和喜用神一致：己丑 丁丑 壬子 辛丑（身弱 35%）不可以寫成「身能擔財」', () => {
  const b = buildBazi({ date: { y: 1950, m: 1, d: 17 }, time: { h: 2, mi: 0 }, lat: 25.04, lon: 121.5, tz: 'Asia/Taipei' }, { gender: '男', today: { y: 2026, m: 11, d: 24 } });
  assert.equal(b.pillars.map((p) => p.gan + p.zhi).join(' '), '己丑 丁丑 壬子 辛丑');
  assert.equal(yongShen(b).strength, '身弱');
  const text = natalWealth(b).lines.join('');
  assert.doesNotMatch(text, /身能擔財/);
  assert.match(text, /偏弱/);
});

test('扶抑：身弱的人偏財日不加分、劫財日反而加分（己未 丁丑 壬午 乙巳，身弱喜金水、忌土火）', async () => {
  const { dailyIndex } = await import('../js/core/daily.js');
  const b = buildBazi({ date: { y: 1980, m: 1, d: 10 }, time: { h: 10, mi: 0 }, lat: 25.04, lon: 121.5, tz: 'Asia/Taipei' }, { gender: '男', today: { y: 2026, m: 11, d: 24 } });
  assert.equal(yongShen(b).strength, '身弱');
  const part = (r) => r.parts.find((x) => x.system === '八字');
  const bing = windfallDay({ y: 2026, m: 11, d: 28 }, { bazi: b }); // 丙午：偏財
  const gui = windfallDay({ y: 2026, m: 11, d: 25 }, { bazi: b }); // 癸卯：劫財
  assert.ok(part(bing).delta < 0, `偏財日 ${part(bing).delta}`);
  assert.ok(part(gui).delta > 0, `劫財日 ${part(gui).delta}`);
  assert.match(part(bing).text, /身弱/);
  assert.match(part(dailyIndex({ date: { y: 2026, m: 11, d: 28 }, bazi: b })).text, /忌神/);
});
