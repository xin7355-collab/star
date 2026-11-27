// 興趣與性格測驗：題目數量、計分（含反向題）、興趣代碼、投給工作性質的票、存檔白名單。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONS, INTEREST_ITEMS, PERSONALITY_ITEMS, RIASEC, RIASEC_ORDER, BIG5, BIG5_ORDER, QUIZ_VERSION,
  scoreQuiz, hollandCode, big5Level, quizVotes, sanitizeQuiz,
} from '../js/core/quiz.js';
import { NATURES } from '../js/core/jobs.js';
import { buildCareer } from '../js/core/career.js';
import { sanitizePerson } from '../js/core/records.js';

// 依題目產生答案：興趣題照 pick(type) 給分；性格題照 want(trait) 給「想要的分數方向」（反向題自動反過來）
function answersFor(interest, personality) {
  return QUESTIONS.map((q) => {
    if (q.part === 'interest') return interest[q.type];
    const v = personality[q.trait];
    return q.r ? 6 - v : v;
  });
}
const flat = (n) => Object.fromEntries(RIASEC_ORDER.map((t) => [t, n]));
const mid = (n) => Object.fromEntries(BIG5_ORDER.map((t) => [t, n]));

test('題目：興趣 36 題（六型各 6 題、交錯排列）、性格 20 題（五個面向各 4 題，反向題各 2 題以上）', () => {
  assert.equal(INTEREST_ITEMS.length, 36);
  assert.equal(PERSONALITY_ITEMS.length, 20);
  assert.equal(QUESTIONS.length, 56);
  for (const t of RIASEC_ORDER) assert.equal(INTEREST_ITEMS.filter((x) => x.type === t).length, 6);
  for (let i = 1; i < INTEREST_ITEMS.length; i += 1) assert.notEqual(INTEREST_ITEMS[i].type, INTEREST_ITEMS[i - 1].type);
  for (const t of BIG5_ORDER) {
    const items = PERSONALITY_ITEMS.filter((x) => x.trait === t);
    assert.equal(items.length, 4, t);
    assert.ok(items.filter((x) => x.r).length >= 2, t);
  }
  assert.equal(new Set(QUESTIONS.map((q) => q.text)).size, QUESTIONS.length, '題目重複');
  for (const t of RIASEC_ORDER) assert.ok(RIASEC[t].natures.every((k) => NATURES[k]));
});

test('計分：全部最高是 100、全部最低是 0；反向題照方向算（「想要外向 5 分」在反向題要答 1）', () => {
  const top = scoreQuiz(answersFor(flat(5), mid(5)), '2026-11-27');
  assert.deepEqual(top.riasec, flat(100));
  assert.deepEqual(top.big5, mid(100));
  assert.equal(top.at, '2026-11-27');
  assert.equal(top.v, QUIZ_VERSION);
  const low = scoreQuiz(answersFor(flat(1), mid(1)));
  assert.deepEqual(low.riasec, flat(0));
  assert.deepEqual(low.big5, mid(0));
  // 每題都答「普通」：興趣 50；性格也是 50（反向題答 3 還是 3）
  const neutral = scoreQuiz(QUESTIONS.map(() => 3));
  assert.deepEqual(neutral.riasec, flat(50));
  assert.deepEqual(neutral.big5, mid(50));
  // 沒答完、答案超出範圍：不算
  assert.equal(scoreQuiz(QUESTIONS.slice(1).map(() => 3)), null);
  assert.equal(scoreQuiz(QUESTIONS.map(() => 6)), null);
  assert.equal(scoreQuiz(null), null);
});

test('興趣代碼：分數最高、40 分以上的最多三型；全部低於 40 分代表沒有特別喜歡的', () => {
  const r = scoreQuiz(answersFor({ R: 5, I: 4, A: 1, S: 2, E: 1, C: 3 }, mid(3)));
  assert.equal(hollandCode(r), 'RIC');
  assert.equal(hollandCode(scoreQuiz(answersFor(flat(2), mid(3)))), '');
  // 只有一型喜歡：不硬湊三個字（其他型每題都答「不太喜歡」只有 25 分）
  const one = scoreQuiz(answersFor({ R: 5, I: 2, A: 2, S: 2, E: 2, C: 2 }, mid(3)));
  assert.equal(hollandCode(one), 'R');
  assert.equal(quizVotes(one).filter((v) => v.source.startsWith('興趣測驗')).length, 1);
  assert.equal(big5Level(70), 'high');
  assert.equal(big5Level(30), 'low');
  assert.equal(big5Level(50), 'mid');
});

test('投票：興趣第一型 2 票、第二型 1 票；性格偏高偏低且有對應的才投；投進「天賦」的工作性質', () => {
  const r = scoreQuiz(answersFor({ R: 5, I: 4, A: 1, S: 2, E: 1, C: 3 }, { E: 1, A: 3, C: 5, S: 5, O: 3 }));
  const votes = quizVotes(r);
  assert.deepEqual(votes[0], { keys: RIASEC.R.natures, source: '興趣測驗：實作型', w: 2 });
  assert.deepEqual(votes[1], { keys: RIASEC.I.natures, source: '興趣測驗：研究型', w: 1 });
  const sources = votes.map((v) => v.source);
  assert.ok(sources.includes('性格測驗：盡責性高') && sources.includes('性格測驗：情緒穩定高') && sources.includes('性格測驗：外向性低'));
  assert.ok(!sources.some((s) => /親和性|開放性/.test(s)), '中等的不投');
  for (const v of votes) assert.ok(v.keys.every((k) => NATURES[k]));
  assert.deepEqual(quizVotes(null), []);
  // 天賦：只有測驗（沒有命盤）也排得出工作性質；票數是加權後的
  const c = buildCareer({ birth: { y: 1990, m: 8, d: 15 }, today: { y: 2026, m: 11, d: 27 }, quiz: r });
  const expert = c.ranked.find((n) => n.key === 'expert');
  assert.ok(expert.count >= 3, `專業技術型 ${expert.count} 票`);
  assert.ok(expert.sources.includes('興趣測驗：實作型'));
  assert.ok(c.points.some((p) => p.system === '測驗'));
  assert.ok(Object.keys(BIG5).every((k) => BIG5_ORDER.includes(k)));
});

test('存檔白名單：只收版本、日期、0～100 的整數分數；不合法整筆不收；經由名單存檔也保留', () => {
  const r = scoreQuiz(QUESTIONS.map(() => 4), '2026-11-27');
  assert.deepEqual(sanitizeQuiz(r), r);
  assert.equal(sanitizeQuiz({ ...r, v: 99 }), null);
  assert.equal(sanitizeQuiz({ ...r, riasec: { ...r.riasec, R: 101 } }), null);
  assert.equal(sanitizeQuiz({ ...r, big5: { ...r.big5, O: 'x' } }), null);
  assert.equal(sanitizeQuiz({ ...r, at: '<script>' }).at, '');
  assert.equal(sanitizeQuiz(null), null);
  const person = sanitizePerson({ id: 'p-0123456789abcdef', name: '我', raw: { calendar: 'solar', era: 'ad', year: 1990, month: 8, day: 15, leap: false, knowTime: false, placeId: 'taipei', tz: 'Asia/Taipei' }, quiz: { ...r, answers: [1, 2, 3] } });
  assert.deepEqual(person.quiz, r, '每一題的答案不存');
});
