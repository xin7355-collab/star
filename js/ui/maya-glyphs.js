// 瑪雅曆的圖示：20 個圖騰、調性（瑪雅數字：一條橫線＝5、一個點＝1）、260 格卓爾金曆。全部用 SVG 自己畫。
// 圖騰是依每個圖騰的意思畫的原創圖案（例如紅龍＝巢裡的蛋、白狗＝心裡的腳印），沒有臨摹 13 月亮曆官方圖騰或網路上的手繪圖。
// 動畫：線條依序描出來（stroke-dashoffset，pathLength＝1），實心的部分接著浮現，調性的點與線最後一個一個跳出來；
// 減少動態效果時直接顯示完成的圖（CSS 處理）。

import { s } from './dom.js';
import { SEALS, toneBarsDots } from '../core/maya-kin.js';

const f1 = (n) => Number(n.toFixed(1));
/** 圓、橢圓換成 path（pathLength 在圓形元素上各瀏覽器支援不一，path 最穩） */
const ell = (cx, cy, rx, ry = rx) => `M${f1(cx - rx)} ${cy} a${rx} ${ry} 0 1 0 ${f1(2 * rx)} 0 a${rx} ${ry} 0 1 0 ${f1(-2 * rx)} 0`;
const star4 = (cx, cy, r) => {
  const k = r * 0.3;
  return `M${cx} ${f1(cy - r)} L${f1(cx + k)} ${f1(cy - k)} L${f1(cx + r)} ${cy} L${f1(cx + k)} ${f1(cy + k)} L${cx} ${f1(cy + r)} L${f1(cx - k)} ${f1(cy + k)} L${f1(cx - r)} ${cy} L${f1(cx - k)} ${f1(cy - k)} Z`;
};
/** 阿基米德螺線（藍猴） */
const spiral = (cx, cy, turns, step) => {
  const pts = [];
  for (let a = 0; a <= turns * Math.PI * 2; a += 0.25) pts.push(`${f1(cx + Math.cos(a) * (2 + step * a))} ${f1(cy + Math.sin(a) * (2 + step * a))}`);
  return `M${pts.join(' L')}`;
};
/** 太陽的光芒 */
const rays = (cx, cy, r1, r2, n) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return `M${f1(cx + Math.cos(a) * r1)} ${f1(cy + Math.sin(a) * r1)} L${f1(cx + Math.cos(a) * r2)} ${f1(cy + Math.sin(a) * r2)}`;
}).join(' ');

// 每個圖騰：['l', 線條] 或 ['f', 實心]，座標在 100×100 裡
const GLYPHS = {
  1: [['l', 'M18 56 Q50 96 82 56'], ['l', 'M27 67 Q50 84 73 67'], ['l', ell(50, 43, 13, 17)], ['l', 'M50 19 V11 M35 24 L30 17 M65 24 L70 17'], ['f', ell(50, 46, 4)]],
  2: [['l', 'M14 34 H52 C62 34 66 26 62 21 C58 16 50 19 51 26'], ['l', 'M14 50 H70 C80 50 84 60 78 65 C73 69 66 66 67 60'], ['l', 'M14 66 H46 C55 66 58 74 54 78 C50 82 44 79 45 74']],
  3: [['l', 'M60 20 A30 30 0 1 0 60 80 A40 40 0 0 1 60 20 Z'], ['f', star4(74, 32, 8)], ['f', star4(80, 56, 5)], ['f', star4(70, 74, 6)]],
  4: [['l', 'M18 82 H82'], ['l', 'M50 63 V36'], ['l', 'M50 47 C40 45 32 37 33 27 C43 28 50 36 50 47'], ['l', 'M50 40 C59 37 67 30 67 20 C57 21 50 29 50 40'], ['f', ell(50, 71, 12, 8)]],
  5: [['l', 'M22 82 C20 62 76 66 78 48 C80 32 58 22 46 30'], ['l', 'M32 30 L23 25 M32 30 L23 35'], ['f', ell(40, 30, 8, 6)], ['f', `${ell(34, 68, 2.6)} ${ell(52, 61, 2.6)} ${ell(67, 53, 2.6)}`]],
  6: [['l', 'M14 82 H86'], ['l', 'M26 82 V44 M74 82 V44'], ['l', 'M26 44 Q50 12 74 44'], ['l', 'M42 82 V66 Q50 55 58 66 V82']],
  7: [['l', 'M40 52 V24 M50 50 V17 M60 52 V21 M70 56 V32'], ['l', 'M30 64 L21 50'], ['l', 'M30 62 C30 78 38 86 50 86 C64 86 72 76 72 58'], ['f', ell(51, 68, 5)]],
  8: [['l', 'M50 11 L58 42 L89 50 L58 58 L50 89 L42 58 L11 50 L42 42 Z'], ['l', 'M29 29 L37 37 M71 29 L63 37 M29 71 L37 63 M71 71 L63 63'], ['f', ell(50, 50, 5)]],
  9: [['l', 'M46 14 A30 30 0 1 0 46 74 A40 40 0 0 1 46 14 Z'], ['f', 'M68 40 C68 40 58 54 58 60 A10 10 0 0 0 78 60 C78 54 68 40 68 40 Z'], ['l', 'M18 88 Q28 82 38 88 T58 88 T78 88']],
  10: [['l', 'M50 84 C22 64 14 46 24 32 C33 21 46 25 50 36 C54 25 67 21 76 32 C86 46 78 64 50 84 Z'], ['f', `${ell(50, 60, 8, 6)} ${ell(40, 47, 3.5)} ${ell(46.5, 42, 3.5)} ${ell(53.5, 42, 3.5)} ${ell(60, 47, 3.5)}`]],
  11: [['l', spiral(50, 52, 2.6, 2.1)], ['f', star4(22, 22, 7)], ['f', star4(80, 20, 5)], ['f', star4(82, 80, 6)]],
  12: [['l', ell(50, 42, 13)], ['l', 'M24 86 C24 66 36 60 50 60 C64 60 76 66 76 86'], ['l', 'M50 13 V21 M38 17 L42 24 M62 17 L58 24']],
  13: [['l', 'M38 88 L45 32 M62 88 L55 32'], ['l', 'M40 76 H60 M41.5 64 H58.5 M43 52 H57 M44 41 H56'], ['l', 'M16 30 Q50 6 84 30']],
  14: [['l', 'M50 11 L80 50 L50 89 L20 50 Z'], ['l', 'M33 50 Q50 34 67 50 Q50 66 33 50 Z'], ['f', ell(50, 50, 6)]],
  15: [['l', 'M12 40 C28 44 40 54 50 66 C60 54 72 44 88 40'], ['l', 'M18 56 C32 60 42 66 50 76 C58 66 68 60 82 56'], ['l', ell(50, 31, 9)], ['f', `M45 40 L55 40 L50 49 Z ${ell(53, 29, 2.4)}`]],
  16: [['l', 'M50 11 L80 21 V46 C80 66 68 80 50 89 C32 80 20 66 20 46 V21 Z'], ['f', 'M50 27 L61 46 H54.5 V70 H45.5 V46 H39 Z']],
  17: [['l', ell(50, 50, 34)], ['l', 'M16 50 H84'], ['l', 'M50 16 C34 32 34 68 50 84 C66 68 66 32 50 16'], ['f', ell(64, 37, 5)]],
  18: [['l', 'M50 10 L86 50 L50 90 L14 50 Z'], ['l', 'M50 26 L71 50 L50 74 L29 50 Z'], ['f', 'M50 40 L59 50 L50 60 L41 50 Z']],
  19: [['l', 'M28 56 C16 56 14 40 27 38 C29 25 46 20 53 31 C59 23 75 27 73 40 C86 40 86 56 72 56 Z'], ['f', 'M52 52 L41 72 H51 L45 90 L66 62 H55 L61 52 Z']],
  20: [['l', ell(50, 50, 20)], ['l', rays(50, 50, 27, 38, 8)], ['f', `${ell(43, 46, 3)} ${ell(57, 46, 3)}`], ['l', 'M42 56 Q50 63 58 56']],
};

/** 調性的瑪雅數字（點在上、橫線在下），畫在 x 0～100、y 0～22 的範圍 */
function numeral(tone, { animate }) {
  const { bars, dots } = toneBarsDots(tone);
  const g = s('g', { class: 'mg-num' });
  let y = 21;
  let j = 0;
  for (let b = 0; b < bars; b += 1) {
    g.append(s('rect', { x: 27, y: f1(y - 5.5), width: 46, height: 5.5, rx: 2.5, style: animate ? { '--j': String(j) } : null }));
    j += 1;
    y -= 8.5;
  }
  for (let d = 0; d < dots; d += 1) {
    g.append(s('path', { d: ell(f1(50 + (d - (dots - 1) / 2) * 10), f1(y - 3.4), 3.4), style: animate ? { '--j': String(j) } : null }));
    j += 1;
  }
  return g;
}

/**
 * 圖騰圖示（方塊＋圖案，有調性的話上面加瑪雅數字）
 * @param {number} n 圖騰 1～20
 * @param {{tone?:number|null, animate?:boolean, label?:string}} [opts] label 有給才會被螢幕閱讀器念（純裝飾不給）
 */
export function mayaGlyph(n, { tone = null, animate = false, label = '' } = {}) {
  const seal = SEALS[n - 1];
  const top = tone ? 26 : 0;
  const body = s('g', { transform: tone ? `translate(0 ${top})` : null });
  body.append(s('rect', { x: 2, y: 2, width: 96, height: 96, rx: 14, class: `mg-bg ${seal.color}` }));
  GLYPHS[n].forEach(([kind, d], i) => {
    body.append(s('path', { d, pathLength: kind === 'l' ? 1 : null, class: kind === 'l' ? 'mg-line' : 'mg-fill', style: animate ? { '--i': String(i) } : null }));
  });
  const svg = s('svg', {
    viewBox: `0 0 100 ${100 + top}`,
    class: `mg-tile${animate ? ' mg-anim' : ''}`,
    ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }),
  });
  if (tone) svg.append(numeral(tone, { animate }));
  svg.append(body);
  return svg;
}

/** 只有調性數字（13 調性的列表用） */
export function toneGlyph(tone) {
  return s('svg', { viewBox: '0 0 100 24', class: 'mg-tone', 'aria-hidden': 'true' }, numeral(tone, { animate: false }));
}

/**
 * 260 格卓爾金曆：13 欄 × 20 列，第 1 欄是 KIN 1～20（由上往下），顏色是圖騰的顏色。
 * 你的 KIN 金框（會發亮）、今天虛線框，你出生的波符（13 天）顏色比較深。
 */
export function tzolkinGrid({ kin, today, label }) {
  const CELL = 10;
  const GAP = 1.6;
  const step = CELL + GAP;
  const ws = new Set();
  const start = kin - ((kin - 1) % 13);
  for (let i = 0; i < 13; i += 1) ws.add(((start - 1 + i) % 260) + 1);
  const cells = s('g', {});
  const marks = s('g', {});
  for (let k = 1; k <= 260; k += 1) {
    const c = Math.floor((k - 1) / 20);
    const r = (k - 1) % 20;
    const x = f1(c * step);
    const y = f1(r * step);
    const color = SEALS[r].color;
    cells.append(s('rect', { x, y, width: CELL, height: CELL, rx: 2, class: `tz-cell ${color}${ws.has(k) ? ' ws' : ''}`, style: { '--c': String(c) } }));
    if (k === kin) marks.append(s('rect', { x: f1(x - 1.6), y: f1(y - 1.6), width: CELL + 3.2, height: CELL + 3.2, rx: 3, class: 'tz-me' }));
    if (k === today && today !== kin) marks.append(s('rect', { x: f1(x - 1.2), y: f1(y - 1.2), width: CELL + 2.4, height: CELL + 2.4, rx: 3, class: 'tz-today' }));
  }
  return s('svg', { viewBox: `-2 -2 ${f1(13 * step + 2.4)} ${f1(20 * step + 2.4)}`, class: 'tzolkin', role: 'img', 'aria-label': label }, cells, marks);
}
