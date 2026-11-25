// 掌紋：線形選項、照片描線的量測與判定、斷掌、左右手比較。全部是純函式，可在 Node 測試。
// 為什麼不用 AI 自動辨識：X-Ray 看過的掌紋專案都沒有真的認出掌紋（只在固定位置算亮度），
// 手部關節模型也不會找掌紋。所以改成「看圖自選」為主、「照片描線」為輔：線在哪裡由使用者的眼睛決定，
// App 只負責量長度、彎度、起訖，照片也完全不必離開手機。

// ── 座標：掌心框（u, v）
// u：小指根部＝0、食指根部＝1（拇指那側大於 1）；v：指根連線＝0、手腕橫紋中間＝1。
// 左右手都用「小指 → 食指」當 u 的方向，所以同一套範本與判定規則左右手通用，畫圖時再鏡像。

/** 三個校正點（食指根部、小指根部、手腕中間，像素座標）→ 掌心框；三點太近或幾乎一直線回傳 null */
export function palmFrame({ index, pinky, wrist }) {
  const ex = [index[0] - pinky[0], index[1] - pinky[1]];
  const mid = [(index[0] + pinky[0]) / 2, (index[1] + pinky[1]) / 2];
  const ey = [wrist[0] - mid[0], wrist[1] - mid[1]];
  const width = Math.hypot(ex[0], ex[1]);
  const length = Math.hypot(ey[0], ey[1]);
  const det = ex[0] * ey[1] - ex[1] * ey[0];
  // 手腕要離指根連線夠遠（夾角太小代表三點幾乎一直線），兩根手指也不能點在同一處
  if (width < 1e-6 || length < 1e-6 || Math.abs(det) / (width * length) < 0.5 || length / width < 0.6 || length / width > 3.5) return null;
  return {
    width,
    // 照片看起來是哪隻手：掌心朝鏡頭時，右手的食指在小指的右側（照片怎麼轉都一樣，只有左右翻過的照片會相反）。
    // 用來提醒「選左手卻拍了右手」：男左女右之下描錯手，解讀就整個看錯手
    side: det > 0 ? 'right' : 'left',
    toUV([x, y]) {
      // P = 小指根部 + u·ex + v·ey，用克拉瑪公式解 2×2 方程式
      const rx = x - pinky[0];
      const ry = y - pinky[1];
      return [(rx * ey[1] - ry * ey[0]) / det, (ex[0] * ry - ex[1] * rx) / det];
    },
    toXY([u, v]) {
      return [pinky[0] + u * ex[0] + v * ey[0], pinky[1] + u * ex[1] + v * ey[1]];
    },
  };
}

// ── 範本線形（u, v 控制點）：看圖自選的縮圖、結果圖都用這些點畫，判定規則也拿它們自我檢查
const P = (...pts) => pts;
export const TEMPLATES = {
  life: {
    'long-wide': [P([1.04, 0.34], [0.86, 0.5], [0.78, 0.7], [0.82, 0.88], [0.9, 1.0])],
    'long-narrow': [P([1.04, 0.34], [0.97, 0.5], [0.93, 0.7], [0.95, 0.88], [0.98, 0.99])],
    short: [P([1.04, 0.34], [0.88, 0.48], [0.82, 0.62])],
    broken: [P([1.04, 0.34], [0.87, 0.49], [0.81, 0.6]), P([0.75, 0.66], [0.77, 0.82], [0.85, 0.98])],
    double: [P([1.04, 0.34], [0.86, 0.5], [0.78, 0.7], [0.82, 0.88], [0.9, 1.0]), P([0.96, 0.46], [0.86, 0.6], [0.85, 0.76], [0.9, 0.9])],
  },
  head: {
    straight: [P([1.03, 0.33], [0.7, 0.36], [0.35, 0.38], [0.04, 0.4])],
    slope: [P([1.03, 0.33], [0.72, 0.38], [0.42, 0.5], [0.16, 0.66])],
    short: [P([1.03, 0.33], [0.8, 0.35], [0.56, 0.37])],
    fork: [P([1.03, 0.33], [0.7, 0.36], [0.4, 0.38], [0.12, 0.38]), P([0.4, 0.38], [0.25, 0.46], [0.12, 0.54])],
  },
  heart: {
    'long-curve': [P([-0.12, 0.22], [0.2, 0.2], [0.5, 0.18], [0.78, 0.11], [0.95, 0.02])],
    'long-straight': [P([-0.12, 0.22], [0.3, 0.21], [0.65, 0.2], [1.0, 0.19])],
    mid: [P([-0.12, 0.22], [0.2, 0.2], [0.45, 0.16], [0.66, 0.08])],
    short: [P([-0.12, 0.22], [0.15, 0.2], [0.35, 0.17], [0.48, 0.13])],
    fork: [P([-0.12, 0.22], [0.2, 0.2], [0.5, 0.18], [0.78, 0.11], [0.92, 0.03]), P([0.6, 0.16], [0.75, 0.17], [0.9, 0.2])],
  },
  fate: {
    wrist: [P([0.55, 1.0], [0.56, 0.72], [0.58, 0.45], [0.6, 0.2])],
    mid: [P([0.56, 0.62], [0.58, 0.42], [0.6, 0.2])],
    broken: [P([0.55, 1.0], [0.56, 0.78]), P([0.58, 0.7], [0.59, 0.48]), P([0.6, 0.42], [0.61, 0.22])],
    none: [],
  },
  // 斷掌：真斷掌是一條橫線取代感情線和智慧線；半斷掌是兩線之間有一段接起來
  simian: {
    full: [P([-0.12, 0.26], [0.3, 0.29], [0.68, 0.31], [1.03, 0.33])],
    half: [P([0.44, 0.17], [0.43, 0.27], [0.42, 0.37])],
    none: [],
  },
};
// 智慧線起點和生命線分開時，智慧線起點往上移（範本與縮圖用）
export const HEAD_APART_START = [0.9, 0.28];

// ── 選項（id 會存進名單，改名要相容舊資料）。order 是看圖自選的步驟順序：先看有沒有斷掌，真斷掌就略過感情線與智慧線
export const PALM_FIELDS = [
  { id: 'simian', label: '斷掌', options: ['none', 'half', 'full'] },
  { id: 'life', label: '生命線', options: ['long-wide', 'long-narrow', 'short', 'broken', 'double'] },
  { id: 'head', label: '智慧線', options: ['straight', 'slope', 'short', 'fork'] },
  { id: 'start', label: '智慧線起點', options: ['joined', 'apart'] },
  { id: 'heart', label: '感情線', options: ['long-curve', 'long-straight', 'mid', 'short', 'fork'] },
  { id: 'fate', label: '事業線', options: ['wrist', 'mid', 'broken', 'none'] },
  { id: 'shape', label: '掌形', options: ['square-short', 'square-long', 'long-long', 'long-short'] },
  { id: 'thick', label: '手掌厚薄', options: ['thick', 'medium', 'thin'] },
];
// 真斷掌時不另外看的欄位
const MERGED_BY_SIMIAN = ['head', 'start', 'heart'];

/** 這一隻手要問哪些欄位（真斷掌就不問感情線、智慧線、智慧線起點） */
export function activeFields(picks) {
  return PALM_FIELDS.filter((f) => !(picks && picks.simian === 'full' && MERGED_BY_SIMIAN.includes(f.id)));
}

/** 一隻手的選項白名單：只收已知欄位與選項，其他丟掉 */
export function sanitizePicks(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const f of PALM_FIELDS) if (typeof raw[f.id] === 'string' && f.options.includes(raw[f.id])) out[f.id] = raw[f.id];
  if (out.simian === 'full') for (const k of MERGED_BY_SIMIAN) delete out[k];
  return out;
}

// 看哪隻手的三種看法：都有人用、沒有公認的對錯（查到的多是一般網站，找不到可靠的古籍出處），畫面上講清楚用哪一種
// - gender：傳統「男左女右」（左屬陽看男、右屬陰看女），另一隻手當參考
// - side：「左手先天、右手後天」，不分男女
// - dominant：現代西洋手相，慣用手看後天、另一隻手看先天
export const HAND_SCHOOLS = [
  { id: 'gender', label: '男左女右' },
  { id: 'side', label: '左先天右後天' },
  { id: 'dominant', label: '看慣用手' },
];
const SCHOOL_IDS = HAND_SCHOOLS.map((x) => x.id);

/** 存進名單的掌紋資料（不含照片，照片從不儲存）；什麼都沒選回傳 null，名單就不多存一欄 */
export function sanitizePalm(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const left = sanitizePicks(raw.left);
  const right = sanitizePicks(raw.right);
  const dominant = raw.dominant === 'left' || raw.dominant === 'right' ? raw.dominant : '';
  const school = SCHOOL_IDS.includes(raw.school) ? raw.school : '';
  if (!Object.keys(left).length && !Object.keys(right).length && !dominant && !school) return null;
  return { school, dominant, left, right };
}

/** 依看法決定主要看哪隻手：男左女右看性別、慣用手派看慣用手；「左先天右後天」兩手並重，回傳 null */
export function mainHand(school, { gender = '', dominant = '' } = {}) {
  if (school === 'gender') return gender === '男' ? 'left' : gender === '女' ? 'right' : null;
  if (school === 'dominant') return dominant === 'left' || dominant === 'right' ? dominant : null;
  return null;
}

// ── 描線的量測
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function pathLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i += 1) s += dist(pts[i - 1], pts[i]);
  return s;
}
/** 走到一半路程的那個點（判斷彎曲方向用） */
function midPoint(pts) {
  const half = pathLength(pts) / 2;
  let s = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const d = dist(pts[i - 1], pts[i]);
    if (s + d >= half) {
      const t = d ? (half - s) / d : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    s += d;
  }
  return pts[pts.length - 1];
}
/** 點到線段的距離 */
function segDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
/** 兩條折線最近的距離（斷掌判定：感情線、智慧線有沒有碰在一起） */
export function polylineGap(a, b) {
  let best = Infinity;
  for (const p of a) for (let i = 1; i < b.length; i += 1) best = Math.min(best, segDist(p, b[i - 1], b[i]));
  for (const p of b) for (let i = 1; i < a.length; i += 1) best = Math.min(best, segDist(p, a[i - 1], a[i]));
  return best;
}

/**
 * 手指描的點太密（每個觸控事件一點）：只留彼此相距 step 以上的點，量測與儲存都比較穩。
 * 太短的描線（不到 0.08 個掌寬）當成誤觸，回傳 null。
 */
export function simplifyStroke(pts, step = 0.015) {
  if (!Array.isArray(pts) || pts.length < 2) return null;
  const out = [pts[0]];
  for (const p of pts.slice(1)) if (dist(p, out[out.length - 1]) >= step) out.push(p);
  const last = pts[pts.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return pathLength(out) < 0.08 ? null : out;
}

/**
 * 依描線判斷線形（strokes：同一條線的一到多筆，每筆是 u, v 點列）。判斷不出來回傳 null。
 * 規則刻意簡單，門檻寫在 docs/DECISIONS.md；描線本來就不精確，只當「建議」，使用者可以再改。
 */
export function classifyStrokes(field, strokes) {
  const list = (strokes || []).filter((s) => Array.isArray(s) && s.length >= 2);
  if (!list.length) return null;
  if (field === 'life') {
    if (list.length >= 2) {
      // 兩筆的上下範圍重疊多＝平行的姊妹線；前後接續＝斷開
      const range = (s) => [Math.min(...s.map((p) => p[1])), Math.max(...s.map((p) => p[1]))];
      const [a, b] = [range(list[0]), range(list[1])];
      const overlap = Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
      return overlap >= 0.2 ? 'double' : 'broken';
    }
    const s = list[0];
    const [top, bottom] = s[0][1] <= s[s.length - 1][1] ? [s[0], s[s.length - 1]] : [s[s.length - 1], s[0]];
    if (bottom[1] < 0.72) return 'short';
    const minU = Math.min(...s.map((p) => p[0]));
    return top[0] - minU >= 0.18 ? 'long-wide' : 'long-narrow';
  }
  if (field === 'head') {
    if (list.length >= 2) return 'fork';
    const s = list[0];
    const [start, end] = s[0][0] >= s[s.length - 1][0] ? [s[0], s[s.length - 1]] : [s[s.length - 1], s[0]];
    if (end[1] - start[1] >= 0.18) return 'slope';
    return start[0] - end[0] < 0.6 ? 'short' : 'straight';
  }
  if (field === 'heart') {
    if (list.length >= 2) return 'fork';
    const s = list[0];
    const end = s[0][0] >= s[s.length - 1][0] ? s[0] : s[s.length - 1];
    if (end[0] >= 0.85) return end[1] < midPoint(s)[1] - 0.06 ? 'long-curve' : 'long-straight';
    return end[0] >= 0.58 ? 'mid' : 'short';
  }
  if (field === 'fate') {
    if (list.length >= 2) return 'broken';
    const s = list[0];
    const bottom = Math.max(s[0][1], s[s.length - 1][1]);
    return bottom >= 0.85 ? 'wrist' : 'mid';
  }
  return null;
}

/**
 * 整隻手的描線 → 建議的選項。traces：{ life:[stroke…], head, heart, fate, simian }（u, v 座標）。
 * 斷掌：描了「斷掌線」＝真斷掌；感情線和智慧線有一段距離不到 0.035 個掌寬＝半斷掌。
 */
export function suggestPicks(traces) {
  const t = traces || {};
  const out = {};
  for (const field of ['life', 'head', 'heart', 'fate']) {
    const r = classifyStrokes(field, t[field]);
    if (r) out[field] = r;
  }
  if ((t.simian || []).length) {
    out.simian = 'full';
    delete out.head;
    delete out.heart;
  } else if ((t.heart || []).length && (t.head || []).length) {
    const gap = Math.min(...t.heart.flatMap((a) => t.head.map((b) => polylineGap(a, b))));
    out.simian = gap < 0.035 ? 'half' : 'none';
  }
  if (out.simian !== 'full' && (t.head || []).length && (t.life || []).length) {
    // 智慧線靠拇指那端、生命線上端：兩端相距不到 0.09 算相連
    const headStart = t.head[0].reduce((a, p) => (p[0] > a[0] ? p : a));
    const lifeTop = t.life[0].reduce((a, p) => (p[1] < a[1] ? p : a));
    out.start = dist(headStart, lifeTop) < 0.09 ? 'joined' : 'apart';
  }
  return out;
}

// 每條描線會影響哪些選項：斷掌要合看感情線、智慧線；智慧線起點要合看智慧線、生命線
const AFFECTS = {
  life: ['life', 'start'],
  head: ['head', 'simian', 'start'],
  heart: ['heart', 'simian'],
  fate: ['fate'],
  simian: ['simian', 'head', 'heart', 'start'],
};
export const TRACE_LINES = Object.keys(AFFECTS);

/**
 * 把描線建議併進目前的選項（修掉「描感情線時，自己改過的生命線被蓋回去」）。
 * - 只動這次有變動的線影響到的欄位。
 * - 自己改過的欄位（和上次自動填的不一樣）：只有那條線本身重描、清掉或復原時才換成新的判斷；
 *   斷掌、智慧線起點這種要合看兩條線的，自己選過就保留。
 * - 判斷消失（線清掉、復原到沒描）：自動填的拿掉，自己選的留著。
 * @param {object} cur 目前的選項
 * @param {object} applied 上次自動填進去的值
 * @param {object} sug suggestPicks 的結果
 * @param {string[]} changed 這次有變動的線（校正點變了就傳所有描過的線）
 * @returns {{picks:object, applied:object}}
 */
export function mergeSuggestions(cur, applied, sug, changed) {
  const picks = { ...cur };
  const next = { ...applied };
  const lines = (changed || []).filter((l) => AFFECTS[l]);
  for (const k of new Set(lines.flatMap((l) => AFFECTS[l]))) {
    const own = lines.includes(k);
    const auto = picks[k] === undefined || picks[k] === applied[k];
    if (sug[k] !== undefined) {
      if (auto || own) picks[k] = sug[k];
      next[k] = sug[k];
    } else {
      if (auto) delete picks[k];
      delete next[k];
    }
  }
  return { picks: sanitizePicks(picks), applied: next };
}

/**
 * 「加強掌紋」的顯示用影像：轉灰階後減掉周圍的平均亮度（局部對比），細細的暗線變深、大片明暗變平，
 * 再和原本的灰階混一點，手的輪廓才認得出來。只拿來顯示，判定一律用描線，不受影響。
 * 用積分圖算方框平均，整張圖只掃兩次；1280px 的照片在手機上不到一秒。
 * @param {Uint8ClampedArray|Uint8Array} rgba 原圖（RGBA）
 * @returns {Uint8ClampedArray} 同尺寸的 RGBA
 */
export function enhanceLines(rgba, w, h, { radius = Math.max(3, Math.round(Math.min(w, h) / 48)), gain = 3.5, mix = 0.4 } = {}) {
  const n = w * h;
  const gray = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i += 1, j += 4) gray[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  const W1 = w + 1;
  // 總和最大 255 × 1280 × 1280 ≈ 4.2 億，Uint32 放得下（照片讀進來時已經縮到 1280px 以內）
  const sat = new Uint32Array(W1 * (h + 1));
  for (let y = 1; y <= h; y += 1) {
    let row = 0;
    for (let x = 1; x <= w; x += 1) {
      row += gray[(y - 1) * w + x - 1];
      sat[y * W1 + x] = sat[(y - 1) * W1 + x] + row;
    }
  }
  const out = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w, x + radius + 1);
      const mean = (sat[y1 * W1 + x1] - sat[y0 * W1 + x1] - sat[y1 * W1 + x0] + sat[y0 * W1 + x0]) / ((x1 - x0) * (y1 - y0));
      const g = gray[y * w + x];
      const v = mix * g + (1 - mix) * (150 + (g - mean) * gain);
      const o = (y * w + x) * 4;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * 照片品質（只提醒、不擋）：亮度與反光看掌心範圍的灰階；手太小看掌寬占照片寬度的比例。
 * @param gray 掌心範圍的灰階值（0–255）陣列
 * @param palmShare 掌寬 ÷ 照片寬
 * @returns 最該先改善的一項提醒（沒有問題回傳 null）
 */
export function photoAdvice(gray, palmShare) {
  const tips = [];
  if (palmShare < 0.28) tips.push({ level: 3, text: '手在照片裡太小：請靠近一點，讓手掌占畫面一半以上再拍。' });
  if (gray && gray.length) {
    const mean = gray.reduce((a, b) => a + b, 0) / gray.length;
    const glare = gray.filter((g) => g >= 245).length / gray.length;
    if (mean < 60) tips.push({ level: 2, text: '照片太暗：請到窗邊或開燈，讓光從正面照在手掌上。' });
    else if (mean > 215) tips.push({ level: 2, text: '照片太亮：請避開直射的燈光或陽光，換個角度再拍。' });
    if (glare > 0.08) tips.push({ level: 1, text: '掌心有反光：把手掌稍微傾斜，或關掉閃光燈再拍。' });
  }
  tips.sort((a, b) => b.level - a.level);
  return tips[0] ? tips[0].text : null;
}

/** 兩手各欄位比較：選了且不同的才列出 */
export function compareHands(left, right) {
  const L = sanitizePicks(left);
  const R = sanitizePicks(right);
  return PALM_FIELDS.filter((f) => L[f.id] && R[f.id] && L[f.id] !== R[f.id]).map((f) => ({ field: f.id, label: f.label, left: L[f.id], right: R[f.id] }));
}

/**
 * 這一隻手在選定看法裡的角色：
 * main／ref（男左女右的主要手、參考手）；innate／acquired（先天、後天）；資料不夠判斷時回傳 null
 */
export function handRole(hand, { school = 'gender', gender = '', dominant = '' } = {}) {
  if (school === 'side') return hand === 'left' ? 'innate' : 'acquired';
  const main = mainHand(school, { gender, dominant });
  if (!main) return null;
  if (school === 'dominant') return hand === main ? 'acquired' : 'innate';
  return hand === main ? 'main' : 'ref';
}


/**
 * 手部關鍵點（MediaPipe Hand Landmarker 的 21 點，座標是 0～1 的比例）→ 描線用的三個校正點（照片像素）。
 * 0＝手腕、5／6＝食指的掌指關節／第一指節、17／18＝小指的掌指關節／第一指節。
 * 為什麼不直接用 5、17：掌指關節在手掌照片上落在掌心那一側（約在感情線附近），而「指根」是手指和手掌的交界，
 * 大約在掌指關節往第一指節 3 成的地方；直接用關節會讓掌心框短一截，量出來的線都偏長。
 * @returns {{index:number[], pinky:number[], wrist:number[]}|null} 關鍵點不完整回傳 null
 */
export function calibFromLandmarks(lm, w, h, k = 0.3) {
  if (!Array.isArray(lm) || lm.length < 21) return null;
  const P = (i) => [lm[i].x * w, lm[i].y * h];
  const toward = (a, b) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  return { index: toward(P(5), P(6)), pinky: toward(P(17), P(18)), wrist: P(0) };
}
