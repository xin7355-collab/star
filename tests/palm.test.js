// 掌紋：座標換算、描線判定（拿範本線形自我檢查）、斷掌、白名單、解讀文字完整性。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  palmFrame, TEMPLATES, HEAD_APART_START, PALM_FIELDS, activeFields, sanitizePicks, sanitizePalm,
  simplifyStroke, classifyStrokes, suggestPicks, polylineGap, photoAdvice, compareHands, handRole, mainHand, HAND_SCHOOLS,
  mergeSuggestions, enhanceLines, TRACE_LINES,
} from '../js/core/palm.js';
import { PALM_TEXT, SCALES, palmReading, handDiffText, roleText } from '../js/core/palm-texts.js';
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

test('照片是哪隻手：掌心朝鏡頭時右手食指在右；照片轉 90 度、倒過來都一樣；左右翻過的照片會相反', () => {
  const rot = ([x, y], deg) => {
    const r = (deg * Math.PI) / 180;
    return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
  };
  const right = { index: [300, 200], pinky: [100, 220], wrist: [190, 520] };
  const left = { index: [100, 200], pinky: [300, 220], wrist: [210, 520] };
  for (const deg of [0, 90, 180, 270, 33]) {
    const turn = (c) => Object.fromEntries(Object.entries(c).map(([k, q]) => [k, rot(q, deg)]));
    assert.equal(palmFrame(turn(right)).side, 'right', `轉 ${deg} 度`);
    assert.equal(palmFrame(turn(left)).side, 'left', `轉 ${deg} 度`);
  }
  // 左右翻過（例如前鏡頭鏡像）：右手看起來像左手，所以畫面上只提醒、讓使用者決定
  const flip = Object.fromEntries(Object.entries(right).map(([k, q]) => [k, [-q[0], q[1]]]));
  assert.equal(palmFrame(flip).side, 'left');
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

test('描線建議併進選項：描別條線不會蓋掉自己改過的（重現過的 bug）', () => {
  // 描生命線 → 自動填「長、弧度大」；自己改成「短」；再描感情線，生命線要保留「短」
  let traces = { life: TEMPLATES.life['long-wide'] };
  let st = mergeSuggestions({}, {}, suggestPicks(traces), ['life']);
  assert.equal(st.picks.life, 'long-wide');
  const mine = { ...st.picks, life: 'short' };
  traces = { ...traces, heart: TEMPLATES.heart['long-curve'] };
  st = mergeSuggestions(mine, st.applied, suggestPicks(traces), ['heart']);
  assert.equal(st.picks.life, 'short');
  assert.equal(st.picks.heart, 'long-curve');
  // 同一條線重描（或復原、清掉這條線的筆畫）：用新的判斷
  st = mergeSuggestions(st.picks, st.applied, suggestPicks({ ...traces, life: TEMPLATES.life['long-narrow'] }), ['life']);
  assert.equal(st.picks.life, 'long-narrow');
});

test('描線建議併進選項：合看兩條線的斷掌、起點自己選過就保留；判斷消失時只拿掉自動填的', () => {
  // 先手選半斷掌，再描智慧線、感情線（判斷是沒有斷掌）：保留自己選的半斷掌
  const traces = { head: TEMPLATES.head.straight, heart: TEMPLATES.heart.mid };
  let st = mergeSuggestions({ simian: 'half' }, {}, suggestPicks(traces), ['head', 'heart']);
  assert.deepEqual(st.picks, { simian: 'half', head: 'straight', heart: 'mid' });
  assert.equal(st.applied.simian, 'none'); // 記得判斷是什麼，畫面可以說「你選的和描線不同」
  // 沒手選過的：跟著判斷
  st = mergeSuggestions({}, {}, suggestPicks(traces), ['head', 'heart']);
  assert.equal(st.picks.simian, 'none');
  // 線清掉了：自動填的拿掉，自己改過的事業線留著
  const cur = { life: 'long-wide', fate: 'mid' };
  st = mergeSuggestions(cur, { life: 'long-wide', fate: 'wrist' }, {}, ['life', 'fate']);
  assert.deepEqual(st.picks, { fate: 'mid' });
  assert.deepEqual(st.applied, {});
  // 描了斷掌線：真斷掌，感情線、智慧線、起點一起拿掉（白名單也會擋）
  st = mergeSuggestions({ head: 'straight', heart: 'mid', start: 'joined', life: 'short' }, { head: 'straight', heart: 'mid', start: 'joined' },
    suggestPicks({ simian: TEMPLATES.simian.full }), ['simian']);
  assert.deepEqual(st.picks, { simian: 'full', life: 'short' });
  // 沒有變動的線：一個欄位都不碰；不認得的線名稱忽略
  st = mergeSuggestions({ life: 'short' }, { life: 'long-wide' }, { life: 'long-wide' }, ['nope']);
  assert.deepEqual(st.picks, { life: 'short' });
  assert.deepEqual(TRACE_LINES, ['life', 'head', 'heart', 'fate', 'simian']);
});

test('加強掌紋：細暗線的對比變大、大片明暗變平；整張全白（最大總和）也不會溢位', () => {
  const w = 120;
  const h = 120;
  const img = new Uint8ClampedArray(w * h * 4);
  // 左暗右亮的漸層（光線不均）＋第 60、61 列一條比旁邊暗 25 的細線（掌紋）
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const v = 140 + (80 * x) / (w - 1) - (y === 60 || y === 61 ? 25 : 0);
      const o = (y * w + x) * 4;
      img[o] = v;
      img[o + 1] = v;
      img[o + 2] = v;
      img[o + 3] = 255;
    }
  }
  const out = enhanceLines(img, w, h);
  assert.equal(out.length, img.length);
  const at = (a, x, y) => a[(y * w + x) * 4];
  const lineContrast = (a) => {
    let s = 0;
    for (let x = 20; x < 100; x += 1) s += (at(a, x, 54) + at(a, x, 67)) / 2 - (at(a, x, 60) + at(a, x, 61)) / 2;
    return s / 80;
  };
  assert.ok(lineContrast(out) >= lineContrast(img) * 1.8, `線的對比 ${lineContrast(img)} → ${lineContrast(out)}`);
  const sideGap = (a) => Math.abs(at(a, 100, 20) - at(a, 20, 20));
  assert.ok(sideGap(out) < sideGap(img) * 0.7, `左右明暗差 ${sideGap(img)} → ${sideGap(out)}`);
  for (let i = 3; i < out.length; i += 4) assert.equal(out[i], 255);
  // 1280×1280 全白：積分圖總和最大，算出來每一點都一樣（溢位的話右下角會亂掉）
  const big = 1280;
  const white = new Uint8ClampedArray(big * big * 4).fill(255);
  const res = enhanceLines(white, big, big);
  assert.equal(res[0], res[res.length - 4]);
  assert.equal(res[((big / 2) * big + big / 2) * 4], res[0]);
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
  assert.deepEqual(sanitizePalm({ dominant: 'left', right: { life: 'short' }, photo: 'data:image/png;base64,AAAA' }), { school: '', dominant: 'left', left: {}, right: { life: 'short' } });
  assert.deepEqual(sanitizePalm({ school: 'gender' }), { school: 'gender', dominant: '', left: {}, right: {} });
  assert.equal(sanitizePalm({ school: 'evil' }), null);
  const person = { id: 'p-0123456789abcdef', name: '測試', raw: { calendar: 'solar', era: 'ad', year: 1990, month: 8, day: 15 } };
  assert.ok(!('palm' in sanitizePerson(person)));
  const withPalm = sanitizePerson({ ...person, palm: { right: { simian: 'half', heart: 'mid' }, image: 'x' } });
  assert.deepEqual(withPalm.palm, { school: '', dominant: '', left: {}, right: { simian: 'half', heart: 'mid' } });
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

test('看哪隻手：男左女右依性別決定主要的手；左先天右後天不分男女；慣用手派看慣用手', () => {
  assert.deepEqual(HAND_SCHOOLS.map((x) => x.id), ['gender', 'side', 'dominant']);
  assert.equal(mainHand('gender', { gender: '男' }), 'left');
  assert.equal(mainHand('gender', { gender: '女' }), 'right');
  assert.equal(mainHand('gender', { gender: '' }), null);
  assert.equal(mainHand('side', { gender: '男' }), null);
  assert.equal(mainHand('dominant', { dominant: 'left' }), 'left');
  // 男左女右：主要的手和參考的手
  assert.equal(handRole('left', { school: 'gender', gender: '男' }), 'main');
  assert.equal(handRole('right', { school: 'gender', gender: '男' }), 'ref');
  assert.equal(handRole('right', { school: 'gender', gender: '女' }), 'main');
  assert.equal(handRole('left', { school: 'gender', gender: '' }), null);
  // 左先天右後天：不看性別
  assert.equal(handRole('left', { school: 'side', gender: '女' }), 'innate');
  assert.equal(handRole('right', { school: 'side', gender: '男' }), 'acquired');
  // 慣用手：慣用手看後天
  assert.equal(handRole('right', { school: 'dominant', dominant: 'right' }), 'acquired');
  assert.equal(handRole('left', { school: 'dominant', dominant: 'right' }), 'innate');
  assert.equal(handRole('left', { school: 'dominant' }), null);
  // 畫面上的一句話
  assert.match(roleText('left', 'gender', { gender: '男' }, 'main'), /主要看的手.+男生看左手/);
  assert.match(roleText('left', 'gender', { gender: '女' }, 'ref'), /當參考.+以右手為主/);
  assert.match(roleText('left', 'gender', {}, null), /選性別/);
  assert.match(roleText('right', 'side', {}, 'acquired'), /右手看後天.+不分男女/);
  assert.match(roleText('left', 'dominant', {}, null), /還沒選慣用手/);
});

test('左右手比較：只列兩手都選了又不同的；說法跟著看法走', () => {
  const diffs = compareHands({ heart: 'mid', life: 'short', fate: 'wrist' }, { heart: 'long-curve', life: 'short' });
  assert.deepEqual(diffs.map((d) => d.field), ['heart']);
  const d = diffs[0];
  assert.match(handDiffText(d, { school: 'gender', gender: '男' }), /主要看的左手是「感情線停在食指和中指之間」，右手是「感情線長，尾端上揚到食指下」。照男左女右以左手為準，右手當參考/);
  assert.match(handDiffText(d, { school: 'gender', gender: '女' }), /主要看的右手是「感情線長，尾端上揚到食指下」/);
  assert.match(handDiffText(d, { school: 'gender', gender: '' }), /選性別/);
  assert.match(handDiffText(d, { school: 'side', gender: '女' }), /天生（左手）是「感情線停在食指和中指之間」，後天（右手）是「感情線長，尾端上揚到食指下」/);
  assert.match(handDiffText(d, { school: 'dominant', dominant: 'left' }), /天生（右手）.+後天（左手）/);
  assert.match(handDiffText(d, { school: 'dominant', dominant: '' }), /選了慣用手/);
});
