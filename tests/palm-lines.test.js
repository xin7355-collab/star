// 自動描掌紋：用合成的手掌照片測（膚色＋雜訊＋光線不均＋細小的雜紋，主線照範本線形畫上去），
// 找出來的線交給和手描一樣的判定，要判回原本畫的線形。另測轉了角度、左手（鏡像）、低對比、沒有線的空白手掌。離線可跑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceLines, traceLineAt } from '../js/core/palm-lines.js';
import { classifyStrokes } from '../js/core/palm.js';
import { synthPalm, RIGHT, rotate, mirror } from './helpers/synth-palm.js';

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

test('真斷掌（一條橫線取代感情線和智慧線）：描成斷掌線、不另外描感情線和智慧線；清掉過就改描感情線、智慧線', () => {
  for (const [k, opt] of [{ real: false }, { real: true }, { real: true, bg: 'bright' }, { real: true, bg: 'dark' }].entries()) {
    const p = synthPalm({ lines: { life: k % 2 ? 'long-narrow' : 'long-wide', simian: 'full', fate: 'wrist' }, seed: 61 + k, ...opt });
    const r = traceLines(p.gray, p.w, p.h, p.frame);
    assert.ok(r.strokes.simian, `第 ${k + 1} 張沒認出斷掌`);
    assert.equal(r.strokes.heart, undefined);
    assert.equal(r.strokes.head, undefined);
    assert.equal(r.simianHint, true);
    const st = r.strokes.simian[0];
    assert.ok(st[0][0] <= 0.2 && st.at(-1)[0] >= 0.92, '斷掌線要橫過整個手掌');
    assert.equal(classifyStrokes('life', r.strokes.life), k % 2 ? 'long-narrow' : 'long-wide');
    // 使用者清掉自動描的斷掌線（認為不是斷掌）：不找斷掌，照一般的找感情線
    const r2 = traceLines(p.gray, p.w, p.h, p.frame, { simian: false });
    assert.equal(r2.strokes.simian, undefined);
    assert.ok(r2.strokes.heart || r2.strokes.head, '不找斷掌時要描出感情線或智慧線');
  }
});

test('一般手掌不會被當成斷掌（含很長很平的感情線、亮背景）', () => {
  let n = 0;
  for (const [i, c] of CASES.entries()) {
    for (let k = 0; k < 3; k += 1) {
      const { r } = classifyAll(synthPalm({ lines: c.lines, seed: 1011 + i * 10 + k, real: true, bg: k === 2 ? 'bright' : null }));
      assert.equal(r.strokes.simian, undefined, `${c.name} 第 ${k + 1} 張被當成斷掌`);
      n += 1;
    }
  }
  assert.equal(n, 12);
});

// 使用者實拍照片的情況（照片本身不放 repo：掌紋是生物特徵）：拇指根肉墊大，生命線的弧掃到掌心中間（u≈0.55），
// 背景是比皮膚亮的白磁磚。以前生命線範圍只到 u 0.66，生命線被逼去描虎口的掌緣，事業線反而撿到生命線的下半段
const WIDE_LIFE = [[1.04, 0.3], [0.86, 0.33], [0.72, 0.41], [0.62, 0.52], [0.56, 0.66], [0.55, 0.78], [0.58, 0.88], [0.63, 0.98]];
test('生命線的弧很寬（掃到掌心中間）、背景是亮的磁磚：描得到整條、不會多描一條事業線', () => {
  for (let k = 0; k < 4; k += 1) {
    const p = synthPalm({ lines: { head: 'straight', heart: 'long-curve' }, extra: [[WIDE_LIFE, 36]], seed: 811 + k, real: true, bg: k < 2 ? 'bright' : null });
    const r = traceLines(p.gray, p.w, p.h, p.frame);
    assert.equal(classifyStrokes('life', r.strokes.life), 'long-wide', `第 ${k + 1} 張`);
    const st = r.strokes.life[0];
    assert.ok(Math.min(...st.map((q) => q[0])) < 0.62, `生命線要彎到掌心中間（最小 u ${Math.min(...st.map((q) => q[0])).toFixed(2)}）`);
    assert.equal(r.strokes.fate, undefined, '生命線的下半段不能被當成事業線');
  }
});

test('空白手掌放在亮背景、暗背景前面：掌緣不會被當成主線', () => {
  for (const [k, bg] of ['bright', 'dark', 'bright'].entries()) {
    const { out, r } = classifyAll(synthPalm({ lines: {}, seed: 57 + k, bg }));
    assert.deepEqual(out, { life: null, head: null, heart: null, fate: null }, bg);
    assert.equal(r.strokes.simian, undefined);
  }
});

test('生命線中段淡掉一段（光線、皮膚皺摺）：還是一整條，不會被判成斷開；真的斷開還是判斷開', () => {
  const faded = [[[1.04, 0.34], [0.86, 0.5], [0.8, 0.6]], [[0.8, 0.6], [0.78, 0.7]], [[0.78, 0.7], [0.82, 0.88], [0.9, 1.0]]];
  for (let k = 0; k < 3; k += 1) {
    const p = synthPalm({ lines: { head: 'straight', heart: 'long-curve' }, extra: [[faded[0], 40], [faded[1], 16], [faded[2], 40]], seed: 131 + k, real: true });
    assert.equal(classifyStrokes('life', traceLines(p.gray, p.w, p.h, p.frame).strokes.life), 'long-wide', `第 ${k + 1} 張`);
  }
  const { out } = classifyAll(synthPalm({ lines: { life: 'broken', head: 'straight', heart: 'short' }, seed: 141, real: true }));
  assert.equal(out.life, 'broken');
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
