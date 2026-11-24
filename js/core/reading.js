// 綜合解讀：把星座、八字、紫微、生命靈數、瑪雅、姓名、稱骨放在同一張桌上看。
//
// 做法：
// 1. 每個系統依你的盤面給出「特質標籤」（例：太陽獅子座 → 有主見、有創意；日主丙火 → 有主見、有創意）。
// 2. 統計標籤：兩個以上系統都提到的特質，就是「共同點」，可信度比單一系統高。
// 3. 依個性、事業、財運、感情、健康、人際、今年七個面向，列出每個系統的看法與依據，最後用共同點寫一句總結。
// 4. 多胞胎：說明哪些系統算出來一樣、哪些會不同，並套用紫微「借宮」的傳統看法（兩派都列出）。
// 全部在手機上計算；解讀文字由本 App 撰寫，僅供參考。

import { SIGNS, signAspect } from './zodiac.js';
import { positionsAt } from './astro.js';
import { MEANINGS } from './numerology.js';
import { SHISHEN_TEXT, liunian, WUXING } from './bazi.js';
import { natalWealth, ziweiWealth } from './windfall.js';
import { CHENGGU_PLAIN, DAYMASTER, LIFEPATH_DETAIL, MAYA_KEYWORD_TEXT, MOON_ELEMENT, MUTAGEN_TEXT, SHISHEN_GROUPS, SIGN_DETAIL, TAGS, WUXING_HEALTH, ZIWEI_STARS } from './reading-texts.js';

const ELEMENT_OF_SIGN = ['fire', 'earth', 'air', 'water'];
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
  return { palace: p, stars: opposite.major, borrowed: true };
}

const starLine = (ziwei, palaceName, field) => {
  const { stars, borrowed } = palaceStars(ziwei, palaceName);
  if (!stars.length) return null;
  const head = `${palaceName}${borrowed ? '（無主星，借對宮）' : ''}有${stars.map((s) => s.name + (s.mutagen ? `（${s.mutagen}）` : '')).join('、')}`;
  const body = stars.map((s) => ZIWEI_STARS[s.name]?.[field]).filter(Boolean).join('');
  const mut = stars.filter((s) => s.mutagen).map((s) => MUTAGEN_TEXT[s.mutagen]).join('');
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
    '同一天出生的多胞胎：八字、生命靈數、稱骨通常完全一樣（除非出生時間跨過時辰，例如一個 12:50、一個 13:05）。',
    '真正會不一樣的：①上升星座與宮位（上升星座平均每 2 小時換一個，差幾分鐘也可能不同）；②姓名，每個人的姓名學都不同；③紫微斗數的傳統借宮看法；④瑪雅曆會把出生的時與分加進去計算。',
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

const PERSONAL_YEAR = {
  1: '新循環的開始：適合立新目標、換跑道、主動出擊。', 2: '合作與耐心的一年：感情與夥伴關係是重點，別急。', 3: '表達與社交的一年：多曝光、多創作，人緣好。',
  4: '打基礎的一年：踏實工作、整理財務與健康，辛苦但有回報。', 5: '變動的一年：搬家、轉職、旅行機會多，保持彈性。', 6: '家庭與責任的一年：家人、伴侶與承諾是主題。',
  7: '沉澱學習的一年：適合進修、研究、獨處思考，不宜衝動。', 8: '收成與財務的一年：努力容易換成實際成果，也是升遷加薪的機會。', 9: '整理與告別的一年：結束不適合的人事物，為下個循環騰出空間。',
};

function personalYearNumber(birth, year) {
  let n = [birth.m, birth.d, year].join('').split('').reduce((a, c) => a + Number(c), 0);
  while (n > 9) n = String(n).split('').reduce((a, c) => a + Number(c), 0);
  return n;
}

/**
 * @param {{natal?:object, bazi?:object, ziwei?:object, birth:{y,m,d}, maya?:object, name?:object, chenggu?:object,
 *          today:{y,m,d}, gender?:string, birthOrder?:number, twinMethod?:'sibling'|'travel'}} input
 */
export function buildReading({ natal = null, bazi = null, ziwei = null, birth, maya = null, name = null, chenggu = null, today, gender = null, birthOrder = 0, twinMethod = 'sibling' }) {
  const lp = (() => {
    const digits = `${birth.y}${String(birth.m).padStart(2, '0')}${String(birth.d).padStart(2, '0')}`.split('').map(Number);
    let n = digits.reduce((a, b) => a + b, 0);
    while (n > 9) n = String(n).split('').reduce((a, c) => a + Number(c), 0);
    return n;
  })();
  const twins = twinsInfo({ birthOrder, natal, hasTime: !!(natal && natal.mode === 'timed'), method: twinMethod });
  const zw = ziwei && ziwei.ok ? (twins && twins.shift ? rotateZiwei(ziwei, twins.shift) : ziwei) : null;

  // ── 1. 收集特質標籤
  const votes = {};
  const vote = (tags, source) => {
    for (const t of tags) (votes[t] ||= []).push(source);
  };
  const sun = natal ? natal.sun.sign : null;
  if (sun !== null) vote(SIGN_DETAIL[sun].tags, `占星：太陽${signName(sun)}`);
  if (natal && natal.rising !== undefined && natal.rising !== null) vote(SIGN_DETAIL[natal.rising].tags, `占星：上升${signName(natal.rising)}`);
  let dom = null;
  if (bazi && bazi.ok) {
    vote(DAYMASTER[bazi.dayMaster.gan].tags, `八字：日主${bazi.dayMaster.gan}${bazi.dayMaster.wx}`);
    dom = dominantShishen(bazi);
    if (dom.value >= 1.5) vote(SHISHEN_GROUPS[dom.group].tags, `八字：${dom.group}較多`);
  }
  if (zw) {
    const { stars } = palaceStars(zw, '命宮');
    for (const s of stars) if (ZIWEI_STARS[s.name]) vote(ZIWEI_STARS[s.name].tags, `紫微：命宮${s.name}`);
  }
  vote(LIFEPATH_DETAIL[lp].tags, `生命靈數 ${lp}`);
  const ranked = Object.entries(votes).map(([tag, sources]) => ({ tag, label: TAGS[tag].label, count: sources.length, sources })).sort((a, b) => b.count - a.count);
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
    moon !== null && { system: '占星', text: `月亮${signName(moon)}（內在情緒）：${MOON_ELEMENT[ELEMENT_OF_SIGN[moon % 4]]}` },
    natal && natal.rising !== undefined && natal.rising !== null && { system: '占星', text: `上升${signName(natal.rising)}（給人的第一印象）：${SIGN_DETAIL[natal.rising].personality}。` },
    bazi && bazi.ok && { system: '八字', text: DAYMASTER[bazi.dayMaster.gan].text },
    dom && { system: '八字', text: SHISHEN_GROUPS[dom.group].text },
    bazi && bazi.ok && { system: '八字', text: wuxingBalance(bazi) },
    zw && { system: '紫微', text: starLine(zw, '命宮', 'ming') },
    { system: '生命靈數', text: `生命靈數 ${lp}（${MEANINGS[lp].title}）：${MEANINGS[lp].text}` },
    maya && { system: '瑪雅', text: mayaLine(maya) },
    name && name.ok && { system: '姓名', text: `人格 ${name.grids.人格.value}（${name.grids.人格.title}）：${name.grids.人格.text}` },
    chenggu && chenggu.ok && { system: '稱骨', text: `骨重 ${chenggu.text}。${CHENGGU_PLAIN[chenggu.total] || ''}` },
  ]);

  // ── 3. 事業
  const mc = natal && natal.angles ? Math.floor(natal.angles.MC / 30) : null;
  const curYun = bazi && bazi.yun ? bazi.yun.list.find((d) => d.current) : null;
  add('career', '事業', `適合的方向：${top.map((t) => TAGS[t.tag].career).join('；')}。`, [
    sun !== null && { system: '占星', text: `太陽${signName(sun)}：${SIGN_DETAIL[sun].career}。` },
    mc !== null && { system: '占星', text: `天頂（社會角色）在${signName(mc)}：${SIGN_DETAIL[mc].career}。` },
    dom && { system: '八字', text: `${dom.group}較多：${SHISHEN_GROUPS[dom.group].career}` },
    curYun && { system: '八字', text: `目前大運 ${curYun.ganzhi}（${curYun.startYear}–${curYun.endYear}）是「${curYun.shishen}」運：${SHISHEN_TEXT[curYun.shishen]}` },
    zw && { system: '紫微', text: starLine(zw, '官祿', 'career') },
    { system: '生命靈數', text: LIFEPATH_DETAIL[lp].career },
    name && name.ok && { system: '姓名', text: `總格 ${name.grids.總格.value}（${name.grids.總格.title}，${name.grids.總格.gradeText}）看中年以後的成就：${name.grids.總格.text}` },
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
  ]);

  // ── 6. 健康
  add('health', '健康', '以下是命理上的提醒，不能取代醫療；身體不舒服請看醫生。', [
    bazi && bazi.ok && { system: '八字', text: healthLine(bazi) },
    sun !== null && { system: '占星', text: `太陽${signName(sun)}對應的身體部位：${SIGN_DETAIL[sun].body}。` },
    zw && { system: '紫微', text: (() => { const { stars } = palaceStars(zw, '疾厄'); return stars.length ? `疾厄宮有${stars.map((s) => s.name).join('、')}：壓力大時，這些星代表的個性（${stars.map((s) => ZIWEI_STARS[s.name]?.tags.map((t) => TAGS[t].label).join('、')).join('；')}）容易反映在身體上，記得適度放鬆。` : null; })() },
  ]);

  // ── 7. 人際與貴人
  const jup = bodySign(natal, 'Jupiter');
  add('social', '人際與貴人', '貴人常出現在你願意主動交流、分享專業的場合。', [
    jup !== null && { system: '占星', text: `木星（幸運與貴人）在${signName(jup)}：好運常來自「${SIGN_DETAIL[jup].career}」相關的人與機會。` },
    bazi && bazi.ok && { system: '八字', text: socialLine(bazi) },
    zw && { system: '紫微', text: starLine(zw, '僕役', 'ming')?.replace('僕役', '交友（僕役）宮') },
    zw && { system: '紫微', text: starLine(zw, '遷移', 'ming') },
  ]);

  // ── 8. 今年
  const yearPoints = [];
  if (bazi && bazi.ok) {
    const [ln] = liunian(bazi, [today.y]);
    yearPoints.push({ system: '八字', text: `${today.y} 流年 ${ln.ganzhi} 是你的「${ln.shishen}」年：${ln.shishenText}` });
    if (ln.taisui.length) yearPoints.push({ system: '八字', text: `今年${ln.taisui.join('、')}：民俗上會安太歲；重點是凡事多一分謹慎，重大變動先規劃。` });
    for (const r of ln.relations.slice(0, 2)) yearPoints.push({ system: '八字', text: r.text });
  }
  if (zw && zw.horoscope) {
    const [lu, quan, ke, ji] = zw.horoscope.yearlyMutagen || [];
    const where = (star) => zw.palaces.find((p) => [...p.major, ...p.minor].some((s) => s.name === star))?.name;
    if (lu) yearPoints.push({ system: '紫微', text: `流年化祿（${lu}）在${where(lu) || '盤外'}、化權（${quan}）在${where(quan) || '盤外'}、化科（${ke}）在${where(ke) || '盤外'}：這些宮位代表的事今年比較順；化忌（${ji}）在${where(ji) || '盤外'}，這方面要多花心力。` });
  }
  if (sun !== null) {
    const pos = positionsAt(Date.UTC(today.y, today.m - 1, today.d, 4));
    const ja = signAspect(sun, pos.Jupiter.sign);
    const sa = signAspect(sun, pos.Saturn.sign);
    const good = (a) => a.tone === 'harmony' || a.tone === 'strong';
    yearPoints.push({ system: '占星', text: `木星在${signName(pos.Jupiter.sign)}，和你的太陽成${ja.name}：${good(ja) ? '今年機會與貴人比較多，適合擴展。' : '好運要自己去創造，別只等機會。'}土星在${signName(pos.Saturn.sign)}，和你成${sa.name}：${sa.tone === 'tension' ? '責任與考驗變多，穩紮穩打最重要。' : '壓力可控，適合長期規劃。'}` });
  }
  const py = personalYearNumber(birth, today.y);
  yearPoints.push({ system: '生命靈數', text: `今年是你的流年數 ${py}：${PERSONAL_YEAR[py]}` });
  add('year', `${today.y} 年重點`, yearPoints.length > 2 ? '把下面幾個系統的提醒合起來看：哪件事被提到兩次以上，就是今年最該花心思的地方。' : '', yearPoints);

  return { traits: top, ranked, areas, twins, lifePathNumber: lp };
}

function wuxingBalance(bazi) {
  const c = bazi.wuxing.withHidden;
  const sorted = [...WUXING].sort((a, b) => c[b] - c[a]);
  const strong = sorted[0];
  const weak = sorted.filter((w) => c[w] === c[sorted[4]]);
  return `五行（含藏干）：${WUXING.map((w) => `${w}${c[w]}`).join('、')}。最旺的是${strong}，最弱的是${weak.join('、')}；生活上可以多接觸「${weak.join('、')}」相關的顏色、環境與興趣來平衡（簡化看法，真正的喜用神要看整體格局）。`;
}

function spouseLine(bazi, gender) {
  const stars = gender === '女' ? ['正官', '七殺'] : ['正財', '偏財'];
  const label = gender === '女' ? '官殺（女命看夫星）' : '財星（男命看妻星）';
  let n = 0;
  for (const p of bazi.pillars.filter(Boolean)) {
    if (p.label !== '日柱' && stars.includes(p.shishen)) n += 1;
    for (const h of p.hidden) if (stars.includes(h.shishen)) n += 0.5;
  }
  const dayZhi = bazi.pillars[2].zhi;
  const base = !gender ? '（沒有性別資料，以財星與官星一起看）' : '';
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

function mayaLine(maya) {
  const d = maya.items.find((x) => x.key === 'D');
  const e = maya.items.find((x) => x.key === 'E');
  const kw = (x) => (x && x.keyword ? `${x.keyword}（${MAYA_KEYWORD_TEXT[x.keyword].replace(/。$/, '')}）` : '—');
  return `表象 D 是「${kw(d)}」，別人看到的你；小宇宙 E 是「${kw(e)}」，你內在真正的核心。`;
}
