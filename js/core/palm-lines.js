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
  // 下限 0.008：太乾淨的影像（程式畫的範例手掌、極少雜訊）雜訊估計接近 0，膚色的漸層都會變成很深的「紋路」；
  // 手機照片的皮膚紋理和雜訊約 0.01 以上（合成照片量到 0.013～0.016），不受影響
  const sigma = Math.max(1.4826 * median(core.map((v) => Math.abs(v - med))), 0.008);
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
          // 這一步的範圍和上一步接不起來（範圍突然變寬或跳開）：接最近的那一格，但每跳一格要算 1.5 的成本
          // （比走一格最暗的路還貴）。以前只算轉彎的成本，點一下重描時路徑過了點的地方，會一步橫跳到旁邊的線上
          const k = Math.min(prevBand[1], Math.max(prevBand[0], j));
          best = prev[k - prevBand[0]] + 1.5 * Math.abs(k - j);
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

/** 夠深的連續段：深度 ≥ tau，中間斷開不到 gap 步的接起來；回傳 [{a, b, mean}]（步的編號，含兩端；mean 是這段的平均深度） */
function runs(prof, tau, gap) {
  const out = [];
  let cur = null;
  prof.forEach((v, i) => {
    if (v < tau) return;
    if (cur && i - cur.b - 1 <= gap) cur.b = i;
    else {
      cur = { a: i, b: i };
      out.push(cur);
    }
  });
  for (const r of out) {
    let sum = 0;
    for (let i = r.a; i <= r.b; i += 1) sum += prof[i];
    r.mean = sum / (r.b - r.a + 1);
  }
  return out;
}

/**
 * 把一段往兩頭延伸到還「像這條線」的地方：深度至少是這段平均的 55%（也至少 2.5）。
 * 55% 是擬真合成照片掃描出來的：45% 時生命線內側的平行淺紋（約主線一半深）會被接成生命線的延續，
 * 65% 時低對比照片裡淡掉的那段真線又會被截斷。
 * 真實的掌紋深淺不一，只用一個固定門檻會在淡的那段被截斷、線判得太短；但門檻固定放低（例如 2）又會接上雜訊，
 * 把斷開的線接成一條、空白手掌描出假線（擬真合成照片實測）。跟著這條線自己的深度走，兩邊都顧到。
 */
function extend(prof, r, gap, crossAt = null) {
  const lo = Math.max(2.5, 0.55 * r.mean);
  // 跨過淡掉的那一小段時，路徑如果橫著跳了一大步（超過 6 格、又比一步 1.5 格陡），接上的是旁邊另一條紋路，不延伸
  // （擬真照片：短生命線結束後，路徑在淡掉的地方跳到內側平行的淺紋，短生命線被判成長的）
  const jumped = (from, to) => {
    if (!crossAt) return false;
    const lateral = Math.abs(crossAt(to) - crossAt(from));
    return lateral > 6 && lateral > 1.5 * Math.abs(to - from);
  };
  let b = r.b;
  for (let i = r.b + 1, miss = 0; i < prof.length; i += 1) {
    if (prof[i] >= lo) {
      if (miss && jumped(b, i)) break;
      b = i;
      miss = 0;
    } else if ((miss += 1) > gap) break;
  }
  let a = r.a;
  for (let i = r.a - 1, miss = 0; i >= 0; i -= 1) {
    if (prof[i] >= lo) {
      if (miss && jumped(a, i)) break;
      a = i;
      miss = 0;
    } else if ((miss += 1) > gap) break;
  }
  return { ...r, a, b };
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
 * @param {{simian?:boolean}} [opts] simian：要不要找斷掌線（使用者清掉過自動描的斷掌線，就傳 false，改描感情線和智慧線）
 * @returns {{strokes:{life?:number[][][], head?:number[][][], heart?:number[][][], fate?:number[][][], simian?:number[][][]}, score:object, simianHint:boolean}}
 *   strokes 是 UV 座標的筆畫（和手描的一樣，可以直接交給 classifyStrokes）；找不到的線不會出現。
 *   找到斷掌線時，感情線和智慧線不會出現（斷掌線取代它們）
 */
/** 共用的前處理：暗紋 z 分數、每格的成本、找段（自動描、點一下重描都用） */
function prepare(gray, w, h, frame) {
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
  const p90 = (prof) => {
    const sorted = [...prof].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.9)] || 0;
  };
  const stepTau = (prof) => Math.max(MIN_Z * 0.8, 0.4 * p90(prof));
  // 先找夠深的核心段，再往兩頭延伸到還像這條線的地方；延伸後碰在一起、深度又差不多的合成一段（同一條線深淺起伏，
  // 不合的話會被當成斷開）。核心段本身至少 0.1 掌寬：空白手掌的短雜紋延伸後會被拉長到過門檻
  const segments = (prof, gap, cells, cross, tau = stepTau(prof), minCore = 0.1, fadeMerge = true) => {
    const ext = runs(prof, tau, gap)
      .filter((r) => lenOf(cells, r.a, r.b) >= minCore)
      .map((r) => extend(prof, r, gap, (i) => cross(cells[i])));
    const merged = [];
    for (const r of ext) {
      const last = merged[merged.length - 1];
      // 同一條線淡掉再出現，位置是連續的；換到旁邊平行的淺紋（生命線內側常有一條），路徑會先橫著跳一段。
      // 接縫兩邊橫向差超過 0.03 掌寬、又比一步一格陡，就不是同一條；深度差太多也不合
      const lateral = last ? Math.abs(cross(cells[r.a]) - cross(cells[last.b])) : 0;
      const jump = lateral > 6 && lateral > (r.a - last?.b) * 1;
      // 淡掉一段再出現（縫隙不到 0.12 掌寬、縫裡平均還有 2 個標準差深，比皮膚深）也是同一條：
      // 實拍照片的生命線中段淡了 0.1 掌寬（z 2～3），以前被判成「斷開的生命線」——斷開在手相上是很重的判斷，
      // 不能因為光線把淡的地方判成斷。真的斷開，縫裡是皮膚（z 0～1）。
      // 事業線不用這條：事業線本來就常常一段一段、縫很短又對齊，接起來會把「斷續」判成「從手腕起」
      let faded = false;
      if (fadeMerge && last && r.a > last.b + gap && r.a - last.b <= 24) {
        let sum = 0;
        for (let i = last.b + 1; i < r.a; i += 1) sum += prof[i];
        faded = sum / (r.a - last.b - 1) >= 2;
      }
      if (last && (r.a <= last.b + gap || faded) && !jump && Math.min(r.mean, last.mean) >= 0.6 * Math.max(r.mean, last.mean)) {
        const n1 = last.b - last.a + 1;
        const n2 = r.b - r.a + 1;
        last.mean = (last.mean * n1 + r.mean * n2) / (n1 + n2);
        last.b = Math.max(last.b, r.b);
      } else merged.push({ ...r });
    }
    return merged;
  };
  return { z, cellCost, segments, p90 };
}

export function traceLines(gray, w, h, frame, { simian = true } = {}) {
  const { z, cellCost, segments, p90 } = prepare(gray, w, h, frame);
  const strokes = {};
  const score = {};

  // ── 生命線：由上往下（v 0.28→1.04），每一列選一格。範圍跟著高度變：上段在拇指和食指之間（u 0.62～1.13），
  // 往下可以一路彎到掌心中間（u 0.44）——拇指根肉墊大、拇指張得開的人，生命線的弧會掃到掌心正中間
  // （使用者的實拍照片最寬到 u≈0.55；以前範圍只到 0.66，生命線被逼去描虎口的掌緣）。
  // 拇指那側最多到 1.08（下段 1.06）：再出去是虎口外面和拇指根肉墊的外緣，背景比皮膚亮或暗時那裡像一條暗線，
  // 範圍太寬會被它騙走（起點被拉到虎口外面，貼著拇指的生命線也會被判成弧線很寬）
  const lifeR0 = row(0.28);
  const lifeR1 = row(1.04);
  const lifeN = lifeR1 - lifeR0 + 1;
  const lerp = (v, v0, v1, a, b) => (v <= v0 ? a : v >= v1 ? b : a + ((v - v0) / (v1 - v0)) * (b - a));
  const lifeBand = (i) => {
    const v = vOf(lifeR0 + i);
    return [col(lerp(v, 0.35, 0.62, 0.62, 0.44)), col(lerp(v, 0.35, 0.5, 1.08, 1.06))];
  };
  const lifePath = bestPath(lifeN, lifeBand, (i, j) => cellCost(j, lifeR0 + i), 2, 0.05);
  const lifeCells = lifePath.map((c, i) => [c, lifeR0 + i]);
  {
    const prof = profile(z, lifeCells);
    // 斷開的生命線縫隙常常只有 0.06 掌寬：接縫的容許只到 6 步（0.03），不然斷開的會被接成一條。
    // 門檻只看手腕橫紋以上（v ≤ 0.88）：手腕的橫紋很深，路徑走到那裡會把「這條線多深」的估計拉高，
    // 生命線下段淡一點就被截掉（實拍照片：生命線只描到一半）
    const rs = segments(prof, 6, lifeCells, (q) => q[0], Math.max(MIN_Z * 0.8, 0.4 * p90(prof.slice(0, Math.max(1, row(0.88) - lifeR0)))));
    // 生命線從拇指和食指之間開始：主要那段要從上面開始（v ≤ 0.45），而且起點在拇指那側（u ≥ 0.66）。
    // 範圍放寬到掌心中間以後，從手腕直上的事業線也在範圍裡；事業線的上端在 u≈0.6，這條規則把它排除
    const main = rs.find((r) => vOf(lifeCells[r.a][1]) <= 0.45 && uOf(lifeCells[r.a][0]) >= 0.66 && r.mean >= MIN_Z && lenOf(lifeCells, r.a, r.b) >= MIN_LEN);
    if (main) {
      strokes.life = [toStroke(lifeCells, main.a, main.b)];
      score.life = main.mean;
      // 斷開：主要那段下面還有一段夠長、夠深的
      // 第二段要和主要那段差不多深、離得不遠，而且接得上（左右差不到 0.1 掌寬）：生命線內側常有一條平行的淺紋，
      // 短生命線結束後路徑會沿著它往下走；範圍放寬後，路徑也可能橫過去接上事業線
      const second = rs.find((r) => r.a > main.b + 6 && r.a - main.b <= 24 && lenOf(lifeCells, r.a, r.b) >= 0.12
        && r.mean >= MIN_Z && r.mean >= 0.7 * main.mean && Math.abs(uOf(lifeCells[r.a][0]) - uOf(lifeCells[main.b][0])) <= 0.1);
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
    const rs = segments(prof, 8, heartCells, (q) => q[1]);
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
    const rs = segments(prof, 8, headCells, (q) => q[1]);
    const main = rs.find((r) => uOf(headCells[r.a][0]) >= 0.82 && r.mean >= MIN_Z && lenOf(headCells, r.a, r.b) >= MIN_LEN);
    if (main) {
      strokes.head = [toStroke(headCells, main.a, main.b)];
      score.head = main.mean;
    }
  }

  // ── 斷掌：一條橫線從小指那側一路橫過掌心、接到虎口（感情線和智慧線合成一條）。
  // 感情線的範圍到了食指那側只到 v 0.27（不然會被智慧線搶走），斷掌線在那裡通常更低（接到虎口、v≈0.3），
  // 所以另外找一條：範圍放寬到 v 0.12～0.44，從小指側走到虎口。三個條件都成立才算斷掌：
  // 1. 一整段橫過手掌：小指側 u ≤ 0.2 起、到 u ≥ 0.92；中間淡掉的地方每一處不到 0.1 掌寬
  //    （斷掌線靠虎口那段和生命線起點交會，紋路很亂、常常淡掉，實拍照片就斷了 0.08）；
  //    小指那頭在感情線的高度（開頭 0.1 掌寬平均 v ≤ 0.34，不是智慧線的尾巴），
  //    虎口那頭不往上彎進食指根（v ≥ 0.22，往上彎的是很長的感情線）；
  // 2. 下面沒有另外一條從虎口出發的智慧線；3. 上面沒有另外一條感情線。
  // 有另一條就只是感情線或智慧線特別長，照一般的描（使用者的實拍照片是真斷掌，以前被描成一條很長的感情線）。
  const simC0 = col(-0.12);
  const simC1 = col(1.06);
  const simPath = bestPath(simC1 - simC0 + 1, (i) => {
    const u = uOf(simC0 + i);
    return [row(u < 0.5 ? 0.12 : 0.15), row(u < 0.5 ? 0.4 : 0.44)];
  }, (i, j) => cellCost(simC0 + i, j) + (lifeAvoid.has(j * COLS + simC0 + i) ? 1 : 0), 1, 0.04);
  const simCells = simPath.map((r, i) => [simC0 + i, r]);
  {
    const prof = profile(z, simCells);
    const meanV = (a, b) => {
      let sum = 0;
      for (let i = a; i <= b; i += 1) sum += vOf(simCells[i][1]);
      return sum / (b - a + 1);
    };
    // 斷掌線幾乎是平的（實拍 v 0.22～0.29、範本 0.26～0.33）：整段高低差超過 0.13 掌寬，是感情線接到別條線上
    // （擬真照片抓到：小指側的感情線經過一段斜的雜紋，接上虎口出發的短智慧線，被當成一整條）
    const vRange = (r) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = r.a; i <= r.b; i += 1) {
        lo = Math.min(lo, vOf(simCells[i][1]));
        hi = Math.max(hi, vOf(simCells[i][1]));
      }
      return hi - lo;
    };
    const full = runs(prof, MIN_Z * 0.85, 20).find((r) => uOf(simCells[r.a][0]) <= 0.2 && uOf(simCells[r.b][0]) >= 0.92 && r.mean >= MIN_Z * 0.92
      && meanV(r.a, Math.min(r.b, r.a + 19)) <= 0.34 && meanV(Math.max(r.a, r.b - 19), r.b) >= 0.22 && vRange(r) <= 0.13);
    // 另一條線和斷掌線是不是同一條：八成的點都在 0.04 掌寬以內才算同一條（只有一半重疊的是另一條線，
    // 例如往上彎進手指的感情線，前半段和斷掌線的路徑重疊）
    const simV = new Map(simCells.map(([c, r]) => [c, vOf(r)]));
    const separate = (st) => {
      if (!st) return false;
      const ds = [];
      for (const [u, v] of st[0]) {
        const sv = simV.get(col(u));
        if (sv !== undefined) ds.push(Math.abs(v - sv));
      }
      ds.sort((x, y) => x - y);
      return ds.length > 0 && ds[Math.floor(ds.length * 0.8)] >= 0.04;
    };
    if (simian && full && !separate(strokes.head) && !separate(strokes.heart)) {
      strokes.simian = [toStroke(simCells, full.a, full.b)];
      score.simian = full.mean;
      delete strokes.heart;
      delete strokes.head;
      delete score.heart;
      delete score.head;
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
    // 事業線幾乎是直的：一段裡左右偏超過上下長度的 0.35 倍，是生命線的弧（生命線沒描到時，事業線的範圍會撿到它）
    const straight = (r) => Math.abs(uOf(fateCells[r.b][0]) - uOf(fateCells[r.a][0])) <= 0.35 * Math.abs(vOf(fateCells[r.b][1]) - vOf(fateCells[r.a][1]));
    const rs = segments(prof, 8, fateCells, (q) => q[0], undefined, undefined, false).filter((r) => lenOf(fateCells, r.a, r.b) >= 0.12 && r.mean >= STRONG_Z && straight(r));
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
  const simianHint = !!strokes.simian || (!!heartS && (headS
    ? Math.hypot(heartS[heartS.length - 1][0] - headS[headS.length - 1][0], heartS[heartS.length - 1][1] - headS[headS.length - 1][1]) < 0.06
    : vAtMid(heartS) >= 0.25));
  return { strokes, score, simianHint };
}

const ANCHOR_Z = 3.6;

// 點一下重描：每條線放寬的範圍（使用者說線在這裡，不再限制得那麼緊）。step＝沿線走的方向，band＝另一個方向
const AT = {
  life: { vertical: true, from: 0.25, to: 1.08, band: [0.5, 1.25], maxStep: 2, turn: 0.05 },
  fate: { vertical: true, from: 1.08, to: 0.08, band: [0.2, 0.85], maxStep: 1, turn: 0.08 },
  heart: { vertical: false, from: -0.16, to: 1.08, band: [-0.05, 0.5], maxStep: 1, turn: 0.04 },
  head: { vertical: false, from: 1.12, to: -0.08, band: [0.1, 0.88], maxStep: 1, turn: 0.06 },
};

/**
 * 沿著使用者點的位置重描一條線（自動描到別條紋路、或沒找到時用）：路徑一定經過點的那裡（左右 0.015 掌寬內），
 * 其他照原本的方法找最暗、最連續的路；範圍放寬、門檻放低（只要求點的附近夠像一條線）。
 * 已經描好的其他線（avoid）會避開：範圍放寬後，路徑過了點的地方很容易漂到旁邊更深的那條（例如感情線漂到智慧線）。
 * 只該傳「平行、容易搞混」的線：掌紋本來就會交叉（事業線穿過感情線、智慧線），把交叉的線也避開，路徑會在交叉處繞道而斷掉。
 * 門檻 3.6：空白皮膚上點一下，雜訊路徑的深度最高約 3.5；比皮膚暗 14 的淡線約 3.6～3.9（tests/palm-lines.test.js）。
 * @param {'life'|'head'|'heart'|'fate'} line
 * @param {number[]} at 點的位置（u, v）
 * @param {{avoid?:number[][][]}} [opts] avoid：其他線的筆畫（u, v）
 * @returns {{strokes:number[][][], score:number}|null} 點的地方看不到線時回傳 null
 */
export function traceLineAt(gray, w, h, frame, line, at, { avoid = [] } = {}) {
  const spec = AT[line];
  if (!spec || !Array.isArray(at)) return null;
  const { z, cellCost, segments, p90 } = prepare(gray, w, h, frame);
  const stepIdx = spec.vertical ? row : col;
  const crossIdx = spec.vertical ? col : row;
  const [sAt, cAt] = spec.vertical ? [at[1], at[0]] : [at[0], at[1]];
  // 點在預設範圍外面時，範圍跟著放大到包含那一點
  const asc = spec.to > spec.from;
  const from = asc ? Math.min(spec.from, sAt - 0.03) : Math.max(spec.from, sAt + 0.03);
  const to = asc ? Math.max(spec.to, sAt + 0.03) : Math.min(spec.to, sAt - 0.03);
  const i0 = stepIdx(from);
  const dir = asc ? 1 : -1;
  const n = Math.abs(stepIdx(to) - i0) + 1;
  const ia = (stepIdx(sAt) - i0) * dir;
  const ja = crossIdx(cAt);
  const maxCross = (spec.vertical ? COLS : ROWS) - 1;
  const clamp = (j) => Math.max(0, Math.min(maxCross, j));
  const lo = clamp(crossIdx(Math.min(spec.band[0], cAt - 0.03)));
  const hi = clamp(crossIdx(Math.max(spec.band[1], cAt + 0.03)));
  const band = (i) => (i === ia ? [clamp(ja - 3), clamp(ja + 3)] : [lo, hi]);
  const at2 = (i, j) => (spec.vertical ? [j, i0 + i * dir] : [i0 + i * dir, j]);
  // 其他線附近（0.03 掌寬內）很貴；點的地方附近（0.05 內）不算，使用者點的就是對的
  const near = new Set();
  for (const st of avoid) {
    for (let k = 1; k < st.length; k += 1) {
      const [a, b] = [st[k - 1], st[k]];
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP));
      for (let t = 0; t <= steps; t += 1) {
        const u = a[0] + ((b[0] - a[0]) * t) / steps;
        const v = a[1] + ((b[1] - a[1]) * t) / steps;
        // 點的地方附近不算；拇指和食指之間（u ≥ 0.95）是生命線和智慧線共同的起點，也不算
        if (Math.hypot(u - at[0], v - at[1]) < 0.05 || u >= 0.95) continue;
        for (let dc = -6; dc <= 6; dc += 1) for (let dr = -6; dr <= 6; dr += 1) near.add((row(v) + dr) * COLS + col(u) + dc);
      }
    }
  }
  const path = bestPath(n, band, (i, j) => {
    const [c, r] = at2(i, j);
    return cellCost(c, r) + (near.has(r * COLS + c) ? 1 : 0);
  }, spec.maxStep, spec.turn);
  const cells = path.map((j, i) => at2(i, j));
  const prof = profile(z, cells);
  // 門檻放低（2 個標準差就算），只看點的那附近：包含那一點、或離它 12 步內的那段
  const rs = segments(prof, 10, cells, (q) => (spec.vertical ? q[0] : q[1]), Math.max(2, 0.35 * p90(prof)), 0.03);
  let best = null;
  for (const r of rs) {
    const d = ia < r.a ? r.a - ia : ia > r.b ? ia - r.b : 0;
    if (d <= 12 && (!best || d < best.d || (d === best.d && r.mean > best.r.mean))) best = { r, d };
  }
  if (!best || best.r.mean < ANCHOR_Z || lenOf(cells, best.r.a, best.r.b) < 0.06) return null;
  const a = Math.min(best.r.a, ia);
  const b = Math.max(best.r.b, ia);
  return { strokes: [toStroke(cells, a, b)], score: best.r.mean };
}
