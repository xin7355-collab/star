// 合成手掌照片（測試與調參數共用）：膚色＋雜訊＋光線不均＋細小的雜紋，主線照範本線形畫上去。
// 不放真實照片：掌紋是個人的生物特徵，repo 是公開的。真實照片只在本機調參數時用，失敗的情境再做成這裡的合成版本。
import { palmFrame, TEMPLATES } from '../../js/core/palm.js';

/** 固定種子的亂數（每次跑結果都一樣） */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export const gauss = (rand) => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());

export const RIGHT = { index: [470, 300], pinky: [225, 335], wrist: [360, 700] };
export const rotate = (calib, deg, [cx, cy] = [360, 480]) => {
  const t = (deg * Math.PI) / 180;
  const r = ([x, y]) => [cx + (x - cx) * Math.cos(t) - (y - cy) * Math.sin(t), cy + (x - cx) * Math.sin(t) + (y - cy) * Math.cos(t)];
  return { index: r(calib.index), pinky: r(calib.pinky), wrist: r(calib.wrist) };
};
export const mirror = (calib, w = 720) => ({ index: [w - calib.index[0], calib.index[1]], pinky: [w - calib.pinky[0], calib.pinky[1]], wrist: [w - calib.wrist[0], calib.wrist[1]] });

/**
 * 合成手掌照片（灰階）：lines＝{ life:'long-wide', … } 照 TEMPLATES 畫；depth＝主線比皮膚暗多少，noise＝皮膚紋理雜訊，
 * lighting＝左上到右下的亮度差，minor＝雜紋數量（短、淺、方向亂）。
 */
/**
 * real＝擬真：再加上指紋般的細紋、拇指根和小指側肉墊的明暗、生命線內側平行的淺紋等次要紋路，主線也深淺不一（最淺 55%）。
 * 這些是真實手掌常見、讓自動描線出錯的東西（平行淺紋曾讓短生命線被判成斷開或變長）。
 */
export function synthPalm({ calib = RIGHT, lines = {}, seed = 7, w = 720, h = 960, depth = 40, noise = 6, lighting = 40, minor = 70, width = 0.016, extra = [], depthOf = {}, real = false, bg = null }) {
  const frame = palmFrame(calib);
  const rand = rng(seed);
  const img = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) img[y * w + x] = 178 + lighting * (0.5 - (x / w + y / h) / 2) + noise * gauss(rand);
  const pw = Math.hypot(calib.index[0] - calib.pinky[0], calib.index[1] - calib.pinky[1]);
  const dark = new Float32Array(w * h); // 每一點取最深的那一筆，重疊的地方才不會越疊越黑
  const stroke = (uvPts, d, wid) => {
    const r = Math.max(1.2, (wid * pw) / 2);
    for (let i = 1; i < uvPts.length; i += 1) {
      const [a, b] = [frame.toXY(uvPts[i - 1]), frame.toXY(uvPts[i])];
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
      for (let k = 0; k <= n; k += 1) {
        const x = a[0] + ((b[0] - a[0]) * k) / n;
        const y = a[1] + ((b[1] - a[1]) * k) / n;
        for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy += 1) {
          for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx += 1) {
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const q = ((xx - x) ** 2 + (yy - y) ** 2) / (r * r);
            if (q < 1) dark[yy * w + xx] = Math.max(dark[yy * w + xx], d * (1 - q));
          }
        }
      }
    }
  };
  for (let i = 0; i < minor; i += 1) {
    const u = rand() * 1.1 - 0.05;
    const v = rand() * 1.0 + 0.02;
    const ang = rand() * Math.PI;
    const len = 0.03 + rand() * 0.05;
    stroke([[u, v], [u + Math.cos(ang) * len, v + Math.sin(ang) * len]], depth * 0.35, width * 0.6);
  }
  if (real) {
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const [u, v] = frame.toUV([x, y]);
      const ang = 0.8 * Math.sin(u * 3.1 + v * 2.3) + 0.6;
      const phase = (Math.cos(ang) * u + Math.sin(ang) * v) / 0.008;
      const mound = 14 * Math.exp(-(((u - 1.0) / 0.22) ** 2 + ((v - 0.72) / 0.28) ** 2)) + 10 * Math.exp(-(((u + 0.02) / 0.18) ** 2 + ((v - 0.7) / 0.3) ** 2))
        - 10 * Math.exp(-(((u - 0.5) / 0.25) ** 2 + ((v - 0.55) / 0.25) ** 2));
      img[y * w + x] += 5 * Math.sin(phase * 2 * Math.PI) + mound;
    }
    const secondary = [
      [[0.97, 0.45], [0.9, 0.62], [0.89, 0.8], [0.93, 0.95]], // 生命線內側平行的淺紋
      [[1.05, 0.62], [0.96, 0.66]], [[1.08, 0.78], [0.97, 0.8]],
      [[-0.1, 0.55], [0.12, 0.53]], [[-0.1, 0.68], [0.1, 0.7]], [[-0.08, 0.82], [0.12, 0.8]],
      [[0.45, 0.06], [0.52, 0.18]], [[0.3, 0.08], [0.36, 0.16]],
    ];
    for (const pts of secondary) stroke(pts, depth * 0.55, width * 0.8);
  }
  for (const [field, opt] of Object.entries(lines)) {
    for (const pts of TEMPLATES[field][opt]) {
      if (!real) {
        stroke(pts, depthOf[field] ?? depth, width);
        continue;
      }
      // 擬真：沿線一小段一小段畫，深度在 55%～100% 之間慢慢變化
      for (let i = 1; i < pts.length; i += 1) {
        for (let k = 0; k < 8; k += 1) {
          const t0 = k / 8;
          const t1 = (k + 1) / 8;
          const lerp = (t) => [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
          const f = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin((i * 8 + k) * 0.9 + seed));
          stroke([lerp(t0), lerp(t1)], (depthOf[field] ?? depth) * f, width * (0.8 + 0.4 * rand()));
        }
      }
    }
  }
  for (const [pts, d] of extra) stroke(pts, d, width);
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < gray.length; i += 1) gray[i] = img[i] - dark[i];
  if (bg) paintBackground(gray, w, h, frame, bg, rand);
  return { gray, w, h, frame };
}


/**
 * 手的外形（u, v）：掌心、拇指根的肉墊往拇指那側鼓出去、四根手指、手腕；拇指和食指之間（虎口）是空的。
 * 真實照片的手是放在背景前面拍的，掌緣外面如果比皮膚亮（白磁磚、白桌面），掌緣就像一條暗線——
 * 生命線、智慧線的起點就在虎口旁邊，最容易被掌緣騙走（使用者的實拍照片就是這樣錯的）。
 */
export function inHand(u, v) {
  if (v >= -0.05 && v <= 1.06) {
    // 小指側掌緣微微外鼓；拇指側：虎口（v < 0.26）以內，往下是拇指根肉墊往外鼓
    const left = -0.15 - 0.04 * Math.sin(Math.PI * Math.min(1, Math.max(0, v)));
    const right = v < 0.26 ? 1.08 - 0.12 * Math.max(0, (0.26 - v) / 0.31) ** 2 : 1.08 + 0.2 * Math.sin((Math.PI * Math.min(1, v - 0.26)) / 0.8);
    if (u >= left && u <= right) return true;
  }
  if (v > 1.0 && v <= 1.5 && u >= 0.08 && u <= 0.98) return true; // 手腕
  if (v < 0) {
    // 四根手指（指根中心 0、0.33、0.66、1，寬 0.24），指縫是背景
    for (const c of [0, 0.33, 0.66, 1]) if (Math.abs(u - c) <= 0.12) return true;
  }
  return false;
}

/** 手以外換成背景（亮＝白磁磚，有幾條灰色磁磚縫；暗＝深色衣服或桌面），掌緣有一圈因為弧面而偏暗的邊 */
function paintBackground(gray, w, h, frame, bg, rand) {
  const level = bg === 'dark' ? 45 : 222;
  const pw = Math.hypot(...[0, 1].map((i) => frame.toXY([1, 0])[i] - frame.toXY([0, 0])[i]));
  const rim = 0.025;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [u, v] = frame.toUV([x, y]);
      const i = y * w + x;
      if (inHand(u, v)) {
        // 離掌緣 rim 以內，皮膚往外彎、比較暗（最多暗 12%）
        let near = false;
        for (const [du, dv] of [[rim, 0], [-rim, 0], [0, rim], [0, -rim]]) if (!inHand(u + du, v + dv)) near = true;
        if (near) gray[i] = gray[i] * 0.88;
        continue;
      }
      let g = level + 4 * (rand() - 0.5) * 2;
      // 磁磚縫：每 0.9 個掌寬一條，寬 3px
      if (bg === 'bright' && (Math.abs(((x + 0.31 * y) % (0.9 * pw)) - 10) < 1.5 || Math.abs(((y - 0.2 * x) % (0.9 * pw)) - 14) < 1.5)) g -= 55;
      gray[i] = g;
    }
  }
}
