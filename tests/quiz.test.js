// 興趣與性格測驗：題目數量、計分（含反向題）、興趣代碼、投給工作性質的票、存檔白名單。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONS, INTEREST_ITEMS, PERSONALITY_ITEMS, RIASEC, RIASEC_ORDER, BIG5, BIG5_ORDER, QUIZ_VERSION,
  scoreQuiz, hollandCode, big5Level, sanitizeQuiz, interestFit, personalityFit, eiOf, mbtiOf,
} from '../js/core/quiz.js';
import { NATURES, jobOf, jobFit, overallOf, careerPlan, recommendJobs } from '../js/core/jobs.js';
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
  assert.equal(big5Level(70), 'high');
  assert.equal(big5Level(30), 'low');
  assert.equal(big5Level(50), 'mid');
});

test('和工作比：興趣相符看工作偏的那幾型、性格相符看工作最吃重的面向；命理的天賦不再混進測驗的票', () => {
  const r = scoreQuiz(answersFor({ R: 5, I: 5, A: 1, S: 1, E: 1, C: 3 }, { E: 1, A: 3, C: 5, S: 5, O: 3 }));
  // 電信工程技術員（專業技術＋穩定制度）→ 實作、研究、事務
  const tele = interestFit(jobOf('3522').natures, r);
  assert.deepEqual(tele.letters, ['R', 'I', 'C']);
  // 主要性質（專業技術：實作、研究）權重 2，穩定制度（事務）權重 1
  assert.equal(tele.score, Math.round((100 * 2 + 100 * 2 + 50) / 5));
  // 業務（業務開拓＋變動移動）→ 企業×2、實作×1：你討厭說服人，雖然喜歡實作，還是偏低（不是 50 分的「普通」）
  const sales = interestFit(jobOf('sales').natures, r);
  assert.deepEqual(sales.letters, ['E', 'R']);
  assert.equal(sales.score, Math.round(100 / 3));
  // 性格：業務吃外向（主要）、情緒穩定，你偏內向 → 低；行政吃盡責 → 高
  assert.ok(personalityFit(jobOf('sales').natures, r).score < 50);
  assert.ok(personalityFit(jobOf('admin').natures, r).score >= 75);
  assert.equal(interestFit(['expert'], null), null);
  assert.equal(interestFit([], r), null);
  assert.equal(personalityFit(['不存在'], r), null);
  // 天賦（命理）不再收測驗的票
  const c = buildCareer({ birth: { y: 1990, m: 8, d: 15 }, today: { y: 2026, m: 11, d: 27 }, quiz: r });
  assert.ok(c.ranked.every((n) => n.sources.every((x) => !/測驗/.test(x))));
});

test('E 人／I 人：外向性 60 以上偏 E、40 以下偏 I、中間型；類 MBTI 中間的寫 X，不硬分', () => {
  const mk = (b) => ({ big5: { E: 50, A: 50, C: 50, S: 50, O: 50, ...b } });
  assert.equal(eiOf(mk({ E: 75 })).code, 'E');
  assert.equal(eiOf(mk({ E: 25 })).code, 'I');
  assert.equal(eiOf(mk({ E: 50 })).code, 'X');
  assert.equal(eiOf(null), null);
  assert.equal(mbtiOf(mk({ E: 20, O: 80, A: 30, C: 70 })), 'INTJ');
  assert.equal(mbtiOf(mk({ E: 70, O: 50, A: 65, C: 35 })), 'EXFP');
  assert.equal(mbtiOf(null), '');
});

test('綜合分數：做了測驗多興趣、性格兩項；喜歡的類型分數高；想去業務但偏 I 人會被提醒', () => {
  const ranked = [{ key: 'expert', label: '專業技術型', count: 3 }, { key: 'stable', label: '穩定制度型', count: 2 }];
  const r = scoreQuiz(answersFor({ R: 5, I: 5, A: 1, S: 1, E: 1, C: 3 }, { E: 1, A: 3, C: 5, S: 5, O: 3 }));
  const job = jobOf('3522');
  const fit = jobFit(job, { ranked, ys: null });
  const without = overallOf(job, { fit });
  const withQuiz = overallOf(job, { fit, quiz: r });
  assert.deepEqual(without.parts.map((x) => x.key), ['talent', 'future']);
  assert.deepEqual(withQuiz.parts.map((x) => x.key), ['talent', 'interest', 'personality', 'future']);
  assert.ok(withQuiz.score > without.score, '興趣、性格都對上，分數往上');
  // 推薦會受測驗影響：喜歡實作研究的人，前幾名沒有業務
  const rec = recommendJobs({ ranked, quiz: r, n: 10 });
  assert.ok(rec.every((x) => x.job.id !== 'sales'));
  const plan = careerPlan({ current: 'admin', targets: ['sales'], ranked, quiz: r });
  assert.ok(plan.notes.some((n) => /你偏 I 人/.test(n.text)));
  assert.ok(plan.notes.some((n) => /興趣測驗：「業務」/.test(n.text)));
  assert.deepEqual(plan.quiz.code.split(''), ['R', 'I', 'C']);
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
