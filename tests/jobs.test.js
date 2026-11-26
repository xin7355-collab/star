// 工作選單與換跑道：選單資料完整、存檔白名單、適合程度、轉換難度與橋接工作、步驟、時機、修正想法、推薦。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOB_GROUPS, NATURES, jobOf, jobFit, sanitizeCareer, careerPlan, careerMaster, changeTiming, suggestJobs, MAX_TARGETS, TENURES, PRIORITIES, RUNWAYS, TRAIT_KEYS, fitPct, aiNoteOf } from '../js/core/jobs.js';
import { NATURES as CAREER_NATURES, buildCareer, careerTimeline, TIMELINE_MODE } from '../js/core/career.js';
import { EMERGING } from '../js/core/emerging.js';
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

test('存檔白名單：只收選單裡的代碼、最多 3 個想做的、不重複、不收現在的工作和狀態類；最在意的、能撐多久只收選項；什麼都沒選就不存', () => {
  assert.equal(sanitizeCareer(null), null);
  assert.equal(sanitizeCareer({ current: '', targets: [] }), null);
  assert.deepEqual(sanitizeCareer({ current: 'accountant', tenure: '5-10', priority: 'stable', runway: 'half', targets: ['ai_eng', 'ai_eng', 'accountant', 'student', 'xxx', 'uiux', 'data', 'swe'] }),
    { current: 'accountant', tenure: '5-10', priority: 'stable', runway: 'half', targets: ['ai_eng', 'uiux', 'data'] });
  assert.deepEqual(sanitizeCareer({ current: '<script>', tenure: 'forever', priority: 'money!!', runway: 'never', targets: ['swe'] }), { current: '', tenure: '', priority: '', runway: '', targets: ['swe'] });
  // 只填了最在意的事也算有填（之後才選工作）
  assert.deepEqual(sanitizeCareer({ priority: 'income' }), { current: '', tenure: '', priority: 'income', runway: '', targets: [] });
  assert.equal(MAX_TARGETS, 3);
  assert.ok(TENURES.some((t) => t.value === 'gt10'));
  assert.deepEqual(PRIORITIES.map((x) => x.value), ['', 'fit', 'income', 'stable', 'freedom', 'balance']);
  assert.deepEqual(RUNWAYS.map((x) => x.value), ['', 'none', 'half', 'year']);
  // 名單存檔帶著工作資料；亂填的欄位丟掉
  const raw = { calendar: 'solar', era: 'ad', year: 1990, month: 8, day: 15, leap: false, knowTime: false, time: '', placeId: 'taipei', lat: null, lon: null, tz: 'Asia/Taipei', fold: null, solar: null };
  const p = sanitizePerson({ name: '我', raw, career: { current: 'swe', priority: 'balance', targets: ['product', 'nope'] } });
  assert.deepEqual(p.career, { current: 'swe', tenure: '', priority: 'balance', runway: '', targets: ['product'] });
  assert.equal('career' in sanitizePerson({ name: '我', raw, career: { current: 'nope' } }), false);
});

test('每個工作都有收入、穩定、自由、生活平衡的傾向（1～3）和趨勢產業代碼（對得上新興產業）', () => {
  const trends = new Set(EMERGING.map((e) => e.id));
  for (const g of JOB_GROUPS) {
    for (const x of g.jobs) {
      if (x.status) continue;
      const j = jobOf(x.id);
      for (const t of TRAIT_KEYS) assert.ok([1, 2, 3].includes(j[t.key]), `${x.id} ${t.key}`);
      assert.ok(j.trend === null || trends.has(j.trend), `${x.id} ${j.trend}`);
      assert.ok(aiNoteOf(j).length > 10);
    }
  }
  // 幾個常識：公務員穩定、自由接案自由、業務收入起伏大
  assert.equal(jobOf('civil').stab, 3);
  assert.equal(jobOf('freelancer').free, 3);
  assert.equal(jobOf('sales').stab, 1);
});

test('適合度 0～100：不從 0 起（很不適合顯示 5 分會嚇到人）；三個等級對照 50、66', () => {
  assert.equal(fitPct(-1), 22);
  assert.equal(fitPct(2.5), 50);
  assert.equal(fitPct(4.5), 66);
  assert.ok(fitPct(20) <= 98 && fitPct(-20) >= 15);
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
  // 沒填最在意的事、能撐多久：準備好再換；總評一段話講完天賦、現況、路線、時機
  assert.equal(r.path.id, 'prep');
  assert.equal(r.path.year, 2027);
  const m = careerMaster(r, [{ label: '專業技術型', desc: '把一門技術做深。', edge: '專精、可靠', trap: '只顧技術' }]);
  assert.match(m.verdict, /^老師看你：天賦偏「專業技術型」/);
  assert.match(m.verdict, /現在的「會計」適合度 \d+（要多花力氣）/);
  assert.match(m.verdict, /建議：準備好再換到「AI 工程師」。2027 年是比較好的時機。/);
  assert.equal(m.badge, '準備好再換');
  assert.deepEqual(m.remedies.map((x) => x.title), ['建議路線：準備好再換到「AI 工程師」', '這幾年先別裸辭']);
  assert.ok(m.remedies[0].steps.some((t) => /先到「.+」累積經驗/.test(t)), '跨很大要有跳板');
  assert.ok(m.combos.every((c) => Array.isArray(c.go) && c.go.length === 2));
});

test('建議路線看你最在意的事和能撐多久：收入不能變少→副業先行；能撐一年→全力轉換；最在意穩定卻想去自媒體→副業先行', () => {
  const base = { current: 'accountant', targets: ['ai_eng'], ranked: RANKED, ys: YS, years: YEARS, age: 36 };
  assert.equal(careerPlan({ ...base, runway: 'none' }).path.id, 'side');
  assert.equal(careerPlan({ ...base, runway: 'year' }).path.id, 'switch');
  assert.equal(careerPlan({ ...base, runway: 'half' }).path.id, 'prep');
  // 自媒體的穩定偏低：最在意穩定的人，除非存款撐得了一年，都先當副業；還會直說這一項偏低
  const creator = careerPlan({ current: 'accountant', targets: ['creator'], priority: 'stable', runway: 'half', ranked: [{ key: 'create', label: '創意表達型', count: 3 }, { key: 'public', label: '公眾溝通型', count: 2 }], ys: YS, years: YEARS, age: 30 });
  assert.equal(creator.path.id, 'side');
  assert.ok(creator.notes.some((n) => n.tone === 'bad' && /你最在意「穩定」，但「內容創作者／自媒體」的穩定偏低/.test(n.text)));
  // 最在意收入、想去的收入也高：講出來
  const income = careerPlan({ ...base, priority: 'income' });
  assert.ok(income.notes.some((n) => n.tone === 'good' && /正好符合你最在意的「收入」/.test(n.text)));
  // 最在意的那一項變差：也講
  const worse = careerPlan({ current: 'civil', targets: ['freelancer'], priority: 'stable', ranked: RANKED, ys: YS, years: YEARS, age: 30 });
  assert.ok(worse.notes.some((n) => /你最在意「穩定」，但「自由接案」的穩定偏低/.test(n.text)));
});

test('沒有想做的工作：留下往上走（衝的年份爭取升遷加薪）；還沒選任何東西：總評請他先填', () => {
  const stay = careerPlan({ current: 'swe', ranked: RANKED, ys: YS, years: YEARS, age: 30 });
  assert.equal(stay.path.id, 'stay');
  assert.equal(stay.path.year, 2027); // 2027 小順以上又有傷官（轉換）的訊號
  assert.ok(stay.path.steps.some((t) => /2027 年：衝的年份，爭取升遷、加薪/.test(t)));
  assert.match(careerMaster(stay, []).verdict, /2027 年是衝的年份/);
  const none = careerPlan({ ranked: RANKED, ys: YS, years: YEARS });
  assert.equal(none.path, null);
  assert.match(careerMaster(none, [{ label: '專業技術型', desc: '把一門技術做深。', edge: '專精', trap: '' }]).verdict, /先在上面填你的狀況/);
});

test('想換的沒有比現在適合：直說，路線是「先換環境，不急著換行」；想換的對你都要多花力氣：不說方向對', () => {
  const worse = careerPlan({ current: 'swe', targets: ['admin'], ranked: RANKED, ys: YS, years: YEARS, age: 36 });
  assert.ok(worse.notes.some((n) => n.tone === 'bad' && /換公司、換部門/.test(n.text)));
  assert.equal(worse.path.id, 'move');
  assert.match(careerMaster(worse, []).verdict, /建議：先換環境，不急著換行/);
  const both = careerPlan({ current: 'accountant', targets: ['admin'], ranked: RANKED, ys: YS, age: 36 });
  assert.ok(!both.notes.some((n) => /方向是對的/.test(n.text)), '兩個都不適合時，比現在稍好不等於方向對');
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
  const plan = careerPlan({ current: 'sales', tenure: '3-5', priority: 'balance', runway: 'half', targets: ['product', 'creator', 'civil'], ranked: r.ranked, ys: yongShen(bazi), years: L.years, age: 36 });
  // 工作運時間軸：10 年、每年衝穩守其中一個；前三年接上未來三年的做什麼、小心什麼
  const tl = careerTimeline(L.years, r.future);
  assert.equal(tl.length, 10);
  assert.ok(tl.every((y) => TIMELINE_MODE[y.mode] && y.focus));
  assert.ok(tl.slice(0, 3).every((y) => y.detail && y.detail.doList.length));
  assert.ok(tl.every((y) => (y.mode === 'hold') === (y.level === '注意' || y.level === '小心')));
  const m = careerMaster(plan, r.natures);
  const lines = [m.verdict, ...m.why.map((w) => w.text), ...m.remedies.flatMap((x) => [x.title, ...x.steps]), ...m.boosts,
    ...plan.items.flatMap((it) => [...it.fit.why, ...it.plan, it.ai.note]), ...plan.suggest.flatMap((s) => s.fit.why)];
  for (const t of lines) assert.ok(typeof t === 'string' && t.length > 4 && !/undefined|null|NaN/.test(t), t);
});
