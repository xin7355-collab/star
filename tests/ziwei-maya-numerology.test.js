import test from 'node:test';
import assert from 'node:assert/strict';
import { buildZiwei, timeIndexOf, GRID } from '../js/core/ziwei.js';
import { computeMaya, compareMaya } from '../js/core/maya.js';
import { lifePath, grid, gridWithTalent, LINES, MISSING_TEXT, MANY_TEXT } from '../js/core/numerology.js';
import { chengGu, shichenIndex, formatWeight } from '../js/core/chenggu.js';
import { computeFortune } from '../js/core/fortune.js';

test('紫微交界提醒：離換時辰 10 分鐘內列出另一邊的命宮；晚子時和隔天早子時是同一張盤，不提醒', () => {
  const z = (date, h, mi) => buildZiwei({ date, time: { h, mi }, tz: 'Asia/Taipei', place: null }, { gender: '男' });
  const d = { y: 1990, m: 8, d: 15 };
  assert.match(z(d, 13, 5).uncertain.join(''), /早 6 分鐘，就是午時，命宮會在「丑」宮（紫微、破軍），不是現在的「子」宮（天機）/);
  assert.match(z(d, 22, 55).uncertain.join(''), /晚 5 分鐘，就是晚子時，命宮會在「未」宮（天府）/);
  assert.deepEqual(z(d, 23, 55).uncertain, []);
  assert.deepEqual(z({ y: 1990, m: 8, d: 16 }, 0, 5).uncertain, []);
  assert.deepEqual(z(d, 12, 30).uncertain, []);
});

test('紫微：14 主星位置與 tianji 交叉驗算一致（1990-08-15 06:20 男）', () => {
  const z = buildZiwei({ date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: null }, { gender: '男', at: { y: 2026, m: 11, d: 24 } });
  assert.equal(z.ok, true);
  assert.equal(z.soulBranch, '辰');
  assert.equal(z.fiveElementsClass, '金四局');
  const stars = {};
  for (const p of z.palaces) for (const s of p.major) stars[s.name] = p.branch;
  assert.deepEqual(stars, { 太陽: '寅', 巨門: '寅', 天相: '卯', 天機: '辰', 天梁: '辰', 紫微: '巳', 七殺: '巳', 廉貞: '酉', 破軍: '酉', 天府: '亥', 天同: '子', 太陰: '子', 武曲: '丑', 貪狼: '丑' });
  assert.equal(z.palaces.length, 12);
  assert.equal(new Set(z.palaces.map((p) => p.grid.join(','))).size, 12);
  assert.ok(z.horoscope && z.horoscope.yearlyMutagen.length === 4);
  assert.ok(z.palaces.some((p) => p.name === '命宮'));
});

test('紫微：沒有時間或性別時給出可行動的錯誤訊息', () => {
  const base = { date: { y: 1990, m: 8, d: 15 }, tz: 'Asia/Taipei', place: null };
  assert.match(buildZiwei({ ...base, time: null }, { gender: '男' }).error, /出生時間/);
  assert.match(buildZiwei({ ...base, time: { h: 6, mi: 0 } }, { gender: '' }).error, /性別/);
});

test('時辰序號：23 點為晚子時（12）、0 點為早子時（0）', () => {
  assert.deepEqual([0, 1, 2, 3, 22, 23].map(timeIndexOf), [0, 1, 1, 2, 11, 12]);
  assert.equal(Object.keys(GRID).length, 12);
});

test('瑪雅密碼：與 V1 規則一致（3,015 組比對過），例外年份與雙胞胎時間', () => {
  const r = computeMaya({ y: 1990, m: 8, d: 15 });
  assert.deepEqual(r.items.map((x) => x.value), [9, 0, 9, 6, 6]);
  const ex = computeMaya({ y: 2015, m: 5, d: 5 });
  assert.deepEqual(ex.items.map((x) => x.value), [null, null, 10, 9, 9]);
  assert.equal(ex.items[2].keyword, '本源');
  const twin = computeMaya({ y: 1990, m: 8, d: 15 }, { h: 8, mi: 30 });
  assert.equal(twin.sum, 1990 + 8 + 15 + 38);
  const big = computeMaya({ y: 1999, m: 9, d: 29 });
  assert.equal(big.digitTotal, 2037 % 10 + 3 + 0 + 2);
  assert.equal(compareMaya(r, r).every((x) => x.same || x.a === null), true);
});

test('生命靈數：1990-08-15 → 33／6；九宮格連線', () => {
  const lp = lifePath({ y: 1990, m: 8, d: 15 });
  assert.equal(lp.label, '33／6');
  assert.equal(lp.number, 6);
  assert.equal(lifePath({ y: 2000, m: 1, d: 1 }).label, '4');
  const g = grid({ y: 1987, m: 6, d: 25 }); // 數字 1、9、8、7、6、2、5
  assert.equal(g.counts[7], 1);
  assert.ok(g.lines.some((l) => l.name === '權力線'));
  assert.deepEqual(g.missing, [3, 4]);
  const none = grid({ y: 2000, m: 1, d: 1 }); // 只有 1、2
  assert.equal(none.lines.length, 0);
});

test('生命靈數：天賦數、空缺數、重複三次以上、另一派（天賦數與生命數也圈）並列', () => {
  // 1990-08-15：加總 33 → 天賦數 3、3；生日數字只有 1、9、8、5 → 只有事業線，空缺 2、3、4、6、7
  const lp = lifePath({ y: 1990, m: 8, d: 15 });
  assert.deepEqual(lp.talent, [3, 3]);
  const g = grid({ y: 1990, m: 8, d: 15 });
  assert.deepEqual(g.lines.map((l) => l.name), ['事業線']);
  assert.deepEqual(g.missing, [2, 3, 4, 6, 7]);
  // 另一派把 3、3、6 也圈進去：多出智慧線（3-6-9），空缺剩 2、4、7
  const alt = gridWithTalent({ y: 1990, m: 8, d: 15 });
  assert.deepEqual(alt.lines.map((l) => l.name), ['智慧線', '事業線']);
  assert.deepEqual(alt.missing, [2, 4, 7]);
  // 加總只有一位數就沒有天賦數；同一個數字出現三次以上要提醒「過頭」
  assert.deepEqual(lifePath({ y: 2000, m: 1, d: 1 }).talent, []);
  assert.deepEqual(grid({ y: 1999, m: 9, d: 19 }).many, [9]);
  assert.equal(grid({ y: 1999, m: 9, d: 19 }).counts[9], 5);
  // 八條連線、九個空缺數、九個「太多」都有說明
  assert.equal(LINES.length, 8);
  for (const l of LINES) assert.ok(l.text.length > 10, l.name);
  for (let n = 1; n <= 9; n += 1) assert.ok(MISSING_TEXT[n] && MANY_TEXT[n], String(n));
});

test('稱骨：與 tianji 300 組比對一致；23 點與 0 點都是子時', () => {
  assert.deepEqual([23, 0, 1, 2, 3, 22].map(shichenIndex), [0, 0, 1, 1, 2, 11]);
  // 06:00 是卯時（05–07 點）：庚午 9 ＋ 六月 16 ＋ 廿五 15 ＋ 卯時 10 ＝ 50
  const r = chengGu({ yearGanZhi: '庚午', lunarMonth: 6, lunarDay: 25, hour: 6 });
  assert.equal(r.shichen, '卯');
  assert.equal(r.total, 50);
  assert.equal(r.text, '5 兩');
  assert.match(r.poem, /為利為名/);
  assert.equal(formatWeight(30), '3 兩');
});

test('運勢：今年每月取 4 天，產出 12 個月與最佳／最需保守月份', () => {
  const f = computeFortune(0, 'year', { y: 2026, m: 11, d: 24 });
  assert.equal(f.dates.length, 48);
  assert.equal(f.months.length, 12);
  assert.ok(f.best.m >= 1 && f.best.m <= 12);
  assert.match(f.summary, /月份/);
});
