// 格局化解：每一項都要有原因和至少一段做法；涉及鏡子一律提醒不要照到鄰居；八宅凶方附上「洩」的化解。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, ISSUES, PRINCIPLE, tailor, pickIssues, KUA_STAR_DETAIL, STAR_CURE_WHY } from '../js/core/fengshui-fix.js';
import { personalDirections } from '../js/core/fengshui.js';

test('化解清單：id 不重複、每個地方至少三項、每項都有原因與做法', () => {
  const ids = new Set();
  for (const x of ISSUES) {
    assert.ok(!ids.has(x.id), `重複 ${x.id}`);
    ids.add(x.id);
    assert.ok(AREAS.some((a) => a.id === x.area), x.id);
    assert.ok(x.label && x.why, x.id);
    assert.ok(x.move || x.block || x.cure, `${x.id} 沒有任何做法`);
  }
  for (const a of AREAS) assert.ok(ISSUES.filter((x) => x.area === a.id).length >= 3, a.id);
  assert.match(PRINCIPLE, /移開.*擋.*化/);
});

test('提到八卦鏡、凸面鏡的地方都提醒會照到鄰居、不建議自己掛', () => {
  for (const x of ISSUES) {
    const all = `${x.move}${x.block}${x.cure}`;
    if (/八卦鏡|凸面鏡/.test(all)) assert.match(all, /不建議/, x.id);
  }
});

test('勾選順序照清單、不認得的 id 忽略；植物化解依喜用補一句', () => {
  assert.deepEqual(pickIssues(['bed-beam', 'nope', 'door-facing-door']).map((x) => x.id), ['door-facing-door', 'bed-beam']);
  assert.deepEqual(pickIssues(null), []);
  const plant = ISSUES.find((x) => x.plant);
  const noPlant = ISSUES.find((x) => !x.plant);
  assert.match(tailor(plant, { primary: '土' }), /陶盆/);
  assert.match(tailor(plant, { primary: '水' }), /水耕/);
  assert.equal(tailor(noPlant, { primary: '土' }), '');
  assert.equal(tailor(plant, null), '');
});

test('八宅：吉方給加強、凶方給以洩化解的五行；飛星凶星附原理', () => {
  const p = personalDirections({ y: 1990, m: 8, d: 15 }, '男'); // 坎卦
  for (const s of p.stars) {
    assert.ok(s.star, s.key);
    if (s.good) assert.ok(s.boost, s.key);
    else assert.ok(s.cure, s.key);
  }
  // 凶星的洩：土→金、水→木、火→土、金→水
  assert.match(KUA_STAR_DETAIL.禍害.cure, /金/);
  assert.match(KUA_STAR_DETAIL.六煞.cure, /木/);
  assert.match(KUA_STAR_DETAIL.五鬼.cure, /土/);
  assert.match(KUA_STAR_DETAIL.絕命.cure, /水/);
  assert.deepEqual(Object.keys(STAR_CURE_WHY).map(Number), [2, 3, 5, 7]);
});
