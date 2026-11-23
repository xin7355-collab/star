// 合盤／配對評分。
// 設計參考 tianji scripts/fortune_calc.py（MIT）：
//   ・星座相位分數表 XINGZUO_ASPECT_SCORE（合/三分 15、六分 14、半六分 11、對分 8、四分 5、梅花 2）
//   ・多人合盤一律取「人對均值」，2 人與 5 人的分數同一量尺、可直接比較
// 以 JS 重寫，並把八字項目換成星座項目。

import { SIGNS, ELEMENTS, signDistance, SIGN_ASPECTS } from './zodiac.js';
import { signOptions } from './natal.js';

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

/** 兩人配對分數 */
export function scorePair(a, b) {
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
    basis: used.length === BANDS.length ? '完整四項' : `以 ${used.length} 項計算（資料不足的項目不計分）`,
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
