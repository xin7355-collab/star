// 塔羅牌面（自己畫的 SVG，不用任何外部圖檔）：金箔雙框、四角星飾、依元素換色的底色與光暈、
// 大牌放射星芒＋22 張各自的圖騰、小牌依數字排花色、宮廷牌冠冕。使用者匯入自訂牌組時，整張換成他的圖、外框照舊。
// 漸層、裁切只定義一次（ensureTarotDefs），每張牌用 url(#…) 共用，避免一頁幾十張牌各自重複定義。
// 動畫只動 transform、opacity（翻牌、星屑、反光帶），減少動態效果時直接顯示結果。

import { h, s } from './dom.js';
import { reducedMotion } from './motion.js';

const f = (n) => Number(n.toFixed(2));
const EL = { 火: 'fire', 水: 'water', 風: 'air', 土: 'earth' };
const BG = {
  fire: ['#3d0f1d', '#6e1e22', '#2b0a14'],
  water: ['#0a1c40', '#114470', '#071430'],
  air: ['#1a1642', '#3a2c80', '#110e2e'],
  earth: ['#0e2a1d', '#2f4c1f', '#0a1c13'],
};
const GLOW = { fire: '#ffb36b', water: '#7fd8ff', air: '#d4c1ff', earth: '#c4ea8f' };

let defsReady = false;
/** 共用的漸層與裁切：第一次畫牌時放進 body（寬高 0，不能用 display:none，否則有的瀏覽器漸層會失效） */
export function ensureTarotDefs() {
  if (defsReady || typeof document === 'undefined' || !document.body) return;
  defsReady = true;
  const stops = (list) => list.map(([o, c, a = 1]) => s('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }));
  const defs = s('defs', {},
    // userSpaceOnUse：水平、垂直的直線外框寬或高是 0，用預設的 objectBoundingBox 會整條畫不出來
    s('linearGradient', { id: 'ta-gold', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 120, y2: 200 }, stops([[0, '#fff3c9'], [0.28, '#e9c46a'], [0.52, '#b4842a'], [0.78, '#f6dc9b'], [1, '#c4912f']])),
    s('linearGradient', { id: 'ta-back', x1: 0, y1: 0, x2: 0, y2: 1 }, stops([[0, '#1b1f57'], [0.5, '#2c2270'], [1, '#141845']])),
    ...Object.entries(BG).map(([k, [a, b, c]]) => s('linearGradient', { id: `ta-bg-${k}`, x1: 0, y1: 0, x2: 0, y2: 1 }, stops([[0, a], [0.55, b], [1, c]]))),
    ...Object.entries(GLOW).map(([k, c]) => s('radialGradient', { id: `ta-glow-${k}`, cx: 0.5, cy: 0.5, r: 0.5 }, stops([[0, c, 0.55], [0.55, c, 0.16], [1, c, 0]]))),
    s('clipPath', { id: 'ta-clip', clipPathUnits: 'objectBoundingBox' }, s('rect', { x: 0, y: 0, width: 1, height: 1, rx: 0.07, ry: 0.042 })),
  );
  document.body.append(s('svg', { width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false', class: 'ta-defs' }, defs));
}

// ── 小工具
const starPts = (cx, cy, R, r, n, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const a = ((rot + (i * 180) / n) * Math.PI) / 180;
  const rr = i % 2 ? r : R;
  return `${f(cx + rr * Math.cos(a))},${f(cy + rr * Math.sin(a))}`;
}).join(' ');
const P = (d, cls = 'ta-l') => s('path', { d, class: cls });
const C = (cx, cy, r, cls = 'ta-l') => s('circle', { cx, cy, r, class: cls });
const R = (x, y, w, ht, cls = 'ta-l', rx = 0) => s('rect', { x, y, width: w, height: ht, rx, class: cls });
const Ln = (x1, y1, x2, y2, cls = 'ta-l') => s('line', { x1, y1, x2, y2, class: cls });
const Star = (cx, cy, Ro, ri, n, cls = 'ta-f', rot = -90) => s('polygon', { points: starPts(cx, cy, Ro, ri, n, rot), class: cls });
const G = (attrs, ...kids) => s('g', attrs, ...kids);
const at = (x, y, k = 1, rot = 0) => ({ transform: `translate(${x} ${y})${rot ? ` rotate(${rot})` : ''}${k !== 1 ? ` scale(${k})` : ''}` });

/** 放射光線（大牌背景、王牌） */
function rays(cx, cy, r0, r1, n, cls = 'ta-ray') {
  return G({ class: cls }, ...Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    const r = i % 2 ? r1 * 0.78 : r1;
    return Ln(f(cx + r0 * Math.cos(a)), f(cy + r0 * Math.sin(a)), f(cx + r * Math.cos(a)), f(cy + r * Math.sin(a)), '');
  }));
}
function sun(cx, cy, r, n = 12) {
  return G({}, rays(cx, cy, r + 2, r + 7, n, 'ta-l thin'), C(cx, cy, r, 'ta-f'));
}
function flower(cx, cy, r) {
  return G({}, ...Array.from({ length: 5 }, (_, i) => {
    const a = ((i * 72 - 90) * Math.PI) / 180;
    return C(f(cx + r * 0.62 * Math.cos(a)), f(cy + r * 0.62 * Math.sin(a)), f(r * 0.5), 'ta-f soft');
  }), C(cx, cy, f(r * 0.34), 'ta-f'));
}
function lemniscate(cx, cy, w) {
  const a = w / 2;
  return P(`M${cx} ${cy} C${f(cx + a * 0.5)} ${f(cy - a * 0.6)} ${f(cx + a)} ${f(cy - a * 0.6)} ${f(cx + a)} ${cy} C${f(cx + a)} ${f(cy + a * 0.6)} ${f(cx + a * 0.5)} ${f(cy + a * 0.6)} ${cx} ${cy} C${f(cx - a * 0.5)} ${f(cy - a * 0.6)} ${f(cx - a)} ${f(cy - a * 0.6)} ${f(cx - a)} ${cy} C${f(cx - a)} ${f(cy + a * 0.6)} ${f(cx - a * 0.5)} ${f(cy + a * 0.6)} ${cx} ${cy}Z`, 'ta-l bold');
}
/** 新月：兩段弧圍出月牙（不用「蓋一個底色圓」的作法，底色是漸層時才不會露出一塊色斑）；dir > 0 開口朝右 */
function crescent(cx, cy, r, dir = 1) {
  const s0 = dir > 0 ? 0 : 1;
  return P(`M${cx} ${f(cy - r)} A${r} ${r} 0 1 ${s0} ${cx} ${f(cy + r)} A${f(r * 1.3)} ${f(r * 1.3)} 0 0 ${1 - s0} ${cx} ${f(cy - r)}Z`, 'ta-f');
}
function key(x, y, rot) {
  return G(at(x, y, 1, rot), C(0, -12, 4.5), Ln(0, -7.5, 0, 12), Ln(0, 8, 4, 8), Ln(0, 12, 4, 12));
}
function tower(x, y, w, ht) {
  return G({}, R(x, y, w, ht, 'ta-l'), ...Array.from({ length: 3 }, (_, i) => R(f(x + (i * w) / 2.5), y - 4, f(w / 5), 4, 'ta-f')));
}

// ── 花色（以 0,0 為中心，約 ±15）
const SUIT_GLYPH = {
  權杖: () => [Ln(0, -15, 0, 15, 'ta-l bold'), C(0, -15, 2.4, 'ta-f'), s('ellipse', { cx: -4.5, cy: -6, rx: 4.2, ry: 1.8, transform: 'rotate(-35 -4.5 -6)', class: 'ta-f' }), s('ellipse', { cx: 4.5, cy: 1, rx: 4.2, ry: 1.8, transform: 'rotate(35 4.5 1)', class: 'ta-f' })],
  聖杯: () => [P('M-10 -13 H10 Q10 1 0 4 Q-10 1 -10 -13Z', 'ta-f'), Ln(0, 4, 0, 11, 'ta-l bold'), Ln(-6.5, 12.5, 6.5, 12.5, 'ta-l bold'), P('M-7 -9 H7', 'ta-cut-l')],
  寶劍: () => [s('polygon', { points: '0,-16 2.8,-11 2.8,6 -2.8,6 -2.8,-11', class: 'ta-f' }), R(-7.5, 6, 15, 2.6, 'ta-f', 1), R(-1.3, 8.6, 2.6, 4.4, 'ta-f'), C(0, 14.6, 2, 'ta-f')],
  錢幣: () => [C(0, 0, 12, 'ta-l bold'), Star(0, 0, 9, 3.6, 5)],
};
const glyph = (suit, x, y, k = 1, rot = 0) => G(at(x, y, k, rot), ...SUIT_GLYPH[suit]());

// 小牌 2～10 的排點（中心區域約 x 30–90、y 58–140）
const PIPS = {
  2: [[60, 70], [60, 126]],
  3: [[60, 64], [60, 98], [60, 132]],
  4: [[42, 70], [78, 70], [42, 126], [78, 126]],
  5: [[42, 68], [78, 68], [60, 98], [42, 128], [78, 128]],
  6: [[42, 66], [78, 66], [42, 98], [78, 98], [42, 130], [78, 130]],
  7: [[42, 64], [78, 64], [60, 81], [42, 98], [78, 98], [42, 132], [78, 132]],
  8: [[42, 64], [78, 64], [60, 81], [42, 98], [78, 98], [60, 115], [42, 132], [78, 132]],
  9: [[42, 62], [78, 62], [42, 86], [78, 86], [60, 98], [42, 110], [78, 110], [42, 134], [78, 134]],
  10: [[42, 62], [78, 62], [60, 75], [42, 88], [78, 88], [42, 108], [78, 108], [60, 121], [42, 134], [78, 134]],
};
// 宮廷牌的冠冕（中心 60,70）
const COURT_CROWN = [
  () => [P('M44 76 Q60 58 76 76 Z', 'ta-f'), P('M70 66 Q82 52 88 58 Q80 60 74 70', 'ta-l')], // 侍者：便帽＋羽毛
  () => [P('M46 80 V66 Q60 52 74 66 V80 Z', 'ta-f'), Ln(50, 70, 70, 70, 'ta-cut-l'), Ln(50, 74, 70, 74, 'ta-cut-l')], // 騎士：頭盔
  () => [P('M42 80 L44 64 L52 72 L60 58 L68 72 L76 64 L78 80 Z', 'ta-f'), C(44, 62, 2.2, 'ta-f'), C(60, 56, 2.4, 'ta-f'), C(76, 62, 2.2, 'ta-f')], // 皇后：圓珠冠
  () => [P('M42 82 L42 64 L51 72 L60 56 L69 72 L78 64 L78 82 Z', 'ta-f'), Ln(60, 56, 60, 46, 'ta-l bold'), Ln(55, 50, 65, 50, 'ta-l bold')], // 國王：十字冠
];

// ── 22 張大牌的圖騰（中心區域約 x 22–98、y 52–146）
const MAJOR_EMBLEM = [
  () => [sun(84, 66, 8), P('M22 146 Q36 116 60 118 L76 132 L98 132', 'ta-l bold'), flower(46, 96, 11), P('M64 92 Q72 84 82 88', 'ta-l')], // 0 愚者：太陽、懸崖、白玫瑰
  () => [lemniscate(60, 64, 30), Ln(44, 134, 76, 82, 'ta-l bold'), C(44, 134, 2.6, 'ta-f'), C(76, 82, 2.6, 'ta-f'), glyph('聖杯', 32, 140, 0.42), glyph('寶劍', 50, 140, 0.42), glyph('權杖', 70, 140, 0.42), glyph('錢幣', 88, 140, 0.42)], // 1 魔術師
  () => [R(28, 70, 11, 74, 'ta-f', 1.5), R(81, 70, 11, 74, 'ta-l', 1.5), P('M39 76 Q60 92 81 76', 'ta-l'), R(50, 92, 20, 28, 'ta-l', 3), Ln(54, 100, 66, 100, 'ta-l thin'), Ln(54, 106, 66, 106, 'ta-l thin'), Ln(54, 112, 64, 112, 'ta-l thin'), crescent(60, 136, 7), C(60, 60, 5, 'ta-f'), crescent(50, 60, 4.5, -0.5), crescent(70, 60, 4.5, 0.5)], // 2 女祭司
  () => [C(60, 92, 15, 'ta-l bold'), Ln(60, 107, 60, 132, 'ta-l bold'), Ln(50, 120, 70, 120, 'ta-l bold'), ...[34, 42, 51, 60, 69, 78, 86].map((x, i) => Star(x, 66 - Math.sin((i / 6) * Math.PI) * 8, 3.4, 1.4, 5)), Ln(28, 146, 36, 128, 'ta-l'), Ln(92, 146, 84, 128, 'ta-l')], // 3 皇后：金星符號、星冠
  () => [R(38, 96, 44, 42, 'ta-l', 2), R(44, 102, 32, 30, 'ta-l thin', 1), C(38, 96, 5, 'ta-l'), C(82, 96, 5, 'ta-l'), C(60, 66, 7, 'ta-l bold'), Ln(60, 73, 60, 122, 'ta-l bold'), Ln(51, 82, 69, 82, 'ta-l bold')], // 4 皇帝：王座、公羊角、權杖
  () => [Ln(60, 56, 60, 116, 'ta-l bold'), Ln(53, 70, 67, 70, 'ta-l bold'), Ln(49, 80, 71, 80, 'ta-l bold'), Ln(45, 90, 75, 90, 'ta-l bold'), key(50, 130, -38), key(70, 130, 38)], // 5 教皇：三重十字、交叉鑰匙
  () => [sun(60, 64, 9), P('M26 92 Q42 72 60 88 Q78 72 94 92', 'ta-l bold'), C(46, 114, 13, 'ta-l'), C(74, 114, 13, 'ta-l'), P('M60 104 Q64 114 60 124 Q56 114 60 104Z', 'ta-f')], // 6 戀人：太陽、羽翼、兩個交疊的圓
  () => [...[38, 49, 60, 71, 82].map((x) => Star(x, 60, 3.6, 1.5, 5)), R(40, 84, 40, 30, 'ta-l', 2), P('M48 98 Q60 88 72 98', 'ta-l'), C(60, 98, 3, 'ta-f'), C(46, 126, 9, 'ta-l'), C(74, 126, 9, 'ta-l'), Ln(46, 117, 46, 135, 'ta-l thin'), Ln(37, 126, 55, 126, 'ta-l thin'), Ln(74, 117, 74, 135, 'ta-l thin'), Ln(65, 126, 83, 126, 'ta-l thin'), C(30, 142, 4, 'ta-f'), C(90, 142, 4, 'ta-l')], // 7 戰車：星篷、車身、雙輪、黑白獅身像
  () => [lemniscate(60, 62, 26), Star(60, 106, 27, 19, 18, 'ta-l'), C(60, 106, 15, 'ta-f'), C(54, 103, 1.8, 'ta-cut'), C(66, 103, 1.8, 'ta-cut'), P('M55 112 Q60 116 65 112', 'ta-cut-l')], // 8 力量：無限符號、獅子
  () => [Ln(84, 58, 80, 146, 'ta-l bold'), P('M60 70 L72 78 L72 108 L60 116 L48 108 L48 78 Z', 'ta-l'), Star(60, 93, 9, 4.5, 6), P('M54 70 Q60 60 66 70', 'ta-l'), P('M22 146 L40 126 L50 136 L62 120 L74 146', 'ta-l thin')], // 9 隱者：提燈、六芒星、手杖
  () => [C(60, 98, 31, 'ta-l bold'), C(60, 98, 22, 'ta-l'), C(60, 98, 6, 'ta-f'), ...Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return Ln(f(60 + 6 * Math.cos(a)), f(98 + 6 * Math.sin(a)), f(60 + 22 * Math.cos(a)), f(98 + 22 * Math.sin(a)), 'ta-l'); }), ...Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4 + Math.PI / 8; return C(f(60 + 26.5 * Math.cos(a)), f(98 + 26.5 * Math.sin(a)), 1.8, 'ta-f'); }), Star(26, 60, 4, 1.6, 4), Star(94, 60, 4, 1.6, 4), Star(26, 138, 4, 1.6, 4), Star(94, 138, 4, 1.6, 4)], // 10 命運之輪
  () => [s('polygon', { points: '60,56 63,62 63,124 57,124 57,62', class: 'ta-f' }), R(48, 120, 24, 3.2, 'ta-f', 1), C(60, 132, 3, 'ta-f'), Ln(32, 84, 88, 84, 'ta-l bold'), Ln(36, 84, 30, 104, 'ta-l thin'), Ln(36, 84, 42, 104, 'ta-l thin'), Ln(84, 84, 78, 104, 'ta-l thin'), Ln(84, 84, 90, 104, 'ta-l thin'), P('M28 104 Q36 112 44 104Z', 'ta-f'), P('M76 104 Q84 112 92 104Z', 'ta-f')], // 11 正義：寶劍、天秤
  () => [Ln(30, 60, 90, 60, 'ta-l bold'), Ln(60, 60, 60, 76, 'ta-l'), Ln(60, 76, 60, 112, 'ta-l bold'), P('M60 88 L72 80 L72 94', 'ta-l'), Ln(52, 100, 68, 100, 'ta-l'), C(60, 124, 9, 'ta-f'), rays(60, 124, 11, 17, 12, 'ta-l thin')], // 12 吊人：T 形木、倒吊、光環
  () => [Ln(34, 56, 34, 146, 'ta-l bold'), P('M34 60 L90 60 L80 78 L90 96 L34 96 Z', 'ta-l'), flower(58, 78, 9), R(26, 118, 10, 28, 'ta-l'), R(84, 118, 10, 28, 'ta-l'), P('M44 146 A16 16 0 0 1 76 146', 'ta-f'), rays(60, 146, 18, 24, 10, 'ta-l thin')], // 13 死神：白玫瑰旗、雙塔間的日出
  () => [R(50, 56, 20, 20, 'ta-l'), P('M60 59 L68 73 L52 73 Z', 'ta-f'), glyph('聖杯', 40, 96, 0.9, -24), glyph('聖杯', 80, 128, 0.9, 16), P('M47 88 Q58 100 62 110 Q66 120 74 118', 'ta-l bold'), C(30, 134, 3, 'ta-f')], // 14 節制：三角入方、兩杯傾注
  () => [Star(60, 84, 21, 8.5, 5, 'ta-l bold', 90), C(60, 84, 24, 'ta-l thin'), s('ellipse', { cx: 50, cy: 124, rx: 7, ry: 4.5, class: 'ta-l bold' }), s('ellipse', { cx: 62, cy: 124, rx: 7, ry: 4.5, class: 'ta-l bold' }), s('ellipse', { cx: 74, cy: 124, rx: 7, ry: 4.5, class: 'ta-l bold' }), R(36, 134, 48, 10, 'ta-f', 2)], // 15 惡魔：逆五芒星、鎖鏈、台座
  () => [tower(48, 76, 24, 70), R(56, 96, 8, 10, 'ta-f', 4), R(56, 118, 8, 10, 'ta-f', 4), s('polygon', { points: '88,52 74,70 82,72 68,92 72,74 64,72', class: 'ta-f' }), P('M28 78 L31 70 L36 75 L41 68 L44 78 Z', 'ta-f'), C(32, 98, 2, 'ta-f'), C(88, 108, 2, 'ta-f'), C(36, 120, 1.6, 'ta-f'), C(86, 128, 1.6, 'ta-f')], // 16 高塔：塔、閃電、墜落的王冠
  () => [Star(60, 74, 19, 7, 8), ...[[32, 62], [88, 62], [26, 88], [94, 88], [36, 108], [84, 108], [60, 104]].map(([x, y]) => Star(x, y, 5, 2, 8)), P('M30 132 Q40 126 50 132 T70 132 T90 132', 'ta-l'), P('M30 140 Q40 134 50 140 T70 140 T90 140', 'ta-l')], // 17 星星：大星、七小星、水波
  () => [rays(60, 78, 19, 26, 16, 'ta-l thin'), crescent(60, 78, 16, 0.4), R(24, 108, 10, 38, 'ta-l'), R(86, 108, 10, 38, 'ta-l'), P('M60 146 Q50 134 62 126 Q72 118 60 110', 'ta-l bold'), ...[[48, 102], [60, 98], [72, 102]].map(([x, y]) => P(`M${x} ${y - 4} Q${x + 3} ${y} ${x} ${y + 2} Q${x - 3} ${y} ${x} ${y - 4}Z`, 'ta-f'))], // 18 月亮：月、雙塔、小徑、露珠
  () => [C(60, 84, 18, 'ta-f'), ...Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8; const [c, sn] = [Math.cos(a), Math.sin(a)]; return i % 2 ? Ln(f(60 + 21 * c), f(84 + 21 * sn), f(60 + 31 * c), f(84 + 31 * sn), 'ta-l') : P(`M${f(60 + 21 * c)} ${f(84 + 21 * sn)} Q${f(60 + 26 * c - 3 * sn)} ${f(84 + 26 * sn + 3 * c)} ${f(60 + 31 * c)} ${f(84 + 31 * sn)}`, 'ta-l'); }), Ln(24, 126, 96, 126, 'ta-l'), flower(36, 138, 7), flower(60, 140, 7), flower(84, 138, 7)], // 19 太陽：日輪、直紋與波紋光、向日葵
  () => [P('M34 60 L78 84 L80 78 L36 54 Z', 'ta-f'), s('ellipse', { cx: 80, cy: 81, rx: 3.5, ry: 6.5, transform: 'rotate(28 80 81)', class: 'ta-f' }), R(52, 70, 14, 12, 'ta-l', 1), Ln(59, 70, 59, 82, 'ta-l thin'), Ln(52, 76, 66, 76, 'ta-l thin'), rays(84, 82, 8, 16, 9, 'ta-l thin'), C(40, 116, 5, 'ta-f'), C(60, 112, 5, 'ta-f'), C(80, 116, 5, 'ta-f'), P('M32 108 L40 122 L48 108', 'ta-l'), P('M52 104 L60 118 L68 104', 'ta-l'), P('M72 108 L80 122 L88 108', 'ta-l'), R(28, 130, 64, 10, 'ta-l', 2)], // 20 審判：號角、十字旗、甦醒的人
  () => [s('ellipse', { cx: 60, cy: 98, rx: 24, ry: 35, class: 'ta-l bold' }), ...Array.from({ length: 14 }, (_, i) => { const a = (i * 2 * Math.PI) / 14; return s('ellipse', { cx: f(60 + 24 * Math.cos(a)), cy: f(98 + 35 * Math.sin(a)), rx: 3.4, ry: 1.6, transform: `rotate(${f((a * 180) / Math.PI + 90)} ${f(60 + 24 * Math.cos(a))} ${f(98 + 35 * Math.sin(a))})`, class: 'ta-f' }); }), lemniscate(60, 63, 12), lemniscate(60, 133, 12), Star(60, 98, 9, 3.5, 4), Star(28, 60, 5, 2, 8), Star(92, 60, 5, 2, 8), Star(28, 138, 5, 2, 8), Star(92, 138, 5, 2, 8)], // 21 世界：月桂花環、雙無限結、四角
];

// 四角的星飾與弧線
function corners() {
  return G({ class: 'ta-corner' }, ...[[11, 11, 0], [109, 11, 90], [109, 189, 180], [11, 189, 270]].map(([x, y, r]) => G(at(x, y, 1, r), P('M0 9 Q0 0 9 0', 'ta-l thin'), Star(4.2, 4.2, 3, 1.1, 4))));
}

/**
 * 牌面 SVG。
 * @param {{major:boolean, index?:number, suit?:string, rank?:number, element:string, mark:string, name:string, image?:string}} card
 */
export function cardFace(card) {
  ensureTarotDefs();
  const el = EL[card.element] || 'air';
  const kids = [];
  if (card.image) {
    // 自訂牌圖：整張用使用者的圖（他的牌通常自帶框與牌名），只加一圈金邊
    kids.push(s('image', { href: card.image, x: 0, y: 0, width: 120, height: 200, preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#ta-clip)' }), R(1.5, 1.5, 117, 197, 'ta-frame', 8));
    return s('svg', { viewBox: '0 0 120 200', class: 'ta-face custom', 'aria-hidden': 'true' }, ...kids);
  }
  kids.push(R(0, 0, 120, 200, '', 9), C(60, 98, 50, ''));
  kids[0].setAttribute('fill', `url(#ta-bg-${el})`);
  kids[1].setAttribute('fill', `url(#ta-glow-${el})`);
  kids[1].setAttribute('class', 'ta-glow');
  if (card.major || card.rank === 0) kids.push(rays(60, 98, 16, 54, 32));
  kids.push(R(3, 3, 114, 194, 'ta-frame', 7), R(7.5, 7.5, 105, 185, 'ta-frame thin', 4.5), corners());
  // 上方編號牌、下方名牌
  kids.push(P('M38 13 H82 L86 20 L82 27 H38 L34 20 Z', 'ta-plate'), s('text', { x: 60, y: 24, 'text-anchor': 'middle', class: 'ta-mark', text: card.mark }));
  kids.push(P('M18 170 H102 L107 179 L102 188 H18 L13 179 Z', 'ta-plate'), s('text', { x: 60, y: 184, 'text-anchor': 'middle', class: `ta-name${[...card.name].length > 4 ? ' long' : ''}`, text: card.name }));
  const art = G({ class: 'ta-art' });
  if (card.major) art.append(...MAJOR_EMBLEM[card.index]());
  else if (card.rank === 0) art.append(glyph(card.suit, 60, 98, 2.1), Star(36, 66, 3.5, 1.4, 4), Star(86, 132, 3.5, 1.4, 4));
  else if (card.rank <= 9) art.append(...PIPS[card.rank + 1].map(([x, y]) => glyph(card.suit, x, y, card.rank <= 3 ? 0.72 : 0.56)));
  else art.append(...COURT_CROWN[card.rank - 10](), glyph(card.suit, 60, 116, 1.45));
  kids.push(art);
  return s('svg', { viewBox: '0 0 120 200', class: `ta-face el-${el}`, 'aria-hidden': 'true' }, ...kids);
}

/** 牌背：深藍底、金框、中央曼陀羅（八芒星＋同心圓＋十二點），上下弦月 */
export function cardBack() {
  ensureTarotDefs();
  const bg = R(0, 0, 120, 200, '', 9);
  bg.setAttribute('fill', 'url(#ta-back)');
  return s('svg', { viewBox: '0 0 120 200', class: 'ta-back', 'aria-hidden': 'true' },
    bg,
    R(3, 3, 114, 194, 'ta-frame', 7), R(8, 8, 104, 184, 'ta-frame thin', 4.5), corners(),
    G({ class: 'ta-mandala' },
      C(60, 100, 34, 'ta-l thin'), C(60, 100, 26, 'ta-l'), rays(60, 100, 26, 34, 24, 'ta-l thin'),
      Star(60, 100, 22, 9, 8, 'ta-f soft'), Star(60, 100, 14, 5.5, 8), C(60, 100, 4, 'ta-cut'),
      ...Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return C(f(60 + 40 * Math.cos(a)), f(100 + 40 * Math.sin(a)), 1.6, 'ta-f'); })),
    crescent(60, 36, 7, 0.45), crescent(60, 164, 7, -0.45),
  );
}

/**
 * 一張可以翻的牌（結果列表用）：背面朝上，翻過來是牌面，翻開時灑星屑；逆位整張牌面倒過來。
 * @param face cardFace() 的參數
 */
export function tarotCard(face, { reversed = false } = {}) {
  return h('div', { class: 'tc', 'aria-hidden': 'true' },
    h('div', { class: 'tc-inner' },
      h('div', { class: 'tc-back' }, cardBack()),
      h('div', { class: `tc-front${reversed ? ' rev' : ''}` }, cardFace(face), h('span', { class: 'tc-sheen' }))),
    h('div', { class: 'tc-dust' }, Array.from({ length: 8 }, (_, i) => h('i', { style: { '--a': `${i * 45 + 20}deg` } }))));
}

/**
 * 放大看一張牌：大張牌面，手指拖曳時 3D 傾斜、反光帶跟著移動，放開彈回；下面是這張牌的解讀。
 * 關閉：按「關閉」、點旁邊空白處或按 Esc；焦點回到原本按的那張牌。
 * @param {{face:object, reversed:boolean, title:string, body:Array}} opts
 */
export function openCardView({ face, reversed, title, body }) {
  const opener = document.activeElement;
  const card = h('div', { class: `tz-card${reversed ? ' rev' : ''}` }, cardFace(face), h('span', { class: 'tz-sheen' }));
  const stage = h('div', { class: 'tz-stage', 'aria-hidden': 'true' }, card);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
    panel.remove();
    if (opener && opener.focus) opener.focus();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const closeBtn = h('button', { type: 'button', class: 'btn small', text: '關閉', onclick: close });
  const panel = h('div', { class: 'tz', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, onclick: (e) => { if (e.target === panel) close(); } },
    h('div', { class: 'tz-panel' }, stage, h('div', { class: 'tz-text' }, h('h2', { text: title }), body, h('div', { class: 'actions' }, closeBtn))));
  const tilt = (e) => {
    if (reducedMotion()) return;
    const r = card.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    card.classList.add('tilting');
    card.style.setProperty('--ry', `${(x * 16).toFixed(1)}deg`);
    card.style.setProperty('--rx', `${(-y * 13).toFixed(1)}deg`);
    card.style.setProperty('--sx', `${(x * 55).toFixed(0)}%`);
  };
  const reset = () => {
    card.classList.remove('tilting');
    for (const k of ['--ry', '--rx', '--sx']) card.style.removeProperty(k);
  };
  stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture?.(e.pointerId); tilt(e); });
  stage.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') tilt(e); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) stage.addEventListener(ev, reset);
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  document.body.append(panel);
  // preventScroll：關閉鈕在最下面，直接 focus 會把面板捲到底、牌面的上半部看不到
  closeBtn.focus({ preventScroll: true });
  return close;
}
