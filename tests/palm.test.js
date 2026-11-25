// 掌紋：座標換算、描線判定（拿範本線形自我檢查）、斷掌、白名單、解讀文字完整性。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  palmFrame, TEMPLATES, HEAD_APART_START, PALM_FIELDS, activeFields, sanitizePicks, sanitizePalm,
  simplifyStroke, classifyStrokes, suggestPicks, polylineGap, photoAdvice, compareHands, handRole,
} from '../js/core/palm.js';
import { PALM_TEXT, SCALES, palmReading, handDiffText } from '../js/core/palm-texts.js';
import { sanitizePerson, HISTORY_TYPES } from '../js/core/records.js';

test('掌心框：三個校正點換算來回一致；左手（食指在左）也一樣；三點太近或一直線拒絕', () => {
  const right = palmFrame({ index: [300, 200], pinky: [100, 220], wrist: [190, 520] });
  assert.deepEqual(right.toUV([190, 520]).map((x) => +x.toFixed(6)), [0.5, 1]);
  assert.deepEqual(right.toUV([100, 220]).map((x) => +x.toFixed(6)), [0, 0]);
  for (const uv of [[0.3, 0.4], [1.1, 0.9], [-0.1, 0.2]]) {
    const back = right.toUV(right.toXY(uv));
    assert.ok(Math.abs(back[0] - uv[0]) < 1e-9 && Math.abs(back[1] - uv[1]) < 1e-9);
  }
  // 左手鏡像：食指在左、小指在右，u 一樣是小指 → 食指
  const left = palmFrame({ index: [100, 200], pinky: [300, 220], wrist: [210, 520] });
  assert.deepEqual(left.toUV([100, 200]).map((x) => +x.toFixed(6)), [1, 0]);
  assert.equal(palmFrame({ index: [300, 200], pinky: [100, 200], wrist: [400, 205] }), null); // 幾乎一直線
  assert.equal(palmFrame({ index: [100, 200], pinky: [100, 200], wrist: [100, 500] }), null); // 兩指點在同一處
  assert.equal(palmFrame({ index: [300, 200], pinky: [100, 200], wrist: [200, 230] }), null); // 手腕太近
});

test('描線判定：每個範本線形都判回自己（左右鏡像、整體縮放也一樣）', () => {
  for (const field of ['life', 'head', 'heart', 'fate']) {
    for (const [opt, strokes] of Object.entries(TEMPLATES[field])) {
      if (!strokes.length) continue;
      assert.equal(classifyStrokes(field, strokes), opt, `${field} ${opt}`);
      // 描的方向反過來（從尾描到頭）也要判一樣
      assert.equal(classifyStrokes(field, strokes.map((st) => [...st].reverse())), opt, `${field} ${opt} 反向`);
    }
  }
  // 透過照片座標（左手、任意大小）轉一圈再判
  const fr = palmFrame({ index: [80, 300], pinky: [420, 330], wrist: [260, 900] });
  const viaPhoto = (strokes) => strokes.map((st) => st.map((uv) => fr.toUV(fr.toXY(uv))));
  assert.equal(classifyStrokes('heart', viaPhoto(TEMPLATES.heart['long-curve'])), 'long-curve');
  assert.equal(classifyStrokes('life', viaPhoto(TEMPLATES.life.short)), 'short');
  assert.equal(classifyStrokes('life', []), null);
});

test('整隻手的建議：一般、半斷掌（兩線靠在一起）、真斷掌（描了斷掌線就不看感情線、智慧線）、起點分開', () => {
  const base = { life: TEMPLATES.life['long-wide'], head: TEMPLATES.head.straight, heart: TEMPLATES.heart.mid, fate: TEMPLATES.fate.wrist };
  assert.deepEqual(suggestPicks(base), { life: 'long-wide', head: 'straight', heart: 'mid', fate: 'wrist', simian: 'none', start: 'joined' });
  const dip = [[[-0.12, 0.22], [0.2, 0.24], [0.4, 0.34], [0.5, 0.37]]]; // 感情線往下碰到智慧線
  assert.equal(suggestPicks({ ...base, heart: dip }).simian, 'half');
  const full = suggestPicks({ ...base, simian: TEMPLATES.simian.full });
  assert.equal(full.simian, 'full');
  assert.ok(!('head' in full) && !('heart' in full) && !('start' in full));
  assert.equal(suggestPicks({ ...base, head: [[HEAD_APART_START, [0.7, 0.33], [0.35, 0.36], [0.04, 0.4]]] }).start, 'apart');
  assert.ok(polylineGap(TEMPLATES.heart.mid[0], TEMPLATES.head.straight[0]) > 0.1);
});

test('描線簡化：太密的點只留間隔夠的、太短當成誤觸', () => {
  const dense = Array.from({ length: 200 }, (_, i) => [i / 400, 0.3]);
  const s = simplifyStroke(dense);
  assert.ok(s.length < 40 && s[0] === dense[0] && s[s.length - 1] === dense[199]);
  assert.equal(simplifyStroke([[0, 0], [0.02, 0.02]]), null);
  assert.equal(simplifyStroke([[0, 0]]), null);
});

test('照片品質：只回最該先改的一項；手太小優先、反光最後', () => {
  const dark = Array(100).fill(30);
  assert.match(photoAdvice(dark, 0.2), /手在照片裡太小/);
  assert.match(photoAdvice(dark, 0.5), /太暗/);
  assert.match(photoAdvice(Array(100).fill(230), 0.5), /太亮/);
  assert.match(photoAdvice([...Array(80).fill(150), ...Array(20).fill(250)], 0.5), /反光/);
  assert.equal(photoAdvice(Array(100).fill(150), 0.5), null);
});

test('白名單：只收已知選項；真斷掌時丟掉感情線、智慧線；名單只存選項、照片欄位一律丟掉', () => {
  assert.deepEqual(sanitizePicks({ life: 'short', heart: 'nope', evil: 'x', simian: 'none' }), { simian: 'none', life: 'short' });
  assert.deepEqual(sanitizePicks({ simian: 'full', heart: 'mid', head: 'slope', start: 'apart', fate: 'mid' }), { simian: 'full', fate: 'mid' });
  assert.equal(sanitizePalm({ left: {}, right: {} }), null);
  assert.deepEqual(sanitizePalm({ dominant: 'left', right: { life: 'short' }, photo: 'data:image/png;base64,AAAA' }), { dominant: 'left', left: {}, right: { life: 'short' } });
  const person = { id: 'p-0123456789abcdef', name: '測試', raw: { calendar: 'solar', era: 'ad', year: 1990, month: 8, day: 15 } };
  assert.ok(!('palm' in sanitizePerson(person)));
  const withPalm = sanitizePerson({ ...person, palm: { right: { simian: 'half', heart: 'mid' }, image: 'x' } });
  assert.deepEqual(withPalm.palm, { dominant: '', left: {}, right: { simian: 'half', heart: 'mid' } });
  assert.ok(HISTORY_TYPES.includes('palm'));
});

test('解讀文字：每個選項都有完整的說明與兩端位置，縮圖短名 8 個字以內', () => {
  for (const f of PALM_FIELDS) {
    assert.ok(SCALES[f.id] && SCALES[f.id].length === 2, f.id);
    for (const opt of f.options) {
      const t = PALM_TEXT[f.id][opt];
      assert.ok(t, `${f.id} ${opt}`);
      for (const k of ['label', 'title', 'text', 'good', 'care', 'act']) assert.ok(typeof t[k] === 'string' && t[k].length >= 2, `${f.id} ${opt} ${k}`);
      assert.ok(t.label.length <= 8, `${f.id} ${opt} label 太長：${t.label}`);
      assert.ok(t.pos >= 0 && t.pos <= 4);
    }
  }
  // 依步驟順序；真斷掌不出現感情線、智慧線
  const r = palmReading({ simian: 'full', life: 'short', fate: 'none', thick: 'thin' });
  assert.deepEqual(r.map((x) => x.field), ['simian', 'life', 'fate', 'thick']);
  assert.match(r[1].text, /和壽命長短無關/);
  assert.deepEqual(activeFields({ simian: 'full' }).map((x) => x.id), ['simian', 'life', 'fate', 'shape', 'thick']);
});

test('左右手比較：只列兩手都選了又不同的；有慣用手才講天生、後天', () => {
  const diffs = compareHands({ heart: 'mid', life: 'short', fate: 'wrist' }, { heart: 'long-curve', life: 'short' });
  assert.deepEqual(diffs.map((d) => d.field), ['heart']);
  assert.match(handDiffText(diffs[0], 'right'), /天生（左手）是「感情線停在食指和中指之間」，後天（右手）是「感情線長，尾端上揚到食指下」/);
  assert.match(handDiffText(diffs[0], ''), /選了慣用手/);
  assert.equal(handRole('right', 'right'), 'acquired');
  assert.equal(handRole('left', 'right'), 'innate');
  assert.equal(handRole('left', ''), null);
});
