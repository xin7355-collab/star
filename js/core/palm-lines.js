// 自動描掌紋：照三個校正點把掌心「拉正」，在每條線該出現的那一帶，找一條最暗、最連續的路。
//
// 為什麼不用機器學習模型：查得到的掌紋切割模型多半只限研究用途、授權不清楚，不能放進公開的 App；
// 掌紋是掌心最深的幾條暗溝，位置有固定範圍（感情線在指根下面橫過、智慧線在它下面、生命線圍著拇指根、
// 事業線從手腕往中指直上），「拉正＋找最暗的連續路徑」就抓得到大部分。結果只當建議：畫面上畫成虛線，
// 使用者對照照片，不對就自己描（會取代自動那條）。
//
// 座標和描線一樣：u＝0 小指根、1 食指根（往拇指那側大於 1），v＝0 指根連線、1 手腕。
// 純函式（輸入灰階陣列），可在 Node 測試；1280px 的照片在手機上整套約幾十毫秒。

const STEP = 0.005; // 網格一格＝0.005 個掌寬：掌寬 400px 時一格 2px，掌紋寬 3～10px，看得清楚又不浪費
const U0 = -0.2;
const U1 = 1.25;
const V0 = -0.08;
const V1 = 1.1;
const COLS = Math.round((U1 - U0) / STEP) + 1;
const ROWS = Math.round((V1 - V0) / STEP) + 1;
const col = (u) => Math.round((u - U0) / STEP);
const row = (v) => Math.round((v - V0) / STEP);
const uOf = (c) => U0 + c * STEP;
const vOf = (r) => V0 + r * STEP;

/** 方框平均（積分圖，半徑 rad 像素） */
function boxMean(gray, w, h, rad) {
  const W1 = w + 1;
  const sat = new Float64Array(W1 * (h + 1));
  for (let y = 1; y <= h; y += 1) {
    let acc = 0;
    for (let x = 1; x <= w; x += 1) {
      acc += gray[(y - 1) * w + x - 1];
      sat[y * W1 + x] = sat[(y - 1) * W1 + x] + acc;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - rad);
    const y1 = Math.min(h, y + rad + 1);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - rad);
      const x1 = Math.min(w, x + rad + 1);
      out[y * w + x] = (sat[y1 * W1 + x1] - sat[y0 * W1 + x1] - sat[y1 * W1 + x0] + sat[y0 * W1 + x0]) / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

/**
 * 暗紋強度（在原照片上、用正方形的像素算）：每一點比周圍（半徑 0.035 掌寬）暗多少，除以周圍亮度（陰影裡的線也找得到）。
 * 為什麼不在拉正後的網格上算：手掌長大約是寬的 1.5 倍，網格在掌長方向每格比較大，橫的感情線、智慧線
 * 只剩兩格寬，一做平均就被稀釋（測試裡很淡的感情線、智慧線幾乎都找不到，直的生命線卻找得到）。
 * @param pw 掌寬（像素）
 */
export function relDarkness(gray, w, h, pw) {
  const small = boxMean(gray, w, h, Math.max(1, Math.round(pw * 0.003)));
  const big = boxMean(gray, w, h, Math.max(4, Math.round(pw * 0.035)));
  const rel = new Float32Array(w * h);
  for (let i = 0; i < rel.length; i += 1) rel[i] = (big[i] - small[i]) / Math.max(big[i], 8);
  return rel;
}

/** 照校正框把一張逐點的圖取樣成 UV 網格（雙線性內插）；照片外面的格子記成 NaN */
export function sampleGrid(src, w, h, frame) {
  const o = frame.toXY([U0, V0]);
  const pu = frame.toXY([U0 + STEP, V0]);
  const pv = frame.toXY([U0, V0 + STEP]);
  const ax = pu[0] - o[0];
  const ay = pu[1] - o[1];
  const bx = pv[0] - o[0];
  const by = pv[1] - o[1];
  const g = new Float32Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const x = o[0] + ax * c + bx * r;
      const y = o[1] + ay * c + by * r;
      if (!(x >= 0 && y >= 0 && x <= w - 1 && y <= h - 1)) {
        g[r * COLS + c] = NaN;
        continue;
      }
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const i = y0 * w + x0;
      const dx = x0 < w - 1 ? 1 : 0;
      const dy = y0 < h - 1 ? w : 0;
      g[r * COLS + c] = (src[i] * (1 - fx) + src[i + dx] * fx) * (1 - fy) + (src[i + dy] * (1 - fx) + src[i + dy + dx] * fx) * fy;
    }
  }
  return g;
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = Float64Array.from(arr).sort();
  return s[Math.floor(s.length / 2)];
};

/**
 * 暗紋強度換成 z 分數：除以掌心皮膚紋理的雜訊大小（中位數絕對差，掌紋本身不會把它拉高）。
 * 掌紋是細細的暗溝，z 會明顯大於皮膚紋理；不同光線、不同手機拍的照片都用同一套門檻。
 */
export function zScores(relGrid) {
  const core = [];
  for (let r = row(0.05); r <= row(0.95); r += 2) for (let c = col(0.05); c <= col(0.95); c += 2) {
    const v = relGrid[r * COLS + c];
    if (!Number.isNaN(v)) core.push(v);
  }
  const med = median(core);
  const sigma = Math.max(1.4826 * median(core.map((v) => Math.abs(v - med))), 0.004);
  const z = new Float32Array(COLS * ROWS);
  for (let i = 0; i < z.length; i += 1) z[i] = Number.isNaN(relGrid[i]) ? NaN : (relGrid[i] - med) / sigma;
  return z;
}

/**
 * 動態規劃找路：沿「步」方向一步一步走（橫線每一欄、直線每一列），每一步在允許的範圍裡選一格，
 * 讓整條路越暗越好、轉彎越少越好（每步最多偏 maxStep 格，偏一格多算 turn 的成本）。
 * @param {number} n 步數
 * @param {(i:number)=>[number,number]} band 第 i 步可以選的格子範圍（另一個方向的格子編號，含兩端）
 * @param {(i:number, j:number)=>number} cost 第 i 步選第 j 格的成本（越暗越小）
 * @returns {number[]} 每一步選的格子
 */
function bestPath(n, band, cost, maxStep, turn) {
  const bands = Array.from({ length: n }, (_, i) => band(i));
  let prev = null;
  let prevBand = null;
  const back = [];
  for (let i = 0; i < n; i += 1) {
    const [lo, hi] = bands[i];
    const acc = new Float32Array(hi - lo + 1);
    const bk = new Int16Array(hi - lo + 1);
    for (let j = lo; j <= hi; j += 1) {
      let best = Infinity;
      let arg = j;
      if (prev) {
        for (let d = -maxStep; d <= maxStep; d += 1) {
          const k = j + d;
          if (k < prevBand[0] || k > prevBand[1]) continue;
          const v = prev[k - prevBand[0]] + turn * Math.abs(d);
          if (v < best) {
            best = v;
            arg = k;
          }
        }
        if (best === Infinity) {
          // 這一步的範圍和上一步接不起來（範圍突然跳開）：接最近的那一格
          const k = Math.min(prevBand[1], Math.max(prevBand[0], j));
          best = prev[k - prevBand[0]] + turn * Math.abs(k - j);
          arg = k;
        }
      } else best = 0;
      acc[j - lo] = best + cost(i, j);
      bk[j - lo] = arg;
    }
    back.push(bk);
    prev = acc;
    prevBand = bands[i];
  }
  let j = prevBand[0];
  for (let k = prevBand[0]; k <= prevBand[1]; k += 1) if (prev[k - prevBand[0]] < prev[j - prevBand[0]]) j = k;
  const path = new Array(n);
  for (let i = n - 1; i >= 0; i -= 1) {
    path[i] = j;
    j = back[i][j - bands[i][0]];
  }
  return path;
}

/** 沿路的深淺：每一點取左右各一格裡最暗的（容許一格的偏差），再做 5 點移動平均 */
function profile(z, cells) {
  const raw = cells.map(([c, r], i) => {
    const [nc, nr] = i + 1 < cells.length ? cells[i + 1] : cells[i - 1] || cells[i];
    // 和走向垂直的方向找左右一格
    const horizontal = Math.abs(nc - c) >= Math.abs(nr - r);
    let best = -Infinity;
    for (let d = -1; d <= 1; d += 1) {
      const cc = horizontal ? c : c + d;
      const rr = horizontal ? r + d : r;
      if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
      const v = z[rr * COLS + cc];
      if (!Number.isNaN(v) && v > best) best = v;
    }
    return best === -Infinity ? 0 : best;
  });
  return raw.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(raw.length - 1, i + 2); k += 1) {
      s += raw[k];
      n += 1;
    }
    return s / n;
  });
}

/** 夠深的連續段：深度 ≥ tau，中間斷開不到 gap 步的接起來；回傳 [{a, b, mean}]（步的編號，含兩端） */
function runs(prof, tau, gap) {
  const out = [];
  let cur = null;
  prof.forEach((v, i) => {
    if (v >= tau) {
      if (cur && i - cur.b - 1 <= gap) cur.b = i;
      else {
        cur = { a: i, b: i };
        out.push(cur);
      }
    }
  });
  for (const r of out) {
    let s = 0;
    for (let i = r.a; i <= r.b; i += 1) s += prof[i];
    r.mean = s / (r.b - r.a + 1);
  }
  return out;
}

// 每一條線：從哪裡走到哪裡、每一步可以在哪個範圍、轉彎多難、要多深才算數
const MIN_Z = 3.5; // 沿路平均深度至少比皮膚紋理深 3.5 個標準差才算一條線：2.2 時空白手掌的雜紋會被串成假線（tests/palm-lines.test.js）
const STRONG_Z = 4; // 事業線常常沒有或很淡：要更深才算
const MIN_LEN = 0.15; // 主線至少 0.15 個掌寬（最短的範本也有 0.38）；雜紋串起來的假線通常比這短

/** UV 點列（每 4 步取一點，頭尾一定留） */
function toStroke(cells, a, b) {
  const pts = [];
  for (let i = a; i <= b; i += 4) pts.push([uOf(cells[i][0]), vOf(cells[i][1])]);
  const last = [uOf(cells[b][0]), vOf(cells[b][1])];
  const end = pts[pts.length - 1];
  if (!end || end[0] !== last[0] || end[1] !== last[1]) pts.push(last);
  return pts;
}

const lenOf = (cells, a, b) => {
  let s = 0;
  for (let i = a + 1; i <= b; i += 1) s += Math.hypot(cells[i][0] - cells[i - 1][0], cells[i][1] - cells[i - 1][1]);
  return s * STEP;
};

/**
 * 在照片上找四條主線。
 * @param {Uint8Array|Uint8ClampedArray|Float32Array} gray 灰階（w×h）
 * @param {{toXY:Function}} frame palmFrame 的結果
 * @returns {{strokes:{life?:number[][][], head?:number[][][], heart?:number[][][], fate?:number[][][]}, score:object, simianHint:boolean}}
 *   strokes 是 UV 座標的筆畫（和手描的一樣，可以直接交給 classifyStrokes）；找不到的線不會出現
 */
export function traceLines(gray, w, h, frame) {
  const pw = Math.hypot(...frame.toXY([1, 0]).map((v, i) => v - frame.toXY([0, 0])[i]));
  const z = zScores(sampleGrid(relDarkness(gray, w, h, pw), w, h, frame));
  const zAt = (c, r) => {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return NaN;
    return z[r * COLS + c];
  };
  // 成本：越暗越小；照片外面很貴（不要走出去）
  const cellCost = (c, r) => {
    const v = zAt(c, r);
    return Number.isNaN(v) ? 1.5 : 1 - Math.min(1, Math.max(0, v) / 6);
  };
  const strokes = {};
  const score = {};
  const stepTau = (prof) => {
    const sorted = [...prof].sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)] || 0;
    return Math.max(MIN_Z * 0.8, 0.4 * p90);
  };

  // ── 生命線：由上往下（v 0.30→1.04），每一列在拇指那側 u 0.66～1.16 選一格
  const lifeR0 = row(0.3);
  const lifeR1 = row(1.04);
  const lifeN = lifeR1 - lifeR0 + 1;
  const lifePath = bestPath(lifeN, () => [col(0.66), col(1.16)], (i, j) => cellCost(j, lifeR0 + i), 2, 0.05);
  const lifeCells = lifePath.map((c, i) => [c, lifeR0 + i]);
  {
    const prof = profile(z, lifeCells);
    // 斷開的生命線縫隙常常只有 0.06 掌寬：接縫的容許只到 6 步（0.03），不然斷開的會被接成一條
    const rs = runs(prof, stepTau(prof), 6).filter((r) => lenOf(lifeCells, r.a, r.b) >= 0.08);
    // 生命線從拇指和食指之間開始：主要那段要從上面（v ≤ 0.55）開始
    const main = rs.find((r) => vOf(lifeCells[r.a][1]) <= 0.55 && r.mean >= MIN_Z && lenOf(lifeCells, r.a, r.b) >= MIN_LEN);
    if (main) {
      strokes.life = [toStroke(lifeCells, main.a, main.b)];
      score.life = main.mean;
      // 斷開：主要那段下面還有一段夠長、夠深的
      const second = rs.find((r) => r.a > main.b + 6 && lenOf(lifeCells, r.a, r.b) >= 0.12 && r.mean >= MIN_Z);
      if (second) strokes.life.push(toStroke(lifeCells, second.a, second.b));
    }
  }

  // ── 感情線：從小指那側往食指（u −0.12→1.04）；接近食指時可以往上彎（v 到 −0.01）。
  // 越靠拇指那側，最低只能到 v 0.27：智慧線從拇指和食指之間（v≈0.33）出發，範圍太寬時感情線會整條接到智慧線上
  // （測試抓到：中等長度的感情線被截短、低對比時智慧線被搶走）。每步最多偏一格，不能一下跳到另一條線。
  // 指根的橫紋在 v≈0：靠近它多算一點成本，免得把指根紋當成感情線的尾巴
  const heartC0 = col(-0.12);
  const heartC1 = col(1.04);
  const heartN = heartC1 - heartC0 + 1;
  const heartLow = (u) => (u <= 0.25 ? 0.4 : u >= 0.55 ? 0.27 : 0.4 - ((u - 0.25) / 0.3) * 0.13);
  const heartBand = (i) => {
    const u = uOf(heartC0 + i);
    return [row(u <= 0.7 ? 0.07 : -0.01), row(heartLow(u))];
  };
  const heartPath = bestPath(heartN, heartBand, (i, j) => cellCost(heartC0 + i, j) + (vOf(j) < 0.05 ? 0.3 : 0), 1, 0.04);
  const heartCells = heartPath.map((r, i) => [heartC0 + i, r]);
  let heartRun = null;
  {
    const prof = profile(z, heartCells);
    const rs = runs(prof, stepTau(prof), 8).filter((r) => lenOf(heartCells, r.a, r.b) >= 0.08);
    heartRun = rs.find((r) => uOf(heartCells[r.a][0]) <= 0.15 && r.mean >= MIN_Z && lenOf(heartCells, r.a, r.b) >= MIN_LEN) || null;
    if (heartRun) {
      strokes.heart = [toStroke(heartCells, heartRun.a, heartRun.b)];
      score.heart = heartRun.mean;
    }
  }

  // ── 智慧線：從拇指那側往小指（u 1.08→−0.04），在感情線下面（至少 0.07）到 v 0.80；
  // 生命線開頭和智慧線常常連在一起，所以只在離開拇指根之後（u < 0.97）避開生命線
  const heartVAt = new Map();
  if (heartRun) for (let i = heartRun.a; i <= heartRun.b; i += 1) heartVAt.set(heartCells[i][0], vOf(heartCells[i][1]));
  const lifeAvoid = new Set();
  if (strokes.life) {
    for (const [c, r] of lifeCells) {
      if (uOf(c) >= 0.97) continue;
      for (let dc = -6; dc <= 6; dc += 1) for (let dr = -6; dr <= 6; dr += 1) lifeAvoid.add((r + dr) * COLS + (c + dc));
    }
  }
  const headC0 = col(1.08);
  const headC1 = col(-0.04);
  const headN = headC0 - headC1 + 1;
  const headBand = (i) => {
    const c = headC0 - i;
    const hv = heartVAt.get(c);
    return [row(Math.max(0.24, hv === undefined ? 0 : hv + 0.07)), row(0.8)];
  };
  const headPath = bestPath(headN, headBand, (i, j) => {
    const c = headC0 - i;
    return cellCost(c, j) + (lifeAvoid.has(j * COLS + c) ? 1 : 0);
  }, 1, 0.06);
  const headCells = headPath.map((r, i) => [headC0 - i, r]);
  {
    const prof = profile(z, headCells);
    const rs = runs(prof, stepTau(prof), 8).filter((r) => lenOf(headCells, r.a, r.b) >= 0.08);
    const main = rs.find((r) => uOf(headCells[r.a][0]) >= 0.82 && r.mean >= MIN_Z && lenOf(headCells, r.a, r.b) >= MIN_LEN);
    if (main) {
      strokes.head = [toStroke(headCells, main.a, main.b)];
      score.head = main.mean;
    }
  }

  // ── 事業線：從手腕往上（v 1.04→0.12），每一列在 u 0.32～0.70；幾乎是直的。避開生命線（細的時候會被吸過去）。
  // 常常沒有或很淡：每一段要夠深，而且幾段加起來要有 0.25 掌寬才算有；斷成幾段的照順序全留（判定成「斷續」）
  const fateR0 = row(1.04);
  const fateR1 = row(0.12);
  const fateN = fateR0 - fateR1 + 1;
  const lifeNear = new Set();
  if (strokes.life) for (const [c, r] of lifeCells) for (let dc = -7; dc <= 7; dc += 1) lifeNear.add(r * COLS + (c + dc));
  const fatePath = bestPath(fateN, () => [col(0.32), col(0.7)], (i, j) => {
    const r = fateR0 - i;
    return cellCost(j, r) + (lifeNear.has(r * COLS + j) ? 1 : 0);
  }, 1, 0.08);
  const fateCells = fatePath.map((c, i) => [c, fateR0 - i]);
  {
    const prof = profile(z, fateCells);
    const rs = runs(prof, stepTau(prof), 8).filter((r) => lenOf(fateCells, r.a, r.b) >= 0.12 && r.mean >= STRONG_Z);
    const total = rs.reduce((acc, r) => acc + lenOf(fateCells, r.a, r.b), 0);
    if (total >= 0.25) {
      strokes.fate = rs.slice(0, 3).map((r) => toStroke(fateCells, r.a, r.b));
      score.fate = Math.max(...rs.map((r) => r.mean));
    }
  }

  // 斷掌的提示（不自動判定，請使用者對照照片）：
  // 一條橫線被拆成兩半時，感情線的尾巴和智慧線的尾巴會在掌心中間接在一起；
  // 或只找到一條「感情線」、而且它在掌心中間的位置偏低（v ≥ 0.25，一般感情線在 0.16～0.22）
  const heartS = strokes.heart ? strokes.heart[0] : null;
  const headS = strokes.head ? strokes.head[0] : null;
  const vAtMid = (s) => s.reduce((a, p) => (Math.abs(p[0] - 0.5) < Math.abs(a[0] - 0.5) ? p : a))[1];
  const simianHint = !!heartS && (headS
    ? Math.hypot(heartS[heartS.length - 1][0] - headS[headS.length - 1][0], heartS[heartS.length - 1][1] - headS[headS.length - 1][1]) < 0.06
    : vAtMid(heartS) >= 0.25);
  return { strokes, score, simianHint };
}
