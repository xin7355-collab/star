import test from 'node:test';
import assert from 'node:assert/strict';
import { solarToLunar, lunarToSolar, leapMonthOf, almanac, folkZodiac } from '../js/core/calendar.js';
import { buildBazi, shiShen, GAN, yearGanZhi, taiSui, taiSuiList, liunian, equationOfTime, branchRelations } from '../js/core/bazi.js';
import { LunarUtil, Solar } from '../vendor/lunar.js';
import { tw } from '../js/core/zh.js';
import { CHAR, AMBIGUOUS } from '../js/core/zh-data.js';

const SIMPLIFIED = new Set(Object.keys(CHAR).filter((c) => !AMBIGUOUS.includes(c)));
const assertTraditional = (s, where) => {
  for (const ch of String(s)) assert.ok(!SIMPLIFIED.has(ch), `${where}：「${s}」殘留簡體字「${ch}」`);
};

test('春節：2026-02-17 是丙午年（馬）正月初一；2025-01-29 是乙巳年（蛇）正月初一', () => {
  const a = solarToLunar({ y: 2026, m: 2, d: 17 });
  assert.equal(a.month, 1);
  assert.equal(a.day, 1);
  assert.equal(a.yearGanZhi, '丙午');
  assert.equal(a.zodiac, '馬');
  const b = solarToLunar({ y: 2025, m: 1, d: 29 });
  assert.equal(`${b.yearGanZhi}${b.zodiac}${b.month}/${b.day}`, '乙巳蛇1/1');
});

test('2026 中秋（農曆八月十五）是 9/25', () => {
  assert.deepEqual(lunarToSolar({ year: 2026, month: 8, day: 15 }).value, { y: 2026, m: 9, d: 25 });
});

test('閏月：2023 閏二月十五是 4/5；沒有的閏月與不存在的日子會擋下', () => {
  assert.equal(leapMonthOf(2023), 2);
  assert.deepEqual(lunarToSolar({ year: 2023, month: 2, day: 15, isLeap: true }).value, { y: 2023, m: 4, d: 5 });
  assert.equal(lunarToSolar({ year: 2024, month: 2, day: 1, isLeap: true }).ok, false);
  const r = lunarToSolar({ year: 2026, month: 1, day: 30 });
  if (!r.ok) assert.match(r.error, /只有 29 天/);
  const s = solarToLunar({ y: 2023, m: 4, d: 5 });
  assert.equal(s.isLeap, true);
  assert.equal(s.monthName, '閏二月');
});

test('農民曆：宜忌、沖煞、節氣都轉成台灣繁體', () => {
  const a = almanac({ y: 2026, m: 11, d: 24 });
  assert.ok(a.yi.length > 0 && a.ji.length > 0);
  assert.ok(a.yi.includes('納財'));
  assert.match(a.chong, /猴/);
  assert.equal(a.nextJieQi.name, '大雪');
  assert.deepEqual(a.nextJieQi.date, { y: 2026, m: 12, d: 7 });
  for (const s of [...a.yi, ...a.ji, a.chong, a.sha, ...a.pengzu, a.zhiXing, a.tianShen, a.lunarText, a.positions.xi, a.positions.cai]) assertTraditional(s, '農民曆');
});

test('一整年的農民曆都沒有殘留簡體字', () => {
  for (let i = 0; i < 366; i += 1) {
    const t = new Date(Date.UTC(2026, 0, 1) + i * 86400000);
    const a = almanac({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
    for (const s of [...a.yi, ...a.ji, a.chong, a.sha, ...a.pengzu, a.zhiXing, a.tianShen, a.lunarText, ...a.festivals, a.jieqi]) assertTraditional(s, `${t.toISOString().slice(0, 10)}`);
  }
});

test('簡轉繁：地支「丑」不會變「醜」，「谷雨」→「穀雨」，「冲」→「沖」', () => {
  assert.equal(tw('乙丑'), '乙丑');
  assert.equal(tw('丑'), '丑');
  assert.equal(tw('谷雨'), '穀雨');
  assert.equal(tw('冲'), '沖');
  assert.equal(tw('白蜡金'), '白蠟金');
  assert.equal(tw('干支'), '干支');
});

test('民俗生肖以正月初一為界：2026-02-16 還是蛇、2026-02-17 是馬', () => {
  assert.equal(folkZodiac({ y: 2026, m: 2, d: 16 }).name, '蛇');
  assert.equal(folkZodiac({ y: 2026, m: 2, d: 17 }).name, '馬');
});

test('十神：與 lunar-typescript 的對照表 100 組完全一致', () => {
  for (const a of GAN) for (const b of GAN) assert.equal(shiShen(a, b), tw(LunarUtil.SHI_SHEN[a + b]), `${a}${b}`);
});

// 與 tianji（獨立天文算法）交叉驗算過的 400 組之一部分（東八區、非 23 點）
const GOLDEN = [
  { y: 2034, m: 3, d: 25, h: 16, mi: 49, p: ['甲寅', '丁卯', '庚辰', '甲申'] },
  { y: 2047, m: 5, d: 23, h: 4, mi: 34, p: ['丁卯', '乙巳', '丁亥', '壬寅'] },
  { y: 1923, m: 6, d: 21, h: 8, mi: 16, p: ['癸亥', '戊午', '乙丑', '庚辰'] },
  { y: 1973, m: 12, d: 25, h: 10, mi: 25, p: ['癸丑', '甲子', '乙未', '辛巳'] },
  { y: 2063, m: 3, d: 5, h: 7, mi: 22, p: ['癸未', '甲寅', '壬辰', '甲辰'] },
];

test('四柱與 tianji 交叉驗算一致', () => {
  for (const g of GOLDEN) {
    const b = buildBazi({ date: { y: g.y, m: g.m, d: g.d }, time: { h: g.h, mi: g.mi }, tz: 'Etc/GMT-8', place: null });
    assert.deepEqual(b.pillars.map((p) => p.gan + p.zhi), g.p, `${g.y}-${g.m}-${g.d}`);
  }
});

test('台灣 1975 夏令時出生：自動減 1 小時排時柱', () => {
  const dst = buildBazi({ date: { y: 1975, m: 7, d: 1 }, time: { h: 13, mi: 30 }, tz: 'Asia/Taipei', place: null });
  assert.match(dst.notes.join(''), /日光節約時間/);
  assert.equal(dst.clockText, '1975-07-01 12:30');
  const wall = Solar.fromYmdHms(1975, 7, 1, 12, 30, 0).getLunar().getEightChar();
  assert.equal(dst.pillars[3].gan + dst.pillars[3].zhi, wall.getTime());
});

test('23 點後：預設隔天換日（sect 1），可改 0 點換日（sect 2）', () => {
  const input = { date: { y: 2030, m: 4, d: 18 }, time: { h: 23, mi: 40 }, tz: 'Etc/GMT-8', place: null };
  const s1 = buildBazi(input, { sect: 1 });
  const s2 = buildBazi(input, { sect: 2 });
  assert.equal(s2.pillars[2].gan + s2.pillars[2].zhi, '癸未');
  assert.equal(s1.pillars[2].gan + s1.pillars[2].zhi, '甲申');
});

test('海外出生：年柱看節氣的絕對時刻（洛杉磯 2024/2/4 00:30 已過立春）', () => {
  // 2024 立春 = 北京時間 2/4 16:27；洛杉磯 2/4 00:30 PST = 北京 2/4 16:30
  const after = buildBazi({ date: { y: 2024, m: 2, d: 4 }, time: { h: 0, mi: 30 }, tz: 'America/Los_Angeles', place: null });
  assert.equal(after.pillars[0].gan + after.pillars[0].zhi, '甲辰');
  const before = buildBazi({ date: { y: 2024, m: 2, d: 3 }, time: { h: 23, mi: 0 }, tz: 'America/Los_Angeles', place: null });
  assert.equal(before.pillars[0].gan + before.pillars[0].zhi, '癸卯');
});

test('沒有出生時間：只排三柱；交節氣當天會提醒月柱不確定', () => {
  const b = buildBazi({ date: { y: 1990, m: 8, d: 15 }, time: null, tz: 'Asia/Taipei', place: null });
  assert.equal(b.pillars[3], null);
  assert.equal(b.uncertain.length, 0);
  const jie = buildBazi({ date: { y: 2024, m: 2, d: 4 }, time: null, tz: 'Asia/Taipei', place: null });
  assert.ok(jie.uncertain.length >= 1);
});

test('大運：陽年女命逆行，九步大運；沒性別不排', () => {
  const input = { date: { y: 2000, m: 3, d: 21 }, time: { h: 8, mi: 0 }, tz: 'Asia/Taipei', place: null };
  const f = buildBazi(input, { gender: '女', today: { y: 2026, m: 11, d: 24 } });
  assert.equal(f.yun.forward, false);
  assert.equal(f.yun.list.length, 9);
  assert.equal(f.yun.list.filter((d) => d.current).length, 1);
  assert.equal(buildBazi(input).yun, null);
});

test('真太陽時：均時差 11 月初約 +16 分、2 月中約 -14 分', () => {
  assert.ok(Math.abs(equationOfTime(Date.parse('2026-11-03T04:00:00Z')) - 16.4) < 0.8);
  assert.ok(Math.abs(equationOfTime(Date.parse('2026-02-11T04:00:00Z')) + 14.2) < 0.8);
  const b = buildBazi({ date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: { lat: 25.04, lon: 121.56 } }, { solarTime: 'true' });
  assert.match(b.notes.join(''), /真太陽時/);
});

test('流年與犯太歲：2026 丙午年 → 馬值／刑太歲、鼠沖、牛害、兔破', () => {
  assert.equal(yearGanZhi(2026), '丙午');
  assert.equal(yearGanZhi(1984), '甲子');
  assert.deepEqual(taiSui('午', '午'), ['值太歲', '刑太歲']);
  assert.deepEqual(taiSui('子', '午'), ['沖太歲']);
  assert.deepEqual(taiSui('丑', '午'), ['害太歲']);
  assert.deepEqual(taiSui('卯', '午'), ['破太歲']);
  assert.deepEqual(taiSuiList(2026).map((x) => x.animal), ['鼠', '牛', '兔', '馬']);
  assert.deepEqual(branchRelations('寅', '申'), ['六沖', '相刑']);
  const b = buildBazi({ date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: null }, { gender: '男', today: { y: 2026, m: 11, d: 24 } });
  const ln = liunian(b, [2026, 2027]);
  assert.equal(ln[0].ganzhi, '丙午');
  assert.ok(ln[0].shishenText.length > 10);
  assert.ok(ln[0].dayun);
});
