// AR 星空的計算：太陽高度角對照公式、黃道經過太陽、旋轉矩陣和 W3C 公式一致、投影到螢幕中心、iPhone 指南針換算、
// 對準與文字描述。離線可跑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyNow, enu, rotationMatrix, lookMatrix, cameraDirection, iosOffset, project, nearest, separation, describe, phaseName, DEFAULT_PLACE } from '../js/core/sky.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b}（容許 ${tol}）`);

/** 某天台北當地中午前後一小時，太陽最高的高度角 */
function noonAltitude(isoDate) {
  let best = -90;
  for (let m = -60; m <= 60; m += 2) {
    const t = Date.parse(`${isoDate}T04:00:00Z`) + m * 60000; // 台北中午約 UTC 04:00
    best = Math.max(best, skyNow(t, DEFAULT_PLACE).bodies.find((b) => b.key === 'Sun').alt);
  }
  return best;
}

test('太陽的中午高度：夏至約 90－(25.04－23.44)＝88.4°、冬至約 90－(25.04＋23.44)＝41.5°', () => {
  close(noonAltitude('2026-06-21'), 88.4, 0.4, '夏至');
  close(noonAltitude('2026-12-21'), 41.5, 0.4, '冬至');
});

test('天上的東西：九顆（不含冥王星）、黃道 72 點、十二宮；太陽就在黃道上它的黃經那一點', () => {
  const t = Date.parse('2026-06-21T04:00:00Z');
  const sky = skyNow(t, DEFAULT_PLACE);
  assert.equal(sky.bodies.length, 9);
  assert.ok(!sky.bodies.some((b) => b.key === 'Pluto'));
  assert.equal(sky.ecliptic.length, 72);
  assert.deepEqual(sky.signs.map((s) => s.index), [...Array(12).keys()]);
  const sun = sky.bodies.find((b) => b.key === 'Sun');
  assert.equal(sun.sign, 2, '夏至太陽在雙子座的最後（巨蟹座 0° 前後）');
  // 黃道上最接近太陽黃經的點，離太陽不到 3°（每 5° 一點，加上太陽高掛、折射很小）
  const p = sky.ecliptic.reduce((a, b) => (Math.abs(b.lon - sun.lon) < Math.abs(a.lon - sun.lon) ? b : a));
  assert.ok(separation(p.az, p.alt, sun.az, sun.alt) < 3);
  const moon = sky.bodies.find((b) => b.key === 'Moon');
  assert.ok(moon.phase >= 0 && moon.phase < 360);
});

test('旋轉矩陣：平放朝北時是單位矩陣；直立時鏡頭方向和 W3C 規格範例的方位公式一致', () => {
  const I = rotationMatrix(0, 0, 0);
  I.forEach((row, i) => row.forEach((v, j) => close(v, i === j ? 1 : 0, 1e-12)));
  const W3C = (alpha, beta, gamma) => {
    const [a, b, g] = [alpha, beta, gamma].map((d) => (d * Math.PI) / 180);
    const vx = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
    const vy = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
    return ((Math.atan2(vx, vy) * 180) / Math.PI + 360) % 360;
  };
  for (const [a, b, g] of [[30, 80, 10], [200, 100, -20], [310, 60, 5], [95, 120, 30]]) {
    close(cameraDirection(rotationMatrix(a, b, g)).az, W3C(a, b, g), 1e-6, `${a},${b},${g}`);
  }
  // 直立（beta 90）朝北：鏡頭高度 0；往後仰 30°（beta 120）高度 30°
  close(cameraDirection(rotationMatrix(0, 90, 0)).alt, 0, 1e-9);
  close(cameraDirection(rotationMatrix(0, 120, 0)).alt, 30, 1e-9);
  // 拖曳用的矩陣：鏡頭就朝指定的方位、仰角
  const c = cameraDirection(lookMatrix(135, 30));
  close(c.az, 135, 1e-9);
  close(c.alt, 30, 1e-9);
});

test('投影：鏡頭正前方在螢幕中心、右邊 10° 在右、高 10° 在上、身後的不畫；橫拿螢幕會轉', () => {
  const R = rotationMatrix(0, 90, 0); // 直立朝北
  const view = { f: 500, cx: 200, cy: 400 };
  const c = project(R, enu(0, 0), view);
  close(c.x, 200, 1e-6);
  close(c.y, 400, 1e-6);
  const right = project(R, enu(10, 0), view);
  close(right.x, 200 + 500 * Math.tan((10 * Math.PI) / 180), 1e-6);
  close(right.y, 400, 1e-6);
  assert.ok(project(R, enu(0, 10), view).y < 400);
  assert.equal(project(R, enu(180, 0), view), null);
  assert.equal(project(R, enu(89, 0), view), null, '幾乎在正旁邊（超過約 85°）也不畫');
  // 橫拿（螢幕轉 90°）：本來在右邊的點跑到上面
  const turned = project(R, enu(10, 0), { ...view, screenAngle: 90 });
  close(turned.x, 200, 1e-6);
  assert.ok(turned.y < 400);
  // 任何姿勢：鏡頭朝的方向一定投影在中心
  const R2 = rotationMatrix(250, 115, -12);
  const d = cameraDirection(R2);
  const p = project(R2, enu(d.az, d.alt), view);
  close(p.x, 200, 1e-6);
  close(p.y, 400, 1e-6);
});

test('iPhone：相對 alpha 減掉偏移量＝360－指南針，平放和直立都成立', () => {
  for (const [rel, heading] of [[10, 71.6], [300, 20], [0, 0], [180, 359]]) {
    const abs = ((rel - iosOffset(rel, heading)) % 360 + 360) % 360;
    close(abs, (360 - heading) % 360, 1e-9, `${rel}/${heading}`);
    // 平放時手機頭的方位＝指南針；直立時鏡頭的方位＝指南針
    const flatTop = rotationMatrix(abs, 0, 0);
    close(((Math.atan2(flatTop[0][1], flatTop[1][1]) * 180) / Math.PI + 360) % 360, heading % 360, 1e-6, '平放');
    close(cameraDirection(rotationMatrix(abs, 90, 0)).az, heading % 360, 1e-6, '直立');
  }
});

test('對準與描述：7° 內最近的天體、方位與高度的講法、月相名稱', () => {
  const bodies = [{ key: 'Moon', az: 71.6, alt: 29 }, { key: 'Jupiter', az: 75, alt: 31 }, { key: 'Saturn', az: 174, alt: 66 }];
  assert.equal(nearest({ az: 72, alt: 29 }, bodies).key, 'Moon');
  assert.equal(nearest({ az: 75.5, alt: 31 }, bodies).key, 'Jupiter');
  assert.equal(nearest({ az: 120, alt: 10 }, bodies), null);
  assert.equal(describe({ az: 71.6, alt: 29 }), '東方、高 29°');
  assert.equal(describe({ az: 262, alt: -39.4 }), '西方、在地平線下 39°');
  assert.equal(phaseName(0), '新月');
  assert.equal(phaseName(90), '上弦月');
  assert.equal(phaseName(180), '滿月');
  assert.equal(phaseName(192), '滿月');
  assert.equal(phaseName(270), '下弦月');
  assert.equal(phaseName(350), '新月');
});
