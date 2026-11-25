// 手機指南針：iPhone／Android 的事件換算、八方位與二十四山的邊界、跨 0° 的轉向與平滑。離線可跑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingFromEvent, dirOf, mountainOf, turn, turnHint, smooth, unwrap, isFlat, norm } from '../js/core/compass.js';

test('事件換算：iPhone 用 webkitCompassHeading、Android 用 360－alpha（只收絕對角度）、橫向補螢幕角度', () => {
  assert.deepEqual(headingFromEvent({ type: 'deviceorientation', webkitCompassHeading: 135, webkitCompassAccuracy: 10, alpha: 12 }), { heading: 135, accuracy: 10 });
  assert.deepEqual(headingFromEvent({ type: 'deviceorientationabsolute', alpha: 225, absolute: true }), { heading: 135, accuracy: null });
  assert.deepEqual(headingFromEvent({ type: 'deviceorientation', alpha: 90, absolute: true }), { heading: 270, accuracy: null });
  assert.equal(headingFromEvent({ type: 'deviceorientation', alpha: 90, absolute: false }), null, '相對角度不能當指南針');
  assert.equal(headingFromEvent({ type: 'deviceorientation', alpha: null, beta: null, gamma: null }), null, '電腦沒有感測器');
  assert.equal(headingFromEvent({ type: 'deviceorientation', webkitCompassHeading: -1 }), null, 'iPhone 還沒校正好');
  assert.equal(headingFromEvent({ type: 'deviceorientationabsolute', alpha: 0, absolute: true }).heading, 0);
  assert.equal(headingFromEvent({ webkitCompassHeading: 300 }, 90).heading, 30, '橫向：畫面上方＝手機頭再轉 90°');
  assert.equal(headingFromEvent(null), null);
});

test('八方位與二十四山：邊界在 22.5° 與 7.5°，359° 還是北、子山', () => {
  assert.equal(dirOf(0), '北');
  assert.equal(dirOf(359), '北');
  assert.equal(dirOf(22.4), '北');
  assert.equal(dirOf(22.6), '東北');
  assert.equal(dirOf(135), '東南');
  assert.equal(dirOf(-90), '西');
  assert.equal(mountainOf(0), '子');
  assert.equal(mountainOf(353), '子');
  assert.equal(mountainOf(351), '壬');
  assert.equal(mountainOf(135), '巽');
  assert.equal(mountainOf(180), '午');
  assert.equal(mountainOf(45), '艮');
  assert.equal(mountainOf(315), '乾');
  assert.equal(mountainOf(225), '坤');
});

test('轉向：走短的那一邊、15° 內算對準、度數取 5 的倍數', () => {
  assert.equal(turn(350, 10), 20);
  assert.equal(turn(10, 350), -20);
  assert.equal(turn(0, 180), 180);
  assert.deepEqual(turnHint(120, 135), { delta: 15, onTarget: true, side: null, text: '就是這個方向' });
  assert.equal(turnHint(90, 135).text, '往右轉 45°');
  assert.equal(turnHint(170, 135).text, '往左轉 35°');
  assert.equal(turnHint(300, 45).text, '往右轉 105°');
  assert.equal(turnHint(0, 17).text, '往右轉 15°');
  assert.equal(turnHint(0, 2, 0).text, '往右轉 5°', '容許 0° 時，差一點點也至少說 5°，不會出現「轉 0°」');
});

test('平滑：跨 0° 不會繞一大圈、大轉身直接跳；連續角度不會整圈倒轉', () => {
  assert.equal(smooth(null, 200), 200);
  assert.equal(smooth(350, 10, 0.5), 0);
  assert.equal(smooth(10, 350, 0.5), 0);
  assert.equal(smooth(0, 100), 100, '超過 60° 直接跳過去');
  let cont = unwrap(null, 350);
  cont = unwrap(cont, 10);
  assert.equal(cont, 370);
  cont = unwrap(cont, 340);
  assert.equal(cont, 340);
  assert.equal(norm(-30), 330);
});

test('放平判斷：前後、左右傾斜 50° 以內算平', () => {
  assert.equal(isFlat(10, -20), true);
  assert.equal(isFlat(80, 0), false);
  assert.equal(isFlat(0, -60), false);
  assert.equal(isFlat(null, null), true, '沒有傾斜資料就不要誤報');
});
