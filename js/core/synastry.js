// 合盤／配對評分。
// ・快速模式（只知道太陽星座）：看星座間隔。設計參考 tianji scripts/fortune_calc.py（MIT）的星座相位分數表
//   （合/三分 15、六分 14、半六分 11、對分 8、四分 5、梅花 2）。
// ・精準模式（兩人都有生日）：改看兩張星盤的實際度數相位（A 的行星和 B 的行星相差幾度），
//   依容許度與行星組合加權，分成情感默契、吸引力、溝通理解、長久穩定四項。星座相位只看「同一個星座範圍」，
//   同是三分相，差 1° 和差 9° 的影響差很多，度數才是合盤的主流做法。
// ・多人合盤一律取「人對均值」，2 人與 5 人的分數同一量尺、可直接比較。

import { SIGNS, ELEMENTS, signDistance, SIGN_ASPECTS } from './zodiac.js';
import { signOptions } from './natal.js';
import { positionsAt } from './astro.js';

// 索引 = 相差格數 0~6；數值 = tianji 分數 / 15
const ASPECT_RATIO = [15, 11, 14, 5, 15, 2, 8].map((v) => v / 15);

export const BANDS = [
  { id: 'sunSun', label: '太陽 × 太陽（個性方向）', max: 30 },
  { id: 'sunMoon', label: '太陽 × 月亮（互相理解）', max: 30 },
  { id: 'moonMoon', label: '月亮 × 月亮（情緒節奏）', max: 20 },
  { id: 'venusMars', label: '金星 × 火星（吸引力）', max: 20 },
];

export const MAX_PEOPLE = 5;

function ratioBetween(optsA, optsB) {
  if (!optsA || !optsB || !optsA.length || !optsB.length) return null;
  let sum = 0;
  let n = 0;
  for (const a of optsA) {
    for (const b of optsB) {
      sum += ASPECT_RATIO[signDistance(a, b)];
      n += 1;
    }
  }
  return sum / n; // 出生時間未知、可能有兩個星座時取平均
}

/**
 * 人物資料格式：
 *   快速模式 { name, sunSign: 0~11 }
 *   精準模式 { name, natal }（natal 來自 buildNatal）
 */
function opts(person, key) {
  if (person.natal) return signOptions(person.natal, key);
  if (key === 'Sun' && Number.isInteger(person.sunSign)) return [person.sunSign];
  return null;
}

/** 兩人配對分數：兩人都有星盤就看度數相位，否則看太陽星座 */
export function scorePair(a, b) {
  if (a.natal && b.natal) return aspectPair(a, b);
  const bands = [];
  const add = (id, ratio) => {
    const band = BANDS.find((x) => x.id === id);
    if (ratio === null) bands.push({ ...band, score: null, available: false });
    else bands.push({ ...band, score: Math.round(ratio * band.max * 10) / 10, available: true });
  };
  add('sunSun', ratioBetween(opts(a, 'Sun'), opts(b, 'Sun')));
  const sm1 = ratioBetween(opts(a, 'Sun'), opts(b, 'Moon'));
  const sm2 = ratioBetween(opts(b, 'Sun'), opts(a, 'Moon'));
  add('sunMoon', sm1 === null || sm2 === null ? null : (sm1 + sm2) / 2);
  add('moonMoon', ratioBetween(opts(a, 'Moon'), opts(b, 'Moon')));
  const vm1 = ratioBetween(opts(a, 'Venus'), opts(b, 'Mars'));
  const vm2 = ratioBetween(opts(b, 'Venus'), opts(a, 'Mars'));
  add('venusMars', vm1 === null || vm2 === null ? null : (vm1 + vm2) / 2);

  const used = bands.filter((x) => x.available);
  const gained = used.reduce((acc, x) => acc + x.score, 0);
  const possible = used.reduce((acc, x) => acc + x.max, 0);
  const total = possible ? Math.round((gained / possible) * 100) : 0;
  const sunA = opts(a, 'Sun');
  const sunB = opts(b, 'Sun');
  return {
    a: a.name,
    b: b.name,
    total,
    bands,
    basis: used.length === BANDS.length ? '完整四項' : `以 ${used.length} 項計算（缺資料的那幾項不計分）`,
    label: labelFor(total),
    story: sunA && sunB ? relationStory(sunA[0], sunB[0]) : null,
  };
}

/** 多人：所有兩兩組合取平均 */
export function scoreGroup(people) {
  if (people.length < 2) throw new Error('至少需要兩個人');
  if (people.length > MAX_PEOPLE) throw new Error(`最多 ${MAX_PEOPLE} 人`);
  const pairs = [];
  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) pairs.push(scorePair(people[i], people[j]));
  }
  const total = Math.round(pairs.reduce((acc, p) => acc + p.total, 0) / pairs.length);
  return { total, label: labelFor(total), pairs };
}

export function labelFor(total) {
  if (total >= 85) return '非常合拍';
  if (total >= 70) return '合得來';
  if (total >= 55) return '需要磨合';
  return '挑戰較多';
}

const ELEMENT_FLAVOR = {
  'fire-fire': '兩團火湊在一起，行動力強、熱度高，也容易一起衝過頭。',
  'earth-earth': '都重視實際與穩定，步調一致，缺點是容易一起陷入保守。',
  'air-air': '話題聊不完、想法互相激盪，但需要有人把想法落地。',
  'water-water': '情感細膩、默契深，情緒也容易互相放大。',
  'air-fire': '風助火勢：一方出點子、一方衝刺，很能互相點燃。',
  'earth-water': '水滋養土：一方給安全感、一方給溫度，互補又踏實。',
  'earth-fire': '火想衝、土想穩，節奏差異大，彼此能學到對方缺少的部分。',
  'fire-water': '熱情遇上感性，吸引力強，但表達方式容易擦槍走火。',
  'air-earth': '理性遇上務實，一個重想法、一個重結果，需要互相翻譯。',
  'air-water': '腦袋遇上心，一個講道理、一個講感受，溝通要多一點耐心。',
};

const ASPECT_STORY = {
  0: { summary: '同星座：價值觀相近，一看就懂對方。', tips: ['同樣的缺點會被放大，記得輪流讓步', '保留各自的空間'] },
  1: { summary: '相鄰星座：個性差異明顯，像是互相補課。', tips: ['不要用自己的標準要求對方', '多問「你為什麼這樣想」'] },
  2: { summary: '六分相：容易成為好朋友，相處輕鬆。', tips: ['主動創造共同目標', '別把對方的配合當成理所當然'] },
  3: { summary: '四分相：步調與做法常常不同，摩擦帶來成長。', tips: ['先處理情緒再談事情', '約定好衝突時的冷靜方式'] },
  4: { summary: '三分相：同元素，默契自然、很好溝通。', tips: ['舒適圈太舒服時，一起嘗試新事物', '默契之外仍要把話說清楚'] },
  5: { summary: '梅花相位：生活重心不同，需要互相調整。', tips: ['把期待說出口，不要讓對方猜', '找出兩人都能接受的折衷做法'] },
  6: { summary: '對分相：互相吸引又互相拉扯，是彼此的鏡子。', tips: ['欣賞對方擁有你缺少的部分', '爭執時找第三種選擇，而不是比輸贏'] },
};

/** 依兩人太陽星座產生描述（資料驅動，取代 78 組手寫文案） */
export function relationStory(a, b) {
  const steps = signDistance(a, b);
  const ea = SIGNS[a].element;
  const eb = SIGNS[b].element;
  const key = [ea, eb].sort().join('-');
  const base = ASPECT_STORY[steps];
  return {
    aspect: SIGN_ASPECTS[steps].name,
    elements: `${ELEMENTS[ea].name} × ${ELEMENTS[eb].name}`,
    summary: base.summary,
    flavor: ELEMENT_FLAVOR[key],
    tips: base.tips,
  };
}

/** 12×12 太陽星座配對表（對稱，共 78 組，含同星座） */
export function sunSignMatrix() {
  const out = {};
  for (let i = 0; i < 12; i += 1) {
    for (let j = i; j < 12; j += 1) {
      const r = scorePair({ name: SIGNS[i].name, sunSign: i }, { name: SIGNS[j].name, sunSign: j });
      out[`${SIGNS[i].id}-${SIGNS[j].id}`] = { score: r.total, label: r.label };
    }
  }
  return out;
}

export function lookupMatrix(matrix, a, b) {
  return matrix[`${SIGNS[a].id}-${SIGNS[b].id}`] || matrix[`${SIGNS[b].id}-${SIGNS[a].id}`] || null;
}

// ── 精準模式：度數相位合盤
const SYN_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
const SYN_NAME = { Sun: '太陽', Moon: '月亮', Mercury: '水星', Venus: '金星', Mars: '火星', Jupiter: '木星', Saturn: '土星' };
// 合盤容許度：日月 8°、個人行星 6°、木土 5°；六分相取六成。天王、海王、冥王同年代的人都差不多，不列入
const ORB = { Sun: 8, Moon: 8, Mercury: 6, Venus: 6, Mars: 6, Jupiter: 5, Saturn: 5 };
const SYN_ASPECTS = [
  { name: '合相', angle: 0, k: 1 },
  { name: '六分相', angle: 60, k: 0.6 },
  { name: '四分相', angle: 90, k: 1 },
  { name: '三分相', angle: 120, k: 1 },
  { name: '對分相', angle: 180, k: 1 },
];
// 每種行星組合（不分誰是誰）的重要性與歸類；28 種組合全列
const PAIR = {
  'Sun|Moon': [10, 'emotion'], 'Moon|Moon': [7, 'emotion'], 'Moon|Venus': [7, 'emotion'], 'Moon|Jupiter': [4, 'emotion'],
  'Venus|Mars': [9, 'attraction'], 'Sun|Venus': [6, 'attraction'], 'Venus|Venus': [4, 'attraction'], 'Sun|Mars': [4, 'attraction'], 'Moon|Mars': [4, 'attraction'], 'Mars|Mars': [3, 'attraction'], 'Mars|Jupiter': [2, 'attraction'],
  'Sun|Sun': [5, 'talk'], 'Mercury|Mercury': [5, 'talk'], 'Moon|Mercury': [4, 'talk'], 'Sun|Mercury': [3, 'talk'], 'Mercury|Venus': [3, 'talk'], 'Mercury|Mars': [2, 'talk'], 'Mercury|Jupiter': [2, 'talk'], 'Mercury|Saturn': [3, 'talk'],
  'Sun|Saturn': [6, 'bond'], 'Moon|Saturn': [6, 'bond'], 'Venus|Saturn': [6, 'bond'], 'Mars|Saturn': [3, 'bond'], 'Saturn|Saturn': [2, 'bond'], 'Jupiter|Saturn': [1, 'bond'], 'Sun|Jupiter': [4, 'bond'], 'Venus|Jupiter': [4, 'bond'], 'Jupiter|Jupiter': [1, 'bond'],
};
export const THEMES = [
  { id: 'emotion', label: '情感默契（日月、月亮）' },
  { id: 'attraction', label: '吸引力（金星、火星）' },
  { id: 'talk', label: '溝通理解（水星、太陽）' },
  { id: 'bond', label: '長久穩定（土星、木星）' },
];
// 分數換算：四項各自從 55 起算；總分從 56 起算。3160 組隨機配對：總分平均約 65、標準差約 10
const THEME_BASE = 55;
const THEME_K = 2.2;
const TOTAL_BASE = 56;

const pairKey = (x, y) => [x, y].sort((p, q) => SYN_BODIES.indexOf(p) - SYN_BODIES.indexOf(q)).join('|');
const sep = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

/** 相位對合盤的影響方向：三分、六分加分，四分、對分扣分；金火的四分、對分是火花，日月對分是互補，土星相位都比較沉重 */
function natureOf(key, aspect) {
  const sat = key.includes('Saturn');
  if (aspect === '三分相') return sat ? 0.7 : 1;
  if (aspect === '六分相') return sat ? 0.6 : 0.8;
  if (aspect === '合相') {
    if (sat) return 0.1;
    if (key === 'Mars|Mars') return 0;
    return key.includes('Mars') && key !== 'Venus|Mars' ? 0.3 : 0.8;
  }
  if (aspect === '四分相') return key === 'Venus|Mars' ? 0.1 : sat ? -0.9 : -0.7;
  return key === 'Venus|Mars' ? 0.3 : key === 'Sun|Moon' ? 0.2 : sat ? -0.9 : -0.4; // 對分相
}

/** 一個人的行星位置；沒有出生時間取當天中間，margin 是一天內可能移動的一半（月亮約 6°） */
export function synPoints(natal) {
  if (natal.mode === 'timed') return Object.fromEntries(SYN_BODIES.map((k) => [k, { lon: natal.positions[k].lon, margin: 0 }]));
  const a = positionsAt(natal.dayStartUtc, SYN_BODIES);
  const b = positionsAt(natal.dayEndUtc, SYN_BODIES);
  return Object.fromEntries(SYN_BODIES.map((k) => {
    const delta = ((((b[k].lon - a[k].lon) % 360) + 540) % 360) - 180;
    return [k, { lon: (((a[k].lon + delta / 2) % 360) + 360) % 360, margin: Math.abs(delta) / 2 }];
  }));
}

// 相位白話：{a} 是順序在前那顆行星的主人、{b} 是另一顆的主人（例如日月相位的 {a} 是太陽那一方）。
// 用人名講，行星寫在標題裡；寫成「我的金星欣賞媽媽的太陽」讀起來很怪。
const PAIR_TEXT = {
  'Sun|Moon': { soft: '{a}給方向、{b}給安全感，彼此合拍，這是傳統最看重的配對指標。', conj: '{a}的本性正是{b}內心需要的，很容易有「就是這個人」的感覺。', hard: '{a}在意目標、{b}在意感受，需要的東西不一樣，要學會翻譯彼此的需要。' },
  'Moon|Moon': { soft: '情緒節奏相近，生活習慣、安全感的來源很像，相處不累。', conj: '心情和需要幾乎同步，很懂對方；心情不好時也會一起低落。', hard: '情緒反應不同步：一個需要說、一個需要靜，先講好怎麼安撫對方。' },
  'Moon|Venus': { soft: '溫柔體貼、互相照顧，{a}在{b}身邊很有安全感。', conj: '甜蜜溫柔，{b}很懂得疼{a}，有像家人一樣的親近感。', hard: '表達愛的方式不同，{a}偶爾覺得{b}不夠體貼，其實只是習慣不一樣。' },
  'Moon|Jupiter': { soft: '{b}讓{a}心情變好、更有安全感，相處很療癒。', conj: '在一起很開心、很放鬆，{b}很包容{a}。', hard: '{b}的大方有時太隨性，{a}會覺得承諾不夠踏實。' },
  'Venus|Mars': { soft: '吸引力自然：{b}的主動剛好是{a}喜歡的方式，互動有火花又舒服。', conj: '彼此有強烈的吸引力，一見就有感覺。', hard: '吸引力很強，也容易因步調不同擦出火氣：{b}想衝、{a}想慢慢來。這是熱情，也是挑戰。' },
  'Sun|Venus': { soft: '{b}欣賞{a}原本的樣子，相處愉快。', conj: '{b}很自然地喜歡{a}，戀人與好朋友都常見的相位。', hard: '{b}欣賞的方式未必是{a}要的，多問對方喜歡什麼。' },
  'Venus|Venus': { soft: '品味和喜歡的生活方式相近，約會、花錢容易有共識。', conj: '審美與價值觀很像，很會一起享受生活。', hard: '喜好不同，要互相遷就；把各自喜歡的事輪流安排。' },
  'Sun|Mars': { soft: '{b}的行動力支持{a}的目標，一起做事很有效率。', conj: '互相激勵、充滿能量，也容易爭主導權。', hard: '意志力互相碰撞，容易爭誰說了算；分工比爭吵有效。' },
  'Moon|Mars': { soft: '{b}的熱情能點燃{a}，互動有溫度。', conj: '情緒和慾望綁在一起，很有感覺，也容易一點就燃。', hard: '{b}的直接容易刺傷{a}的情緒，說話放軟一點。' },
  'Mars|Mars': { soft: '做事步調一致，一起運動、一起拚都順。', conj: '幹勁相同，一起衝很有力，吵起來也一樣兇。', hard: '脾氣容易一起爆，衝突時先冷靜再談。' },
  'Sun|Sun': { soft: '個性方向相近或互補，做事節奏容易配合。', conj: '個性很像、價值觀一致；兩個人都想主導時要輪流讓步。', hard: '個性方向不同，能學到對方沒有的；尊重差異，不要想改變對方。' },
  'Mercury|Mercury': { soft: '想法和說話方式合得來，聊得起來、很少誤會。', conj: '思考方式很像，一說就懂。', hard: '思考與溝通方式不同，容易誤會；重要的事寫下來、說清楚。' },
  'Moon|Mercury': { soft: '{b}說的話能安撫{a}的情緒，溝通讓人安心。', conj: '{b}很懂得用{a}聽得進去的方式說話。', hard: '{b}講道理、{a}講感受，溝通時先回應情緒再談事情。' },
  'Sun|Mercury': { soft: '{b}欣賞{a}的想法，討論事情很順。', conj: '常常想到一塊去，很適合一起規劃。', hard: '意見常常不同，記得對事不對人。' },
  'Mercury|Venus': { soft: '說話好聽、互相欣賞，相處愉快。', conj: '聊天就是一種享受，很會逗對方開心。', hard: '說話的方式偶爾讓對方不舒服，語氣放軟一點。' },
  'Sun|Saturn': { soft: '{b}給{a}穩定與支持，關係有長久的基礎。', conj: '責任感很重的連結：{b}對{a}有承諾，也會給壓力。', hard: '{b}容易對{a}要求太高、管太多，{a}會覺得被限制。' },
  'Moon|Saturn': { soft: '{b}讓{a}有安全感，像可靠的依靠。', conj: '很忠誠的連結，但{b}的冷靜可能讓{a}覺得不夠溫暖。', hard: '{b}的冷靜或嚴格，可能讓{a}覺得冷淡、不被理解。' },
  'Venus|Saturn': { soft: '感情穩定、重承諾，是長久關係常見的相位。', conj: '很認真的感情，甜度不高但可靠。', hard: '愛的表達被責任或現實壓住，需要刻意經營浪漫。' },
  'Sun|Jupiter': { soft: '彼此帶來好運與信心，在一起更樂觀、更敢做夢。', conj: '互相鼓勵、一起成長，是很有福氣的組合。', hard: '一起時容易樂觀過頭、承諾太多，計畫要落地。' },
  'Venus|Jupiter': { soft: '大方、寬容、享受生活，相處很開心。', conj: '{b}很疼{a}，常一起吃喝玩樂。', hard: '一起花錢、一起放縱的時候要節制。' },
};
const PLANET_MEANING = { Sun: '自我與目標', Moon: '情緒與安全感', Mercury: '想法與說話方式', Venus: '喜歡的方式與價值觀', Mars: '行動力與慾望', Jupiter: '信念與成長', Saturn: '責任與界線' };

function aspectText(key, aspect, na, nb) {
  const kind = aspect === '合相' ? 'conj' : aspect === '三分相' || aspect === '六分相' ? 'soft' : 'hard';
  const [x, y] = key.split('|');
  const tpl = PAIR_TEXT[key]?.[kind] || {
    soft: `{a}的${SYN_NAME[x]}（${PLANET_MEANING[x]}）和{b}的${SYN_NAME[y]}（${PLANET_MEANING[y]}）互相支持，這方面相處順。`,
    conj: `{a}的${SYN_NAME[x]}和{b}的${SYN_NAME[y]}綁在一起：${PLANET_MEANING[x]}、${PLANET_MEANING[y]}的影響都被放大。`,
    hard: `{a}的${SYN_NAME[x]}和{b}的${SYN_NAME[y]}有拉扯：${PLANET_MEANING[x]}、${PLANET_MEANING[y]}這兩方面要多溝通。`,
  }[kind];
  return tpl.replaceAll('{a}', na).replaceAll('{b}', nb);
}

/** 兩張星盤之間的相位（A 的每顆行星對 B 的每顆行星），依影響大小排序 */
export function crossAspects(a, b) {
  const pa = synPoints(a.natal);
  const pb = synPoints(b.natal);
  const out = [];
  for (const x of SYN_BODIES) {
    for (const y of SYN_BODIES) {
      const d = sep(pa[x].lon, pb[y].lon);
      const margin = pa[x].margin + pb[y].margin;
      const key = pairKey(x, y);
      let best = null;
      for (const asp of SYN_ASPECTS) {
        const orb = Math.max(ORB[x], ORB[y]) * asp.k;
        const dev = Math.abs(d - asp.angle);
        if (dev - margin <= orb && (!best || dev < best.dev)) best = { ...asp, orb, dev, certain: dev + margin <= orb };
      }
      if (!best) continue;
      const [w, theme] = PAIR[key];
      const nature = natureOf(key, best.name);
      // 越接近正相位影響越大（正好 1、在容許度邊緣 0.5）；沒有出生時間、可能不成立的相位只算一半
      const factor = Math.max(0.5, 1 - (0.5 * Math.min(best.dev, best.orb)) / best.orb) * (best.certain ? 1 : 0.5);
      // {a} 是順序在前那顆行星的主人：A 的行星在前就是 A，否則是 B
      const first = SYN_BODIES.indexOf(x) <= SYN_BODIES.indexOf(y);
      const na = first ? a.name : b.name;
      const nb = first ? b.name : a.name;
      out.push({
        x, y, key, theme, aspect: best.name, dev: Math.round(best.dev * 10) / 10, orb: best.orb, certain: best.certain,
        effect: w * nature * factor,
        tone: nature >= 0.5 ? 'good' : nature <= -0.3 ? 'hard' : 'mixed',
        title: `${a.name}的${SYN_NAME[x]} ${best.name} ${b.name}的${SYN_NAME[y]}`,
        text: aspectText(key, best.name, na, nb),
      });
    }
  }
  return out.sort((p, q) => Math.abs(q.effect) - Math.abs(p.effect));
}

const THEME_NOTE = {
  emotion: { strong: '情緒很合拍：彼此懂得對方需要什麼，是關係最好的地基。', weak: '情緒需要不同步：多問一句「你現在需要什麼」，先接住情緒再談事情。' },
  attraction: { strong: '吸引力強：彼此有感覺、有火花。', weak: '火花較少：刻意安排約會和新鮮感，不要讓關係只剩生活瑣事。' },
  talk: { strong: '溝通順：想法容易對上，討論事情有效率。', weak: '溝通容易誤會：重要的事寫下來，吵架時先複述對方的意思再回應。' },
  bond: { strong: '長久穩定的條件好：責任感與承諾感相近。', weak: '長期關係有壓力：把責任分清楚、一起訂目標，壓力大時別把對方當出氣筒。' },
};

function aspectPair(a, b) {
  const aspects = crossAspects(a, b);
  const bands = THEMES.map((t) => {
    const list = aspects.filter((x) => x.theme === t.id);
    const sum = list.reduce((acc, x) => acc + x.effect, 0);
    const score = Math.max(15, Math.min(98, Math.round(THEME_BASE + THEME_K * sum)));
    return { id: t.id, label: t.label, score, max: 100, available: true, count: list.length };
  });
  // 總分看全部相位的加總（四項只是分類小計）：取四項平均會把好壞互相抵掉，九成的人都落在「需要磨合」
  const total = Math.max(15, Math.min(98, Math.round(TOTAL_BASE + aspects.reduce((acc, x) => acc + x.effect, 0))));
  const sorted = [...bands].sort((x, y) => y.score - x.score);
  const tips = [];
  if (sorted[3].score < 60) tips.push(THEME_NOTE[sorted[3].id].weak);
  if (sorted[0].score >= 60) tips.push(THEME_NOTE[sorted[0].id].strong);
  const dateOnly = [a, b].filter((p) => p.natal.mode !== 'timed').map((p) => p.name);
  const sunA = signOptions(a.natal, 'Sun');
  const sunB = signOptions(b.natal, 'Sun');
  return {
    mode: 'aspects',
    a: a.name,
    b: b.name,
    total,
    bands,
    aspects,
    basis: `兩張星盤之間的 ${aspects.length} 個度數相位（日月容許 8°、個人行星 6°、木土 5°）${dateOnly.length ? `；${dateOnly.join('、')}沒有出生時間，用當天中間的位置，月亮可能差到 6° 左右，不確定的相位標「可能」、只算一半` : ''}`,
    label: labelFor(total),
    tips,
    story: sunA && sunB ? relationStory(sunA[0], sunB[0]) : null,
  };
}
