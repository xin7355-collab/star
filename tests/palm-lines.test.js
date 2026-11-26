// 自動描掌紋：用合成的手掌照片測（膚色＋雜訊＋光線不均＋細小的雜紋，主線照範本線形畫上去），
// 找出來的線交給和手描一樣的判定，要判回原本畫的線形。另測轉了角度、左手（鏡像）、低對比、沒有線的空白手掌。離線可跑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceLines } from '../js/core/palm-lines.js';
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
function synthPalm({ calib = RIGHT, lines = {}, seed = 7, w = 720, h = 960, depth = 40, noise = 6, lighting = 40, minor = 70, width = 0.016 }) {
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
  for (const [field, opt] of Object.entries(lines)) for (const pts of TEMPLATES[field][opt]) stroke(pts, depth, width);
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
