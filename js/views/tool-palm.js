// 命理 → 掌紋：看圖自選（主要）＋拍照描線（選用）；斷掌、四大線、掌形、厚薄、左右手比較。
// 照片只畫在畫面上的 canvas（先縮到 1280px 以內，原圖馬上釋放），不存、不上傳；
// 選好的線形按「存到資料」才寫進名單（records.js 白名單過濾），沒按就只留在這次開著的 App 裡。

import { h, fill, segmented } from '../ui/dom.js';
import { cardHead } from '../ui/icons.js';
import { traitScale } from '../ui/widgets.js';
import { playWhenVisible } from '../ui/motion.js';
import { palmDiagram, palmThumb, diagramFields } from '../ui/palm-chart.js';
import { PALM_CANVAS } from '../ui/palette.js';
import { activeFields, sanitizePicks, palmFrame, simplifyStroke, suggestPicks, photoAdvice, compareHands, handRole } from '../core/palm.js';
import { PALM_TEXT, PALM_HOW, ROLE_TEXT, SIMIAN_NOTE, PALM_DISCLAIMER, palmReading, handDiffText } from '../core/palm-texts.js';

const HAND_NAME = { left: '左手', right: '右手' };
const MAX_SIDE = 1280; // iPhone 原圖解開約 48MB：縮到這個大小以內，記憶體才不會被吃光
const MAX_FILE = 40 * 1024 * 1024;
const QUESTION = {
  simian: '感情線和智慧線是分開的，還是連成一條橫線？',
  life: '生命線（繞著拇指根部的弧線）長什麼樣子？',
  head: '智慧線（從拇指和食指中間，往小指那側橫過去）長什麼樣子？',
  start: '智慧線的起點，和生命線連在一起嗎？',
  heart: '感情線（小指下方往食指方向的線）走到哪裡？',
  fate: '事業線（從手腕往中指方向的直線）長什麼樣子？',
  shape: '整個手掌和手指，比較像哪一種？',
  thick: '從側面看，手掌的厚度如何？',
};
const CALIB = [
  { key: 'index', text: '食指根部的中間' },
  { key: 'pinky', text: '小指根部的中間' },
  { key: 'wrist', text: '手腕橫紋的中間' },
];
const TARGETS = [
  { value: 'life', label: '生命線' },
  { value: 'head', label: '智慧線' },
  { value: 'heart', label: '感情線' },
  { value: 'fate', label: '事業線' },
  { value: 'simian', label: '斷掌線' },
];
const TRACE_FIELDS = ['life', 'head', 'heart', 'fate', 'simian', 'start'];

// 整個命理分頁會重畫（例如按了儲存），畫到一半的選擇和照片要留著：放在模組層級，只在記憶體裡
const session = { personId: null, hand: 'right', dominant: '', picks: { left: {}, right: {} }, dirty: false, step: { left: 0, right: 0 }, photos: { left: null, right: null }, target: 'life' };

function dropPhoto(hand) {
  const ph = session.photos[hand];
  if (ph) ph.canvas.width = 0; // 讓瀏覽器馬上釋放這張圖的記憶體
  session.photos[hand] = null;
}

function loadSaved(p) {
  const saved = p.palm || {};
  session.dominant = saved.dominant || '';
  session.picks = { left: sanitizePicks(saved.left), right: sanitizePicks(saved.right) };
}

/** 照片 → 縮小的 canvas（原圖用完就放掉） */
async function readPhoto(file) {
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
    return { canvas, w, h: ht, calib: {}, strokes: {}, auto: [], advice: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 掌心範圍的灰階取樣（看太暗、太亮、反光） */
function sampleGray(ph, frame) {
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

const frameOf = (ph) => (ph && ph.calib.index && ph.calib.pinky && ph.calib.wrist ? palmFrame(ph.calib) : null);

/** 照片上描的線（像素）換成掌心框座標，給判定與結果圖用 */
function uvTraces(ph) {
  const frame = frameOf(ph);
  if (!frame) return {};
  const out = {};
  for (const [field, strokes] of Object.entries(ph.strokes)) {
    const list = strokes.map((st) => simplifyStroke(st.map((q) => frame.toUV(q)))).filter(Boolean);
    if (list.length) out[field] = list;
  }
  return out;
}

const lineColor = (field) => getComputedStyle(document.documentElement).getPropertyValue(`--pl-${field}`).trim() || PALM_CANVAS.fallbackLine;

/**
 * 照片畫布：先點三個校正點，再沿著掌紋描線。只用 pointer 事件，滑鼠、手指、觸控筆都能用。
 * onStroke(field)／onCalib() 讓外面更新建議與結果。
 */
function photoCanvas(ph, { getTarget, onCalib, onStroke }) {
  const cv = h('canvas', { class: 'palm-canvas', role: 'img', 'aria-label': '手掌照片：點校正點、用手指沿著掌紋描線' });
  let cur = null;
  let down = null;
  let scale = 1;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);

  function layout() {
    const wrap = cv.parentElement;
    if (!wrap) return;
    const maxW = wrap.clientWidth || 320;
    const maxH = Math.max(240, (globalThis.innerHeight || 700) * 0.6);
    scale = Math.min(maxW / ph.w, maxH / ph.h);
    cv.style.width = `${Math.round(ph.w * scale)}px`;
    cv.style.height = `${Math.round(ph.h * scale)}px`;
    cv.width = Math.round(ph.w * scale * dpr);
    cv.height = Math.round(ph.h * scale * dpr);
    paint();
  }

  function paint() {
    const c = cv.getContext('2d');
    if (!c || !cv.width) return;
    const k = cv.width / ph.w;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(ph.canvas, 0, 0, cv.width, cv.height);
    c.setTransform(k, 0, 0, k, 0, 0);
    const px = dpr / k; // 一個畫面像素在照片座標裡有多大
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
    for (const [field, strokes] of Object.entries(ph.strokes)) {
      for (const st of strokes) {
        line(st, PALM_CANVAS.shadow, 6);
        line(st, lineColor(field), 3.5);
      }
    }
    if (cur) line(cur.pts, lineColor(cur.field), 3.5);
    // 校正點與掌心框
    const frame = frameOf(ph);
    if (frame) {
      c.setLineDash([6 * px, 5 * px]);
      line([frame.toXY([-0.1, 0]), frame.toXY([1.15, 0])], PALM_CANVAS.guide, 1.5);
      line([frame.toXY([0.5, 0]), frame.toXY([0.5, 1])], PALM_CANVAS.guide, 1.5);
      c.setLineDash([]);
    }
    CALIB.forEach((cp, i) => {
      const q = ph.calib[cp.key];
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

  const toImg = (e) => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * ph.w, ((e.clientY - r.top) / r.height) * ph.h];
  };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    cv.setPointerCapture?.(e.pointerId);
    const q = toImg(e);
    down = { q, x: e.clientX, y: e.clientY };
    if (frameOf(ph)) cur = { field: getTarget(), pts: [q] };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const q = toImg(e);
    const last = cur.pts[cur.pts.length - 1];
    // 每個觸控事件都存會太密：照片上移動 2 像素以上才記一點
    if (Math.hypot(q[0] - last[0], q[1] - last[1]) >= 2) {
      cur.pts.push(q);
      paint();
    }
  });
  const finish = (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const next = CALIB.find((cp) => !ph.calib[cp.key]);
    if (next && moved < 12) {
      ph.calib[next.key] = down.q;
      onCalib();
    } else if (cur && cur.pts.length >= 2) {
      (ph.strokes[cur.field] = ph.strokes[cur.field] || []).push(cur.pts);
      onStroke(cur.field);
    }
    cur = null;
    down = null;
    paint();
  };
  cv.addEventListener('pointerup', finish);
  cv.addEventListener('pointercancel', () => {
    cur = null;
    down = null;
    paint();
  });
  // 版面寬度改變（轉向、鍵盤收起）時重新量；畫布離開畫面就停止觀察
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => {
      if (!cv.isConnected) ro.disconnect();
      else layout();
    });
    queueMicrotask(() => cv.parentElement && ro.observe(cv.parentElement));
  }
  queueMicrotask(layout);
  return { el: cv, repaint: paint };
}

/**
 * @param p 名單上的人
 * @param kit destiny.js 的共用工具（ctx、actions）
 */
export function drawPalm(p, { ctx, actions }) {
  if (session.personId !== p.id) {
    session.personId = p.id;
    loadSaved(p);
    session.hand = Object.keys(session.picks.left).length && !Object.keys(session.picks.right).length ? 'left' : 'right';
    session.dirty = false;
    session.step = { left: 0, right: 0 };
    dropPhoto('left');
    dropPhoto('right');
  } else if (!session.dirty) {
    loadSaved(p); // 沒有未儲存的修改：以名單裡存的為準（例如剛匯入備份）
  }

  const pickerBox = h('div', {});
  const photoBox = h('div', {});
  const resultBox = h('div', { 'aria-live': 'polite' });
  const roleLine = h('p', { class: 'muted small' });
  let advanceTimer = null;

  const picks = () => session.picks[session.hand];
  const fields = () => activeFields(picks());

  function setPick(field, value) {
    const cur = picks();
    cur[field] = value;
    if (field === 'simian' && value === 'full') for (const k of ['head', 'start', 'heart']) delete cur[k];
    session.picks[session.hand] = sanitizePicks(cur);
    session.dirty = true;
  }

  function paintRole() {
    const role = handRole(session.hand, session.dominant);
    roleLine.textContent = role ? ROLE_TEXT[role] : '還沒選慣用手：選了之後，會說明這隻手看的是天生還是後天。';
  }

  // ── 看圖自選：一次一題，選完自動跳下一題
  function paintPicker() {
    const list = fields();
    const hand = session.hand;
    let i = Math.min(session.step[hand], list.length - 1);
    if (i < 0) i = 0;
    session.step[hand] = i;
    const field = list[i];
    const cur = picks()[field.id] || '';
    const chips = h('div', { class: 'palm-steps', role: 'group', 'aria-label': '各題目前的選擇' }, list.map((f, j) => h('button', {
      type: 'button',
      class: `palm-step${j === i ? ' on' : ''}${picks()[f.id] ? ' done' : ''}`,
      'aria-pressed': j === i ? 'true' : 'false',
      onclick: () => { session.step[hand] = j; paintPicker(); },
      // 橫向捲動列：Tab 到畫面外的按鈕時瀏覽器只捲出一角，要自己捲到整顆看得到
      onfocus: (e) => e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
    }, h('b', { text: f.label }), h('span', { text: picks()[f.id] ? PALM_TEXT[f.id][picks()[f.id]].label : '未選' }))));
    // 目前這題的按鈕捲到中間（只動這一列，不動整頁）
    requestAnimationFrame(() => {
      const on = chips.querySelector('.on');
      if (on && chips.isConnected) chips.scrollLeft = Math.max(0, on.offsetLeft - (chips.clientWidth - on.offsetWidth) / 2);
    });
    const options = h('div', { class: `palm-options n${field.options.length}`, role: 'group', 'aria-label': field.label }, field.options.map((opt) => h('button', {
      type: 'button',
      class: `palm-opt${opt === cur ? ' on' : ''}`,
      'aria-pressed': opt === cur ? 'true' : 'false',
      onclick: () => {
        setPick(field.id, opt);
        paintPicker();
        paintResult();
        clearTimeout(advanceTimer);
        // 停一下讓人看到自己選了哪個，再跳到下一題沒選的
        advanceTimer = setTimeout(() => {
          const now = fields();
          const at = now.findIndex((f) => f.id === field.id);
          const nextOpen = now.findIndex((f, j) => j > at && !picks()[f.id]);
          if (nextOpen >= 0 || at < now.length - 1) {
            session.step[hand] = nextOpen >= 0 ? nextOpen : at + 1;
            if (session.hand === hand && pickerBox.isConnected) paintPicker();
          }
        }, 320);
      },
    }, palmThumb(field.id, opt, hand), h('span', { text: PALM_TEXT[field.id][opt].label }))));
    fill(
      pickerBox,
      chips,
      h('h3', { class: 'palm-q' }, h('span', { class: 'badge', text: `${i + 1}／${list.length}` }), ' ', h('span', { text: QUESTION[field.id] })),
      options,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn small', text: '上一題', disabled: i === 0, onclick: () => { session.step[hand] = i - 1; paintPicker(); } }),
        i < list.length - 1
          ? h('button', { type: 'button', class: 'btn small', text: cur ? '下一題' : '先跳過', onclick: () => { session.step[hand] = i + 1; paintPicker(); } })
          : h('button', { type: 'button', class: 'btn small primary', text: '看結果', onclick: () => resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' }) })),
    );
  }

  // ── 拍照描線
  function applySuggestions() {
    const ph = session.photos[session.hand];
    if (!ph) return;
    const sug = suggestPicks(uvTraces(ph));
    const cur = picks();
    // 之前由描線填的欄位，如果線被清掉、建議沒了，就一起拿掉，免得留下看不到依據的選項
    for (const k of ph.auto) if (!(k in sug)) delete cur[k];
    Object.assign(cur, sug);
    if (sug.simian === 'full') for (const k of ['head', 'start', 'heart']) delete cur[k];
    ph.auto = Object.keys(sug);
    session.picks[session.hand] = sanitizePicks(cur);
    session.dirty = true;
  }

  function paintPhoto() {
    const hand = session.hand;
    const ph = session.photos[hand];
    const input = h('input', {
      type: 'file',
      accept: 'image/*',
      class: 'visually-hidden',
      tabindex: '-1',
      'aria-label': '選擇手掌照片',
      onchange: async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
          dropPhoto(hand);
          // 大張照片解碼要一點時間：先告訴使用者在處理，免得以為按了沒反應
          fill(photoBox, h('p', { class: 'palm-instr', role: 'status', text: '讀取照片中…（只在這支手機處理）' }));
          session.photos[hand] = await readPhoto(file);
          paintPhoto();
        } catch (err) {
          fill(photoBox, h('p', { class: 'warn', text: err.message }), pickButton());
        }
      },
    });
    const pickButton = () => h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', text: ph ? '換一張照片' : '拍照或選照片', onclick: () => input.click() }), input);
    const inApp = /Line\/|FBAN|FBAV|Instagram/i.test(globalThis.navigator ? navigator.userAgent : '');
    if (!ph) {
      fill(
        photoBox,
        inApp ? h('p', { class: 'warn', text: '你是在 LINE、Facebook 或 Instagram 裡開這個網頁，這裡常常叫不出相機：請點右上角的選單，選「用預設瀏覽器開啟」或「在 Safari 中開啟」再試。' }) : null,
        h('p', { text: PALM_HOW.photo }),
        h('ul', { class: 'reasons' },
          h('li', { class: 'tone-info', text: '手掌攤平、手指併攏，整隻手和手腕都要入鏡。' }),
          h('li', { class: 'tone-info', text: '光從正面照、不要開閃光燈，掌紋比較清楚。' }),
          h('li', { class: 'tone-info', text: '拍好後先點三個位置，再用手指沿著掌紋描，App 會量長度和彎度，自動填進上面的選項。' })),
        pickButton(),
        h('details', { class: 'more' }, h('summary', { text: '按了沒反應、照片打不開？' }),
          h('p', { class: 'small', text: '按了沒反應：在 LINE、FB、IG 裡開的網頁常常不能用相機，請改用 Safari 開啟。' }),
          h('p', { class: 'small', text: '照片打不開：請改用「拍照」直接拍一張；照片太大（超過 40MB）也會讀不進來。' }),
          h('p', { class: 'small', text: '不想拍照也沒關係，上面「看圖選線形」一樣能完成解讀。' })),
      );
      return;
    }
    const next = CALIB.find((cp) => !ph.calib[cp.key]);
    const frame = frameOf(ph);
    const canvas = photoCanvas(ph, {
      getTarget: () => session.target,
      onCalib: () => {
        const done = CALIB.every((cp) => ph.calib[cp.key]);
        if (done && !frameOf(ph)) {
          ph.calib = {};
          ph.advice = '三個點太靠近，或幾乎在一直線上：請依序點食指根部、小指根部，再點手腕中間。';
        } else if (done) {
          const fr = frameOf(ph);
          ph.advice = photoAdvice(sampleGray(ph, fr), fr.width / ph.w);
        }
        paintPhoto();
      },
      onStroke: () => {
        applySuggestions();
        paintPhoto();
        paintPicker();
        paintResult();
      },
    });
    const sug = frame ? suggestPicks(uvTraces(ph)) : {};
    const sugText = Object.entries(sug).filter(([k]) => TRACE_FIELDS.includes(k)).map(([k, v]) => `${({ life: '生命線', head: '智慧線', heart: '感情線', fate: '事業線', simian: '斷掌', start: '智慧線起點' })[k]}「${PALM_TEXT[k][v].label}」`);
    fill(
      photoBox,
      next
        ? h('p', { class: 'palm-instr' }, h('span', { class: 'badge', text: `${CALIB.indexOf(next) + 1}／3` }), ' ', h('span', { text: `點照片上的「${next.text}」` }))
        : [
          segmented({ name: 'palm-target', label: '要描哪條線', value: session.target, options: TARGETS, onChange: (v) => { session.target = v; } }),
          h('p', { class: 'palm-instr', text: '用手指沿著選好的那條線描一次；斷開、分岔或旁邊的細線，可以分成好幾筆描。' }),
        ],
      ph.advice ? h('p', { class: 'warn', text: ph.advice }) : null,
      h('div', { class: 'palm-canvas-wrap' }, canvas.el),
      sugText.length ? h('p', { class: 'small', text: `依你描的線推測：${sugText.join('、')}。已經填進上面的選項，可以再自己改。` }) : null,
      h('div', { class: 'actions' },
        next ? null : h('button', { type: 'button', class: 'btn small', text: '清除這條線', onclick: () => { delete ph.strokes[session.target]; applySuggestions(); paintPhoto(); paintPicker(); paintResult(); } }),
        h('button', { type: 'button', class: 'btn small', text: '重新點三個位置', onclick: () => { ph.calib = {}; ph.advice = null; paintPhoto(); } }),
        h('button', { type: 'button', class: 'btn small', text: '清除照片', onclick: () => { dropPhoto(hand); paintPhoto(); paintResult(); } })),
      pickButton(),
    );
  }

  // ── 結果
  function paintResult() {
    const hand = session.hand;
    const cur = picks();
    const items = palmReading(cur);
    const ph = session.photos[hand];
    const role = handRole(hand, session.dominant);
    const saveRow = h('div', { class: 'actions' },
      h('button', {
        type: 'button',
        class: `btn${session.dirty ? ' primary' : ''}`,
        text: `存到${p.name}的資料`,
        disabled: !session.dirty,
        onclick: () => {
          const saved = ctx.savePerson({ ...p, palm: { dominant: session.dominant, left: session.picks.left, right: session.picks.right } });
          if (saved.ok) {
            session.dirty = false;
            ctx.toast('已存進名單（只在這支手機），照片沒有儲存');
          } else {
            ctx.toast(saved.error || '儲存失敗');
          }
        },
      }),
      h('span', { class: 'muted small', text: session.dirty ? '有還沒儲存的選擇' : '已儲存' }));
    if (!items.length) {
      fill(resultBox, h('p', { class: 'muted', text: '選了線形之後，這裡會畫出你的掌紋並逐項解讀。' }), session.dominant !== ((p.palm || {}).dominant || '') ? saveRow : null);
      return;
    }
    const traces = ph ? uvTraces(ph) : {};
    const present = diagramFields(cur, traces);
    const diffs = compareHands(session.picks.left, session.picks.right);
    const bothFilled = Object.keys(session.picks.left).length && Object.keys(session.picks.right).length;
    const summary = items.map((it) => `${it.label}：${it.title}`).join('；');
    fill(
      resultBox,
      h('div', { class: 'palm-figure' },
        playWhenVisible(palmDiagram({ hand, picks: cur, traces, label: `${HAND_NAME[hand]}掌紋示意：${summary}` })),
        h('div', { class: 'palm-legend small' }, present.map((f) => h('span', { class: `pl-key pl-${f}`, text: { life: '生命線', head: '智慧線', heart: '感情線', fate: '事業線', simian: cur.simian === 'full' ? '斷掌線' : '相連處' }[f] })))),
      role ? h('p', { class: 'muted small', text: ROLE_TEXT[role] }) : null,
      items.map((it) => h('div', { class: 'palm-item' },
        h('h3', {}, h('span', { class: 'badge', text: it.label }), ' ', h('span', { text: it.title })),
        traitScale(it.scale, it.pos),
        h('p', { text: it.text }),
        h('ul', { class: 'reasons' },
          h('li', { class: 'tone-good' }, h('b', { text: '值得發揮：' }), h('span', { text: it.good })),
          h('li', { class: 'tone-info' }, h('b', { text: '溫和提醒：' }), h('span', { text: it.care })),
          h('li', { class: 'tone-info' }, h('b', { text: '小行動：' }), h('span', { text: it.act }))))),
      cur.simian && cur.simian !== 'none' ? h('p', { class: 'hint', text: SIMIAN_NOTE }) : null,
      bothFilled
        ? [h('h3', { text: '左右手比較' }), diffs.length ? h('ul', { class: 'reasons' }, diffs.map((d) => h('li', { class: 'tone-info', text: handDiffText(d, session.dominant) }))) : h('p', { text: '兩隻手選的都一樣：天生和後天的傾向一致。' })]
        : h('p', { class: 'hint', text: `也可以切到${HAND_NAME[hand === 'left' ? 'right' : 'left']}選一次，比較兩隻手的差異。` }),
      h('p', { class: 'hint', text: PALM_DISCLAIMER }),
      saveRow,
      actions(p, 'palm', `掌紋（${HAND_NAME[hand]}）`, summary, { title: `${p.name}的掌紋（${HAND_NAME[hand]}）`, subtitle: role ? ROLE_TEXT[role] : '', lines: items.map((it) => `${it.label}｜${it.title}`) }),
    );
  }

  function paintAll() {
    paintRole();
    paintPicker();
    paintPhoto();
    paintResult();
  }

  const domSel = h('select', {
    'aria-label': '慣用手',
    onchange: (e) => {
      session.dominant = e.target.value;
      session.dirty = true;
      paintRole();
      paintResult();
    },
  }, h('option', { value: '', text: '不確定' }), h('option', { value: 'right', text: '右手' }), h('option', { value: 'left', text: '左手' }));
  domSel.value = session.dominant;
  paintAll();

  return [
    h(
      'section',
      { class: 'card' },
      cardHead(h, 'palm', `${p.name}的掌紋`, '看圖選線形，也可以拍照描線'),
      h('div', { class: 'row2' },
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: '看哪隻手' }), segmented({ name: 'palm-hand', label: '看哪隻手', value: session.hand, options: [{ value: 'right', label: '右手' }, { value: 'left', label: '左手' }], onChange: (v) => { session.hand = v; paintAll(); } })),
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: '慣用手' }), domSel)),
      roleLine,
      h('details', { class: 'more' }, h('summary', { text: '看哪隻手？怎麼看？' }), h('p', { class: 'small', text: PALM_HOW.school }), h('p', { class: 'small', text: PALM_HOW.pick })),
    ),
    h('section', { class: 'card' }, h('h2', { text: '看圖選線形' }), pickerBox),
    h('section', { class: 'card' }, cardHead(h, 'sparkle', '拍照描線（選用）', '照片不儲存、不上傳'), photoBox),
    h('section', { class: 'card' }, h('h2', { text: '掌紋解讀' }), resultBox),
  ];
}
