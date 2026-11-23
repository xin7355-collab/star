import test from 'node:test';
import assert from 'node:assert/strict';
import { positionsAt, anglesAt, searchSunLongitude } from '../js/core/astro.js';
import { buildNatal, signOptions } from '../js/core/natal.js';
import { SIGN_INDEX } from '../js/core/zodiac.js';

// 標準答案由 lilith-diviner（Python, astronomy-engine 2.1.19）產生
const GOLDEN = [
  { iso: '1990-08-15T06:20:00+08:00', lat: 25.0375, lon: 121.5637, ASC: 152.6565, MC: 61.7449, Sun: 141.8582, Moon: 68.6984, Venus: 121.2334 },
  { iso: '1975-07-01T12:00:00+09:00', lat: 22.6273, lon: 120.3014, ASC: 174.3268, MC: 84.3564, Sun: 98.6829, Moon: 2.4614, Venus: 143.4144 },
  { iso: '2010-12-01T22:45:00-05:00', lat: 40.7128, lon: -74.006, ASC: 150.8624, MC: 55.4689, Sun: 249.8456, Moon: 203.4921, Venus: 210.9238 },
];

const close = (a, b, tol = 0.001) => Math.abs((((a - b + 180) % 360) + 360) % 360 - 180) < tol;

test('行星位置、上升、天頂與 lilith-diviner 一致', () => {
  for (const g of GOLDEN) {
    const ms = Date.parse(g.iso);
    const p = positionsAt(ms);
    const a = anglesAt(ms, g.lat, g.lon);
    for (const k of ['Sun', 'Moon', 'Venus']) assert.ok(close(p[k].lon, g[k]), `${g.iso} ${k} ${p[k].lon} vs ${g[k]}`);
    assert.ok(close(a.ASC, g.ASC), `${g.iso} ASC ${a.ASC} vs ${g.ASC}`);
    assert.ok(close(a.MC, g.MC), `${g.iso} MC ${a.MC} vs ${g.MC}`);
  }
});

test('2000 年春分：太陽於 07:35 UTC 進入牡羊座', () => {
  const t = searchSunLongitude(0, Date.parse('2000-03-19T00:00:00Z'), 3);
  const iso = new Date(t).toISOString();
  assert.ok(iso.startsWith('2000-03-20T07:3'), iso);
});

test('沒填出生時間、生日剛好在交界：列出換座時刻（台灣 15:35）', () => {
  const n = buildNatal({ date: { y: 2000, m: 3, d: 20 }, time: null, tz: 'Asia/Taipei' });
  assert.equal(n.ok, true);
  assert.equal(n.sun.certain, false);
  assert.deepEqual(n.sun.options, [SIGN_INDEX.pisces, SIGN_INDEX.aries]);
  assert.match(n.sun.switchLocal, /^15:3[4-6]$/);
});

test('美西出生：換座發生在當地 3/19 晚上 23:35（PST），3/20 全天已是牡羊座', () => {
  const day19 = buildNatal({ date: { y: 2000, m: 3, d: 19 }, time: null, tz: 'America/Los_Angeles' });
  assert.equal(day19.sun.certain, false);
  assert.match(day19.sun.switchLocal, /^23:3[4-6]$/);
  const day20 = buildNatal({ date: { y: 2000, m: 3, d: 20 }, time: null, tz: 'America/Los_Angeles' });
  assert.equal(day20.sun.certain, true);
  assert.equal(day20.sun.sign, SIGN_INDEX.aries);
});

test('一般日期太陽星座確定', () => {
  const n = buildNatal({ date: { y: 2000, m: 3, d: 22 }, time: null, tz: 'Asia/Taipei' });
  assert.equal(n.sun.certain, true);
  assert.equal(n.sun.sign, SIGN_INDEX.aries);
  assert.ok(n.warnings.length > 0);
});

test('有時間有地點：算出上升星座與宮位；台灣 1975 夏令時自動 +9', () => {
  const n = buildNatal({
    date: { y: 1975, m: 7, d: 1 }, time: { h: 12, mi: 0 }, tz: 'Asia/Taipei',
    place: { lat: 22.6273, lon: 120.3014, name: '高雄市' },
  });
  assert.equal(n.ok, true);
  assert.equal(n.offsetLabel, 'UTC+9');
  assert.ok(close(n.angles.ASC, 174.3268));
  assert.equal(n.rising, SIGN_INDEX.virgo);
  for (const b of Object.values(n.positions)) assert.ok(b.house >= 1 && b.house <= 12);
});

test('不存在／重複的時刻不會被默默算錯', () => {
  const gap = buildNatal({ date: { y: 1979, m: 7, d: 1 }, time: { h: 0, mi: 30 }, tz: 'Asia/Taipei' });
  assert.equal(gap.ok, false);
  const dup = buildNatal({ date: { y: 1979, m: 9, d: 30 }, time: { h: 23, mi: 30 }, tz: 'Asia/Taipei' });
  assert.equal(dup.ok, false);
  assert.equal(dup.needFold, true);
  assert.equal(dup.options.length, 2);
  const chosen = buildNatal({ date: { y: 1979, m: 9, d: 30 }, time: { h: 23, mi: 30 }, tz: 'Asia/Taipei', fold: 1 });
  assert.equal(chosen.ok, true);
});

test('signOptions：未知時間給可能星座清單', () => {
  const n = buildNatal({ date: { y: 2000, m: 3, d: 20 }, time: null, tz: 'Asia/Taipei' });
  assert.deepEqual(signOptions(n, 'Sun'), [SIGN_INDEX.pisces, SIGN_INDEX.aries]);
});
