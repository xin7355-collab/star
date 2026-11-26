// 工作選單與換跑道：選單資料完整、存檔白名單、適合程度、轉換難度與橋接工作、步驟、時機、修正想法、推薦。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOB_GROUPS, NATURES, jobOf, jobFit, sanitizeCareer, careerPlan, careerMaster, changeTiming, suggestJobs, MAX_TARGETS, TENURES } from '../js/core/jobs.js';
import { NATURES as CAREER_NATURES, buildCareer } from '../js/core/career.js';
import { sanitizePerson } from '../js/core/records.js';
import { buildBazi, yongShen } from '../js/core/bazi.js';
import { buildLifeline } from '../js/core/lifeline.js';

const WX = ['木', '火', '土', '金', '水'];
// 一個「專業技術、研究分析」最強、喜用火木的人
const RANKED = [
  { key: 'expert', label: '專業技術型', count: 3 }, { key: 'research', label: '研究分析型', count: 2 },
  { key: 'public', label: '公眾溝通型', count: 2 }, { key: 'manage', label: '管理決策型', count: 1 },
];
const YS = { primary: '火', secondary: '木', avoid: ['金', '水'] };
const YEARS = [
  { year: 2026, level: '注意', tags: ['正官年', '值太歲'] },
  { year: 2027, level: '順', tags: ['傷官年', '天干是喜用'] },
  { year: 2028, level: '平', tags: ['偏財年'] },
  { year: 2029, level: '小心', tags: ['七殺年', '沖太歲'] },
  { year: 2030, level: '小順', tags: ['正財年'] },
];

test('工作選單：代碼不重複；每個工作都有 1～2 種工作性質、行業五行、要補的能力、怎麼入行、AI 影響；狀態類（學生、待業…）另外標', () => {
  const ids = new Set();
  let jobs = 0;
  for (const g of JOB_GROUPS) {
    for (const x of g.jobs) {
      assert.ok(!ids.has(x.id), `重複：${x.id}`);
      ids.add(x.id);
      if (x.status) continue;
      jobs += 1;
      assert.ok(x.natures.length >= 1 && x.natures.length <= 2 && x.natures.every((k) => NATURES[k]), x.id);
      assert.ok(x.wx.length >= 1 && x.wx.every((w) => WX.includes(w)), x.id);
      assert.ok(x.skills.length > 4 && x.entry.length > 8, x.id);
      assert.ok([0, 1, 2].includes(x.ai), x.id);
    }
  }
  assert.ok(jobs >= 75, `只有 ${jobs} 種工作`);
  assert.deepEqual(JOB_GROUPS.find((g) => g.id === 'status').jobs.map((x) => x.id), ['student', 'jobless', 'homemaker', 'retired']);
  // 工作性質只有一份定義（career.js 轉出 jobs.js 的）
  assert.equal(CAREER_NATURES, NATURES);
});

test('存檔白名單：只收選單裡的代碼、最多 3 個想做的、不重複、不收現在的工作和狀態類，什麼都沒選就不存', () => {
  assert.equal(sanitizeCareer(null), null);
  assert.equal(sanitizeCareer({ current: '', targets: [] }), null);
  assert.deepEqual(sanitizeCareer({ current: 'accountant', tenure: '5-10', targets: ['ai_eng', 'ai_eng', 'accountant', 'student', 'xxx', 'uiux', 'data', 'swe'] }),
    { current: 'accountant', tenure: '5-10', targets: ['ai_eng', 'uiux', 'data'] });
  assert.equal(sanitizeCareer({ current: '<script>', tenure: 'forever', targets: ['swe'] }).current, '');
  assert.equal(sanitizeCareer({ current: 'swe', tenure: 'forever' }).tenure, '');
  assert.equal(MAX_TARGETS, 3);
  assert.ok(TENURES.some((t) => t.value === 'gt10'));
  // 名單存檔帶著工作資料；亂填的欄位丟掉
  const raw = { calendar: 'solar', era: 'ad', year: 1990, month: 8, day: 15, leap: false, knowTime: false, time: '', placeId: 'taipei', lat: null, lon: null, tz: 'Asia/Taipei', fold: null, solar: null };
  const p = sanitizePerson({ name: '我', raw, career: { current: 'swe', targets: ['product', 'nope'] } });
  assert.deepEqual(p.career, { current: 'swe', tenure: '', targets: ['product'] });
  assert.equal('career' in sanitizePerson({ name: '我', raw, career: { current: 'nope' } }), false);
});

test('適合程度：工作性質對上命盤最強的類型、行業五行是喜用就高；狀態類不打分', () => {
  const ai = jobFit(jobOf('ai_eng'), { ranked: RANKED, ys: YS }); // expert＋research、火＝喜用
  assert.equal(ai.level, '很適合');
  assert.equal(ai.score, 7);
  assert.match(ai.why[1], /「火」是你的喜用/);
  const acc = jobFit(jobOf('accountant'), { ranked: RANKED, ys: YS }); // finance＋stable、金＝忌神
  assert.equal(acc.level, '要多花力氣');
  assert.match(acc.why[0], /不是你最強的類型/);
  assert.match(acc.why[1], /忌神/);
  assert.equal(jobFit(jobOf('student'), { ranked: RANKED, ys: YS }), null);
});

test('換跑道的時機：變動的訊號落在平以上的年份才推薦；近三年另外挑一年（最好的常在七八年後）；只有「小心」列為先別裸辭', () => {
  const t = changeTiming(YEARS);
  assert.deepEqual(t.best.map((y) => y.year), [2027, 2028]);
  assert.deepEqual(t.best[0].signals, ['傷官年']);
  assert.equal(t.soon.year, 2027);
  assert.deepEqual(t.avoid, [2029]);
  assert.deepEqual(changeTiming([]), { best: [], soon: null, avoid: [] });
  // 最好的年份在很後面：近三年還是給一個可以轉的年份
  const late = changeTiming([
    { year: 2026, level: '注意', tags: [] }, { year: 2027, level: '平', tags: [] }, { year: 2028, level: '小順', tags: [] },
    { year: 2029, level: '注意', tags: [] }, { year: 2030, level: '注意', tags: [] }, { year: 2034, level: '順', tags: ['食神年', '沖月支'] },
  ]);
  assert.equal(late.best[0].year, 2034);
  assert.equal(late.soon.year, 2028);
  assert.deepEqual(late.avoid, []);
});

test('會計想轉 AI 工程師（跨很大）：先經過跳板工作（資料、IT、產品，不會是作業員）、先別裸辭；方向對；今年注意就建議明年再轉', () => {
  const r = careerPlan({ current: 'accountant', tenure: '5-10', targets: ['ai_eng'], ranked: RANKED, ys: YS, years: YEARS, age: 36 });
  const it = r.items[0];
  assert.equal(it.distance, 'far');
  assert.ok(['data', 'it_admin', 'product'].includes(it.bridge.id), it.bridge.id);
  assert.match(it.plan[0], /先不要裸辭/);
  assert.match(it.plan[1], new RegExp(`先轉到「${it.bridge.name}」`));
  assert.match(it.plan[3], /做很久了，舊經驗別丟/); // 年資 5～10 年
  assert.ok(it.delta > 0);
  assert.ok(r.notes.some((n) => n.tone === 'good' && /方向是對的/.test(n.text)));
  assert.ok(r.notes.some((n) => /2026.*不建議裸辭.*2027 年再轉/.test(n.text)));
  const m = careerMaster(r, [{ label: '專業技術型', desc: '把一門技術做深', edge: '專精、可靠', trap: '只顧技術' }]);
  assert.match(m.verdict, /^老師看你的工作：想換到「AI 工程師」，方向是對的/);
  assert.match(m.verdict, /2027 年比較適合轉換/);
  assert.deepEqual(m.remedies.map((x) => x.title), ['怎麼轉到「AI 工程師」（跨很大）', '這幾年先別裸辭']);
  assert.ok(m.combos.every((c) => Array.isArray(c.go) && c.go.length === 2));
});

test('想換的沒有比現在適合：直說，建議先換公司或部門；想換的對你都要多花力氣：推薦更適合的工作', () => {
  const worse = careerPlan({ current: 'swe', targets: ['admin'], ranked: RANKED, ys: YS, age: 36 });
  assert.ok(worse.notes.some((n) => n.tone === 'bad' && /換公司、換部門/.test(n.text)));
  assert.match(careerMaster(worse, []).verdict, /直說：想換的「行政／助理」沒有比現在的「軟體工程師」更適合你/);
  assert.ok(!/老師看你的工作：老師/.test(careerMaster(worse, []).verdict));
  const both = careerPlan({ current: 'accountant', targets: ['admin'], ranked: RANKED, ys: YS, age: 36 });
  assert.ok(!both.notes.some((n) => /方向是對的/.test(n.text)), '兩個都不適合時，比現在稍好不等於方向對');
  assert.match(careerMaster(both, []).verdict, /你選的工作對你都要多花力氣/);
  assert.ok(both.notes.some((n) => /例行的部分容易被 AI 自動化/.test(n.text))); // 行政 AI 影響高
});

test('方向太分散、養成期長的工作、現在和想去的都適合：各有提醒', () => {
  const r = careerPlan({ current: 'hw_rd', targets: ['nurse', 'realestate', 'ai_eng'], ranked: RANKED, ys: YS, age: 40 });
  assert.ok(r.notes.some((n) => /要相關科系和國考.*先從相關的輔助工作開始/.test(n.text)));
  const scattered = careerPlan({ current: 'student', targets: ['realestate', 'chef', 'psych'], ranked: RANKED, ys: YS, age: 20 });
  assert.ok(scattered.notes.some((n) => /方向差很多/.test(n.text)));
  const good = careerPlan({ current: 'swe', targets: ['ai_eng'], ranked: RANKED, ys: YS, age: 30 });
  assert.ok(good.notes.some((n) => /想離開現在的地方/.test(n.text)));
});

test('還沒有工作（學生、全職照顧家庭、退休）：從頭開始的步驟；相近的工作：內部轉調、同業跳槽', () => {
  const st = careerPlan({ current: 'student', targets: ['swe'], ranked: RANKED, ys: YS, age: 21 });
  assert.equal(st.items[0].distance, 'start');
  assert.match(st.items[0].plan[0], /實習、兼職/);
  const hm = careerPlan({ current: 'homemaker', targets: ['admin'], ranked: RANKED, ys: YS, age: 45 });
  assert.match(hm.items[0].plan[0], /兼職或時間彈性/);
  const near = careerPlan({ current: 'swe', targets: ['data'], ranked: RANKED, ys: YS, age: 30 });
  assert.equal(near.items[0].distance, 'near');
  assert.match(near.items[0].plan[1], /3～6 個月/);
  const mid = careerPlan({ current: 'accountant', tenure: 'gt10', targets: ['purchase'], ranked: RANKED, ys: YS, age: 45 }); // 不同類、都有「理財經營」
  assert.equal(mid.items[0].distance, 'mid');
  assert.ok(mid.items[0].plan.some((t) => /帶著舊專業轉/.test(t)));
});

test('推薦你可能沒想到的工作：不含已選的；30 歲以上不推要從頭讀科系、考國考的工作', () => {
  const young = suggestJobs({ ranked: [{ key: 'care', label: '助人服務型', count: 3 }, { key: 'expert', label: '專業技術型', count: 2 }], ys: { primary: '木', secondary: '土', avoid: ['金'] }, n: 5, age: 20 });
  assert.ok(young.some((s) => s.job.long), '年輕人可以推醫護');
  const older = suggestJobs({ ranked: [{ key: 'care', label: '助人服務型', count: 3 }, { key: 'expert', label: '專業技術型', count: 2 }], ys: { primary: '木', secondary: '土', avoid: ['金'] }, n: 5, age: 45, exclude: ['caregiver'] });
  assert.ok(older.every((s) => !s.job.long && s.job.id !== 'caregiver'));
  for (let i = 1; i < older.length; i += 1) assert.ok(older[i - 1].fit.score >= older[i].fit.score);
});

test('用實際的命盤跑一次：每一行都是真的文字', () => {
  const today = { y: 2026, m: 11, d: 27 };
  const input = { date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, lat: 25.04, lon: 121.5, tz: 'Asia/Taipei' };
  const bazi = buildBazi(input, { gender: '男', today });
  const r = buildCareer({ bazi, birth: input.date, today, lifePathNumber: 5 });
  const L = buildLifeline({ bazi, birth: input.date, today, gender: '男' });
  const plan = careerPlan({ current: 'sales', tenure: '3-5', targets: ['product', 'creator', 'civil'], ranked: r.ranked, ys: yongShen(bazi), years: L.years, age: 36 });
  const m = careerMaster(plan, r.natures);
  const lines = [m.verdict, ...m.why.map((w) => w.text), ...m.remedies.flatMap((x) => [x.title, ...x.steps]), ...m.boosts,
    ...plan.items.flatMap((it) => [...it.fit.why, ...it.plan, it.ai.note]), ...plan.suggest.flatMap((s) => s.fit.why)];
  for (const t of lines) assert.ok(typeof t === 'string' && t.length > 4 && !/undefined|null|NaN/.test(t), t);
});
