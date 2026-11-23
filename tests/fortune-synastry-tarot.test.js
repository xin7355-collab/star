import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFortune, periodDates } from '../js/core/fortune.js';
import { scorePair, scoreGroup, sunSignMatrix, lookupMatrix, relationStory } from '../js/core/synastry.js';
import { buildNatal } from '../js/core/natal.js';
import { DECK, drawSpread, seededRandom, secureRandomInt } from '../js/core/tarot.js';
import { SIGN_INDEX } from '../js/core/zodiac.js';

const TODAY = { y: 2026, m: 11, d: 23 };

test('運勢：同樣輸入得到同樣結果（不用亂數）', () => {
  const a = computeFortune(SIGN_INDEX.libra, 'today', TODAY);
  const b = computeFortune(SIGN_INDEX.libra, 'today', TODAY);
  assert.deepEqual(a.scores, b.scores);
  assert.equal(a.summary, b.summary);
});

test('運勢：分數在 5~95，且每項都有來源說明', () => {
  for (let s = 0; s < 12; s += 1) {
    const f = computeFortune(s, 'today', TODAY);
    for (const v of Object.values(f.scores)) assert.ok(v >= 5 && v <= 95, `${s} ${v}`);
    assert.ok(f.highlights.length >= 6);
  }
});

test('運勢：本週從星期一開始 7 天，本月涵蓋整月', () => {
  const week = periodDates('week', TODAY);
  assert.equal(week.length, 7);
  assert.deepEqual(week[0], { y: 2026, m: 11, d: 23 });
  assert.equal(periodDates('month', TODAY).length, 30);
  const f = computeFortune(SIGN_INDEX.aries, 'week', TODAY);
  assert.ok(f.best && f.worst);
});

test('配對：對稱、同星座與三分相滿分', () => {
  const p = (s) => ({ name: s, sunSign: SIGN_INDEX[s] });
  assert.equal(scorePair(p('aries'), p('leo')).total, scorePair(p('leo'), p('aries')).total);
  assert.equal(scorePair(p('aries'), p('aries')).total, 100);
  assert.equal(scorePair(p('aries'), p('leo')).total, 100);
  const quincunx = scorePair(p('aries'), p('virgo')).total;
  const square = scorePair(p('aries'), p('cancer')).total;
  assert.ok(quincunx < square);
});

test('配對表：12×12 共 78 組，查詢與順序無關', () => {
  const m = sunSignMatrix();
  assert.equal(Object.keys(m).length, 78);
  assert.deepEqual(lookupMatrix(m, 0, 4), lookupMatrix(m, 4, 0));
});

test('配對文案用中文名稱（修正 sbti 分享文字露出英文 id 的錯誤）', () => {
  const s = relationStory(SIGN_INDEX.aries, SIGN_INDEX.libra);
  assert.match(s.elements, /火象 × 風象|風象 × 火象/);
  assert.ok(!/aries|libra/.test(JSON.stringify(s)));
});

test('多人合盤取人對均值', () => {
  const people = ['aries', 'leo', 'cancer'].map((s) => ({ name: s, sunSign: SIGN_INDEX[s] }));
  const g = scoreGroup(people);
  assert.equal(g.pairs.length, 3);
  const avg = Math.round(g.pairs.reduce((a, p) => a + p.total, 0) / 3);
  assert.equal(g.total, avg);
  assert.throws(() => scoreGroup(people.slice(0, 1)));
});

test('精準配對：四項都有資料時用完整四項，沒時間時月亮取可能值平均', () => {
  const a = { name: 'A', natal: buildNatal({ date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei' }) };
  const b = { name: 'B', natal: buildNatal({ date: { y: 1992, m: 1, d: 5 }, time: null, tz: 'Asia/Taipei' }) };
  const r = scorePair(a, b);
  assert.equal(r.bands.filter((x) => x.available).length, 4);
  assert.ok(r.total >= 0 && r.total <= 100);
});

test('塔羅：78 張、名稱不重複', () => {
  assert.equal(DECK.length, 78);
  assert.equal(new Set(DECK.map((c) => c.name)).size, 78);
});

test('塔羅：不放回（同一次不會抽到重複的牌）', () => {
  for (let seed = 1; seed < 300; seed += 1) {
    const r = drawSpread('five', { rng: seededRandom(seed) });
    assert.equal(new Set(r.cards.map((c) => c.id)).size, 5);
  }
});

test('塔羅：固定種子可重現', () => {
  assert.deepEqual(drawSpread('three', { rng: seededRandom(42) }), drawSpread('three', { rng: seededRandom(42) }));
});

test('塔羅：每張牌被抽中的機率均勻（卡方檢定）', () => {
  const N = 78000;
  const counts = new Map();
  const rng = seededRandom(20261123);
  for (let i = 0; i < N; i += 1) {
    const id = drawSpread('single', { rng }).cards[0].id;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  assert.equal(counts.size, 78);
  const expected = N / 78;
  let chi = 0;
  for (const c of counts.values()) chi += ((c - expected) ** 2) / expected;
  assert.ok(chi < 130, `chi-square ${chi.toFixed(1)}（自由度 77，99.9% 臨界值約 122~130）`);
});

test('加密亂數範圍正確', () => {
  for (let i = 0; i < 1000; i += 1) {
    const v = secureRandomInt(78);
    assert.ok(v >= 0 && v < 78 && Number.isInteger(v));
  }
});
