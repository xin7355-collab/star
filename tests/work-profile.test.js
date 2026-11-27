// 工作背景：技能證照清單、準備度、軍警專長的民間對照、月退門檻、AI 降低的門檻、存檔白名單。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKILLS, CERTS, SKILL_GROUPS, CERT_GROUPS, MIL_CIVIL, MODES, SERVICES, MIL_ORGS, RANKS, YEARS, EDUS, MAJORS, STUDY_TIMES, WHENS,
  readinessOf, matchesJob, aiEaseOf, pensionOf, SERVICE_OF, asksService, searchItems, norm,
} from '../js/core/work-profile.js';
import { SOC_NAMES } from '../js/core/occupations.js';
import { JOB_GROUPS, jobOf, sanitizeCareer, careerPlan, searchJobs } from '../js/core/jobs.js';
import { sanitizePerson } from '../js/core/records.js';

const CURATED = new Set(JOB_GROUPS.flatMap((g) => g.jobs.map((x) => x.id)));
const GROUPS = new Set([...JOB_GROUPS.map((g) => g.id), 'science']);
// for 裡的代碼只能是：官方 1～4 碼、常見工作代碼、g:類別
const validToken = (t) => SOC_NAMES.has(t) || CURATED.has(t) || (t.startsWith('g:') && GROUPS.has(t.slice(2)));
const RANKED = [
  { key: 'expert', label: '專業技術型', count: 3 }, { key: 'research', label: '研究分析型', count: 2 }, { key: 'stable', label: '穩定制度型', count: 2 },
];
const YS = { primary: '火', secondary: '水', avoid: ['金'] };
const LIFE = [{ year: 2026, level: '注意', tags: [] }, { year: 2027, level: '順', tags: ['傷官年'] }, { year: 2028, level: '平', tags: [] }];

test('技能、證照清單：代碼不重複、名稱不重複、每一項都對得到存在的工作（代碼打錯就永遠對不上）', () => {
  for (const [label, list] of [['技能', SKILLS], ['證照', CERTS]]) {
    assert.equal(new Set(list.map((x) => x.id)).size, list.length, `${label}代碼重複`);
    assert.equal(new Set(list.map((x) => x.name)).size, list.length, `${label}名稱重複`);
    for (const x of list) {
      assert.ok(x.for.length >= 1, x.id);
      for (const t of x.for) assert.ok(validToken(t), `${label}「${x.name}」的 ${t} 不存在`);
    }
  }
  assert.ok(SKILLS.length >= 90 && CERTS.length >= 80, `技能 ${SKILLS.length}、證照 ${CERTS.length}`);
  assert.ok(SKILL_GROUPS.some((g) => g.id === 'mil') && CERT_GROUPS.some((g) => g.id === 'comm'));
  for (const [mil, list] of Object.entries(MIL_CIVIL)) {
    assert.ok(CURATED.has(mil), mil);
    for (const id of list) assert.ok(jobOf(id), `${mil} → ${id}`);
  }
  // 每個軍警專長都有民間對照
  for (const x of JOB_GROUPS.find((g) => g.id === 'military').jobs) assert.ok(MIL_CIVIL[x.id], x.id);
  for (const list of [MODES, SERVICES, MIL_ORGS, RANKS, YEARS, EDUS, MAJORS, STUDY_TIMES, WHENS]) assert.equal(list[0].value, '');
});

test('對工作的規則：常見工作代碼、官方 1～4 碼、沿用的常見工作（like）、類別都對得上', () => {
  assert.ok(matchesJob(jobOf('2512'), ['swe'])); // 2512 沿用軟體工程師
  assert.ok(matchesJob(jobOf('swe'), ['251']));
  assert.ok(matchesJob(jobOf('3522'), ['35']));
  assert.ok(matchesJob(jobOf('mil_comm'), ['g:military']));
  assert.ok(!matchesJob(jobOf('3522'), ['2512']));
  assert.ok(!matchesJob(null, ['swe']));
});

test('準備度：沒填技能證照學歷科系時不算（不給誤導的數字）；會無線電、修電腦、有電腦硬體裝修證照的人，轉電信、資訊維修準備度高，轉軟體工程低', () => {
  assert.equal(readinessOf(jobOf('3522'), { from: jobOf('mil_comm') }), null);
  const prof = { skills: ['radio_op', 'radio_maint', 'pc_repair'], certs: ['tc_pc'], from: jobOf('mil_comm'), related: MIL_CIVIL.mil_comm };
  const tele = readinessOf(jobOf('3522'), prof);
  assert.ok(tele.pct >= 70, `電信 ${tele.pct}`);
  assert.equal(tele.level, '準備得差不多');
  assert.ok(tele.haveSkills.includes('無線電通訊操作（值機、通聯）'));
  const repair = readinessOf(jobOf('7421'), prof);
  assert.ok(repair.haveCerts.includes('電腦硬體裝修（乙／丙級）'));
  const swe = readinessOf(jobOf('2512'), prof);
  assert.ok(swe.pct < 40, `軟體 ${swe.pct}`);
  assert.equal(swe.level, '要從頭準備');
  // 可以考的證照：對得上、還沒有的
  assert.ok(readinessOf(jobOf('2523'), prof).suggestCerts.length >= 1);
  assert.ok(!repair.suggestCerts.includes('電腦硬體裝修（乙／丙級）'));
});

test('學歷門檻：專業人員要大學（用 AI 做 App 不看學歷）；研究所的工作、要國考的工作各有上限和說明', () => {
  const hs = { skills: ['programming', 'app_ai', 'web'], edu: 'hs' };
  assert.ok(readinessOf(jobOf('2511'), hs).pct <= 50);
  assert.match(readinessOf(jobOf('2511'), hs).gaps[0], /大學/);
  assert.ok(readinessOf(jobOf('ai_builder'), hs).pct >= 70, 'AI 應用開發不看學歷');
  assert.match(readinessOf(jobOf('2111'), { skills: ['data_analysis'], edu: 'ba' }).gaps[0], /研究所/);
  assert.match(readinessOf(jobOf('nurse'), { skills: ['first_aid', 'nursing'], edu: 'ba', major: 'it' }).gaps[0], /相關科系/);
  assert.equal(readinessOf(jobOf('nurse'), { skills: ['first_aid', 'nursing'], edu: 'ba', major: 'med' }).gaps.length, 0);
});

test('AI 降低的門檻：寫程式、做 App 是 build（轉換門檻少算一級），設計影音文字是 content；其他不算', () => {
  assert.equal(aiEaseOf(jobOf('2512')), 'build');
  assert.equal(aiEaseOf(jobOf('ai_builder')), 'build');
  assert.equal(aiEaseOf(jobOf('graphic')), 'content');
  assert.equal(aiEaseOf(jobOf('nurse')), null);
  // 士兵轉軟體工程：本來跳兩級（要提醒門檻），AI 讓門檻少一級，不再當成「要先讀科系」
  const plan = careerPlan({ current: 'mil_combat', rank: 'enlisted', targets: ['2512'], ranked: RANKED, ys: YS, years: LIFE, age: 28 });
  assert.ok(!plan.items[0].plan.some((t) => /入行門檻比現在高/.test(t)));
  assert.ok(plan.notes.some((n) => /用 AI（用說的描述需求）就能做出 App/.test(n.text) && /要被錄用，還是要看得懂程式/.test(n.text)));
  // 軍警公職要提醒資安：公務、軍事資料不要放進外部 AI（只講一次）
  assert.equal(plan.notes.filter((n) => /公務、軍事資料不要放進外部 AI/.test(n.text)).length, 1);
  const civilian = careerPlan({ current: 'admin', targets: ['2512', 'ai_builder'], ranked: RANKED, ys: YS, years: LIFE, age: 28 });
  assert.ok(!civilian.notes.some((n) => /公務、軍事資料/.test(n.text)));
});

test('月退門檻（軍職服現役滿 20 年）：滿 20 年可領；10～19 年提醒差幾年和哪一年；不到 10 年說還遠；警職文職只提醒試算；沒填年資不講', () => {
  assert.equal(pensionOf({ service: 'mil', years: '20', thisYear: 2026 }).id, 'ok');
  const wait = pensionOf({ service: 'mil', years: '13', thisYear: 2026 });
  assert.equal(wait.id, 'wait');
  assert.equal(wait.toGo, 7);
  assert.equal(wait.year, 2033);
  assert.match(wait.text, /再 7 年（2033 年）服滿 20 年才能請領月退俸/);
  assert.equal(pensionOf({ service: 'mil', years: '4', thisYear: 2026 }).id, 'early');
  assert.equal(pensionOf({ service: 'police', years: '8' }).id, 'civil');
  assert.equal(pensionOf({ service: 'mil', years: '' }), null);
  assert.equal(pensionOf({ service: 'contract', years: '8' }), null);
  assert.equal(SERVICE_OF(jobOf('mil_comm')), 'mil');
  assert.equal(SERVICE_OF(jobOf('cga_police')), 'police');
  assert.equal(SERVICE_OF(jobOf('3359')), 'civil');
  assert.ok(asksService(jobOf('5402')) && !asksService(jobOf('swe')));
});

test('海巡通電資訊、士官、13 年、會無線電和修電腦：電信技術員和現在的專長是同一種工作 → 不急著換行、調單位，滿 20 年（2033）再決定；同時選了明顯更適合的工作 → 撐到月退、先準備那一個', () => {
  const profile = {
    current: 'mil_comm', service: 'mil', org: 'cga', rank: 'nco', svcYears: '13', mode: 'office',
    skills: ['radio_op', 'radio_maint', 'pc_repair', 'helpdesk'], certs: ['tc_pc'], edu: 'jc', major: 'ee',
    ranked: RANKED, ys: YS, years: LIFE, age: 35,
  };
  const r = careerPlan({ ...profile, targets: ['3522'] });
  // 值不值得換不算準備度：電信和現在同一種工作，綜合沒有高 5 分以上 → 先換環境（軍警是調單位、換職務）
  assert.equal(r.path.target.id, '3522');
  assert.equal(r.path.id, 'move');
  assert.ok(r.path.steps.some((t) => /申請調單位或換職務/.test(t)));
  assert.ok(r.path.steps.some((t) => /^2033 年：服滿 20 年/.test(t)));
  assert.match(r.notes[0].text, /2033 年/);
  assert.ok(!r.notes.some((n) => /再轉比較順/.test(n.text)), '和月退打架');
  const tele = r.items.find((x) => x.job.id === '3522');
  assert.equal(tele.distance, 'near');
  assert.match(tele.plan[0], /你已經有：/);
  assert.ok(r.civil.length >= 6 && r.civil[0].readiness.pct >= r.civil.at(-1).readiness.pct);
  assert.ok(r.ready.every((x) => !MIL_CIVIL.mil_comm.includes(x.job.id)), '民間對照已經列過的不重複');
  // 想去的明顯更好（軟體工程的天賦分數高很多），而且 8 年內滿 20 年 → 撐到月退再轉
  const soft = careerPlan({ current: 'mil_comm', service: 'mil', rank: 'nco', svcYears: '13', targets: ['2512'], ranked: RANKED, ys: YS, years: LIFE, age: 35 });
  assert.equal(soft.path.id, 'pension');
  assert.equal(soft.path.year, 2033);
  // 兩個一起選：準備度高、但和現在差不多的電信，不能蓋掉明顯更適合的軟體（上一版這樣會整個忽略軟體、變成先換環境）
  const both = careerPlan({ ...profile, targets: ['2512', '3522'] });
  assert.equal(both.path.id, 'pension');
  assert.equal(both.path.target.id, '2512');
  assert.match(both.path.steps[0], /下班時間準備「軟體開發及程式設計師」/);
  // 換成一般工作後殘留的年資不算月退
  assert.equal(careerPlan({ current: 'swe', service: 'mil', svcYears: '13', ranked: RANKED, years: LIFE }).pension, null);
});

test('作息、學習時間、想換的時間：固定上下班想去要輪班的工作、每週不到 3 小時想跨很大、半年內想換但準備度低，都直說', () => {
  const base = { ranked: RANKED, ys: YS, years: LIFE, age: 35 };
  const shift = careerPlan({ ...base, current: 'admin', mode: 'office', targets: ['nurse'] });
  assert.ok(shift.notes.some((n) => /固定上下班的作息差很多/.test(n.text)));
  const slow = careerPlan({ ...base, current: 'cs', study: 'lt3', targets: ['lawyer'] });
  assert.ok(slow.notes.some((n) => /不到 3 小時/.test(n.text)));
  const rush = careerPlan({ ...base, current: 'cs', when: 'soon', skills: ['customer'], targets: ['lawyer'] });
  assert.ok(rush.notes.some((n) => /半年內換，但「律師／法務」的準備度還低/.test(n.text)));
});

test('存檔白名單：新欄位只收選單代碼、技能證照去重複，沒填的欄位不存（舊資料不變）', () => {
  const c = sanitizeCareer({
    current: 'mil_comm', service: 'mil', org: 'cga', rank: 'nco', svcYears: 13, mode: 'office', edu: 'jc', major: 'ee',
    skills: ['radio_op', 'radio_op', 'xxx', 'pc_repair', 5], certs: ['tc_pc', '<b>'], study: '7-15', when: 'year', junk: 'x',
  });
  assert.deepEqual(c, {
    current: 'mil_comm', tenure: '', priority: '', runway: '', targets: [],
    mode: 'office', service: 'mil', org: 'cga', rank: 'nco', svcYears: '13', edu: 'jc', major: 'ee', study: '7-15', when: 'year',
    skills: ['radio_op', 'pc_repair'], certs: ['tc_pc'],
  });
  assert.deepEqual(sanitizeCareer({ current: 'swe' }), { current: 'swe', tenure: '', priority: '', runway: '', targets: [] });
  assert.deepEqual(sanitizeCareer({ skills: ['radio_op'] }), { current: '', tenure: '', priority: '', runway: '', targets: [], skills: ['radio_op'] });
  assert.equal(sanitizeCareer({ svcYears: 99, rank: 'general' }), null);
  // 經由名單存檔也保留
  const person = sanitizePerson({ id: 'p-0123456789abcdef', name: '我', raw: { calendar: 'solar', era: 'ad', year: 1990, month: 8, day: 15, leap: false, knowTime: false, placeId: 'taipei', tz: 'Asia/Taipei' }, career: c });
  assert.deepEqual(person.career, c);
});

test('搜尋：軍警專長和 AI 應用開發找得到；技能證照的搜尋比對名稱和常見說法', () => {
  const ids = (q) => searchJobs(q).hits.map((h) => h.job.id);
  assert.equal(ids('通電資訊')[0], 'mil_comm');
  assert.ok(ids('海巡').includes('cga_patrol') && ids('海巡').includes('cga_police'));
  assert.ok(ids('無線電').includes('mil_comm') && ids('無線電').includes('3522'));
  assert.equal(ids('vibe coding')[0], 'ai_builder');
  assert.ok(ids('no code').includes('ai_builder'));
  assert.equal(norm('No-Code'), 'nocode');
  assert.ok(searchItems(SKILLS, '無線電').some((x) => x.id === 'radio_op'));
  assert.ok(searchItems(SKILLS, 'ChatGPT').some((x) => x.id === 'ai_tools'));
  assert.ok(searchItems(CERTS, 'GMDSS').length === 2);
  assert.deepEqual(searchItems(CERTS, ''), []);
});
