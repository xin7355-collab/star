// 綜合解讀：把星座、八字、紫微、生命靈數、瑪雅（銀河印記與瑪雅密碼）、姓名、稱骨、血型放在同一張桌上看。
//
// 做法：
// 1. 每個系統依你的盤面給出「特質標籤」（例：太陽獅子座 → 有主見、有創意；日主丙火 → 有主見、有創意）。
// 2. 統計標籤：兩個以上系統都提到的特質，就是「共同點」，可信度比單一系統高。
// 3. 依個性、事業、財運、感情、健康、人際、今年七個面向，列出每個系統的看法與依據，最後用共同點寫一句總結。
// 4. 多胞胎：說明哪些系統算出來一樣、哪些會不同，並套用紫微「借宮」的傳統看法（兩派都列出）。
// 5. 另外整理成結構化的訊號（signals）：老師解盤（synthesis.js）用它挑「好幾個系統都指向同一件事」的結論，不用再拆文字。
// 全部在手機上計算；解讀文字由本 App 撰寫，僅供參考。

import { SIGNS, signAspect } from './zodiac.js';
import { positionsAt } from './astro.js';
import { MEANINGS } from './numerology.js';
import { SHISHEN_TEXT, liunian, WUXING, yongShen, ganzhiTone } from './bazi.js';
import { natalWealth, ziweiWealth } from './windfall.js';
import { geju } from './geju.js';
import { BLOOD } from './blood.js';
import { mayaKin, yearKin, kinInfo, dayRelation } from './maya-kin.js';
import { sanFang } from './ziwei-pattern.js';
import { GEJU_TAGS, PALACE_THEME, PILLAR_THEME, SHISHEN_YEAR, PERSONAL_YEAR_SIGNAL } from './synthesis-texts.js';
import { SEAL_TEXT, TONE_TEXT } from './maya-texts.js';
import { CHENGGU_PLAIN, DAYMASTER, LIFEPATH_DETAIL, MAYA_KEYWORD_TEXT, MOON_SIGN_TEXT, SEAL_TAGS, SHISHEN_GROUPS, SIGN_DETAIL, TAGS, WUXING_HEALTH, ZIWEI_STARS, STAR_KEYWORDS, PALACE_DOMAIN, RISING_TEXT, mutagenIn } from './reading-texts.js';

const signName = (i) => SIGNS[i].name;

export const PALACE_SEQ = ['命宮', '兄弟', '夫妻', '子女', '財帛', '疾厄', '遷移', '僕役', '官祿', '田宅', '福德', '父母'];

/** 星盤上某顆星的星座（沒有出生時間、當天又換座時回傳 null） */
function bodySign(natal, key) {
  if (!natal) return null;
  if (natal.mode === 'timed') return natal.positions[key].sign;
  const signs = natal.ranges?.[key]?.signs;
  return signs && signs.length === 1 ? signs[0] : null;
}

/** 某個整宮的星座（第 n 宮）；沒有上升就回傳 null */
function houseSign(natal, n) {
  if (!natal || natal.rising === undefined || natal.rising === null) return null;
  return (natal.rising + n - 1) % 12;
}

/** 八字裡哪一組十神最多（天干算 1、藏干算 0.5，日主不算） */
export function dominantShishen(bazi) {
  const score = Object.fromEntries(Object.keys(SHISHEN_GROUPS).map((g) => [g, 0]));
  const groupOf = (ss) => Object.entries(SHISHEN_GROUPS).find(([, v]) => v.members.includes(ss))?.[0];
  for (const p of bazi.pillars.filter(Boolean)) {
    if (p.label !== '日柱') {
      const g = groupOf(p.shishen);
      if (g) score[g] += 1;
    }
    for (const h of p.hidden) {
      const g = groupOf(h.shishen);
      if (g) score[g] += 0.5;
    }
  }
  const [group, value] = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return { group, value, score };
}

/** 紫微：某宮的主星（沒有主星時借對宮，傳統作法） */
function palaceStars(ziwei, name) {
  const idx = ziwei.palaces.findIndex((p) => p.name === name);
  const p = ziwei.palaces[idx];
  if (p.major.length) return { palace: p, stars: p.major, borrowed: false };
  const opposite = ziwei.palaces.find((q) => q.index === (p.index + 6) % 12);
  return { palace: p, stars: opposite.major, borrowed: true, from: opposite.name };
}

/**
 * 某一宮的主星一句話。field 是 ZIWEI_STARS 的專屬文案欄位（命宮 ming、官祿 career、夫妻 love、財帛 wealth）；
 * 其他宮沒有專屬文案，改說「星的特質表現在這一宮管的事上」，不再套命宮的個性。
 */
const starLine = (ziwei, palaceName, field = null) => {
  const { stars, borrowed, from } = palaceStars(ziwei, palaceName);
  if (!stars.length) return null;
  const head = `${palaceName}${borrowed ? '（無主星，借對宮）' : ''}有${stars.map((s) => s.name + (s.mutagen ? `（${s.mutagen}）` : '')).join('、')}`;
  const body = field
    ? stars.map((s) => ZIWEI_STARS[s.name]?.[field]).filter(Boolean).join('')
    : `${stars.map((s) => STAR_KEYWORDS[s.name]).filter(Boolean).join('，')}，這些特質會表現在${PALACE_DOMAIN[palaceName]}上。`;
  // 借對宮的星：四化留在它真正所在的對宮
  const mut = stars.filter((s) => s.mutagen).map((s) => mutagenIn(s.mutagen, borrowed ? from : palaceName)).join('');
  return `${head}：${body}${mut ? ` ${mut}` : ''}`;
};

/** 多胞胎的紫微借宮：老二以兄弟宮（或遷移宮）當命宮，宮名依序輪轉 */
export function rotateZiwei(ziwei, shift) {
  if (!ziwei || !ziwei.ok || !shift) return ziwei;
  return {
    ...ziwei,
    twinShift: shift,
    palaces: ziwei.palaces.map((p) => {
      const pos = PALACE_SEQ.indexOf(p.name);
      return { ...p, originalName: p.name, name: PALACE_SEQ[(pos - shift + 12) % 12] };
    }),
  };
}

/** 多胞胎說明：哪些一樣、哪些不同、這個 App 怎麼區分 */
export function twinsInfo({ birthOrder, natal = null, hasTime = false, method = 'sibling' }) {
  if (!birthOrder || birthOrder < 1) return null;
  const lines = [
    '同一天出生的多胞胎：八字、生命靈數、稱骨、瑪雅銀河印記通常完全一樣（八字、稱骨除非出生時間跨過時辰，例如一個 12:50、一個 13:05）。',
    '真正會不一樣的：①上升星座與宮位（上升星座平均每 2 小時換一個，差幾分鐘也可能不同）；②姓名，每個人的姓名學都不同；③紫微斗數的傳統借宮看法；④瑪雅密碼（另一套算法）會把出生的時與分加進去計算。',
    '個性與人生也大量受環境與選擇影響，同卵雙胞胎也會長成不同的人，命盤只是其中一個角度。',
  ];
  if (birthOrder >= 2) {
    const shift = method === 'travel' ? (birthOrder === 2 ? 6 : birthOrder - 1) : birthOrder - 1;
    const from = PALACE_SEQ[shift % 12];
    lines.push(`你是第 ${birthOrder} 個出生：紫微斗數依「${method === 'travel' && birthOrder === 2 ? '老二用遷移宮' : '弟妹依序用兄弟宮'}」的看法，以原本的「${from}」當命宮來參考（另一派看法可在命盤設定切換；兩派沒有定論）。`);
  } else {
    lines.push('你是第 1 個出生：紫微斗數用原本的命盤。');
  }
  if (!hasTime) lines.push('目前沒有填出生時間：上升星座、宮位、紫微都無法區分，建議補上出生證明上的時間（精確到分）。');
  else if (natal && natal.angles) lines.push(`你的上升點在${signName(natal.rising)} ${(natal.angles.ASC % 30).toFixed(1)}°；接近 0° 或 30° 時，晚幾分鐘出生的手足可能就換到隔壁星座。`);
  return { lines, shift: birthOrder >= 2 ? (method === 'travel' && birthOrder === 2 ? 6 : birthOrder - 1) : 0 };
}

export const PERSONAL_YEAR = {
  1: '新循環的開始：適合立新目標、換跑道、主動出擊。', 2: '合作與耐心的一年：感情與夥伴關係是重點，別急。', 3: '表達與社交的一年：多曝光、多創作，人緣好。',
  4: '打基礎的一年：踏實工作、整理財務與健康，辛苦但有回報。', 5: '變動的一年：搬家、轉職、旅行機會多，保持彈性。', 6: '家庭與責任的一年：家人、伴侶與承諾是主題。',
  7: '沉澱學習的一年：適合進修、研究、獨處思考，不宜衝動。', 8: '收成與財務的一年：努力容易換成實際成果，也是升遷加薪的機會。', 9: '整理與告別的一年：結束不適合的人事物，為下個循環騰出空間。',
};

export function personalYearNumber(birth, year) {
  let n = [birth.m, birth.d, year].join('').split('').reduce((a, c) => a + Number(c), 0);
  while (n > 9) n = String(n).split('').reduce((a, c) => a + Number(c), 0);
  return n;
}

/**
 * @param {{natal?:object, bazi?:object, ziwei?:object, birth:{y,m,d}, maya?:object, name?:object, chenggu?:object,
 *          today:{y,m,d}, gender?:string, birthOrder?:number, twinMethod?:'sibling'|'travel', bloodType?:string}} input
 */
export function buildReading({ natal = null, bazi = null, ziwei = null, birth, maya = null, name = null, chenggu = null, today, gender = null, birthOrder = 0, twinMethod = 'sibling', bloodType = '', mayaCount = 'dreamspell' }) {
  const lp = (() => {
    const digits = `${birth.y}${String(birth.m).padStart(2, '0')}${String(birth.d).padStart(2, '0')}`.split('').map(Number);
    let n = digits.reduce((a, b) => a + b, 0);
    while (n > 9) n = String(n).split('').reduce((a, c) => a + Number(c), 0);
    return n;
  })();
  const twins = twinsInfo({ birthOrder, natal, hasTime: !!(natal && natal.mode === 'timed'), method: twinMethod });
  // 瑪雅曆銀河印記只看日期，生日一定有，所以直接在這裡算（瑪雅密碼要看多胞胎時分，由呼叫的地方傳進來）
  const kin = mayaKin(birth, mayaCount);
  const zw = ziwei && ziwei.ok ? (twins && twins.shift ? rotateZiwei(ziwei, twins.shift) : ziwei) : null;

  // ── 1. 收集特質標籤（said：每個系統說了哪些特質，「說中與不像」拿來和測驗逐句對照）
  const votes = {};
  const said = [];
  const vote = (system, tags, source) => {
    said.push({ system, source, tags });
    for (const t of tags) (votes[t] ||= []).push(source);
  };
  const sun = natal ? natal.sun.sign : null;
  if (sun !== null) vote('占星', SIGN_DETAIL[sun].tags, `占星：太陽${signName(sun)}`);
  if (natal && natal.rising !== undefined && natal.rising !== null) vote('占星', SIGN_DETAIL[natal.rising].tags, `占星：上升${signName(natal.rising)}`);
  let dom = null;
  if (bazi && bazi.ok) {
    vote('八字', DAYMASTER[bazi.dayMaster.gan].tags, `八字：日主${bazi.dayMaster.gan}${bazi.dayMaster.wx}`);
    dom = dominantShishen(bazi);
    if (dom.value >= 1.5) vote('八字', SHISHEN_GROUPS[dom.group].tags, `八字：${dom.group}較多`);
  }
  if (zw) {
    const { stars } = palaceStars(zw, '命宮');
    for (const s of stars) if (ZIWEI_STARS[s.name]) vote('紫微', ZIWEI_STARS[s.name].tags, `紫微：命宮${s.name}`);
  }
  vote('生命靈數', LIFEPATH_DETAIL[lp].tags, `生命靈數 ${lp}`);
  if (kin) vote('瑪雅', SEAL_TAGS[kin.seal.n], `瑪雅：銀河印記${kin.title}`);
  const blood = BLOOD[bloodType] || null;
  if (blood) vote('血型', blood.tags, `血型 ${bloodType} 型（流行文化）`);
  // 算「幾個系統」而不是「幾句話」：同一個系統的兩句（例如太陽和上升都說有主見）只算一個系統，不能說成好幾個系統一致
  const ranked = Object.entries(votes).map(([tag, sources]) => {
    const systems = [...new Set(said.filter((x) => x.tags.includes(tag)).map((x) => x.system))];
    return { tag, label: TAGS[tag].label, count: systems.length, systems, sources };
  }).sort((a, b) => b.count - a.count);
  const consensus = ranked.filter((t) => t.count >= 2).slice(0, 3);
  const top = consensus.length ? consensus : ranked.slice(0, 2);

  const areas = [];
  const add = (id, title, summary, points) => areas.push({ id, title, summary, points: points.filter((p) => p && p.text) });

  // ── 2. 個性
  const moon = natal ? bodySign(natal, 'Moon') : null;
  add('personality', '個性', consensus.length
    ? `好幾個系統都說你「${consensus.map((t) => t.label).join('」「')}」（每一項至少兩個系統一致），這是你最明顯、最值得參考的特質。`
    : `各系統看法較分散，比較明顯的是「${top.map((t) => t.label).join('」「')}」。`, [
    sun !== null && { system: '占星', text: `太陽${signName(sun)}：${SIGN_DETAIL[sun].personality}。` },
    moon !== null && { system: '占星', text: `月亮${signName(moon)}（內在情緒）：${MOON_SIGN_TEXT[moon]}` },
    natal && natal.rising !== undefined && natal.rising !== null && { system: '占星', text: `上升${signName(natal.rising)}（給人的第一印象）：${RISING_TEXT[natal.rising]}。` },
    bazi && bazi.ok && { system: '八字', text: DAYMASTER[bazi.dayMaster.gan].text },
    dom && { system: '八字', text: SHISHEN_GROUPS[dom.group].text },
    bazi && bazi.ok && { system: '八字', text: wuxingBalance(bazi) },
    zw && { system: '紫微', text: starLine(zw, '命宮', 'ming') },
    { system: '生命靈數', text: `生命靈數 ${lp}（${MEANINGS[lp].title}）：${MEANINGS[lp].text}` },
    kin && { system: '瑪雅', text: kinLine(kin) },
    maya && { system: '瑪雅', text: mayaLine(maya) },
    name && name.ok && { system: '姓名', text: `人格 ${name.grids.人格.value}（${name.grids.人格.title}）：${name.grids.人格.text}` },
    chenggu && chenggu.ok && { system: '稱骨', text: `骨重 ${chenggu.text}。${CHENGGU_PLAIN[chenggu.total] || ''}` },
    blood && { system: '血型', text: `${bloodType} 型：${blood.personality}（流行文化說法）` },
  ]);

  // ── 3. 事業
  const mc = natal && natal.angles ? Math.floor(natal.angles.MC / 30) : null;
  const curYun = bazi && bazi.yun ? bazi.yun.list.find((d) => d.current) : null;
  const ge = bazi && bazi.ok ? geju(bazi) : null;
  add('career', '事業', `適合的方向：${top.map((t) => TAGS[t.tag].career).join('；')}。`, [
    sun !== null && { system: '占星', text: `太陽${signName(sun)}：${SIGN_DETAIL[sun].career}。` },
    mc !== null && { system: '占星', text: `天頂（社會角色）在${signName(mc)}：${SIGN_DETAIL[mc].career}。` },
    ge && { system: '八字', text: `格局是${ge.name}${ge.use ? `（${ge.use}）` : ''}、${ge.status}：一生的主軸在「${ge.info.core}」，適合${ge.info.work}` },
    dom && { system: '八字', text: `${dom.group}較多：${SHISHEN_GROUPS[dom.group].career}` },
    curYun && { system: '八字', text: `目前大運 ${curYun.ganzhi}（${curYun.startYear}–${curYun.endYear}）是「${curYun.shishen}」運：${SHISHEN_TEXT[curYun.shishen]}` },
    zw && { system: '紫微', text: starLine(zw, '官祿', 'career') },
    { system: '生命靈數', text: LIFEPATH_DETAIL[lp].career },
    kin && { system: '瑪雅', text: `${kin.seal.name}的天賦：${SEAL_TEXT[kin.seal.n].gift}` },
    name && name.ok && { system: '姓名', text: `總格 ${name.grids.總格.value}（${name.grids.總格.title}，${name.grids.總格.gradeText}）看中年以後的成就：${name.grids.總格.text}` },
    blood && { system: '血型', text: `${blood.work}常見適合：${blood.jobs.join('、')}。` },
  ]);

  // ── 4. 財運
  const nw = bazi && bazi.ok ? natalWealth(bazi) : null;
  const zwW = zw ? ziweiWealth(zw) : null;
  const second = houseSign(natal, 2);
  const pianLean = (nw && nw.pian >= 1.5) || (zwW && zwW.lines[0] && zwW.lines[0].includes('偏財型'));
  add('wealth', '財運（正財與偏財）', pianLean
    ? '偏財有緣：除了本業，投資、副業、獎金這類機會比一般人多；記得設停損、別把全部押在運氣上。'
    : '正財型：穩定收入、專業加值與長期理財最適合你，投機的報酬率不如踏實累積。', [
    nw && { system: '八字', text: nw.lines.join('') },
    zwW && { system: '紫微', text: zwW.lines.join('') },
    second !== null && { system: '占星', text: `第二宮（金錢）在${signName(second)}：賺錢方式偏向「${SIGN_DETAIL[second].career}」。` },
    lp === 8 && { system: '生命靈數', text: '生命靈數 8 是和金錢最有緣的數字，懂得管理與累積。' },
    name && name.ok && name.wealthGrids.length && { system: '姓名', text: `${name.wealthGrids.join('、')}是姓名學常說的財源數。` },
  ]);

  // ── 5. 感情
  const venus = bodySign(natal, 'Venus');
  const desc = houseSign(natal, 7);
  add('love', '感情', `在感情裡：${top.map((t) => TAGS[t.tag].love).join('；')}。`, [
    venus !== null && { system: '占星', text: `金星${signName(venus)}（愛的方式）：${SIGN_DETAIL[venus].love}。` },
    desc !== null && { system: '占星', text: `第七宮（伴侶）在${signName(desc)}：容易被「${SIGN_DETAIL[desc].personality}」的人吸引。` },
    bazi && bazi.ok && { system: '八字', text: spouseLine(bazi, gender) },
    zw && { system: '紫微', text: starLine(zw, '夫妻', 'love') },
    { system: '生命靈數', text: LIFEPATH_DETAIL[lp].love },
    blood && { system: '血型', text: blood.love },
  ]);

  // ── 6. 健康
  add('health', '健康', '以下是命理上的提醒，不能取代醫療；身體不舒服請看醫生。', [
    bazi && bazi.ok && { system: '八字', text: healthLine(bazi) },
    sun !== null && { system: '占星', text: `太陽${signName(sun)}對應的身體部位：${SIGN_DETAIL[sun].body}。` },
    zw && { system: '紫微', text: (() => { const { stars } = palaceStars(zw, '疾厄'); return stars.length ? `疾厄宮有${stars.map((s) => s.name).join('、')}：壓力大時，這些星代表的個性（${stars.map((s) => ZIWEI_STARS[s.name]?.tags.map((t) => TAGS[t].label).join('、')).join('；')}）容易反映在身體上，記得適度放鬆。` : null; })() },
    blood && { system: '血型', text: `壓力來時：${blood.stress}${blood.cope}` },
  ]);

  // ── 7. 人際與貴人
  const jup = bodySign(natal, 'Jupiter');
  add('social', '人際與貴人', '貴人常出現在你願意主動交流、分享專業的場合。', [
    jup !== null && { system: '占星', text: `木星（幸運與貴人）在${signName(jup)}：好運常來自「${SIGN_DETAIL[jup].career}」相關的人與機會。` },
    bazi && bazi.ok && { system: '八字', text: socialLine(bazi) },
    zw && { system: '紫微', text: starLine(zw, '僕役')?.replace('僕役', '交友（僕役）宮') },
    zw && { system: '紫微', text: starLine(zw, '遷移') },
    kin && { system: '瑪雅', text: oracleLine(kin) },
  ]);

  // ── 8. 今年（yearSignals：每個系統對今年的好壞和點名的主題，老師解盤用來找「好幾個系統都指向的事」）
  const yearPoints = [];
  const yearSignals = [];
  const signal = (system, tone, text) => {
    const sig = { system, tone, text, good: [], bad: [], focus: [], reasons: {} };
    yearSignals.push(sig);
    return sig;
  };
  // reasons：每個主題是這個系統的哪一項點名的（老師解盤寫「為什麼」用）
  const put = (sig, pol, theme, reason) => {
    if (!theme) return;
    if (!sig[pol].includes(theme)) sig[pol].push(theme);
    if (reason) sig.reasons[theme] = sig.reasons[theme] ? `${sig.reasons[theme]}、${reason}` : reason;
  };
  if (bazi && bazi.ok) {
    const [ln] = liunian(bazi, [today.y]);
    yearPoints.push({ system: '八字', text: `${today.y} 流年 ${ln.ganzhi} 是你的「${ln.shishen}」年：${ln.shishenText}` });
    if (ln.taisui.length) yearPoints.push({ system: '八字', text: `今年${ln.taisui.join('、')}：民俗上會安太歲；重點是凡事多一分謹慎，重大變動先規劃。` });
    for (const t of ln.triggers) yearPoints.push({ system: '八字', text: t.text });
    for (const r of ln.relations.slice(0, 2)) yearPoints.push({ system: '八字', text: r.text });
    // 好壞：流年干支對你的喜忌；主題：流年十神（喜忌不明顯時看十神本身）、沖到哪一柱、犯太歲
    let tone = gzTone(ln.tone);
    const sig = signal('八字', tone, `流年${ln.ganzhi}是「${ln.shishen}」年${ln.tone ? `（天干${ln.tone.gan}、地支${ln.tone.zhi}）` : ''}${ln.taisui.length ? `、${ln.taisui.join('、')}` : ''}`);
    const sy = SHISHEN_YEAR[ln.shishen];
    if (sy) {
      const pol = tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : sy.nature;
      put(sig, pol, sy.theme, `${ln.ganzhi}是${ln.shishen}年`);
      // 女命的官殺、男命的財星也代表伴侶（傳統看法）
      if ((gender === '女' && ['正官', '七殺'].includes(ln.shishen)) || (gender === '男' && ['正財', '偏財'].includes(ln.shishen))) put(sig, pol, '感情', `${ln.shishen}是${gender === '女' ? '夫星' : '妻星'}`);
    }
    for (const r of ln.relations) {
      if (r.type === '六沖') put(sig, 'bad', PILLAR_THEME[r.pillar], `流年沖${r.pillar}`);
      else if (r.type === '六合') put(sig, 'good', PILLAR_THEME[r.pillar], `流年合${r.pillar}`);
    }
    if (ln.taisui.length || ln.triggers.some((t) => t.type !== '歲運並臨')) {
      put(sig, 'bad', '變動', [...ln.taisui, ...ln.triggers.filter((t) => t.type !== '歲運並臨').map((t) => t.type)].join('、'));
      tone = tone === 'good' ? 'mixed' : tone === 'neutral' ? 'bad' : tone;
    }
    sig.tone = tone;
  }
  if (zw && zw.horoscope) {
    const [lu, quan, ke, ji] = zw.horoscope.yearlyMutagen || [];
    const where = (star) => zw.palaces.find((p) => [...p.major, ...p.minor].some((s) => s.name === star))?.name;
    if (lu) yearPoints.push({ system: '紫微', text: `流年化祿（${lu}）在${where(lu) || '盤外'}、化權（${quan}）在${where(quan) || '盤外'}、化科（${ke}）在${where(ke) || '盤外'}：這些宮位代表的事今年比較順；化忌（${ji}）在${where(ji) || '盤外'}，這方面要多花心力。` });
    // 紫微每年都同時有祿和忌，不算整體好壞，只提供主題
    if (lu && ji) {
      const sig = signal('紫微', 'neutral', `流年化祿在${where(lu) || '盤外'}、化忌在${where(ji) || '盤外'}`);
      [['化祿', lu], ['化權', quan], ['化科', ke]].forEach(([m, st]) => put(sig, 'good', PALACE_THEME[where(st)], `流年${m}在${where(st)}`));
      put(sig, 'bad', PALACE_THEME[where(ji)], `流年化忌在${where(ji)}`);
    }
  }
  if (sun !== null) {
    const pos = positionsAt(Date.UTC(today.y, today.m - 1, today.d, 4));
    const ja = signAspect(sun, pos.Jupiter.sign);
    const sa = signAspect(sun, pos.Saturn.sign);
    const good = (a) => a.tone === 'harmony' || a.tone === 'strong';
    // 土星合太陽（土星走到你的太陽星座）是傳統上最重的考驗之一，運勢計分也給負分，不能歸到「壓力可控」
    let saText = '影響不大，照自己的節奏走。';
    if (sa.tone === 'strong') saText = '土星正走過你的太陽（約 29 年一次）：責任變重、考驗變多，也是成長最紮實的時候，穩紮穩打最重要。';
    else if (sa.tone === 'tension') saText = '責任與考驗變多，穩紮穩打最重要。';
    else if (sa.tone === 'harmony') saText = '壓力可控，適合長期規劃、累積實力。';
    yearPoints.push({ system: '占星', text: `木星在${signName(pos.Jupiter.sign)}，和你的太陽成${ja.name}：${good(ja) ? '今年機會與貴人比較多，適合擴展。' : '好運要自己去創造，別只等機會。'}土星在${signName(pos.Saturn.sign)}，和你成${sa.name}：${saText}` });
    // 木星合太陽是好事，土星合太陽是考驗：同一個「合」對兩顆星意思相反
    const jGood = good(ja);
    const sBad = sa.tone === 'strong' || sa.tone === 'tension';
    signal('占星', jGood && sBad ? 'mixed' : sBad ? 'bad' : jGood || sa.tone === 'harmony' ? 'good' : 'neutral', `木星和你的太陽成${ja.name}、土星成${sa.name}`);
  }
  const py = personalYearNumber(birth, today.y);
  yearPoints.push({ system: '生命靈數', text: `今年是你的流年數 ${py}：${PERSONAL_YEAR[py]}` });
  const pys = PERSONAL_YEAR_SIGNAL[py];
  put(signal('生命靈數', pys.tone, `流年數 ${py}`), pys.tone === 'good' ? 'good' : 'focus', pys.theme, `流年數 ${py}`);
  const yk = yearKin(birth, today, mayaCount);
  if (yk) yearPoints.push({ system: '瑪雅', text: `流年印記是 KIN ${yk.kin}「${yk.title}」（${yk.from.y}/${yk.from.m}/${yk.from.d} 生日起的一年）：關鍵字「${SEAL_TEXT[yk.seal.n].keys.join('、')}」，這一年常問自己：${TONE_TEXT[yk.tone.n].q}` });
  if (yk && kin) {
    const rel = dayRelation(yk.kin, kin.kin);
    signal('瑪雅', ['return', 'analog', 'guide', 'occult'].includes(rel) ? 'good' : rel === 'antipode' ? 'bad' : 'neutral', `流年印記${yk.title}${YEAR_KIN_REL[rel]}`);
  }
  add('year', `${today.y} 年重點`, yearPoints.length > 2 ? '把下面幾個系統的提醒合起來看：哪件事被提到兩次以上，就是今年最該花心思的地方。' : '', yearPoints);

  // ── 9. 結構化的訊號（老師解盤用）：事業、感情、財運、這十年
  const career = [];
  if (zw) for (const s of palaceStars(zw, '官祿').stars) if (ZIWEI_STARS[s.name]) career.push({ system: '紫微', source: `紫微：官祿宮${s.name}`, tags: ZIWEI_STARS[s.name].tags });
  if (mc !== null) career.push({ system: '占星', source: `占星：天頂${signName(mc)}`, tags: SIGN_DETAIL[mc].tags });
  if (ge && GEJU_TAGS[ge.kind]) career.push({ system: '八字', source: `八字：${ge.name}`, tags: GEJU_TAGS[ge.kind] });
  const loveStyle = [];
  if (venus !== null) loveStyle.push({ system: '占星', source: `占星：金星${signName(venus)}`, tags: SIGN_DETAIL[venus].tags });
  if (zw) for (const s of palaceStars(zw, '夫妻').stars) if (ZIWEI_STARS[s.name]) loveStyle.push({ system: '紫微', source: `紫微：夫妻宮${s.name}`, tags: ZIWEI_STARS[s.name].tags });
  // 緣分的多寡：八字的配偶星（沒有性別就不判斷，男女看的星不同）、紫微夫妻宮的三方四正
  const loveFate = [];
  if (bazi && bazi.ok && (gender === '男' || gender === '女')) {
    const n = spouseStars(bazi, gender);
    loveFate.push({ system: '八字', level: n === 0 ? 'low' : n >= 3 ? 'high' : 'mid', source: `${gender === '女' ? '官殺' : '財星'}${n === 0 ? '不明顯' : n >= 3 ? '很多' : '適中'}` });
  }
  if (zw) {
    const sf = sanFang(zw, zw.palaces.find((p) => p.name === '夫妻'));
    loveFate.push({ system: '紫微', level: sf.tone === 'good' ? 'high' : sf.tone === 'bad' ? 'low' : 'mid', source: `夫妻宮三方四正${sf.tone === 'good' ? '偏吉' : sf.tone === 'bad' ? '偏辛苦' : '平穩'}` });
  }
  const wealthSig = [];
  if (nw) wealthSig.push({ system: '八字', kind: nw.pian >= 1.5 ? 'pian' : nw.pian === 0 ? 'zheng' : 'some', source: nw.pian >= 1.5 ? `偏財星 ${nw.pian} 個` : nw.pian === 0 ? '沒有偏財星' : '偏財星不多' });
  if (zwW && zwW.lines[0]) {
    const kind = zwW.lines[0].includes('偏財型') ? 'pian' : zwW.lines[0].includes('正財型') ? 'zheng' : 'some';
    wealthSig.push({ system: '紫微', kind, source: `財帛宮${kind === 'pian' ? '偏財型' : kind === 'zheng' ? '正財型' : '看個人經營'}` });
  }
  const decade = [];
  if (curYun) {
    const idx = bazi.yun.list.indexOf(curYun);
    const next = bazi.yun.list[idx + 1] || null;
    decade.push({ system: '八字', tone: gzTone(ganzhiTone(bazi, curYun.ganzhi)), source: `大運${curYun.ganzhi}（${curYun.startYear}–${curYun.endYear}）`, next: next ? { source: `大運${next.ganzhi}`, startYear: next.startYear, tone: gzTone(ganzhiTone(bazi, next.ganzhi)) } : null });
  }
  if (zw && zw.horoscope) {
    const pal = zw.palaces.find((p) => p.index === zw.horoscope.decadalIndex);
    if (pal) {
      const sf = sanFang(zw, pal);
      decade.push({ system: '紫微', tone: sf.tone === 'good' ? 'good' : sf.tone === 'bad' ? 'bad' : 'neutral', source: `${pal.name}大限（${pal.decadal[0]}–${pal.decadal[1]} 歲）` });
    }
  }
  const signals = { year: yearSignals, career, loveStyle, loveFate, wealth: wealthSig, decade };

  return { traits: top, ranked, said, areas, twins, lifePathNumber: lp, signals };
}

/** 干支喜忌 → 好壞：有喜有忌是好壞參半，喜加平算好、忌加平算要小心 */
function gzTone(t) {
  if (!t) return 'neutral';
  const parts = [t.gan, t.zhi];
  const good = parts.includes('喜');
  const bad = parts.includes('忌');
  return good && bad ? 'mixed' : good ? 'good' : bad ? 'bad' : 'neutral';
}

/** 流年印記落在你五大神諭的哪個位置（老師解盤的依據文字） */
const YEAR_KIN_REL = {
  return: '是你的主印記（銀河生日年）', seal: '和你同圖騰', analog: '是你的支持位', antipode: '是你的挑戰位',
  occult: '是你的隱藏推動位', guide: '是你的引導位', color: '和你同色', none: '和你的神諭沒有直接關係',
};

function wuxingBalance(bazi) {
  const c = bazi.wuxing.withHidden;
  const ys = yongShen(bazi);
  const extra = ys.special
    ? ` 另外，這個盤可能是「${ys.special.name}」，有些派別的喜用正好相反（${ys.special.alt.primary}、${ys.special.alt.secondary}），兩種都可以參考。`
    : ys.borderline ? ` 你的身強弱在分界附近，也有人看成「${ys.alt.strength}」（喜用${ys.alt.primary}）。` : '';
  return `五行（含藏干）：${WUXING.map((w) => `${w}${c[w]}`).join('、')}。日主${ys.strength}，喜用五行是「${ys.primary}」（${ys.roles.primary}），其次「${ys.secondary}」；生活上多接觸「${ys.primary}」相關的顏色、環境與興趣來平衡（「開運佈置」有完整做法）。${extra}`;
}

/** 配偶星的份量：女命看官殺、男命看財星（天干算 1、藏干算 0.5，日柱天干是自己不算） */
function spouseStars(bazi, gender) {
  const stars = gender === '女' ? ['正官', '七殺'] : ['正財', '偏財'];
  let n = 0;
  for (const p of bazi.pillars.filter(Boolean)) {
    if (p.label !== '日柱' && stars.includes(p.shishen)) n += 1;
    for (const h of p.hidden) if (stars.includes(h.shishen)) n += 0.5;
  }
  return n;
}

function spouseLine(bazi, gender) {
  const label = gender === '女' ? '官殺（女命看夫星）' : '財星（男命看妻星）';
  const n = spouseStars(bazi, gender);
  const dayZhi = bazi.pillars[2].zhi;
  // 沒有性別時只看了財星：以前寫「財星與官星一起看」，實際上沒有算官星
  const base = !gender ? '（沒有性別資料，先用財星看）' : '';
  const amount = n === 0 ? '不明顯，感情通常來得比較晚或要主動經營' : n >= 3 ? '很多，異性緣好、選擇多，也要小心感情複雜' : '適中，感情能自然發展';
  return `${label}${base}在命盤裡${amount}。日支（配偶宮）是「${dayZhi}」，代表你心裡伴侶的位置。`;
}

function healthLine(bazi) {
  const c = bazi.wuxing.withHidden;
  const sorted = [...WUXING].sort((a, b) => c[b] - c[a]);
  const strong = sorted[0];
  const weak = sorted[4];
  return `五行最旺「${strong}」、最弱「${weak}」：太旺和太弱都容易反映在對應的部位。${strong}→${WUXING_HEALTH[strong]} ${weak}→${WUXING_HEALTH[weak]}`;
}

function socialLine(bazi) {
  let yin = 0;
  let bi = 0;
  for (const p of bazi.pillars.filter(Boolean)) {
    const add = (ss, w) => {
      if (ss === '正印' || ss === '偏印') yin += w;
      if (ss === '比肩' || ss === '劫財') bi += w;
    };
    if (p.label !== '日柱') add(p.shishen, 1);
    for (const h of p.hidden) add(h.shishen, 0.5);
  }
  const parts = [];
  parts.push(yin >= 1.5 ? `印星 ${yin} 個：長輩、老師、上司是你的貴人，遇到困難多請教。` : '印星不多：貴人要靠自己主動經營，別怕開口請教。');
  parts.push(bi >= 1.5 ? `比劫 ${bi} 個：朋友多、重義氣，合作時權責與金錢要先講清楚。` : '比劫不多：朋友圈小而精，重質不重量。');
  return parts.join('');
}

/** 銀河印記：圖騰的性格＋調性的功課 */
function kinLine(kin) {
  const tt = TONE_TEXT[kin.tone.n];
  return `銀河印記 KIN ${kin.kin}「${kin.title}」：${SEAL_TEXT[kin.seal.n].gist}調性「${kin.tone.name}」的關鍵是${tt.key}：${tt.text}`;
}

/** 五大神諭的支持位（最合拍的人）與挑戰位（逼你成長的人） */
function oracleLine(kin) {
  const a = kinInfo(kin.oracle.analog.kin);
  const b = kinInfo(kin.oracle.antipode.kin);
  return `五大神諭的支持位是${a.title}（${SEAL_TEXT[a.seal.n].keys.join('、')}）：和這種能量的人相處最輕鬆、最能互補；挑戰位是${b.title}（${SEAL_TEXT[b.seal.n].keys.join('、')}）：讓你不太舒服，卻最能逼你成長。`;
}

/** 瑪雅密碼 A～E（你提供的 V1 規則）：和銀河印記是不同算法，開頭標清楚 */
function mayaLine(maya) {
  const d = maya.items.find((x) => x.key === 'D');
  const e = maya.items.find((x) => x.key === 'E');
  const kw = (x) => (x && x.keyword ? `${x.keyword}（${MAYA_KEYWORD_TEXT[x.keyword].replace(/。$/, '')}）` : '—');
  const twin = maya.twin ? '（多胞胎：已把出生時分加進計算，和手足會不同）' : '';
  // 1950–2025 年出生的人有七成多 D 和 E 是同一個詞：合成一句，不要同一個詞講兩次
  if (d && e && d.keyword && d.keyword === e.keyword) return `瑪雅密碼（另一套算法）：表象 D 和小宇宙 E 都是「${kw(d)}」：別人看到的你，和你內在真正的核心是一致的。${twin}`;
  return `瑪雅密碼（另一套算法）：表象 D 是「${kw(d)}」，別人看到的你；小宇宙 E 是「${kw(e)}」，你內在真正的核心。${twin}`;
}
