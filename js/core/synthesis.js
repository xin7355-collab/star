// 綜合解讀的「老師解盤」：把各系統的結果翻成一段結論，像老師看完整份命盤後當面講。
//
// 使用者回饋：「綜合解讀目前就是各別加起來的說明，我要的是你看得懂各項分析，然後去做一個解讀；
// 有用的整併就好，不用硬合併。」所以這裡的規則是：
// 1. 只有兩個以上系統一致的說法才寫進結論（血型性格是流行文化，算半個系統）；只有一個系統說的放在「參考」。
// 2. 做了興趣與性格測驗的話，測驗當裁判：命盤說你有、測驗說不像的特質，不寫成你的特質，改列在「說法不一致」。
// 3. 方向相反的特質（求穩／求變、理性／感性）兩邊都有人說，照實講，有測驗就看測驗偏哪邊。
// 4. 今年、這十年：各系統的訊號（reading.js 的 signals）對到同一組主題，好幾個系統點名同一件事才是重點。
// 純函式，可在 Node 測試（tests/synthesis.test.js）。文字由本 App 撰寫，命理僅供參考。

import { TAGS } from './reading-texts.js';
import { verdictOf, TAG_CHECKS } from './trait-check.js';
import { RIASEC, RIASEC_ORDER } from './quiz.js';
import { TRAIT_TEXT, TENSIONS, RIASEC_TAG, YEAR_VERDICT, THEME_FIX, THEME_USE } from './synthesis-texts.js';

const TAG_ORDER = Object.keys(TAGS);
// 血型性格沒有研究支持，只當流行文化參考：和一個系統一起說，還不夠算「好幾個系統一致」
const WEIGHT = { 血型: 0.5 };
const weightOf = (systems) => systems.reduce((a, s) => a + (WEIGHT[s] ?? 1), 0);
const LOVE_FATE = { low: '感情要主動經營，來得晚一點也沒關係', mid: '感情能自然發展，不用急', high: '異性緣好、機會多，選擇時多看人品' };
const WEALTH = { pian: '偏財有緣：本業以外的投資、副業、獎金機會比一般人多，記得設停損、只用閒錢', zheng: '正財型：穩定收入加上長期理財最適合你，投機的勝率不高' };
const TONE_WORD = { good: '順', bad: '辛苦', mixed: '好壞參半', neutral: '平穩' };

/**
 * 來源依系統分組：「占星（太陽獅子座、上升牡羊座）、生命靈數 1」。
 * inner：要放進括號裡時改用「占星：金星獅子座；紫微：夫妻宮太陽」，避免括號裡再套括號
 */
function sourcesText(sources, inner = false) {
  const groups = new Map();
  for (const src of sources) {
    const [sys, ...rest] = src.split('：');
    const key = rest.length ? sys : src;
    if (!groups.has(key)) groups.set(key, []);
    if (rest.length) groups.get(key).push(rest.join('：'));
  }
  if (inner) return [...groups].map(([k, v]) => (v.length ? `${k}：${v.join('、')}` : k)).join('；');
  return [...groups].map(([k, v]) => (v.length ? `${k}（${v.join('、')}）` : k)).join('、');
}

/** 測驗對這個特質的結果（一句話） */
function checkText(c) {
  if (!c) return '';
  if (c.verdict === 'hit') return `測驗也說中（${c.detail}）`;
  if (c.verdict === 'half') return `測驗一半一半（${c.detail}）`;
  if (c.verdict === 'miss') return `測驗不像（${c.detail}）`;
  return '測驗量不到這一項';
}

/** 依系統把同一個特質的票合起來 */
function tally(entries) {
  const map = new Map();
  for (const { system, source, tags } of entries) {
    for (const tag of tags) {
      if (!tag) continue;
      if (!map.has(tag)) map.set(tag, { tag, systems: [], sources: [] });
      const e = map.get(tag);
      if (!e.systems.includes(system)) e.systems.push(system);
      if (source) e.sources.push(source);
    }
  }
  return [...map.values()].map((e) => ({ ...e, label: TAGS[e.tag].label, weight: weightOf(e.systems) }));
}

const byStrength = (score) => (a, b) => score(b) - score(a) || TAG_ORDER.indexOf(a.tag) - TAG_ORDER.indexOf(b.tag);

/**
 * @param reading buildReading 的結果（要有 said、signals）
 * @param {{quiz?:object|null, name?:string, year?:number}} o quiz：興趣與性格測驗（sanitizeQuiz 過的）
 */
export function synthesize(reading, { quiz = null, name = '你', year = null } = {}) {
  const W = name && name !== '你' ? name : '你';
  const said = reading.said || [];
  const sig = reading.signals || { year: [], career: [], loveStyle: [], loveFate: [], wealth: [], decade: [] };
  const systems = [...new Set(said.map((x) => x.system))];

  // ── 1. 個性：好幾個系統一致、測驗不反對的才算
  const traits = tally(said).map((e) => ({ ...e, check: quiz ? verdictOf(e.tag, quiz) : null }));
  const consensus = traits.filter((e) => e.weight >= 2);
  const contested = consensus.filter((e) => e.check && e.check.verdict === 'miss');
  let accepted = consensus.filter((e) => !contested.includes(e))
    .sort(byStrength((e) => e.weight + (e.check && e.check.verdict === 'hit' ? 1 : 0)));
  const conflicts = [];
  for (const t of TENSIONS) {
    const a = accepted.find((e) => e.tag === t.a);
    const b = accepted.find((e) => e.tag === t.b);
    if (!a || !b) continue;
    // 測驗分數高的那一邊為主；沒有測驗就比系統數，一樣多時兩邊都留著、只照實講
    const pick = quiz && a.check.avg !== undefined && b.check.avg !== undefined && a.check.avg !== b.check.avg ? (a.check.avg > b.check.avg ? a : b) : null;
    conflicts.push(`${t.text}（「${a.label}」：${a.systems.join('、')}；「${b.label}」：${b.systems.join('、')}）${pick ? `測驗比較偏「${pick.label}」，以它為主。` : '哪一邊比較像你，以你自己的經驗為準。'}`);
    if (pick) accepted = accepted.filter((e) => e !== (pick === a ? b : a));
  }
  for (const e of contested) {
    conflicts.push(`命盤說你「${e.label}」（${e.systems.join('、')}），${checkText(e.check)}：可能是還沒發揮，或環境讓你把它收起來了；以你自己的感覺為準，不用硬套。`);
  }
  // 命盤沒有一致的特質時，有測驗就用測驗最明顯的兩項（標明是測驗說的）
  let quizOnly = [];
  if (!accepted.length && quiz) {
    quizOnly = TAG_ORDER.filter((t) => TAG_CHECKS[t]).map((tag) => ({ tag, label: TAGS[tag].label, ...verdictOf(tag, quiz) }))
      .filter((x) => x.verdict === 'hit').sort((a, b) => b.avg - a.avg).slice(0, 2);
  }
  const core = accepted.slice(0, 2);
  const lead = core.length ? core : quizOnly;
  // 測驗說不像的特質，事業、感情的結論也不用（不只是個性的共同點）
  const vetoed = (tag) => !!quiz && verdictOf(tag, quiz).verdict === 'miss';

  // ── 2. 事業：個性的票＋事業專屬的指標（紫微官祿、天頂、八字格局）＋興趣測驗最高的類型
  const careerEntries = [...said, ...sig.career];
  if (quiz && quiz.riasec) {
    const top = RIASEC_ORDER.filter((k) => quiz.riasec[k] >= 60).sort((a, b) => quiz.riasec[b] - quiz.riasec[a]).slice(0, 2);
    for (const k of top) if (RIASEC_TAG[k]) careerEntries.push({ system: '測驗', source: `測驗：${RIASEC[k].name} ${quiz.riasec[k]}`, tags: [RIASEC_TAG[k]] });
  }
  const careerTop = tally(careerEntries).filter((e) => e.weight >= 2 && !vetoed(e.tag))
    .sort(byStrength((e) => e.weight)).slice(0, 2);

  // ── 3. 感情：愛的方式（金星、夫妻宮主星、個性）＋緣分（八字配偶星、紫微夫妻宮）兩邊一致才講
  // 至少要有一個感情專屬的指標（金星或夫妻宮）支持：只有個性的票，講的是個性不是感情
  const loveTags = new Set(sig.loveStyle.flatMap((x) => x.tags));
  const loveTop = tally([...sig.loveStyle, ...said.filter((x) => accepted.some((e) => x.tags.includes(e.tag)))])
    .filter((e) => e.weight >= 2 && loveTags.has(e.tag) && !vetoed(e.tag)).sort(byStrength((e) => e.weight))[0] || null;
  const fates = sig.loveFate;
  let fate = null;
  if (fates.length >= 2) {
    if (fates.every((f) => f.level === fates[0].level)) fate = { level: fates[0].level, by: fates };
    else if (fates.some((f) => f.level === 'low') && fates.some((f) => f.level === 'high')) {
      conflicts.push(`感情緣分：${fates.map((f) => `${f.system}說${f.source}`).join('、')}，兩邊說法相反；以實際相處為準。`);
    }
  }

  // ── 4. 財運：八字和紫微都說偏財（或都說正財）才下結論
  const wealthVotes = sig.wealth.filter((w) => w.kind === 'pian' || w.kind === 'zheng');
  let wealth = null;
  if (wealthVotes.length >= 2) {
    if (wealthVotes.every((w) => w.kind === wealthVotes[0].kind)) wealth = { kind: wealthVotes[0].kind, by: wealthVotes };
    else conflicts.push(`財運：${wealthVotes.map((w) => `${w.system}看是${w.kind === 'pian' ? '偏財' : '正財'}（${w.source}）`).join('、')}。說法不同時，以本業為主、偏財當額外。`);
  }

  // ── 5. 今年：整體好壞＋被兩個以上系統點名的主題
  const themes = new Map();
  const mark = (theme, pol, system, reason) => {
    if (!themes.has(theme)) themes.set(theme, { theme, good: [], bad: [], focus: [] });
    themes.get(theme)[pol].push({ system, reason });
  };
  let goodScore = 0;
  let badScore = 0;
  for (const s of sig.year) {
    if (s.tone === 'good') goodScore += 1;
    else if (s.tone === 'bad') badScore += 1;
    else if (s.tone === 'mixed') { goodScore += 0.5; badScore += 0.5; }
    // 同一個系統對同一件事又說好又說壞（例如偏財是妻星、流年又沖日柱）：算「有變數」，不重複計
    for (const t of s.good) mark(t, s.bad.includes(t) ? 'focus' : 'good', s.system, s.reasons && s.reasons[t]);
    for (const t of s.bad) if (!s.good.includes(t)) mark(t, 'bad', s.system, s.reasons && s.reasons[t]);
    for (const t of s.focus) mark(t, 'focus', s.system, s.reasons && s.reasons[t]);
  }
  const overall = goodScore >= badScore + 1 && goodScore >= 1.5 ? 'good' : badScore >= goodScore + 1 && badScore >= 1.5 ? 'bad' : goodScore >= 1 && badScore >= 1 ? 'mixed' : 'calm';
  const T = [...themes.values()].map((t) => ({ ...t, all: [...t.good, ...t.bad, ...t.focus] }));
  const hotBad = T.filter((t) => t.bad.length >= 2).sort((a, b) => b.bad.length - a.bad.length);
  const hotGood = T.filter((t) => t.good.length >= 2 && !hotBad.includes(t)).sort((a, b) => b.good.length - a.good.length);
  const hotFocus = T.filter((t) => !hotBad.includes(t) && !hotGood.includes(t) && new Set(t.all.map((x) => x.system)).size >= 2);
  const evid = (list) => list.map((x) => (x.reason ? `${x.system}：${x.reason}` : x.system)).join('；');
  const toneSystems = (tone) => sig.year.filter((s) => s.tone === tone).map((s) => s.system);

  // ── 6. 這十年：八字大運和紫微大限說法一致才講
  let decade = null;
  const dec = sig.decade;
  if (dec.length >= 2 && dec.every((d) => d.tone === dec[0].tone) && (dec[0].tone === 'good' || dec[0].tone === 'bad')) decade = { tone: dec[0].tone, by: dec };
  else if (dec.length >= 2 && dec.some((d) => d.tone === 'good') && dec.some((d) => d.tone === 'bad')) {
    conflicts.push(`這十年：${dec.map((d) => `${d.system}${d.source}說${TONE_WORD[d.tone]}`).join('、')}，兩邊相反；逐年的細節看「人生時間軸」。`);
  }
  const nextYun = dec.find((d) => d.system === '八字' && d.next && year && d.next.startYear - year <= 3 && d.next.startYear > year && d.next.tone !== d.tone);

  // ── 斷語：一段話講完（誰、適合做什麼、最大的功課、今年）
  const yearLabel = year ? `${year} 年` : '今年';
  const ev = (e) => `${e.systems.length} 個系統一致${e.check && e.check.verdict === 'hit' ? '、測驗也說中' : ''}`;
  let verdict = `老師看${W}的整體命盤：`;
  if (core.length) {
    const evidence = !core[1] ? ev(core[0]) : ev(core[0]) === ev(core[1]) ? `各有 ${ev(core[0])}` : `${ev(core[0])}；${ev(core[1])}`;
    verdict += `${W}最明顯的特質是「${core[0].label}」${core[1] ? `和「${core[1].label}」` : ''}（${evidence}）。`;
  } else if (quizOnly.length) {
    verdict += `各系統的說法很分散，沒有一個特質被兩個以上系統同時說到；${W}的測驗最明顯的是「${quizOnly.map((x) => x.label).join('」「')}」，先以測驗為準。`;
  } else {
    verdict += '各系統的說法很分散，沒有一個特質被兩個以上系統同時說到，不適合用一句話定型。';
  }
  const jobs = (careerTop.length ? careerTop : lead).map((e) => TRAIT_TEXT[e.tag].job);
  const oneLine = lead.length ? `一句話：${W}適合${jobs.join('，或')}的工作；最大的功課是${TRAIT_TEXT[lead[0].tag].riskShort}。` : '';
  let yearLine = `${yearLabel}${YEAR_VERDICT[overall]}`;
  if (hotBad.length) yearLine += `，最該花心思的是「${hotBad[0].theme}」（${hotBad[0].bad.map((x) => x.system).join('、')}都點名）`;
  else if (hotGood.length) yearLine += `，最有機會的是「${hotGood[0].theme}」（${hotGood[0].good.map((x) => x.system).join('、')}都指向）`;
  yearLine += '。';
  verdict += oneLine + yearLine;
  // 存成圖卡用的短句（圖卡每行最多四行字，整段斷語放不下）
  const posterLines = [lead.length ? `最明顯：「${lead.map((e) => e.label).join('」「')}」` : '各系統說法分散', oneLine.replace(/^一句話：/, ''), yearLine].filter(Boolean);

  // ── 為什麼這樣說：每一項只寫結論和依據
  const why = [];
  for (const e of core) why.push({ tone: 'good', text: `個性「${e.label}」：${sourcesText(e.sources)}，${e.systems.length} 個系統一致${e.check ? `；${checkText(e.check)}` : ''}。` });
  for (const x of quizOnly) why.push({ tone: 'info', text: `測驗說你「${x.label}」：${x.detail}（命盤沒有一致的說法）。` });
  if (careerTop.length) {
    const c = careerTop[0];
    why.push({ tone: 'info', text: `事業：最多系統指向「${TAGS[c.tag].career}」（${c.systems.join('、')}）${careerTop[1] ? `；其次是「${TAGS[careerTop[1].tag].career}」（${careerTop[1].systems.join('、')}）` : ''}。具體職業和薪水看「工作與未來方向」。` });
  } else {
    why.push({ tone: 'info', text: '事業：各系統指的方向不一樣，沒有兩個以上系統一致的結論；可以做興趣測驗，或看「工作與未來方向」的綜合推薦。' });
  }
  if (wealth) why.push({ tone: 'info', text: `財運：${WEALTH[wealth.kind]}（${wealth.by.map((w) => `${w.system}${w.source}`).join('、')}）。` });
  if (loveTop || fate) {
    const parts = [];
    if (loveTop) parts.push(`${TAGS[loveTop.tag].love}（${sourcesText(loveTop.sources, true)}）`);
    if (fate) parts.push(`${LOVE_FATE[fate.level]}（${fate.by.map((f) => `${f.system}${f.source}`).join('、')}）`);
    why.push({ tone: 'info', text: `感情：${parts.join('；')}。` });
  }
  if (sig.year.length) {
    const goods = toneSystems('good');
    const bads = toneSystems('bad');
    const mixed = toneSystems('mixed');
    const tones = [goods.length && `說順的有${goods.join('、')}`, bads.length && `說要小心的有${bads.join('、')}`, mixed.length && `${mixed.join('、')}好壞參半`].filter(Boolean).join('；');
    const lines = [];
    for (const t of hotBad) lines.push(`要小心「${t.theme}」（${evid(t.bad)}）`);
    for (const t of hotGood) lines.push(`有機會「${t.theme}」（${evid(t.good)}）`);
    for (const t of hotFocus) lines.push(`「${t.theme}」有變數、要多留意（${evid(t.all)}）`);
    why.push({ tone: overall === 'bad' ? 'bad' : overall === 'good' ? 'good' : 'info', text: `${yearLabel}：${YEAR_VERDICT[overall]}${tones ? `（${tones}）` : ''}。${lines.length ? `${lines.join('；')}。` : '各系統點名的事都不一樣，沒有一件被兩個以上系統同時提到。'}` });
  }
  if (decade) {
    why.push({ tone: decade.tone === 'good' ? 'good' : 'bad', text: `這十年：${decade.by.map((d) => `${d.system}${d.source}`).join('、')}都說${TONE_WORD[decade.tone]}，${decade.tone === 'good' ? '想做的大事（創業、換跑道、置產）適合在這幾年做' : '以守成、累積實力為主，重大決定多想一步'}。` });
  }
  if (nextYun) why.push({ tone: 'info', text: `${nextYun.next.startYear} 年起換${nextYun.next.source}（八字）：從「${TONE_WORD[nextYun.tone]}」轉為「${TONE_WORD[nextYun.next.tone]}」，提早準備。` });

  // ── 化解：最大的盲點、今年最該小心的事
  const remedies = [];
  for (const e of lead.slice(0, 2)) remedies.push({ title: `盲點：${TRAIT_TEXT[e.tag].riskShort}`, steps: [`${TRAIT_TEXT[e.tag].risk}。`, ...TRAIT_TEXT[e.tag].fix] });
  if (hotBad.length) remedies.push({ title: `${yearLabel}要小心：${hotBad[0].theme}`, steps: THEME_FIX[hotBad[0].theme] || [] });
  const boosts = [];
  for (const e of lead) boosts.push(`「${e.label}」：${TRAIT_TEXT[e.tag].edge}。用在${TRAIT_TEXT[e.tag].job}的地方，最容易做出成績。`);
  for (const t of hotGood) if (THEME_USE[t.theme]) boosts.push(`${yearLabel}${THEME_USE[t.theme]}`);
  if (decade && decade.tone === 'good') boosts.push('這十年兩個系統都說順：把握時間做長期的布局。');

  // 只有一個系統說的（沒寫進結論），列出來參考
  const singles = traits.filter((e) => e.weight < 2).sort(byStrength((e) => e.weight))
    .map((e) => ({ label: e.label, text: `${sourcesText(e.sources)}${e.systems.length > 1 ? '（含血型的流行文化說法，算半個系統）' : ''}` }));

  return {
    badge: core.length ? { text: `核心：${core[0].label.split('、')[0]}`, cls: 'good' } : { text: '說法分散', cls: 'alt' },
    verdict,
    why,
    remedies: remedies.slice(0, 3),
    boosts,
    conflicts,
    singles,
    systems,
    core: core.map((e) => e.tag),
    posterLines,
    year: { overall, hotBad: hotBad.map((t) => t.theme), hotGood: hotGood.map((t) => t.theme), focus: hotFocus.map((t) => t.theme) },
  };
}
