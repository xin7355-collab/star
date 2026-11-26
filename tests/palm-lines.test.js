// 自動描掌紋：用合成的手掌照片測（膚色＋雜訊＋光線不均＋細小的雜紋，主線照範本線形畫上去），
// 找出來的線交給和手描一樣的判定，要判回原本畫的線形。另測轉了角度、左手（鏡像）、低對比、沒有線的空白手掌。離線可跑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceLines, traceLineAt } from '../js/core/palm-lines.js';
import { palmFrame, classifyStrokes, TEMPLATES } from '../js/core/palm.js';

/** 固定種子的亂數（每次跑結果都一樣） */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const gauss = (rand) => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());

const RIGHT = { index: [470, 300], pinky: [225, 335], wrist: [360, 700] };
const rotate = (calib, deg, [cx, cy] = [360, 480]) => {
  const t = (deg * Math.PI) / 180;
  const r = ([x, y]) => [cx + (x - cx) * Math.cos(t) - (y - cy) * Math.sin(t), cy + (x - cx) * Math.sin(t) + (y - cy) * Math.cos(t)];
  return { index: r(calib.index), pinky: r(calib.pinky), wrist: r(calib.wrist) };
};
const mirror = (calib, w = 720) => ({ index: [w - calib.index[0], calib.index[1]], pinky: [w - calib.pinky[0], calib.pinky[1]], wrist: [w - calib.wrist[0], calib.wrist[1]] });

/**
 * 合成手掌照片（灰階）：lines＝{ life:'long-wide', … } 照 TEMPLATES 畫；depth＝主線比皮膚暗多少，noise＝皮膚紋理雜訊，
 * lighting＝左上到右下的亮度差，minor＝雜紋數量（短、淺、方向亂）。
 */
/**
 * real＝擬真：再加上指紋般的細紋、拇指根和小指側肉墊的明暗、生命線內側平行的淺紋等次要紋路，主線也深淺不一（最淺 55%）。
 * 這些是真實手掌常見、讓自動描線出錯的東西（平行淺紋曾讓短生命線被判成斷開或變長）。
 */
function synthPalm({ calib = RIGHT, lines = {}, seed = 7, w = 720, h = 960, depth = 40, noise = 6, lighting = 40, minor = 70, width = 0.016, extra = [], depthOf = {}, real = false }) {
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
  return { gray, w, h, frame };
}

/** 找出來的線交給和手描一樣的判定；沒找到的線回 null */
function classifyAll({ gray, w, h, frame }) {
  const t0 = performance.now();
  const r = traceLines(gray, w, h, frame);
  const ms = performance.now() - t0;
  const out = {};
  for (const f of ['life', 'head', 'heart', 'fate']) out[f] = r.strokes[f] ? classifyStrokes(f, r.strokes[f]) : null;
  return { out, ms, r };
}

const CASES = [
  { name: '範例手掌那一組（長弧生命線、下斜智慧線、彎上去的長感情線、從手腕起的事業線）', lines: { life: 'long-wide', head: 'slope', heart: 'long-curve', fate: 'wrist' } },
  { name: '貼著拇指的生命線、平直的智慧線、平直的長感情線、從掌心起的事業線', lines: { life: 'long-narrow', head: 'straight', heart: 'long-straight', fate: 'mid' } },
  { name: '短生命線、短智慧線、到中指下的感情線、沒有事業線', lines: { life: 'short', head: 'short', heart: 'mid' } },
  { name: '斷開的生命線、短感情線、斷開的事業線', lines: { life: 'broken', head: 'straight', heart: 'short', fate: 'broken' } },
];

for (const [i, c] of CASES.entries()) {
  test(`合成照片：${c.name}`, () => {
    const { out, ms } = classifyAll(synthPalm({ lines: c.lines, seed: 11 + i }));
    for (const f of ['life', 'head', 'heart', 'fate']) assert.equal(out[f], c.lines[f] || null, `${f}：判成 ${out[f]}，畫的是 ${c.lines[f] || '沒有'}`);
    assert.ok(ms < 1500, `太慢：${Math.round(ms)}ms`);
  });
}

test('擬真照片（指紋細紋、肉墊、平行淺紋、主線深淺不一）：四組線形各 3 種雜訊，每條線至少 9 成判對', () => {
  const tally = { life: 0, head: 0, heart: 0, fate: 0 };
  const wrong = [];
  let n = 0;
  for (const [i, c] of CASES.entries()) {
    for (let k = 0; k < 3; k += 1) {
      const { out } = classifyAll(synthPalm({ lines: c.lines, seed: 211 + i * 10 + k, real: true }));
      n += 1;
      for (const f of Object.keys(tally)) {
        if (out[f] === (c.lines[f] || null)) tally[f] += 1;
        else wrong.push(`${f}：畫 ${c.lines[f] || '沒有'}→判 ${out[f] || '沒找到'}`);
      }
    }
  }
  for (const [f, good] of Object.entries(tally)) assert.ok(good / n >= 0.9, `${f} 只判對 ${good}/${n}：${wrong.join('、')}`);
});

test('擬真照片：短生命線旁邊緊接著一條往下的平行淺紋（最難分的情況），6 張至少 5 張還是判成短', () => {
  // 這種情況連人看都模稜兩可（淺紋像生命線淡掉的延續）；判錯的那張靠「點一下重描」修正
  let good = 0;
  for (let seed = 1; seed <= 6; seed += 1) {
    const { out } = classifyAll(synthPalm({ lines: { life: 'short', head: 'straight', heart: 'long-curve' }, seed: 400 + seed, real: true }));
    if (out.life === 'short') good += 1;
  }
  assert.ok(good >= 5, `只有 ${good}/6`);
});

test('轉了 18°、左手（鏡像）都一樣判得出來', () => {
  const lines = CASES[0].lines;
  for (const calib of [rotate(RIGHT, 18), mirror(RIGHT), rotate(mirror(RIGHT), -14)]) {
    const { out } = classifyAll(synthPalm({ calib, lines, seed: 31 }));
    assert.deepEqual(out, lines);
  }
});

test('低對比（主線只暗 22）、雜訊大（標準差 9）：三條主線還找得到', () => {
  const lines = { life: 'long-wide', head: 'straight', heart: 'long-curve' };
  const { out } = classifyAll(synthPalm({ lines, seed: 41, depth: 22, noise: 9 }));
  assert.equal(out.life, 'long-wide');
  assert.equal(out.head, 'straight');
  assert.equal(out.heart, 'long-curve');
});

test('空白的手掌（只有雜紋）：不會無中生有描出主線', () => {
  const { out } = classifyAll(synthPalm({ lines: {}, seed: 53 }));
  assert.deepEqual(out, { life: null, head: null, heart: null, fate: null });
});

test('一條橫過整個手掌的線（像斷掌）：給斷掌的提示，不自動判定', () => {
  const { r } = classifyAll(synthPalm({ lines: { life: 'long-wide', simian: 'full', fate: 'wrist' }, seed: 61 }));
  assert.equal(r.simianHint, true);
});

/** 筆畫在 u 附近的 v（取最接近的那一點） */
const vNear = (st, u) => st.reduce((a, p) => (Math.abs(p[0] - u) < Math.abs(a[0] - u) ? p : a))[1];

test('點一下重描：旁邊有一條更深的紋路，點在真的感情線上，就沿著真的感情線描（長而平直）', () => {
  const p = synthPalm({
    lines: { life: 'long-wide', head: 'slope', heart: 'long-straight' },
    depthOf: { heart: 24 },
    extra: [[[[-0.1, 0.11], [0.4, 0.1], [0.95, 0.1]], 42]], // 感情線上面一條更深的橫紋
    seed: 71,
  });
  // 畫面上會把平行、容易搞混的線（感情線的話是智慧線）交給它避開
  const auto = traceLines(p.gray, p.w, p.h, p.frame).strokes;
  const r = traceLineAt(p.gray, p.w, p.h, p.frame, 'heart', [0.35, 0.205], { avoid: auto.head || [] });
  assert.ok(r, '點的地方明明有線');
  const st = r.strokes[0];
  for (const u of [0.0, 0.35, 0.7]) assert.ok(Math.abs(vNear(st, u) - (0.22 - (u + 0.12) * 0.025)) < 0.03, `u=${u} 的 v=${vNear(st, u).toFixed(3)}，應該沿著真的感情線`);
  assert.equal(classifyStrokes('heart', r.strokes), 'long-straight');
});

test('點一下重描：很淡、自動描找不到的事業線，點在線上就找得到（從手腕直上）', () => {
  const p = synthPalm({ lines: { life: 'long-wide', head: 'straight', heart: 'long-curve', fate: 'wrist' }, depthOf: { fate: 14 }, seed: 73 });
  assert.equal(traceLines(p.gray, p.w, p.h, p.frame).strokes.fate, undefined, '這麼淡的事業線自動描應該保守不描');
  const r = traceLineAt(p.gray, p.w, p.h, p.frame, 'fate', [0.565, 0.62]);
  assert.ok(r);
  assert.equal(classifyStrokes('fate', r.strokes), 'wrist');
});

test('點一下重描：點在沒有線的空白皮膚上，回報找不到、不亂描', () => {
  const p = synthPalm({ lines: {}, seed: 79 });
  for (const [line, at] of [['heart', [0.4, 0.2]], ['life', [0.85, 0.6]], ['head', [0.5, 0.4]], ['fate', [0.55, 0.6]]]) {
    assert.equal(traceLineAt(p.gray, p.w, p.h, p.frame, line, at), null, line);
  }
});

test('點一下重描：交叉的線不避開——事業線上端碰到感情線，重描感情線還是完整的一條（長、尾端上揚）', () => {
  const p = synthPalm({ lines: { life: 'long-wide', head: 'slope', heart: 'long-curve', fate: 'wrist' }, seed: 83 });
  const auto = traceLines(p.gray, p.w, p.h, p.frame).strokes;
  const r = traceLineAt(p.gray, p.w, p.h, p.frame, 'heart', [0.5, 0.18], { avoid: auto.head || [] });
  assert.equal(classifyStrokes('heart', r.strokes), 'long-curve');
});

test('點一下重描：點在空白處、旁邊不遠有別條線時，不會一步跳到那條線上（回報找不到）', () => {
  const p = synthPalm({ lines: { life: 'long-wide', head: 'straight', heart: 'long-curve', fate: 'wrist' }, seed: 89 });
  // 事業線在 u≈0.55，點在 u 0.3 的空白處
  assert.equal(traceLineAt(p.gray, p.w, p.h, p.frame, 'fate', [0.3, 0.75]), null);
  assert.equal(traceLineAt(p.gray, p.w, p.h, p.frame, 'fate', [0.25, 0.85]), null);
});
