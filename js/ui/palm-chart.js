// 掌紋圖：手掌輪廓＋線（看圖自選的縮圖、結果圖共用）。畫的是右手掌心朝向自己的樣子（拇指在右），左手整張鏡像。
// 線的位置用 core/palm.js 的掌心框（u, v）定義，所以使用者描的線可以用同一套換算畫進結果圖。
// 動畫只動 stroke-dashoffset（pathLength=1，線從頭畫到尾）與端點的 transform／opacity；減少動態效果時直接顯示畫好的圖。

import { s } from './dom.js';
import { TEMPLATES, HEAD_APART_START } from '../core/palm.js';

const f = (n) => n.toFixed(1);
const VB_W = 210;
// 掌心框的三個基準點在圖上的位置：小指根部、食指根部、手腕中間
const A = [64, 116];
const B = [136, 106];
const W = [100, 238];
const MID = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
const toXY = ([u, v]) => [A[0] + u * (B[0] - A[0]) + v * (W[0] - MID[0]), A[1] + u * (B[1] - A[1]) + v * (W[1] - MID[1])];

/** 平滑曲線：控制點換成圖上座標後，用 Catmull-Rom 轉三次貝茲 */
function smooth(uvPts) {
  const p = uvPts.map(toXY);
  if (p.length < 2) return '';
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i += 1) {
    const p0 = p[i - 1] || p[i];
    const [p1, p2] = [p[i], p[i + 1]];
    const p3 = p[i + 2] || p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

// 手指：[根部 x, y, 長, 寬, 角度]（角度以順時針為正）
const FINGERS = [[64, 119, 56, 19, -13], [88, 108, 74, 21, -4], [112, 104, 82, 22, 2], [136, 108, 72, 21, 10]];

/**
 * 手掌輪廓。palmK：手掌長寬比（方掌 < 1 < 長掌）；fingerK：手指長短。
 * 疊在一起的圖形用同一個填色，看起來就是一隻手；掌紋線畫在上層。
 */
function handShape({ palmK = 1, fingerK = 1 } = {}) {
  const g = s('g', { class: 'palm-hand' });
  const top = 110; // 手掌從指根往下伸長或縮短
  g.append(s('path', { d: 'M56 112 C49 152 50 196 61 236 C86 250 118 250 141 238 C151 214 154 192 153 170 C152 142 150 120 146 104 Z', transform: `translate(0 ${top}) scale(1 ${palmK}) translate(0 ${-top})` }));
  for (const [x, y, len, w, deg] of FINGERS) {
    const l = len * fingerK;
    g.append(s('rect', { x: x - w / 2, y: f(y - l), width: w, height: f(l + 14), rx: w / 2, transform: `rotate(${deg} ${x} ${y})` }));
  }
  const ty = f(top + (200 - top) * palmK);
  const tl = 70 * Math.min(1.1, fingerK);
  g.append(s('rect', { x: 132, y: f(Number(ty) - tl), width: 26, height: f(tl + 10), rx: 13, transform: `rotate(40 145 ${ty})` }));
  return g;
}

/** 折線在 u 這個位置的 v（線性內插）；沒經過回傳 null */
function vAt(pts, u) {
  for (let i = 1; i < pts.length; i += 1) {
    const [a, b] = [pts[i - 1], pts[i]];
    if ((u - a[0]) * (u - b[0]) <= 0 && a[0] !== b[0]) return a[1] + ((u - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return null;
}
/**
 * 半斷掌的連接線：接在感情線、智慧線左右範圍重疊處的中間，兩端剛好落在兩條線上。
 * 用固定位置的話，智慧線往下彎或感情線比較短時，連接線會懸在半空中。
 */
function bridge(lines) {
  const heart = lines.find((l) => l.field === 'heart');
  const head = lines.find((l) => l.field === 'head');
  if (!heart || !head) return null;
  const range = (pts) => [Math.min(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[0]))];
  const [h0, h1] = range(heart.pts);
  const [d0, d1] = range(head.pts);
  const lo = Math.max(h0, d0);
  const hi = Math.min(h1, d1);
  if (hi - lo < 0.05) return null;
  const u = lo + (hi - lo) * 0.45;
  const [vh, vd] = [vAt(heart.pts, u), vAt(head.pts, u)];
  return vh === null || vd === null ? null : [[u, vh], [u - 0.006, (vh + vd) / 2], [u - 0.012, vd]];
}

/** 要畫的線：依選項取範本，使用者有描線的欄位改用他自己的線（traces 是 u, v 點列） */
function linesFor(picks = {}, traces = {}) {
  const out = [];
  const add = (field, strokes, traced = false) => strokes.forEach((pts) => out.push({ field, pts, traced }));
  const tpl = (field, option) => (TEMPLATES[field] && TEMPLATES[field][option]) || [];
  const use = (field) => {
    if (traces[field] && traces[field].length) add(field, traces[field], true);
    else if (picks[field]) add(field, tpl(field, picks[field]));
  };
  use('life');
  if (picks.simian === 'full') {
    // 真斷掌：一條橫線取代感情線與智慧線
    if (traces.simian && traces.simian.length) add('simian', traces.simian, true);
    else add('simian', tpl('simian', 'full'));
  } else {
    if (traces.head && traces.head.length) add('head', traces.head, true);
    else if (picks.head) add('head', tpl('head', picks.head).map((pts, i) => (i === 0 && picks.start === 'apart' ? [HEAD_APART_START, ...pts.slice(1)] : pts)));
    use('heart');
    // 半斷掌的連接線要接在兩條線上：感情線或智慧線還沒選時不畫，免得一段線懸在半空中
    const b = picks.simian === 'half' ? bridge(out) : null;
    if (b) add('simian', [b]);
  }
  use('fate');
  return out;
}

/** 結果圖實際畫了哪些線（圖例照這個列，沒畫出來的線不列） */
export function diagramFields(picks, traces = {}) {
  return [...new Set(linesFor(picks, traces).map((ln) => ln.field))];
}

/**
 * 結果圖：手掌＋選好（或描好）的線，依序畫出、端點亮起。
 * @param {{hand:'left'|'right', picks:object, traces?:object, label:string}} opts
 */
export function palmDiagram({ hand, picks, traces = {}, label }) {
  const body = s('g', hand === 'left' ? { transform: `translate(${VB_W} 0) scale(-1 1)` } : {});
  body.append(handShape());
  const lines = linesFor(picks, traces);
  lines.forEach((ln, i) => {
    const d = smooth(ln.pts);
    if (!d) return;
    body.append(s('path', { d, pathLength: 1, class: `palm-line pl-${ln.field}${ln.traced ? ' traced' : ''}`, style: { '--i': String(i) } }));
    const end = toXY(ln.pts[ln.pts.length - 1]);
    body.append(s('circle', { cx: f(end[0]), cy: f(end[1]), r: 3.2, class: `palm-end pl-${ln.field}`, style: { '--i': String(i) } }));
  });
  return s('svg', { viewBox: `0 0 ${VB_W} 260`, class: 'palm-diagram', role: 'img', 'aria-label': label }, body);
}

// 手掌厚薄從正面看不出來：畫側面，厚度不同
const THICK = { thick: 46, medium: 32, thin: 20 };

/** 看圖自選的縮圖：同一隻手，只把這一題的線形畫亮，其他主線淡淡當位置參考 */
export function palmThumb(field, option, hand) {
  if (field === 'thick') {
    const t = THICK[option];
    return s('svg', { viewBox: `0 0 ${VB_W} 260`, class: 'palm-thumb', 'aria-hidden': 'true' },
      s('g', { class: 'palm-hand' },
        s('rect', { x: 24, y: f(130 - t / 2), width: 128, height: t, rx: f(t / 2) }),
        s('rect', { x: 120, y: f(130 - t * 0.3), width: 72, height: f(t * 0.6), rx: f(t * 0.3) })),
      s('path', { d: `M40 ${f(130 - t / 2 - 12)} V${f(130 + t / 2 + 12)}`, class: 'palm-measure' }));
  }
  const body = s('g', hand === 'left' ? { transform: `translate(${VB_W} 0) scale(-1 1)` } : {});
  const shapeK = { 'square-short': [0.8, 0.76], 'square-long': [0.8, 1.12], 'long-long': [1.16, 1.12], 'long-short': [1.16, 0.76] };
  const [palmK, fingerK] = field === 'shape' ? shapeK[option] : [1, 1];
  // 長掌＋長手指會超出圖框：掌形的縮圖整隻手縮小一點
  body.append(field === 'shape' ? s('g', { transform: 'translate(105 132) scale(0.86) translate(-105 -132)' }, handShape({ palmK, fingerK })) : handShape({ palmK, fingerK }));
  if (field !== 'shape') {
    // 參考線：一般手的四條線，淡淡的；這一題相關的線不畫參考，避免和選項疊在一起
    const ref = { life: 'long-wide', head: 'straight', heart: 'mid', fate: 'wrist' };
    const skip = { start: ['head', 'life'], simian: ['head', 'heart'] }[field] || [field];
    for (const [rf, ro] of Object.entries(ref)) {
      if (!skip.includes(rf)) for (const pts of TEMPLATES[rf][ro]) body.append(s('path', { d: smooth(pts), class: 'palm-ref' }));
    }
    const picks = field === 'start' ? { life: 'long-wide', head: 'straight', start: option }
      : field === 'simian' ? (option === 'full' ? { simian: 'full' } : { simian: option, head: 'straight', heart: 'mid' })
        : { [field]: option };
    for (const ln of linesFor(picks)) body.append(s('path', { d: smooth(ln.pts), class: `palm-line still pl-${ln.field}` }));
    if (field === 'fate' && option === 'none') body.append(s('path', { d: smooth([[0.55, 0.98], [0.57, 0.6], [0.6, 0.22]]), class: 'palm-ghost' }));
  }
  return s('svg', { viewBox: `0 0 ${VB_W} 260`, class: 'palm-thumb', 'aria-hidden': 'true' }, body);
}
