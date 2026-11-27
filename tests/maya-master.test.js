import test from 'node:test';
import assert from 'node:assert/strict';
import { kinInfo, pairSummary, dayRelation, kinOf } from '../js/core/maya-kin.js';
import { mayaPairMaster, sharedMayaDays } from '../js/core/maya-master.js';
import { computeMaya, compareMaya, explainCompare } from '../js/core/maya.js';
import { MAYA_KEYWORD_TEXT } from '../js/core/reading-texts.js';

const person = (kin, name) => ({ ...kinInfo(kin), name });
const FROM = { y: 2026, m: 11, d: 27 };

test('老師解盤（KIN 157 磁性紅地球 × KIN 24 光譜黃種子）：指名道姓，講出誰的長處補誰的卡點、號碼怎麼算', () => {
  const a = person(157, '你');
  const b = person(24, '對方');
  const code = explainCompare(compareMaya(computeMaya({ y: 1993, m: 4, d: 4 }), computeMaya({ y: 1998, m: 6, d: 2 })), '你', '對方', MAYA_KEYWORD_TEXT);
  const m = mayaPairMaster({ a, b, sum: pairSummary(157, 24), code, days: sharedMayaDays(157, 24, FROM) });
  assert.equal(m.badge.text, '隱藏推動');
  assert.match(m.verdict, /^你（紅地球）和對方（黃種子）互為「隱藏推動」/);
  // 交叉：對方的卡點配你的長處、你的卡點配對方的長處
  assert.match(m.verdict, /對方卡在「固執，急著看到成果，或覺得自己長得不夠快」的時候，你的「掌握時機、帶領方向，把人凝聚起來」能推一把/);
  assert.match(m.why[0].text, /圖騰號碼相加是 21（紅地球 17＋黃種子 4）/);
  assert.match(m.why[1].text, /你是紅色（開創）.*對方是黃色（成熟）.*推動色/);
  assert.match(m.why[2].text, /調性 1「目的」.*調性 11「解放」/);
  assert.ok(m.why.some((w) => /瑪雅密碼（另一套算法）5 個位置/.test(w.text)));
  assert.deepEqual(m.remedies.map((r) => r.title), ['對方卡住時，你可以這樣做', '你卡住時，對方可以這樣做', '相處原則（隱藏推動）']);
  assert.match(m.remedies[0].steps[2], /^對方自己可以：一次只種一顆種子/);
  assert.ok(m.boosts[0].startsWith('一起做事的分工：你負責「掌握時機'));
  assert.match(m.boosts[0], /（紅色擅長起頭）.*（黃色擅長收尾）/);
  assert.ok(m.combos.every((c) => Array.isArray(c.go) && c.go.length === 2));
});

test('兩個人都順的日子：最多 3 天、依日期排、兩個人都不在挑戰位；算法和「今日」同一套', () => {
  const days = sharedMayaDays(157, 24, FROM);
  assert.ok(days.length >= 1 && days.length <= 3);
  const ms = days.map((d) => Date.UTC(d.date.y, d.date.m - 1, d.date.d));
  assert.deepEqual([...ms].sort((x, y) => x - y), ms);
  for (const d of days) {
    const kin = kinOf(d.date);
    assert.equal(kin, d.kin);
    for (const k of [157, 24]) assert.ok(!['antipode', 'none'].includes(dayRelation(kin, k)), `${d.label}`);
    assert.match(d.label, /^\d+\/\d+（週[日一二三四五六]）$/);
  }
  assert.deepEqual(sharedMayaDays(157, 24, { y: 1700, m: 1, d: 1 }), []);
});

test('每一種配對都組得出完整的解盤：沒有 undefined、斷語帶兩個人的名字、引導分得出誰引導誰', () => {
  for (let x = 1; x <= 260; x += 7) {
    for (let y = 1; y <= 260; y += 11) {
      const m = mayaPairMaster({ a: person(x, '甲'), b: person(y, '乙'), sum: pairSummary(x, y), days: [] });
      const all = [m.verdict, ...m.why.map((w) => w.text), ...m.remedies.flatMap((r) => [r.title, ...r.steps]), ...m.boosts];
      for (const t of all) assert.ok(t && !/undefined|null|NaN/.test(t), `${x}/${y}: ${t}`);
      assert.ok(/甲/.test(m.verdict) && /乙/.test(m.verdict), `${x}/${y}`);
      assert.equal(m.remedies.length, 3);
    }
  }
  // KIN 57 紅地球是 KIN 109 紅月的引導（單向）
  const g = mayaPairMaster({ a: person(109, '你'), b: person(57, '小華'), sum: pairSummary(109, 57) });
  assert.match(g.verdict, /^小華（紅地球）是你（紅月）的「引導」/);
  // 同調性：問題不重複列兩次
  assert.match(g.boosts.find((t) => /調性的問題|兩個問題/.test(t)), /一起問一次/);
});
