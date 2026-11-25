// AR 星空：手機舉起來對著天空，畫面上標出此刻太陽、月亮、行星和黃道十二宮在哪裡；可以開相機疊在實景上。
// 權限：iPhone 的「動作與方向」在點擊當下要（askOrientation）；相機只在按「開相機」時要；位置只在按「用目前位置」時要。
// 影像、方向、位置都只在手機上拿來畫圖，不存、不送出。沒有方向感測器（電腦）就用手指拖曳看。
// 指南針在室內、靠近金屬時常偏好幾十度，所以提供「對準月亮（或太陽、亮行星）按校正」，用真的天體把方向對回來。

import { h, fill } from './dom.js';
import { screenAngle } from './orientation.js';
import { skyNow, enu, rotationMatrix, lookMatrix, cameraDirection, iosOffset, project, nearest, describe, separation, SKY_MEANING, phaseName, DEFAULT_PLACE } from '../core/sky.js';
import { smooth, turn, dirOf } from '../core/compass.js';
import { SIGNS } from '../core/zodiac.js';

const RAD = Math.PI / 180;
const VFOV = 66; // 直拿手機時畫面上下的視角（度），接近手機主鏡頭直拍的視角
const BRIGHT = ['Sun', 'Moon', 'Venus', 'Jupiter', 'Mars', 'Saturn']; // 肉眼看得到、可以拿來校正方向
const COLOR = { Sun: '#f5c451', Moon: '#e9edf5', Mercury: '#b8b2a7', Venus: '#fff1c1', Mars: '#ff7a5c', Jupiter: '#f0d3a2', Saturn: '#e6c98f', Uranus: '#9fe3ef', Neptune: '#7fa8ff' };
const SIZE = { Sun: 15, Moon: 13, Venus: 7, Jupiter: 7, Mars: 6, Saturn: 6, Mercury: 5, Uranus: 4.5, Neptune: 4.5 };

/**
 * 打開 AR 星空（全螢幕）。要先在點擊當下呼叫 askOrientation（iPhone），拿到結果再呼叫這裡。
 * @param {{natalSign?:number|null, orientation:'granted'|'denied', toast?:(msg:string)=>void}} opts natalSign：本命太陽星座（0～11），盤上標金色
 * @returns {() => void} 關閉函式
 */
export function openArSky({ natalSign = null, orientation = 'granted', toast = () => {} } = {}) {
  const opener = document.activeElement;
  let place = { ...DEFAULT_PLACE, label: `${DEFAULT_PLACE.label}（預設）` };
  let sky = null;
  let vec = null; // 天體、黃道、十二宮的地平座標向量（30 秒更新一次）
  let skyAt = 0;
  // 方向：sensor＝感測器（abs：Android 絕對、ios：iPhone 指南針、rel：只有相對角度）、drag＝手指拖曳
  let mode = 'wait';
  let ori = null; // { alpha, beta, gamma }
  let iosOff = null;
  let calib = 0; // 校正量（度）：指南針偏掉時用真的天體對回來
  let look = { az: 180, alt: 30 };
  let raf = 0;
  let dirty = true;
  let stream = null;
  let lastNear = '';

  const video = h('video', { class: 'ar-cam', playsinline: true, muted: true, autoplay: true, hidden: true, 'aria-hidden': 'true' });
  video.muted = true;
  video.playsInline = true;
  const canvas = h('canvas', { class: 'ar-sky', 'aria-hidden': 'true' });
  const g = canvas.getContext('2d');
  const info = h('div', { class: 'ar-info', 'aria-live': 'polite' });
  const status = h('p', { class: 'ar-status' });
  const placeLine = h('span', {});
  const list = h('ul', { class: 'ar-list-items' });
  const calibBtn = h('button', { type: 'button', class: 'ar-btn', text: '校正方向', onclick: () => calibrate() });
  const camBtn = h('button', { type: 'button', class: 'ar-btn', text: '開相機', 'aria-pressed': 'false', onclick: () => toggleCamera() });
  const closeBtn = h('button', { type: 'button', class: 'ar-btn', text: '關閉', onclick: () => close() });
  const geoBtn = h('button', { type: 'button', class: 'link', text: '用我現在的位置', onclick: () => useMyPlace() });
  const root = h('div', { class: 'ar', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'AR 星空' },
    video,
    canvas,
    h('div', { class: 'ar-cross', 'aria-hidden': 'true' }),
    h('div', { class: 'ar-top' }, closeBtn, h('div', { class: 'ar-top-right' }, calibBtn, camBtn)),
    h('div', { class: 'ar-bottom' },
      info,
      status,
      h('p', { class: 'ar-status' }, placeLine, geoBtn),
      h('details', { class: 'ar-list' }, h('summary', { text: '文字版：現在天上有什麼' }), list)));

  // ── 天上的位置：30 秒更新一次就夠（行星一分鐘只移動約 0.25°）
  function refreshSky() {
    sky = skyNow(Date.now(), place);
    skyAt = Date.now();
    vec = {
      bodies: sky.bodies.map((b) => ({ b, v: enu(b.az, b.alt) })),
      ecliptic: sky.ecliptic.map((p) => ({ p, v: enu(p.az, p.alt) })),
      signs: sky.signs.map((s) => ({ s, v: enu(s.az, s.alt) })),
    };
    const sorted = [...sky.bodies].sort((a, b) => b.alt - a.alt);
    fill(list, ...sorted.map((b) => h('li', { text: `${b.name}：${describe(b)}（${SIGNS[b.sign].name} ${Math.floor(b.deg)}°${b.key === 'Moon' ? `，${phaseName(b.phase)}` : ''}）` })),
      natalSign != null ? h('li', { class: 'ar-mine', text: `你的太陽星座${SIGNS[natalSign].name}：${describe(sky.signs[natalSign])}` }) : null);
    dirty = true;
  }

  // ── 方向
  function matrix() {
    if (mode === 'drag' || !ori) return lookMatrix(look.az, look.alt);
    return rotationMatrix(ori.alpha - calib, ori.beta, ori.gamma);
  }
  const onOri = (e) => {
    if (typeof e.alpha !== 'number' || typeof e.beta !== 'number' || typeof e.gamma !== 'number') return; // 電腦會送一筆全是 null 的
    let m;
    let alpha = e.alpha;
    if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
      // iPhone：陀螺儀的相對 alpha 反應快，指南針慢慢把它校正到以北為準
      const off = iosOffset(e.alpha, e.webkitCompassHeading);
      iosOff = iosOff == null ? off : smooth(iosOff, off, 0.05);
      alpha = e.alpha - iosOff;
      m = 'ios';
    } else if (e.type === 'deviceorientationabsolute' || e.absolute === true) {
      m = 'abs';
    } else {
      if (mode === 'abs') return; // Android 兩種都會發：有絕對的就不用相對的
      m = 'rel';
    }
    if (mode === 'drag') return; // 已經改用拖曳就不再被感測器搶走
    ori = { alpha, beta: e.beta, gamma: e.gamma };
    if (mode !== m) {
      mode = m;
      paintStatus();
    }
    dirty = true;
  };
  const listening = orientation === 'granted';
  if (listening) {
    window.addEventListener('deviceorientationabsolute', onOri);
    window.addEventListener('deviceorientation', onOri);
  }
  // 2.5 秒都沒有方向資料：改成拖曳
  const waitTimer = setTimeout(() => {
    if (mode !== 'wait') return;
    mode = 'drag';
    const target = sky && (sky.bodies.find((b) => b.key === 'Moon' && b.alt > 0) || sky.bodies.find((b) => BRIGHT.includes(b.key) && b.alt > 0));
    if (target) look = { az: target.az, alt: Math.max(5, Math.min(70, target.alt)) };
    paintStatus();
    dirty = true;
  }, orientation === 'granted' ? 2500 : 0);

  function paintStatus() {
    const text = {
      wait: '等待方向感測器…',
      abs: '把手機舉向天空：畫面會跟著手機轉。',
      ios: '把手機舉向天空：畫面會跟著手機轉。方向偏掉時，把中間的圈對準月亮或亮星再按「校正方向」。',
      rel: '這台手機沒有指南針：先把中間的圈對準月亮或亮星，按「校正方向」。',
      drag: orientation === 'granted' ? '收不到方向感測器（電腦或沒有感測器）：用手指拖曳畫面來看。' : '沒有「動作與方向」權限：用手指拖曳畫面來看。要跟著手機轉，關掉再打開時選「允許」。',
    }[mode];
    status.textContent = text;
    calibBtn.hidden = mode === 'drag' || mode === 'wait';
  }

  // 拖曳：沒有感測器時才用
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'drag') return;
    drag = { x: e.clientX, y: e.clientY, az: look.az, alt: look.alt };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const degPerPx = VFOV / canvas.clientHeight;
    look = { az: ((drag.az - (e.clientX - drag.x) * degPerPx) % 360 + 360) % 360, alt: Math.max(-80, Math.min(85, drag.alt + (e.clientY - drag.y) * degPerPx)) };
    dirty = true;
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ── 校正：把中間的圈對準一個看得到的天體，把差距記成校正量
  function calibrate() {
    const R = matrix();
    const cam = cameraDirection(R);
    const cand = sky.bodies.filter((b) => BRIGHT.includes(b.key) && b.alt > -2);
    let best = null;
    for (const b of cand) {
      const d = separation(cam.az, cam.alt, b.az, b.alt);
      if (d <= 30 && (!best || d < best.d)) best = { b, d };
    }
    if (!best) {
      toast('中間的圈附近 30° 內沒有月亮、太陽或亮行星，先把圈對準它再按一次。');
      return;
    }
    // 鏡頭方位角要變成天體的方位角：畫面用 alpha－calib，alpha 每減 1° 方位角加 1°，所以差多少就把 calib 加多少
    calib = ((calib + turn(cam.az, best.b.az)) % 360 + 360) % 360;
    dirty = true;
    toast(`已用${best.b.name}校正方向（差了 ${Math.round(Math.abs(turn(cam.az, best.b.az)))}°）`);
  }

  // ── 相機：只在使用者按下時要權限；關掉 AR 時一定停掉
  async function toggleCamera() {
    if (stream) {
      stopCamera();
      return;
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('unsupported');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = stream;
      video.hidden = false;
      await video.play().catch(() => {});
      camBtn.textContent = '關相機';
      camBtn.setAttribute('aria-pressed', 'true');
      dirty = true;
    } catch (err) {
      stopCamera();
      toast(err && err.name === 'NotAllowedError'
        ? '沒有相機權限：iPhone 到「設定 → Safari → 相機」改成允許。不開相機也能看星空。'
        : '沒辦法開相機（這台裝置可能沒有後鏡頭）。不開相機也能看星空。');
    }
  }
  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    video.hidden = true;
    camBtn.textContent = '開相機';
    camBtn.setAttribute('aria-pressed', 'false');
    dirty = true;
  }

  // ── 位置：預設台北；按了才問定位，只用來算天體位置，不存
  function paintPlace() {
    placeLine.textContent = `位置：${place.label}　`;
  }
  function useMyPlace() {
    if (!navigator.geolocation) {
      toast('這個瀏覽器不能定位，先用台北的位置算（台灣各地看起來差不多）。');
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      place = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: `目前位置（北緯 ${pos.coords.latitude.toFixed(1)}°）` };
      paintPlace();
      refreshSky();
    }, () => toast('沒有拿到位置，繼續用台北的位置算（台灣各地看起來差不多）。'), { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  }

  // ── 畫面
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }
  /** 螢幕上一點朝的方向在不在地平線下（畫地面用） */
  function below(R, view, sx, sy) {
    let x = (sx - view.cx) / view.f;
    let y = -(sy - view.cy) / view.f;
    if (view.screenAngle) {
      const t = -view.screenAngle * RAD;
      [x, y] = [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
    }
    return R[2][0] * x + R[2][1] * y - R[2][2] < 0;
  }
  function drawGround(R, view, W, H) {
    // 地平線是大圓，透視投影後是直線：四個角在地面下的、和四條邊與地平線的交點，圍成地面
    const corners = [[0, 0], [W, 0], [W, H], [0, H]];
    const inside = corners.map(([x, y]) => below(R, view, x, y));
    const poly = [];
    const cross = [];
    for (let i = 0; i < 4; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      if (inside[i]) poly.push(a);
      if (inside[i] !== inside[(i + 1) % 4]) {
        let lo = 0;
        let hi = 1;
        for (let k = 0; k < 14; k += 1) {
          const mid = (lo + hi) / 2;
          const p = [a[0] + (b[0] - a[0]) * mid, a[1] + (b[1] - a[1]) * mid];
          if (below(R, view, p[0], p[1]) === inside[i]) lo = mid; else hi = mid;
        }
        const p = [a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo];
        poly.push(p);
        cross.push(p);
      }
    }
    if (poly.length >= 3) {
      g.fillStyle = stream ? 'rgba(8, 20, 14, 0.35)' : 'rgba(14, 30, 22, 0.92)';
      g.beginPath();
      poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
    }
    if (cross.length === 2) {
      g.strokeStyle = 'rgba(160, 220, 190, 0.8)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(cross[0][0], cross[0][1]);
      g.lineTo(cross[1][0], cross[1][1]);
      g.stroke();
    }
  }
  function label(text, x, y, { color = '#fff', size = 13, bold = false, align = 'left' } = {}) {
    g.font = `${bold ? '700 ' : ''}${size}px system-ui, -apple-system, "PingFang TC", sans-serif`;
    g.textAlign = align;
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    g.strokeText(text, x, y);
    g.fillStyle = color;
    g.fillText(text, x, y);
  }
  function draw() {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    g.clearRect(0, 0, W, H);
    if (!stream) {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#050814');
      grad.addColorStop(1, '#13203d');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }
    const R = matrix();
    const sa = screenAngle();
    const view = { f: (H / 2) / Math.tan((VFOV / 2) * RAD), cx: W / 2, cy: H / 2, screenAngle: sa };
    drawGround(R, view, W, H);
    // 方位：地平線上的八個方向
    ['北', '東北', '東', '東南', '南', '西南', '西', '西北'].forEach((name, i) => {
      const p = project(R, enu(i * 45, 0), view);
      if (p) label(name, p.x, p.y - 8, { color: '#bfe8d2', size: i % 2 ? 13 : 16, bold: !(i % 2), align: 'center' });
    });
    // 黃道與十二宮
    g.strokeStyle = 'rgba(245, 196, 81, 0.55)';
    g.lineWidth = 1.5;
    g.setLineDash([6, 5]);
    g.beginPath();
    let prev = null;
    for (let i = 0; i <= vec.ecliptic.length; i += 1) {
      const p = project(R, vec.ecliptic[i % vec.ecliptic.length].v, view);
      if (p && prev && Math.hypot(p.x - prev.x, p.y - prev.y) < W * 2) g.lineTo(p.x, p.y);
      else if (p) g.moveTo(p.x, p.y);
      prev = p;
    }
    g.stroke();
    g.setLineDash([]);
    for (const { s, v } of vec.signs) {
      const p = project(R, v, view);
      if (!p) continue;
      const mine = s.index === natalSign;
      label(`${SIGNS[s.index].glyph} ${mine ? `${s.name}（你的）` : s.name}`, p.x, p.y + 18, { color: mine ? '#f5c451' : 'rgba(245, 220, 160, 0.85)', size: mine ? 15 : 12, bold: mine, align: 'center' });
    }
    // 天體
    for (const { b, v } of vec.bodies) {
      const p = project(R, v, view);
      if (!p || p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) continue;
      const r = SIZE[b.key];
      const under = b.alt < 0;
      g.globalAlpha = under ? 0.45 : 1;
      if (b.key === 'Sun' || b.key === 'Moon') {
        g.fillStyle = b.key === 'Sun' ? 'rgba(245, 196, 81, 0.25)' : 'rgba(233, 237, 245, 0.18)';
        g.beginPath();
        g.arc(p.x, p.y, r * 2, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = COLOR[b.key];
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.fill();
      if (under) {
        g.setLineDash([3, 3]);
        g.strokeStyle = COLOR[b.key];
        g.beginPath();
        g.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
      g.globalAlpha = 1;
      label(`${b.name}${under ? '（地平線下）' : ''}`, p.x + r + 6, p.y + 4, { color: under ? 'rgba(255,255,255,0.6)' : '#fff', size: 14, bold: !under });
    }
    // 中間對準的是什麼
    const cam = cameraDirection(R);
    const near = nearest(cam, sky.bodies, 7);
    const key = near ? near.key : `${dirOf(cam.az)}${Math.round(cam.alt / 10)}`;
    if (key !== lastNear) {
      lastNear = key;
      fill(info, near
        ? [h('b', { text: `${near.name}・${SIGNS[near.sign].name} ${Math.floor(near.deg)}°${near.key === 'Moon' ? `（${phaseName(near.phase)}）` : ''}` }),
          h('span', { text: `${SKY_MEANING[near.key]}。${describe(near)}${near.alt < 0 ? '，現在看不到' : ''}。` })]
        : [h('b', { text: `鏡頭朝：${dirOf(cam.az)}、${cam.alt >= 0 ? `高 ${Math.round(cam.alt)}°` : `往下 ${Math.round(-cam.alt)}°`}` }),
          h('span', { text: '把中間的圈對準亮點，看看是哪顆行星。' })]);
    }
  }
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (Date.now() - skyAt > 30000) refreshSky();
    if (!dirty) return;
    dirty = false;
    draw();
  };

  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  function close() {
    cancelAnimationFrame(raf);
    clearTimeout(waitTimer);
    window.removeEventListener('deviceorientationabsolute', onOri);
    window.removeEventListener('deviceorientation', onOri);
    window.removeEventListener('resize', resize);
    document.removeEventListener('keydown', onKey);
    stopCamera();
    root.remove();
    document.body.classList.remove('ar-open');
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  }

  document.body.append(root);
  document.body.classList.add('ar-open');
  window.addEventListener('resize', resize);
  document.addEventListener('keydown', onKey);
  paintPlace();
  refreshSky();
  paintStatus();
  resize();
  closeBtn.focus();
  raf = requestAnimationFrame(loop);
  return close;
}
