// 掌紋「拍照描線」的照片處理與畫布（從 views/tool-palm.js 拆出來）：讀照片、加強掌紋、校正框換算、
// 復原用的比對，以及描線畫布（校正點按住微調、放大鏡）。不碰名單與畫面狀態，狀態一律由呼叫端傳進來。
// 照片只畫在畫面上的 canvas（先縮到 1280px 以內，原圖馬上釋放），不存、不上傳。

import { h } from './dom.js';
import { PALM_CANVAS } from './palette.js';
import { palmFrame, simplifyStroke, enhanceLines, TRACE_LINES } from '../core/palm.js';

const MAX_SIDE = 1280; // iPhone 原圖解開約 48MB：縮到這個大小以內，記憶體才不會被吃光
const MAX_FILE = 40 * 1024 * 1024;
export const CALIB = [
  { key: 'index', text: '食指根部的中間', short: '食指根部' },
  { key: 'pinky', text: '小指根部的中間', short: '小指根部' },
  { key: 'wrist', text: '手腕橫紋的中間', short: '手腕' },
];
const LOUPE = 112; // 放大鏡直徑（CSS 像素）
const ZOOM = 2.5;
const MAX_SLIDE = 80; // 校正點按住滑動微調的最大距離；滑超過這麼多當成不是要放點（例如想捲動頁面）

/** 放掉一張照片占的記憶體（縮小後的畫布、加強版） */
export function freePhoto(ph) {
  ph.canvas.width = 0;
  if (ph.enh) ph.enh.width = 0;
  ph.enh = null;
}

/** applied：這張照片自動填進選項的值（判斷哪些是自己改過的）；sideOk：使用者確認過左右手；auto：哪幾條線是自動描的（畫成虛線） */
export const newPhoto = (img, extra = {}) => ({ ...img, calib: {}, strokes: {}, auto: {}, applied: {}, advice: null, sideOk: false, enh: null, demo: false, ...extra });

const TRACE_PALM_PX = 320; // 自動描線時把照片縮到掌寬約 320px：和測試的尺度一樣，iPhone 上記憶體也省（原圖 1280px 要多吃三十幾 MB）

/**
 * 自動描線的輸入：縮小的灰階影像和對應的掌心框。描線結果是掌心座標（u, v），和照片大小無關，
 * 用原本的掌心框換回照片像素就好。
 * @returns {{gray:Uint8Array, w:number, h:number, frame:object}|null}
 */
export function traceInput(ph) {
  const fr = frameOf(ph);
  if (!fr) return null;
  const k = Math.min(1, TRACE_PALM_PX / fr.width);
  const w = Math.max(1, Math.round(ph.w * k));
  const hh = Math.max(1, Math.round(ph.h * k));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = hh;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(ph.canvas, 0, 0, w, hh);
  const d = c.getImageData(0, 0, w, hh).data;
  cv.width = 0;
  const gray = new Uint8Array(w * hh);
  for (let i = 0, j = 0; i < gray.length; i += 1, j += 4) gray[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
  const sc = (q) => [q[0] * k, q[1] * k];
  return { gray, w, h: hh, frame: palmFrame({ index: sc(ph.calib.index), pinky: sc(ph.calib.pinky), wrist: sc(ph.calib.wrist) }) };
}

/** 照片 → 縮小的 canvas（原圖用完就放掉） */
export async function readPhoto(file) {
  if (file.size > MAX_FILE) throw new Error('照片檔案太大（超過 40MB），讀不進來。請改用「拍照」直接拍一張。');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('這張照片打不開，可能是格式不支援或檔案損壞。請改用「拍照」直接拍一張，或換一張照片。'));
      im.src = url;
    });
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const ht = Math.max(1, Math.round(img.naturalHeight * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = ht;
    canvas.getContext('2d').drawImage(img, 0, 0, w, ht);
    img.removeAttribute('src');
    return { canvas, w, h: ht };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 「加強掌紋」的影像：第一次開才算，算好留著（換照片或清除時放掉） */
export function enhancedCanvas(ph) {
  const data = ph.canvas.getContext('2d').getImageData(0, 0, ph.w, ph.h);
  const out = document.createElement('canvas');
  out.width = ph.w;
  out.height = ph.h;
  out.getContext('2d').putImageData(new ImageData(enhanceLines(data.data, ph.w, ph.h), ph.w, ph.h), 0, 0);
  return out;
}

/** 掌心範圍的灰階取樣（看太暗、太亮、反光） */
export function sampleGray(ph, frame) {
  const pts = [[-0.1, 0], [1.1, 0], [-0.1, 1], [1.1, 1]].map((uv) => frame.toXY(uv));
  const x0 = Math.max(0, Math.min(...pts.map((q) => q[0])));
  const y0 = Math.max(0, Math.min(...pts.map((q) => q[1])));
  const x1 = Math.min(ph.w, Math.max(...pts.map((q) => q[0])));
  const y1 = Math.min(ph.h, Math.max(...pts.map((q) => q[1])));
  if (x1 - x0 < 4 || y1 - y0 < 4) return [];
  const tmp = document.createElement('canvas');
  tmp.width = 64;
  tmp.height = 64;
  const c = tmp.getContext('2d');
  c.drawImage(ph.canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, 64, 64);
  const d = c.getImageData(0, 0, 64, 64).data;
  const gray = [];
  for (let i = 0; i < d.length; i += 4) gray.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  tmp.width = 0;
  return gray;
}

export const frameOf = (ph) => (ph && ph.calib.index && ph.calib.pinky && ph.calib.wrist ? palmFrame(ph.calib) : null);

/** 照片上描的線（像素）換成掌心框座標，給判定與結果圖用 */
export function uvTraces(ph) {
  const frame = frameOf(ph);
  if (!frame) return {};
  const out = {};
  for (const [field, strokes] of Object.entries(ph.strokes)) {
    const list = strokes.map((st) => simplifyStroke(st.map((q) => frame.toUV(q)))).filter(Boolean);
    if (list.length) out[field] = list;
  }
  return out;
}

// ── 復原用：筆畫的淺拷貝（點陣列建立後不再修改，淺拷貝就夠）、比對前後哪些線變了
export const copyStrokes = (st) => Object.fromEntries(Object.entries(st).map(([k, list]) => [k, list.slice()]));
export const tracedLines = (ph) => TRACE_LINES.filter((l) => (ph.strokes[l] || []).length);
/** 復原前後哪些線變了：校正點變了＝描過的線都要重新換算 */
export function changedLines(ph, state) {
  const all = TRACE_LINES.filter((l) => (ph.strokes[l] || []).length || (state.strokes[l] || []).length);
  if (CALIB.some((cp) => ph.calib[cp.key] !== state.calib[cp.key])) return all;
  return all.filter((l) => {
    const a = ph.strokes[l] || [];
    const b = state.strokes[l] || [];
    return a.length !== b.length || a.some((st, i) => st !== b[i]);
  });
}

const lineColor = (field) => getComputedStyle(document.documentElement).getPropertyValue(`--pl-${field}`).trim() || PALM_CANVAS.fallbackLine;

/**
 * 照片畫布：先點三個校正點（按住可以滑動微調，放開才算），再沿著掌紋描線。
 * 只用 pointer 事件，手指、觸控筆、滑鼠都能用。手指按著時，角落的放大鏡顯示手指底下的紋路（手指會擋住正在描的線）。
 * 畫布不直接改資料：onCalib(點)、onStroke(線, 點列)、onTap(線, 點)（只點一下沒拖）交給外面，外面先記下復原用的狀態再修改。
 */
export function photoCanvas(ph, { getTarget, getSource, onCalib, onStroke, onTap }) {
  const cv = h('canvas', { class: 'palm-canvas', role: 'img', 'aria-label': '手掌照片：點校正點、用手指沿著掌紋描線' });
  const loupe = h('canvas', { class: 'palm-loupe', 'aria-hidden': 'true', hidden: true });
  const wrap = h('div', { class: 'palm-canvas-wrap' }, cv, loupe);
  let cur = null; // 正在描的線
  let pin = null; // 正在放的校正點
  let down = null;
  let pointers = 0;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const src = () => getSource() || ph.canvas;
  const nextCalib = () => CALIB.find((cp) => !ph.calib[cp.key]);

  function layout() {
    const maxW = wrap.clientWidth || 320;
    const maxH = Math.max(240, (globalThis.innerHeight || 700) * 0.6);
    const scale = Math.min(maxW / ph.w, maxH / ph.h);
    cv.style.width = `${Math.round(ph.w * scale)}px`;
    cv.style.height = `${Math.round(ph.h * scale)}px`;
    cv.width = Math.round(ph.w * scale * dpr);
    cv.height = Math.round(ph.h * scale * dpr);
    paint();
  }

  /** 照片＋描線＋校正點畫到 c。k＝畫布像素／照片像素、(ox, oy)＝位移；放大鏡用同一套，只是 k 比較大 */
  function render(c, k, ox, oy) {
    c.setTransform(k, 0, 0, k, ox, oy);
    c.drawImage(src(), 0, 0);
    const px = dpr / k; // 一個螢幕像素在照片座標裡有多大：放大鏡裡的線一樣細，才看得準
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const line = (pts, color, width) => {
      if (pts.length < 2) return;
      c.strokeStyle = color;
      c.lineWidth = width * px;
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (const q of pts.slice(1)) c.lineTo(q[0], q[1]);
      c.stroke();
    };
    // 自動描的線畫成虛線：提醒「這是建議，對照照片看看」；自己描的是實線
    for (const [field, strokes] of Object.entries(ph.strokes)) {
      const dash = ph.auto && ph.auto[field] ? [9 * px, 6 * px] : [];
      for (const st of strokes) {
        c.setLineDash(dash);
        line(st, PALM_CANVAS.shadow, 6);
        line(st, lineColor(field), 3.5);
      }
      c.setLineDash([]);
    }
    if (cur) {
      line(cur.pts, PALM_CANVAS.shadow, 6);
      line(cur.pts, lineColor(cur.field), 3.5);
    }
    // 校正點與掌心框
    const frame = frameOf(ph);
    if (frame) {
      c.setLineDash([6 * px, 5 * px]);
      line([frame.toXY([-0.1, 0]), frame.toXY([1.15, 0])], PALM_CANVAS.guide, 1.5);
      line([frame.toXY([0.5, 0]), frame.toXY([0.5, 1])], PALM_CANVAS.guide, 1.5);
      c.setLineDash([]);
    }
    const pending = nextCalib();
    CALIB.forEach((cp, i) => {
      const q = ph.calib[cp.key] || (pin && pending === cp ? pin : null);
      if (!q) return;
      c.fillStyle = PALM_CANVAS.marker;
      c.beginPath();
      c.arc(q[0], q[1], 11 * px, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = PALM_CANVAS.markerLine;
      c.lineWidth = 2 * px;
      c.stroke();
      c.fillStyle = PALM_CANVAS.markerLine;
      c.font = `700 ${13 * px}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i + 1), q[0], q[1] + 0.5 * px);
    });
  }

  function paint() {
    const c = cv.getContext('2d');
    if (!c || !cv.width) return;
    c.setTransform(1, 0, 0, 1, 0, 0);
    render(c, cv.width / ph.w, 0, 0);
  }

  function showLoupe(q, e) {
    const c = loupe.getContext('2d');
    if (!c || !cv.width) return;
    const size = Math.round(LOUPE * dpr);
    if (loupe.width !== size) {
      loupe.width = size;
      loupe.height = size;
    }
    const k = (cv.width / ph.w) * ZOOM;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = PALM_CANVAS.loupeBg;
    c.fillRect(0, 0, size, size);
    render(c, k, size / 2 - q[0] * k, size / 2 - q[1] * k);
    // 十字準星：放點、描線的確切位置（深色外框＋白線，淺色皮膚上也看得到）
    c.setTransform(1, 0, 0, 1, 0, 0);
    const m = size / 2;
    const gap = 6 * dpr;
    const len = 18 * dpr;
    const cross = () => {
      c.beginPath();
      c.moveTo(m - len, m);
      c.lineTo(m - gap, m);
      c.moveTo(m + gap, m);
      c.lineTo(m + len, m);
      c.moveTo(m, m - len);
      c.lineTo(m, m - gap);
      c.moveTo(m, m + gap);
      c.lineTo(m, m + len);
      c.stroke();
    };
    c.lineCap = 'round';
    c.strokeStyle = PALM_CANVAS.shadow;
    c.lineWidth = 3.5 * dpr;
    cross();
    c.strokeStyle = PALM_CANVAS.crosshair;
    c.lineWidth = 1.5 * dpr;
    cross();
    // 放在手指對角的那個角落：手指在右下就放左上，永遠不會被手指擋住
    const r = cv.getBoundingClientRect();
    const fx = e.clientX - r.left;
    const fy = e.clientY - r.top;
    const left = fx > r.width / 2 ? 8 : r.width - LOUPE - 8;
    const top = fy > r.height * 0.45 ? 8 : r.height - LOUPE - 8;
    loupe.style.left = `${Math.round(cv.offsetLeft + Math.max(0, left))}px`;
    loupe.style.top = `${Math.round(cv.offsetTop + Math.max(0, top))}px`;
    loupe.hidden = false;
  }

  const toImg = (e) => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * ph.w, ((e.clientY - r.top) / r.height) * ph.h];
  };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointers += 1;
    if (pointers > 1) {
      // 第二隻手指（想縮放或捲動）：這一筆不算，免得畫出一條亂線
      cur = null;
      pin = null;
      down = null;
      loupe.hidden = true;
      paint();
      return;
    }
    cv.setPointerCapture?.(e.pointerId);
    const q = toImg(e);
    down = { x: e.clientX, y: e.clientY };
    if (nextCalib()) pin = q;
    else cur = { field: getTarget(), pts: [q] };
    paint();
    showLoupe(q, e);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!down) return;
    const q = toImg(e);
    if (pin) pin = q;
    else if (cur) {
      const last = cur.pts[cur.pts.length - 1];
      // 每個觸控事件都存會太密：照片上移動 2 像素以上才記一點
      if (Math.hypot(q[0] - last[0], q[1] - last[1]) < 2) return;
      cur.pts.push(q);
    }
    paint();
    showLoupe(q, e);
  });
  const end = (e, commit) => {
    pointers = Math.max(0, pointers - 1);
    const was = { pin, cur, down };
    cur = null;
    pin = null;
    down = null;
    loupe.hidden = true;
    paint();
    if (!commit || !was.down) return;
    if (was.pin) {
      if (Math.hypot(e.clientX - was.down.x, e.clientY - was.down.y) <= MAX_SLIDE) onCalib(was.pin);
    } else if (was.cur && was.cur.pts.length >= 2) onStroke(was.cur.field, was.cur.pts);
    else if (was.cur && onTap) onTap(was.cur.field, was.cur.pts[0]);
  };
  cv.addEventListener('pointerup', (e) => end(e, true));
  cv.addEventListener('pointercancel', (e) => end(e, false));
  // 版面寬度改變（轉向、鍵盤收起）時重新量；畫布離開畫面就停止觀察
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => {
      if (!cv.isConnected) ro.disconnect();
      else layout();
    });
    queueMicrotask(() => ro.observe(wrap));
  }
  queueMicrotask(layout);
  return { el: wrap, repaint: paint };
}
