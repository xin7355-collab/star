import test from 'node:test';
import assert from 'node:assert/strict';
import { TAG_CHECKS, SYSTEM_ORDER, VERDICT, verdictOf, traitCheck } from '../js/core/trait-check.js';
import { TAGS } from '../js/core/reading-texts.js';
import { buildReading } from '../js/core/reading.js';
import { BIG5_ORDER, RIASEC_ORDER } from '../js/core/quiz.js';

const quizOf = (big5, riasec = {}) => ({
  v: 1,
  big5: { E: 50, A: 50, C: 50, S: 50, O: 50, ...big5 },
  riasec: { R: 50, I: 50, A: 50, S: 50, E: 50, C: 50, ...riasec },
});

test('每個特質都有對照（量不到的明寫 null），檢查項目只用測驗真的有的面向', () => {
  assert.deepEqual(Object.keys(TAG_CHECKS).sort(), Object.keys(TAGS).sort());
  for (const [tag, checks] of Object.entries(TAG_CHECKS)) {
    if (checks === null) continue;
    assert.ok(checks.length >= 1, tag);
    for (const c of checks) {
      assert.ok(['b5', 'ri'].includes(c.k), tag);
      assert.ok((c.k === 'b5' ? BIG5_ORDER : RIASEC_ORDER).includes(c.t), `${tag} ${c.t}`);
      assert.ok(['hi', 'lo'].includes(c.dir), tag);
    }
  }
  // 財運、桃花、獨立不是測驗量得到的，不硬算
  for (const t of ['wealth', 'romance', 'independent']) assert.equal(TAG_CHECKS[t], null);
  assert.deepEqual(Object.keys(VERDICT), ['hit', 'half', 'miss', 'na']);
});

test('逐項判斷：60 以上說中、40 以下不像、中間一半一半；細膩敏感看的是情緒穩定偏低', () => {
  assert.equal(verdictOf('lead', quizOf({ E: 80 }, { E: 70 })).verdict, 'hit');
  assert.equal(verdictOf('lead', quizOf({ E: 20 }, { E: 10 })).verdict, 'miss');
  assert.equal(verdictOf('lead', quizOf({ E: 50 }, { E: 50 })).verdict, 'half');
  assert.equal(verdictOf('lead', quizOf({ E: 80 }, { E: 70 })).detail, '企業型 70、外向性 80');
  assert.equal(verdictOf('sensitive', quizOf({ S: 20 })).verdict, 'hit');
  assert.equal(verdictOf('sensitive', quizOf({ S: 85 })).verdict, 'miss');
  assert.equal(verdictOf('wealth', quizOf({})).verdict, 'na');
  assert.equal(verdictOf('lead', null).verdict, 'na');
});

test('整理成各系統：順序固定（不依說中多少排）、每一句都有結果、附「隨便挑也會說中多少」', () => {
  const said = [
    { system: '血型', source: '血型 O 型（流行文化）', tags: ['lead', 'social'] },
    { system: '占星', source: '占星：太陽獅子座', tags: ['lead', 'creative'] },
    { system: '八字', source: '八字：日主壬水', tags: ['analytic', 'wealth'] },
  ];
  const quiz = quizOf({ E: 20, O: 80, A: 70 }, { E: 15, I: 85, A: 75 });
  const r = traitCheck(said, quiz);
  assert.deepEqual(r.systems.map((s) => s.system), ['占星', '八字', '血型']);
  assert.equal(r.systems[0].items[0].source, '太陽獅子座');
  const verdicts = r.systems[0].items[0].tags.map((t) => t.verdict);
  assert.deepEqual(verdicts, ['miss', 'hit']);
  assert.deepEqual(r.systems[1].items[0].tags.map((t) => t.verdict), ['hit', 'na']);
  assert.equal(r.counts.hit + r.counts.half + r.counts.miss + r.counts.na, 6);
  assert.equal(r.base.testable, 10);
  assert.ok(r.base.hits >= 1 && r.base.pct === Math.round((r.base.hits / 10) * 100));
  assert.equal(traitCheck(said, null), null);
  for (const s of r.systems) assert.ok(SYSTEM_ORDER.includes(s.system));
});

test('綜合解讀記下每個系統說了哪些特質（沒有時間就沒有上升、紫微）', () => {
  const r = buildReading({ birth: { y: 1990, m: 8, d: 15 }, today: { y: 2026, m: 11, d: 27 }, bloodType: 'O' });
  assert.ok(r.said.some((x) => x.system === '生命靈數' && x.tags.length));
  assert.ok(r.said.some((x) => x.system === '瑪雅'));
  assert.ok(r.said.some((x) => x.system === '血型'));
  assert.ok(!r.said.some((x) => x.system === '紫微' || /上升/.test(x.source)));
  const c = traitCheck(r.said, quizOf({ O: 70 }));
  assert.deepEqual(c.systems.map((s) => s.system), ['生命靈數', '瑪雅', '血型']);
});
