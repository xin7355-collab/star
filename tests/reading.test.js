// 綜合解讀與多胞胎：七個面向、共同點統計、紫微借宮、沒有時間或性別時也能用。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReading, rotateZiwei, twinsInfo, dominantShishen, PALACE_SEQ } from '../js/core/reading.js';
import { buildBazi } from '../js/core/bazi.js';
import { buildZiwei } from '../js/core/ziwei.js';
import { buildNatal } from '../js/core/natal.js';
import { computeMaya } from '../js/core/maya.js';
import { CHENGGU_PLAIN } from '../js/core/reading-texts.js';

const INPUT = { date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: { lon: 121.5, lat: 25.04 }, fold: null };
const TODAY = { y: 2026, m: 11, d: 24 };
const natal = buildNatal(INPUT);
const bazi = buildBazi(INPUT, { gender: '男', today: TODAY });
const ziwei = buildZiwei(INPUT, { gender: '男', at: TODAY });

test('完整資料：七個面向都有內容，每點都標出系統', () => {
  const r = buildReading({ natal, bazi, ziwei, birth: INPUT.date, maya: computeMaya(INPUT.date), today: TODAY, gender: '男' });
  assert.deepEqual(r.areas.map((a) => a.id), ['personality', 'career', 'wealth', 'love', 'health', 'social', 'year']);
  for (const a of r.areas) {
    assert.ok(a.points.length >= 2, `${a.title} 至少兩個系統`);
    assert.ok(a.points.every((p) => p.system && p.text && !p.text.includes('undefined')), a.title);
  }
  const systems = new Set(r.areas.flatMap((a) => a.points.map((p) => p.system)));
  for (const s of ['占星', '八字', '紫微', '生命靈數', '瑪雅']) assert.ok(systems.has(s), s);
});

test('共同點：至少兩個系統一致才算，並附上來源', () => {
  const r = buildReading({ natal, bazi, ziwei, birth: INPUT.date, today: TODAY, gender: '男' });
  for (const t of r.traits) {
    assert.ok(t.count >= 2);
    assert.equal(t.sources.length, t.count);
    assert.ok(new Set(t.sources.map((s) => s.split('：')[0].split(' ')[0])).size >= 2, '要來自不同系統');
  }
  assert.ok(r.areas[0].summary.includes('至少兩個系統一致'));
});

test('沒有出生時間、沒有性別：不出錯，紫微與上升略過', () => {
  const input = { ...INPUT, time: null };
  const n = buildNatal(input);
  const b = buildBazi(input, { today: TODAY });
  const r = buildReading({ natal: n, bazi: b, ziwei: null, birth: input.date, today: TODAY });
  assert.ok(r.areas.every((a) => a.points.every((p) => p.system !== '紫微')));
  assert.ok(r.areas[0].points.length >= 3);
});

test('十神分組：找出最多的一組', () => {
  const d = dominantShishen(bazi);
  assert.ok(['比劫', '食傷', '財', '官殺', '印'].includes(d.group));
  assert.ok(d.value >= Math.max(...Object.values(d.score)));
});

test('多胞胎借宮：老二以兄弟宮當命宮，宮名整圈輪轉', () => {
  const r = rotateZiwei(ziwei, 1);
  const oldSibling = ziwei.palaces.find((p) => p.name === '兄弟');
  const newMing = r.palaces.find((p) => p.name === '命宮');
  assert.equal(newMing.index, oldSibling.index);
  assert.equal(newMing.originalName, '兄弟');
  assert.deepEqual([...new Set(r.palaces.map((p) => p.name))].sort(), [...PALACE_SEQ].sort());
  // 遷移宮派：老二用遷移宮
  const t = rotateZiwei(ziwei, 6);
  assert.equal(t.palaces.find((p) => p.name === '命宮').originalName, '遷移');
});

test('多胞胎說明：一樣與不一樣的地方都講清楚', () => {
  const first = twinsInfo({ birthOrder: 1, natal, hasTime: true });
  assert.equal(first.shift, 0);
  const second = twinsInfo({ birthOrder: 2, natal, hasTime: true });
  assert.equal(second.shift, 1);
  assert.ok(second.lines.some((l) => l.includes('兄弟')));
  const travel = twinsInfo({ birthOrder: 2, natal, hasTime: true, method: 'travel' });
  assert.equal(travel.shift, 6);
  const third = twinsInfo({ birthOrder: 3, hasTime: false });
  assert.equal(third.shift, 2);
  assert.ok(third.lines.some((l) => l.includes('沒有填出生時間')));
  assert.equal(twinsInfo({ birthOrder: 0 }), null);
});

test('稱骨白話：21～72 兩都有', () => {
  for (let w = 21; w <= 72; w += 1) assert.ok(CHENGGU_PLAIN[w] && CHENGGU_PLAIN[w].includes('現代看法'), String(w));
});
