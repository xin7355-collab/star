// 命理圖：羅盤、九宮飛星路線、五行生剋圖、八卦載入、塔羅牌面。全部是 SVG，文字走 textContent。
// 動畫只動 transform、opacity 與 stroke-dashoffset（線條用 pathLength=1 從 0 畫到滿）；
// 使用者開了「減少動態效果」時，CSS 檔尾會讓動畫瞬間結束，直接顯示畫好的圖。

import { h, s } from './dom.js';

const RAD = Math.PI / 180;
/** 角度以「正上方＝0°、順時針」計（北在上，和九宮格、地圖一致） */
const pt = (cx, cy, r, deg) => [cx + r * Math.sin(deg * RAD), cy - r * Math.cos(deg * RAD)];
const f = (n) => n.toFixed(1);

const DIR_DEG = { 北: 0, 東北: 45, 東: 90, 東南: 135, 南: 180, 西南: 225, 西: 270, 西北: 315 };
// 二十四山，從正北（子）開始順時針，每 15°
const MOUNTAINS = '子癸丑艮寅甲卯乙辰巽巳丙午丁未坤申庚酉辛戌乾亥壬';
// 後天八卦：方位 → 卦（爻由下往上，1 陽 0 陰）
const HOUTIAN = { 北: [0, 1, 0], 東北: [0, 0, 1], 東: [1, 0, 0], 東南: [0, 1, 1], 南: [1, 0, 1], 西南: [0, 0, 0], 西: [1, 1, 0], 西北: [1, 1, 1] };

/** 扇形（內外半徑之間、從 a0 到 a1 度） */
function sector(cx, cy, r0, r1, a0, a1) {
  const [x0, y0] = pt(cx, cy, r1, a0);
  const [x1, y1] = pt(cx, cy, r1, a1);
  const [x2, y2] = pt(cx, cy, r0, a1);
  const [x3, y3] = pt(cx, cy, r0, a0);
  return `M${f(x0)} ${f(y0)} A${r1} ${r1} 0 0 1 ${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} A${r0} ${r0} 0 0 0 ${f(x3)} ${f(y3)}Z`;
}

/** 一個卦：三條爻，最下面的爻靠近圓心（羅盤的畫法） */
function trigram(cx, cy, r, deg, lines) {
  const g = s('g', { transform: `rotate(${deg} ${cx} ${cy})` });
  lines.forEach((yang, i) => {
    const y = cy - r - i * 6;
    if (yang) g.append(s('rect', { x: cx - 9, y: f(y), width: 18, height: 3.4, rx: 1, class: 'lp-yao' }));
    else g.append(s('rect', { x: cx - 9, y: f(y), width: 7.5, height: 3.4, rx: 1, class: 'lp-yao' }), s('rect', { x: cx + 1.5, y: f(y), width: 7.5, height: 3.4, rx: 1, class: 'lp-yao' }));
  });
  return g;
}

/**
 * 羅盤：外圈二十四山、中圈八個方位（有命卦時標出你的八宅吉凶）、內圈後天八卦、中間天池與指南針。
 * @param personal fengshui.js 的 personalDirections（可為 null）
 */
export function luopan(personal) {
  const C = 150;
  const byDir = personal ? Object.fromEntries(personal.stars.map((st) => [st.dir, st])) : {};
  const dial = s('g', { class: 'lp-dial' });
  dial.append(s('circle', { cx: C, cy: C, r: 146, class: 'lp-rim' }), s('circle', { cx: C, cy: C, r: 118, class: 'lp-ring' }), s('circle', { cx: C, cy: C, r: 76, class: 'lp-ring' }));
  // 二十四山
  [...MOUNTAINS].forEach((ch, i) => {
    const deg = i * 15;
    const [x, y] = pt(C, C, 132, deg);
    const main = i % 2 === 0 && '子卯午酉'.includes(ch);
    dial.append(s('text', { x: f(x), y: f(y + 4.5), 'text-anchor': 'middle', class: `lp-mt${main ? ' main' : ''}`, transform: `rotate(${deg} ${f(x)} ${f(y)})`, text: ch }));
    const [a, b] = pt(C, C, 118, deg + 7.5);
    const [c, d] = pt(C, C, 146, deg + 7.5);
    dial.append(s('line', { x1: f(a), y1: f(b), x2: f(c), y2: f(d), class: 'lp-tick' }));
  });
  // 八方位扇形＋八宅星
  Object.entries(DIR_DEG).forEach(([dir, deg], i) => {
    const st = byDir[dir];
    const kind = st ? (st.good ? 'good' : 'bad') : 'plain';
    dial.append(s('path', { d: sector(C, C, 76, 118, deg - 22.5, deg + 22.5), class: `lp-sector ${kind}`, style: { '--i': String(i) } }));
    // 方位名在上、八宅星在下，疊成兩行：以前沿著半徑排，東西兩側會黏成「西禍害」「天醫東」
    const [x, y] = pt(C, C, 97, deg);
    dial.append(s('text', { x: f(x), y: f(st ? y - 2 : y + 4), 'text-anchor': 'middle', class: 'lp-dir', text: dir }));
    if (st) dial.append(s('text', { x: f(x), y: f(y + 12), 'text-anchor': 'middle', class: `lp-star ${kind}`, text: st.key }));
    dial.append(trigram(C, C, 52, deg, HOUTIAN[dir]));
  });
  const needle = s('g', { class: 'lp-needle' },
    s('path', { d: `M${C} ${C - 30} L${C + 6} ${C} L${C} ${C + 30} L${C - 6} ${C}Z`, class: 'lp-needle-s' }),
    s('path', { d: `M${C} ${C - 30} L${C + 6} ${C} L${C - 6} ${C}Z`, class: 'lp-needle-n' }),
    s('circle', { cx: C, cy: C, r: 3.5, class: 'lp-pin' }));
  const good = personal ? personal.stars.filter((st) => st.good).map((st) => `${st.key}${st.dir}`).join('、') : '';
  const bad = personal ? personal.stars.filter((st) => !st.good).map((st) => `${st.key}${st.dir}`).join('、') : '';
  return s(
    'svg',
    { viewBox: '0 0 300 300', class: 'luopan', role: 'img', 'aria-label': personal ? `羅盤（北在上）：吉方 ${good}；凶方 ${bad}` : '羅盤（北在上）：二十四山與後天八卦' },
    dial,
    s('circle', { cx: C, cy: C, r: 36, class: 'lp-pool' }),
    needle,
  );
}

// 九宮格（上北下南）裡每個方位的欄、列
const CELL = { 西北: [0, 0], 北: [1, 0], 東北: [2, 0], 西: [0, 1], 中: [1, 1], 東: [2, 1], 西南: [0, 2], 南: [1, 2], 東南: [2, 2] };
export const FLY_ORDER = ['中', '西北', '西', '東北', '南', '北', '西南', '東', '東南'];

/** 九宮飛星的飛行路線（中宮 → 西北 → 西 → 東北 → 南 → 北 → 西南 → 東 → 東南），疊在九宮格上 */
export function flightPath() {
  const points = FLY_ORDER.map((d) => CELL[d].map((v) => v + 0.5).join(',')).join(' ');
  return s('svg', { viewBox: '0 0 3 3', preserveAspectRatio: 'none', class: 'fly-path', 'aria-hidden': 'true' },
    s('polyline', { points, pathLength: 1, class: 'fly-line' }));
}

const WX = ['火', '土', '金', '水', '木']; // 從正上方順時針，相生順序
const WX_CLASS = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/**
 * 五行生剋圖：外圈箭頭相生、內圈虛線相剋；圈的大小是這個五行的份量（喜用神的月令加權），標出日主、喜用、忌神。
 * @param ys bazi.js 的 yongShen；dm 日主五行
 */
export function wuxingWheel(ys, dm) {
  const C = 130;
  const R = 82;
  const pos = Object.fromEntries(WX.map((w, i) => [w, pt(C, C, R, i * 72)]));
  const max = Math.max(...WX.map((w) => ys.weight[w])) || 1;
  const size = (w) => 15 + 11 * (ys.weight[w] / max);
  const role = (w) => (w === ys.primary || w === ys.secondary ? 'xi' : ys.avoid.includes(w) ? 'ji' : '');
  const arcs = WX.map((w, i) => {
    const next = WX[(i + 1) % 5];
    const a0 = i * 72 + 15;
    const a1 = i * 72 + 57;
    const [x0, y0] = pt(C, C, R + 26, a0);
    const [x1, y1] = pt(C, C, R + 26, a1);
    return s('path', { d: `M${f(x0)} ${f(y0)} A${R + 26} ${R + 26} 0 0 1 ${f(x1)} ${f(y1)}`, pathLength: 1, class: 'wx-sheng', 'marker-end': 'url(#wx-arrow)', style: { '--i': String(i) }, 'aria-label': `${w}生${next}` });
  });
  const kes = WX.map((w, i) => {
    const [x0, y0] = pos[w];
    const [x1, y1] = pos[KE[w]];
    return s('line', { x1: f(x0), y1: f(y0), x2: f(x1), y2: f(y1), pathLength: 1, class: 'wx-ke', style: { '--i': String(i) } });
  });
  const nodes = WX.map((w, i) => {
    const [x, y] = pos[w];
    const r = size(w);
    const tag = w === dm ? '日主' : role(w) === 'xi' ? '喜用' : role(w) === 'ji' ? '忌' : '';
    const tagClass = w === dm ? 'dm' : role(w);
    return s('g', { class: `wx-node ${role(w)}${w === dm ? ' dm' : ''}`, transform: `translate(${f(x)} ${f(y)})`, style: { '--i': String(i) } },
      s('g', { class: 'wx-pop' },
        s('circle', { r: f(r), class: `wx-dot wx-${WX_CLASS[w]}` }),
        s('text', { y: 5, 'text-anchor': 'middle', class: 'wx-char', text: w }),
        tag ? s('text', { y: f(r + 15), 'text-anchor': 'middle', class: `wx-tag ${tagClass}`, text: tag }) : null));
  });
  return s(
    'svg',
    { viewBox: '0 0 260 270', class: 'wx-wheel', role: 'img', 'aria-label': `五行生剋圖：日主${dm}，喜用${ys.primary}、${ys.secondary}，忌${ys.avoid.join('、')}；份量 ${WX.map((w) => `${w}${ys.weight[w]}`).join('、')}` },
    s('defs', {}, s('marker', { id: 'wx-arrow', viewBox: '0 0 8 8', refX: 6, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 L8 4 L0 8Z', class: 'wx-arrowhead' }))),
    kes,
    arcs,
    nodes,
  );
}

/** 載入中：一圈八卦慢慢轉，取代「計算中…」純文字 */
export function loader(text = '排盤中…') {
  const ring = s('g', { class: 'ld-ring' });
  Object.values(DIR_DEG).forEach((deg, i) => ring.append(trigram(40, 40, 22, deg, Object.values(HOUTIAN)[i])));
  return s('svg', { viewBox: '0 0 80 80', class: 'loader-svg', role: 'img', 'aria-label': text }, ring, s('circle', { cx: 40, cy: 40, r: 9, class: 'ld-core' }));
}

/** n 角星的頂點（外半徑 R、內半徑 r，第一個尖角朝上） */
function starPoints(cx, cy, R, r, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i += 1) {
    const rad = (i * Math.PI) / n - Math.PI / 2;
    const rr = i % 2 ? r : R;
    pts.push(`${f(cx + rr * Math.cos(rad))},${f(cy + rr * Math.sin(rad))}`);
  }
  return pts.join(' ');
}
// 牌面圖示：大牌用八角星，小牌用花色（權杖、聖杯、寶劍、錢幣），都是自己畫的簡單幾何
const TAROT_ICON = {
  major: () => [s('polygon', { points: starPoints(20, 20, 16, 6.5, 8), class: 'tc-ico' }), s('circle', { cx: 20, cy: 20, r: 4, class: 'tc-hole' })],
  權杖: () => [s('line', { x1: 20, y1: 5, x2: 20, y2: 36, class: 'tc-stroke' }), s('ellipse', { cx: 15, cy: 12, rx: 4.5, ry: 2, transform: 'rotate(-30 15 12)', class: 'tc-ico' }), s('ellipse', { cx: 25, cy: 19, rx: 4.5, ry: 2, transform: 'rotate(30 25 19)', class: 'tc-ico' })],
  聖杯: () => [s('path', { d: 'M10 7 H30 Q30 21 20 23 Q10 21 10 7Z', class: 'tc-ico' }), s('line', { x1: 20, y1: 23, x2: 20, y2: 31, class: 'tc-stroke' }), s('line', { x1: 13, y1: 33, x2: 27, y2: 33, class: 'tc-stroke' })],
  寶劍: () => [s('polygon', { points: '20,3 23,8 23,26 17,26 17,8', class: 'tc-ico' }), s('rect', { x: 11, y: 26, width: 18, height: 3, rx: 1, class: 'tc-ico' }), s('rect', { x: 18.5, y: 29, width: 3, height: 6, class: 'tc-ico' }), s('circle', { cx: 20, cy: 37, r: 2, class: 'tc-ico' })],
  錢幣: () => [s('circle', { cx: 20, cy: 20, r: 15, class: 'tc-ring' }), s('polygon', { points: starPoints(20, 20, 12, 4.6, 5), class: 'tc-ico' })],
};

/**
 * 一張塔羅牌：背面朝上，翻過來是牌面（CSS 3D 翻牌）；逆位整張牌面倒過來。純裝飾，牌名與正逆位另外用文字寫。
 * @param {{mark:string, suit?:string, major:boolean, reversed:boolean, title:string}} card
 */
export function tarotCard({ mark, suit, major, reversed, title }) {
  return h('div', { class: 'tc', 'aria-hidden': 'true' },
    h('div', { class: 'tc-inner' },
      h('div', { class: 'tc-back' }, s('svg', { viewBox: '0 0 40 40', class: 'tc-svg' }, s('polygon', { points: starPoints(20, 20, 9, 3.5, 4), class: 'tc-ico dim' }))),
      h('div', { class: `tc-front${reversed ? ' rev' : ''}` },
        h('span', { class: 'tc-mark', text: mark }),
        s('svg', { viewBox: '0 0 40 40', class: 'tc-svg' }, TAROT_ICON[major ? 'major' : suit]()),
        h('span', { class: 'tc-title', text: title }))));
}
