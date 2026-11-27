// 官方職業分類（第 6 次修訂）的完整收錄：清單完整、名稱乾淨（相容字、PDF 頁首殘字）、每個小類都有歸類、
// 官方職業和常見工作一樣能比、搜尋找得到口語叫法、轉換難度看學歷門檻。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOC_NAMES, SOC_TREE, MINOR, UNIT, SOC_OF, ALIASES, COMMON_ALIASES } from '../js/core/occupations.js';
import {
  JOB_GROUPS, NATURES, jobOf, jobFit, jobMeta, sanitizeCareer, careerPlan, searchJobs, suggestJobs, aiNoteOf, COMMON_COUNT, OFFICIAL_COUNT,
} from '../js/core/jobs.js';
import { EMERGING } from '../js/core/emerging.js';

const WX = ['木', '火', '土', '金', '水'];
const GROUPS = new Set([...JOB_GROUPS.map((g) => g.id).filter((id) => id !== 'status'), 'science']);
const TRENDS = new Set(EMERGING.map((e) => e.id));
const LONG_KINDS = new Set(['exam', 'teach', 'grad', 'flight', 'judge']);
const CURATED_IDS = new Set(JOB_GROUPS.flatMap((g) => g.jobs.map((x) => x.id)));
const codes = (n) => [...SOC_NAMES.keys()].filter((c) => c.length === n);
const RANKED = [
  { key: 'expert', label: '專業技術型', count: 3 }, { key: 'research', label: '研究分析型', count: 2 },
  { key: 'public', label: '公眾溝通型', count: 2 }, { key: 'manage', label: '管理決策型', count: 1 },
];
const YS = { primary: '火', secondary: '木', avoid: ['金', '水'] };
const YEARS = [
  { year: 2026, level: '平', tags: ['偏財年'] }, { year: 2027, level: '順', tags: ['傷官年'] }, { year: 2028, level: '小順', tags: ['正財年'] },
];

test('官方清單完整：10 大類、39 中類、125 小類、380 細類；每個細類的上層都在，類別樹的細類加起來也是 380', () => {
  assert.deepEqual([1, 2, 3, 4].map((n) => codes(n).length), [10, 39, 125, 380]);
  for (const c of codes(4)) {
    for (const p of [c.slice(0, 1), c.slice(0, 2), c.slice(0, 3)]) assert.ok(SOC_NAMES.has(p), `${c} 的上層 ${p}`);
  }
  assert.equal(SOC_TREE.length, 10);
  assert.equal(SOC_TREE.reduce((a, m) => a + m.subs.reduce((b, s) => b + s.units.length, 0), 0), 380);
  assert.equal(SOC_TREE.at(-1).code, '0'); // 軍人排最後（照官方）
  assert.equal(OFFICIAL_COUNT, 380);
  assert.equal(COMMON_COUNT, 82);
});

test('官方名稱乾淨：沒有相容字（打「經理」才搜得到）、沒有 PDF 頁首殘字、沒有空白數字', () => {
  for (const [c, n] of SOC_NAMES) {
    assert.equal(n, n.normalize('NFC'), c);
    assert.ok(!/[豈-﫿]/.test(n), `${c} 有相容字：${n}`);
    // 曾經發生：中類 22 抽出來是「醫療保健專業人員大類中類小類細類職業名稱」（頁首黏到名稱上）
    assert.ok(!/大類|中類|小類|細類|職業名稱/.test(n), `${c} 有頁首殘字：${n}`);
    assert.ok(!/[\s0-9A-Za-z]/.test(n), `${c}：${n}`);
  }
  assert.equal(SOC_NAMES.get('22'), '醫療保健專業人員');
  assert.equal(SOC_NAMES.get('1211'), '財務經理人員');
});

test('每個小類都有歸類（類別、工作性質、五行、收入穩定自由平衡、AI、趨勢、入行方式），細類例外的欄位也合法', () => {
  assert.deepEqual(Object.keys(MINOR).sort(), codes(3).sort());
  for (const [c, [group, natures, wx, t, ai, trend, skills, entry, long]] of Object.entries(MINOR)) {
    assert.ok(GROUPS.has(group), `${c} 類別 ${group}`);
    const ns = natures.split(' ');
    assert.ok(ns.length >= 1 && ns.length <= 2 && ns.every((k) => NATURES[k]), `${c} 性質 ${natures}`);
    const ws = wx.split(' ');
    assert.ok(ws.length >= 1 && ws.length <= 2 && ws.every((w) => WX.includes(w)), `${c} 五行 ${wx}`);
    assert.match(String(t), /^[1-3]{4}$/, `${c} 傾向 ${t}`);
    assert.ok([0, 1, 2].includes(ai), `${c} AI`);
    assert.ok(trend === '' || TRENDS.has(trend), `${c} 趨勢 ${trend}`);
    assert.ok(skills.length > 4 && entry.length > 8, c);
    assert.ok(long === undefined || LONG_KINDS.has(long), `${c} 養成期 ${long}`);
  }
  for (const [c, u] of Object.entries(UNIT)) {
    assert.ok(SOC_NAMES.has(c) && c.length === 4, `UNIT ${c} 不是細類`);
    if (u.like) assert.ok(CURATED_IDS.has(u.like) && !jobOf(u.like).status, `${c} like ${u.like}`);
    if (u.group) assert.ok(GROUPS.has(u.group), `${c} 類別`);
    if (u.n) assert.ok(u.n.split(' ').every((k) => NATURES[k]), `${c} 性質`);
    if (u.wx) assert.ok(u.wx.split(' ').every((w) => WX.includes(w)), `${c} 五行`);
    if (u.t) assert.match(String(u.t), /^[1-3]{4}$/, `${c} 傾向`);
    if (u.trend) assert.ok(TRENDS.has(u.trend), `${c} 趨勢`);
    if (u.long) assert.ok(LONG_KINDS.has(u.long), `${c} 養成期`);
  }
  for (const [id, c] of Object.entries(SOC_OF)) assert.ok(CURATED_IDS.has(id) && SOC_NAMES.has(c) && c.length === 4, `${id} → ${c}`);
  for (const c of Object.keys(ALIASES)) assert.ok(SOC_NAMES.has(c) && c.length === 4, `別名 ${c}`);
  for (const id of Object.keys(COMMON_ALIASES)) assert.ok(CURATED_IDS.has(id), `常見工作別名 ${id}`);
});

test('380 個官方職業都能比：欄位齊全、AI 說明、適合度算得出來；和常見工作是同一種的（like），分析結果一樣', () => {
  for (const c of codes(4)) {
    const x = jobOf(c);
    assert.ok(x && x.official && !x.status && x.name === SOC_NAMES.get(c), c);
    assert.ok(GROUPS.has(x.group) && x.groupName, `${c} 類別`);
    assert.ok(x.natures.length >= 1 && x.natures.every((k) => NATURES[k]), `${c} 性質`);
    assert.ok(x.wx.length >= 1 && x.wx.every((w) => WX.includes(w)), `${c} 五行`);
    for (const k of ['pay', 'stab', 'free', 'bal']) assert.ok([1, 2, 3].includes(x[k]), `${c} ${k}`);
    assert.ok(x.trend === null || TRENDS.has(x.trend), `${c} 趨勢`);
    assert.ok(x.long === null || LONG_KINDS.has(x.long), `${c} 養成期`);
    assert.ok(aiNoteOf(x).length > 10);
    assert.ok([1, 2, 3, 4].includes(x.tier), `${c} 門檻層級`);
    const fit = jobFit(x, { ranked: RANKED, ys: YS });
    assert.ok(Number.isFinite(fit.score) && fit.why.every((t) => !/undefined|null|NaN/.test(t)), c);
    assert.match(jobMeta(x), new RegExp(`^官方分類 ${c}・`));
  }
  assert.equal(jobFit(jobOf('2512'), { ranked: RANKED, ys: YS }).score, jobFit(jobOf('swe'), { ranked: RANKED, ys: YS }).score);
  assert.equal(jobOf('2512').entry, jobOf('swe').entry);
  assert.equal(jobOf('swe').soc, '2512');
  assert.equal(jobMeta(jobOf('swe'), { detail: true }), '常見工作・官方分類 2512 軟體開發及程式設計師');
  assert.equal(jobMeta(jobOf('freelancer'), { detail: true }), '常見工作・自由業與創業'); // 沒有對應的官方細類
});

test('存檔白名單：收官方細類的 4 碼（含 0100 軍人），不收大中小類代碼、不存在的代碼、前後有空白的', () => {
  assert.deepEqual(sanitizeCareer({ current: '8321', targets: ['2142', '0100', 'swe'] }), { current: '8321', tenure: '', priority: '', runway: '', targets: ['2142', '0100', 'swe'] });
  for (const bad of ['2', '25', '251', '9999', ' 2512', '2512 ', '25120', 2512]) {
    assert.equal(sanitizeCareer({ current: bad }), null, String(bad));
  }
  assert.deepEqual(sanitizeCareer({ current: '2512', targets: ['2512', 'student'] }).targets, []); // 不能和現在一樣、不收狀態
});

test('搜尋：口語叫法、官方名稱、代碼都找得到；常見工作同分排前面；英文只比開頭；好幾個詞要全部對上', () => {
  const ids = (q, o) => searchJobs(q, o).hits.map((h) => h.job.id);
  assert.deepEqual(ids('護理').slice(0, 3), ['nurse', '2220', '3220']);
  assert.ok(ids('外送').includes('8321') && ids('外送').includes('driver'));
  assert.ok(ids('看護').includes('5320'));
  assert.ok(ids('房仲').includes('3334'));
  assert.ok(ids('算命').includes('5191'));
  assert.equal(ids('軍人')[0], '0100');
  assert.equal(ids('2512')[0], '2512');
  assert.ok(ids('經理').includes('1211'), '「財務經理人員」的「理」原本是相容字');
  assert.ok(ids('Uber').includes('8322'));
  assert.ok(!ids('uber').includes('creator'), '不能因為 youtuber 帶出自媒體');
  assert.ok(ids('ＵＢＥＲ').includes('8322'), '全形英文也算');
  assert.ok(ids('YouTuber').includes('creator'));
  assert.ok(ids('電子 工程').includes('2152'));
  assert.deepEqual(ids('護理 zzzz'), []);
  assert.deepEqual(ids('  '), []);
  // 狀態類只有「目前的工作」找得到
  assert.deepEqual(ids('學生'), []);
  assert.equal(ids('學生', { withStatus: true })[0], 'student');
  // 想做的工作不列現在的工作和已選的
  assert.ok(!ids('外送', { exclude: ['8321'] }).includes('8321'));
  assert.ok(ids('外送', { exclude: ['8321'] }).includes('driver'));
  // 上限與總數
  const many = searchJobs('人員', { limit: 30 });
  assert.equal(many.hits.length, 30);
  assert.ok(many.total > 30);
});

test('轉換難度看學歷門檻：基層 → 專業人員算跨很大並提醒入行門檻；同一個官方小類算相近；換到基層工作走「門檻低、先試做」', () => {
  const up = careerPlan({ current: '9312', targets: ['2142'], ranked: RANKED, ys: YS, years: YEARS, age: 30 });
  assert.equal(up.items[0].distance, 'far');
  assert.match(up.items[0].plan[0], /入行門檻比現在高/);
  const tech = careerPlan({ current: '7411', targets: ['2151'], ranked: RANKED, ys: YS, years: YEARS, age: 30 });
  assert.equal(tech.items[0].distance, 'far'); // 水電（中等）再跳兩級門檻
  assert.match(tech.items[0].plan[0], /入行門檻比現在高/);
  const near = careerPlan({ current: '2512', targets: ['2513'], ranked: RANKED, ys: YS, years: YEARS, age: 30 });
  assert.equal(near.items[0].distance, 'near');
  assert.ok(!near.items[0].plan.some((t) => /入行門檻/.test(t)));
  const easy = careerPlan({ current: 'nurse', tenure: 'gt10', targets: ['9111'], ranked: RANKED, ys: YS, years: YEARS, age: 45 });
  assert.equal(easy.items[0].distance, 'easy');
  assert.match(easy.items[0].plan[0], /門檻低/);
  assert.match(easy.items[0].plan[2], /累積很久/);
  // 想去的基層工作比現在更適合時，路線是「先試做」，不是準備作品集、存一年生活費
  const tryIt = careerPlan({ current: '4130', targets: ['9330'], ranked: [{ key: 'mobile', label: '變動移動型', count: 3 }, { key: 'stable', label: '穩定制度型', count: 2 }], ys: { primary: '水', secondary: '土', avoid: ['火'] }, years: YEARS, age: 25 });
  assert.equal(tryIt.path.id, 'try');
  assert.match(tryIt.path.title, /先兼職試做「運輸及倉儲勞力工」/);
});

test('養成期的提醒照工作講對：機師是飛行訓練、物理學家是研究所、法官是司法官考試、護理師是國考', () => {
  const r = careerPlan({ current: 'swe', targets: ['3153', '2111', '2612'], ranked: RANKED, ys: YS, age: 35 });
  const text = r.notes.map((n) => n.text).join('\n');
  assert.match(text, /「飛航駕駛員及有關工作人員」要飛行訓練和檢定/);
  assert.match(text, /「物理及天文學專業人員」通常要研究所以上學歷/);
  assert.match(text, /「法官」要法律系、司法官考試和受訓/);
  const nurse = careerPlan({ current: 'swe', targets: ['2220'], ranked: RANKED, ys: YS, age: 35 });
  assert.ok(nurse.notes.some((n) => /「護理及助產專業人員」要相關科系和國考/.test(n.text)));
});

test('推薦還是只從常見工作挑（官方名稱太正式，推給一般人看不懂）', () => {
  const s = suggestJobs({ ranked: RANKED, ys: YS, n: 20 });
  assert.ok(s.every((x) => !x.job.official));
});
