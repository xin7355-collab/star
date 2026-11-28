// 綜合解讀的老師解盤：只採用兩個以上系統一致的說法、血型算半個系統、測驗當裁判、方向相反的照實講、
// 今年和這十年要好幾個系統點名同一件事才算重點。離線可跑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesize } from '../js/core/synthesis.js';
import { buildReading } from '../js/core/reading.js';
import { buildBazi } from '../js/core/bazi.js';
import { buildZiwei } from '../js/core/ziwei.js';
import { buildNatal } from '../js/core/natal.js';
import { computeMaya } from '../js/core/maya.js';
import { TRAIT_TEXT, THEMES, THEME_FIX, THEME_USE, PALACE_THEME, PILLAR_THEME, SHISHEN_YEAR, PERSONAL_YEAR_SIGNAL, GEJU_TAGS, RIASEC_TAG, TENSIONS } from '../js/core/synthesis-texts.js';
import { TAGS } from '../js/core/reading-texts.js';
import { GEJU_INFO } from '../js/core/geju.js';

const INPUT = { date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: { lon: 121.5, lat: 25.04 }, fold: null };
const TODAY = { y: 2026, m: 11, d: 28 };
const full = () => buildReading({ natal: buildNatal(INPUT), bazi: buildBazi(INPUT, { gender: '男', today: TODAY }), ziwei: buildZiwei(INPUT, { gender: '男', at: TODAY }), birth: INPUT.date, maya: computeMaya(INPUT.date), today: TODAY, gender: '男', bloodType: 'O' });
const quizOf = (big5, riasec = {}) => ({ v: 1, big5: { E: 50, A: 50, C: 50, S: 50, O: 50, ...big5 }, riasec: { R: 50, I: 50, A: 50, S: 50, E: 50, C: 50, ...riasec } });
const empty = { year: [], career: [], loveStyle: [], loveFate: [], wealth: [], decade: [] };
/** 只用指定的「各系統說了什麼」和訊號組一份解讀（測規則用，不必排真的盤） */
const fake = (said, signals = {}) => ({ said, signals: { ...empty, ...signals } });
const texts = (m) => [m.verdict, ...m.why.map((w) => w.text), ...m.remedies.flatMap((r) => [r.title, ...r.steps]), ...m.boosts, ...m.conflicts, ...m.singles.map((x) => x.text), ...m.posterLines];

test('文字表齊全：13 個特質都有長處、盲點、兩步做法；主題都有化解和用法；對照表只對到存在的特質、主題、格局', () => {
  assert.deepEqual(Object.keys(TRAIT_TEXT).sort(), Object.keys(TAGS).sort());
  for (const [tag, t] of Object.entries(TRAIT_TEXT)) {
    for (const k of ['edge', 'risk', 'job', 'riskShort']) assert.ok(t[k], `${tag}.${k}`);
    assert.equal(t.fix.length, 2, tag);
  }
  for (const th of THEMES) {
    assert.equal(THEME_FIX[th].length, 2, th);
    assert.ok(THEME_USE[th], th);
  }
  for (const th of [...Object.values(PALACE_THEME), ...Object.values(PILLAR_THEME), ...Object.values(SHISHEN_YEAR).map((x) => x.theme), ...Object.values(PERSONAL_YEAR_SIGNAL).map((x) => x.theme)]) assert.ok(THEMES.includes(th), th);
  assert.deepEqual(Object.keys(GEJU_TAGS).sort(), Object.keys(GEJU_INFO).sort());
  for (const tags of [...Object.values(GEJU_TAGS), Object.values(RIASEC_TAG).filter(Boolean), TENSIONS.flatMap((t) => [t.a, t.b])]) for (const t of tags) assert.ok(TAGS[t], t);
});

test('綜合解讀的訊號：「幾個系統」算的是系統不是句子；今年每個系統都有好壞和點名的主題（附原因）；事業、感情、財運、這十年都整理出來', () => {
  const r = full();
  for (const t of r.ranked) {
    assert.equal(t.count, new Set(t.systems).size);
    assert.ok(t.sources.length >= t.count);
  }
  const ys = r.signals.year;
  assert.deepEqual(ys.map((s) => s.system), ['八字', '紫微', '占星', '生命靈數', '瑪雅']);
  for (const s of ys) {
    assert.ok(['good', 'bad', 'mixed', 'neutral'].includes(s.tone), s.system);
    for (const th of [...s.good, ...s.bad, ...s.focus]) {
      assert.ok(THEMES.includes(th), th);
      assert.ok(s.reasons[th], `${s.system} ${th} 要有原因`);
    }
  }
  // 1990-08-15 06:20 男：2026 丙午是壬水的偏財年（財星也是妻星），紫微流年化祿在財帛
  assert.ok(ys[0].good.includes('錢'));
  assert.equal(ys[0].reasons.錢, '丙午是偏財年');
  assert.equal(ys[1].reasons.錢, '流年化祿在財帛');
  assert.ok(r.signals.career.some((c) => c.source === '八字：偏印格'));
  assert.deepEqual(r.signals.wealth.map((w) => w.kind), ['zheng', 'zheng']);
  assert.deepEqual(r.signals.decade.map((d) => d.system), ['八字', '紫微']);
  assert.equal(r.signals.decade[0].next.startYear, 2028);
  // 沒有性別：八字的配偶星不判斷（男女看的星不同），紫微也排不出來
  const noGender = buildReading({ natal: buildNatal(INPUT), bazi: buildBazi(INPUT, { today: TODAY }), birth: INPUT.date, today: TODAY });
  assert.equal(noGender.signals.loveFate.length, 0);
});

test('完整的盤：斷語講特質（幾個系統一致）、一句話（適合的工作、最大的功課）、今年；每個結論都附依據，沒有任何空值', () => {
  const m = synthesize(full(), { year: 2026 });
  assert.match(m.verdict, /^老師看你的整體命盤：你最明顯的特質是「愛思考、會分析」和「會照顧人、重家庭」（各有 3 個系統一致）。一句話：你適合/);
  assert.match(m.verdict, /2026 年整體偏順，最有機會的是「錢」（八字、紫微都指向）。$/);
  assert.deepEqual(m.core, ['analytic', 'caring']);
  assert.match(m.why[0].text, /^個性「愛思考、會分析」：占星（上升處女座）、八字（日主壬水）、紫微（命宮天機），3 個系統一致。$/);
  assert.ok(m.why.some((w) => /^事業：最多系統指向「研究、分析、技術、規劃類工作」/.test(w.text)));
  assert.ok(m.why.some((w) => /^財運：正財型/.test(w.text)));
  assert.ok(m.why.some((w) => /^2028 年起換大運戊子（八字）：從「好壞參半」轉為「辛苦」/.test(w.text)));
  assert.deepEqual(m.remedies.map((r) => r.title), ['盲點：想太多、做太慢', '盲點：顧別人、忘了自己']);
  assert.deepEqual(m.year, { overall: 'good', hotBad: [], hotGood: ['錢'], focus: ['家庭'] });
  for (const t of texts(m)) assert.ok(t && !/undefined|null|NaN/.test(t), t);
  assert.ok(m.posterLines.length <= 3);
  assert.equal(m.name, undefined);
  // 指名道姓
  assert.match(synthesize(full(), { year: 2026, name: '媽媽' }).verdict, /^老師看媽媽的整體命盤：媽媽最明顯/);
});

test('只有一個系統說的不寫進結論；血型性格算半個系統，和一個系統一起說還不夠', () => {
  const m = synthesize(fake([
    { system: '占星', source: '占星：太陽獅子座', tags: ['lead', 'creative'] },
    { system: '血型', source: '血型 O 型（流行文化）', tags: ['lead', 'social'] },
    { system: '八字', source: '八字：日主丙火', tags: ['lead', 'creative'] },
  ]), { year: 2026 });
  assert.deepEqual(m.core, ['lead', 'creative']);
  const half = synthesize(fake([
    { system: '占星', source: '占星：太陽獅子座', tags: ['lead'] },
    { system: '血型', source: '血型 O 型（流行文化）', tags: ['lead'] },
  ]), { year: 2026 });
  assert.deepEqual(half.core, []);
  assert.match(half.verdict, /各系統的說法很分散/);
  assert.equal(half.remedies.length, 0);
  assert.deepEqual(half.singles.map((x) => x.label), ['有主見、能帶頭']);
  assert.match(half.singles[0].text, /算半個系統/);
});

test('測驗當裁判：命盤說有、測驗說不像的特質不寫成你的特質（事業的結論也不用），列在「說法不一致」', () => {
  const said = [
    { system: '占星', source: '占星：上升處女座', tags: ['analytic'] },
    { system: '紫微', source: '紫微：命宮天機', tags: ['analytic'] },
    { system: '生命靈數', source: '生命靈數 6', tags: ['caring'] },
    { system: '瑪雅', source: '瑪雅：銀河印記超頻紅月', tags: ['caring'] },
  ];
  const quiz = quizOf({ O: 20, A: 75 }, { I: 15, S: 70 });
  const m = synthesize(fake(said, { career: [{ system: '八字', source: '八字：偏印格', tags: ['analytic', 'independent'] }] }), { year: 2026, quiz });
  assert.deepEqual(m.core, ['caring']);
  assert.match(m.verdict, /「會照顧人、重家庭」（2 個系統一致、測驗也說中）/);
  assert.ok(m.conflicts.some((t) => /命盤說你「愛思考、會分析」（占星、紫微），測驗不像（研究型 15、開放性 20）/.test(t)));
  // 事業：分析型有三個系統，但測驗說不像，不拿來當結論
  assert.ok(!m.why.some((w) => /研究、分析、技術/.test(w.text)));
  assert.ok(m.why.some((w) => /^事業：最多系統指向「教育、醫療、照顧/.test(w.text)));
});

test('命盤沒有一致的特質：有測驗就先用測驗最明顯的兩項（標明是測驗說的）', () => {
  const m = synthesize(fake([{ system: '占星', source: '占星：太陽牡羊座', tags: ['lead', 'adventurous'] }]), { year: 2026, quiz: quizOf({ C: 90, S: 85 }, { C: 80 }) });
  assert.match(m.verdict, /測驗最明顯的是「穩重踏實」「自律負責、守規矩」，先以測驗為準/);
  assert.ok(m.why.some((w) => /^測驗說你「穩重踏實」/.test(w.text)));
});

test('方向相反的特質兩邊都有人說：照實講；有測驗就看測驗偏哪邊，另一邊不寫成你的特質', () => {
  const said = [
    { system: '占星', source: '占星：太陽金牛座', tags: ['steady'] },
    { system: '八字', source: '八字：日主己土', tags: ['steady'] },
    { system: '紫微', source: '紫微：命宮破軍', tags: ['adventurous'] },
    { system: '生命靈數', source: '生命靈數 5', tags: ['adventurous'] },
  ];
  const plain = synthesize(fake(said), { year: 2026 });
  assert.ok(plain.conflicts.some((t) => /求穩和求變兩股力量都在/.test(t) && /以你自己的經驗為準/.test(t)));
  assert.equal(plain.core.length, 2);
  // 測驗兩邊都不算「不像」（求變一半一半）：比分數，偏穩
  const judged = synthesize(fake(said), { year: 2026, quiz: quizOf({ C: 85, S: 80, O: 50, E: 45 }) });
  assert.deepEqual(judged.core, ['steady']);
  assert.ok(judged.conflicts.some((t) => /測驗比較偏「穩重踏實」，以它為主/.test(t)));
  // 測驗直接說求變「不像」：走「測驗當裁判」那條，不再當成兩股力量
  const vetoed = synthesize(fake(said), { year: 2026, quiz: quizOf({ C: 85, S: 80, O: 30, E: 30 }) });
  assert.deepEqual(vetoed.core, ['steady']);
  assert.ok(vetoed.conflicts.some((t) => /命盤說你「愛冒險、求變化」（紫微、生命靈數），測驗不像/.test(t)));
  assert.ok(!vetoed.conflicts.some((t) => /兩股力量/.test(t)));
});

test('今年：兩個以上系統點名同一件事才是重點；同一個系統對同一件事又說好又說壞算「有變數」，不重複計', () => {
  const sig = (system, tone, good = [], bad = [], focus = []) => ({ system, tone, good, bad, focus, reasons: Object.fromEntries([...good, ...bad, ...focus].map((t) => [t, `${system}點名${t}`])) });
  const m = synthesize(fake([], {
    year: [sig('八字', 'bad', [], ['工作', '變動']), sig('紫微', 'neutral', ['錢'], ['工作']), sig('占星', 'bad'), sig('生命靈數', 'neutral', [], [], ['工作'])],
  }), { year: 2027 });
  assert.equal(m.year.overall, 'bad');
  assert.deepEqual(m.year.hotBad, ['工作']);
  assert.match(m.verdict, /2027 年整體要穩著走，最該花心思的是「工作」（八字、紫微都點名）。/);
  assert.deepEqual(m.remedies.map((r) => r.title), ['2027 年要小心：工作']);
  assert.deepEqual(m.remedies[0].steps, THEME_FIX.工作);
  assert.ok(m.why.some((w) => w.tone === 'bad' && /要小心「工作」（八字：八字點名工作；紫微：紫微點名工作）/.test(w.text)));
  const mixed = synthesize(fake([], { year: [sig('八字', 'good', ['感情'], ['感情']), sig('紫微', 'neutral', [], ['人際'])] }), { year: 2027 });
  assert.deepEqual(mixed.year.hotBad, []);
  assert.deepEqual(mixed.year.focus, []);
  assert.equal(mixed.year.overall, 'calm');
  assert.ok(mixed.why.some((w) => /沒有一件被兩個以上系統同時提到/.test(w.text)));
});

test('財運、感情緣分、這十年：兩個系統一致才下結論，相反就列在「說法不一致」', () => {
  const agree = synthesize(fake([], {
    wealth: [{ system: '八字', kind: 'pian', source: '偏財星 2 個' }, { system: '紫微', kind: 'pian', source: '財帛宮偏財型' }],
    loveFate: [{ system: '八字', level: 'low', source: '財星不明顯' }, { system: '紫微', level: 'low', source: '夫妻宮三方四正偏辛苦' }],
    decade: [{ system: '八字', tone: 'good', source: '大運甲子（2020–2029）' }, { system: '紫微', tone: 'good', source: '官祿大限（35–44 歲）' }],
  }), { year: 2026 });
  assert.ok(agree.why.some((w) => /^財運：偏財有緣/.test(w.text)));
  assert.ok(agree.why.some((w) => /^感情：感情要主動經營/.test(w.text)));
  assert.ok(agree.why.some((w) => /^這十年：八字大運甲子（2020–2029）、紫微官祿大限（35–44 歲）都說順/.test(w.text)));
  const clash = synthesize(fake([], {
    wealth: [{ system: '八字', kind: 'pian', source: '偏財星 2 個' }, { system: '紫微', kind: 'zheng', source: '財帛宮正財型' }],
    loveFate: [{ system: '八字', level: 'low', source: '財星不明顯' }, { system: '紫微', level: 'high', source: '夫妻宮三方四正偏吉' }],
    decade: [{ system: '八字', tone: 'good', source: '大運甲子' }, { system: '紫微', tone: 'bad', source: '官祿大限' }],
  }), { year: 2026 });
  assert.ok(!clash.why.some((w) => /^財運|^感情|^這十年/.test(w.text)));
  assert.equal(clash.conflicts.length, 3);
  assert.ok(clash.conflicts.some((t) => /^財運：八字看是偏財.*紫微看是正財/.test(t)));
  // 一個說好、一個平平：不下結論，也不算互相矛盾
  const quiet = synthesize(fake([], { decade: [{ system: '八字', tone: 'good', source: '大運甲子' }, { system: '紫微', tone: 'neutral', source: '官祿大限' }] }), { year: 2026 });
  assert.ok(!quiet.why.some((w) => /^這十年/.test(w.text)));
  assert.equal(quiet.conflicts.length, 0);
});
