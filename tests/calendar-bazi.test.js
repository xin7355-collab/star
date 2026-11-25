import test from 'node:test';
import assert from 'node:assert/strict';
import { solarToLunar, lunarToSolar, leapMonthOf, almanac, folkZodiac, folkDays } from '../js/core/calendar.js';
import { buildBazi, shiShen, GAN, yearGanZhi, taiSui, taiSuiList, liunian, equationOfTime, branchRelations, yongShen } from '../js/core/bazi.js';
import { geju } from '../js/core/geju.js';
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

test('交界提醒：離換時辰 10 分鐘內列出另一個時柱；23 點那條線連日柱一起換', () => {
  const at = (h, mi, sect = 1) => buildBazi({ date: { y: 1990, m: 8, d: 15 }, time: { h, mi }, tz: 'Asia/Taipei', place: null }, { sect });
  // 壬子日：13:05 是未時（丁未），早 6 分鐘就是午時（丙午）
  const a = at(13, 5);
  assert.deepEqual(a.edges.hour.pillars, { 時柱: '丙午' });
  assert.match(a.uncertain.join(''), /早 6 分鐘，時柱就是「丙午」，不是「丁未」/);
  assert.match(at(13, 0).uncertain.join(''), /剛好是換時辰的時刻：實際只要早 1 分鐘/);
  assert.deepEqual(at(12, 55).edges.hour.pillars, { 時柱: '丁未' });
  // 範圍是 10 分鐘（含）：13:10 提醒、13:11 和 12:30 不提醒，也不留空的提醒
  assert.ok(at(13, 10).edges.hour);
  assert.equal(at(13, 11).edges.hour, null);
  assert.deepEqual(at(12, 30).uncertain, []);
  // 23 點換日（預設）：日柱、時柱一起換，提醒要講日主
  assert.deepEqual(at(22, 55).edges.hour.pillars, { 日柱: '癸丑', 時柱: '壬子' });
  assert.match(at(22, 55).uncertain.join(''), /日柱、時柱就是「癸丑」「壬子」.*日主/);
  // 0 點換日：23 點只換時柱，午夜才換日柱；23 點換日的人午夜兩邊同一張盤，不提醒
  assert.deepEqual(at(22, 55, 2).edges.hour.pillars, { 時柱: '壬子' });
  assert.equal(at(23, 55).edges.hour, null);
  const mid = at(23, 55, 2);
  assert.deepEqual(mid.edges.hour.pillars, { 日柱: '癸丑' });
  assert.match(mid.uncertain.join(''), /離換日的 00:00 只差 5 分鐘/);
});

test('交界提醒：離節氣交接 30 分鐘內列出另一個月柱（立春連年柱），格局不會叫已填時間的人補時間', () => {
  const at = (date, h, mi, tz = 'Asia/Taipei') => buildBazi({ date, time: { h, mi }, tz, place: null });
  // 2024 立春 = 北京時間 2/4 16:27:07
  const after = at({ y: 2024, m: 2, d: 4 }, 16, 40);
  assert.deepEqual(after.edges.month.pillars, { 年柱: '癸卯', 月柱: '乙丑' });
  assert.match(after.uncertain.join(''), /「立春」交接之後 13 分鐘：實際只要早 13 分鐘，年柱、月柱就是「癸卯」「乙丑」/);
  const g = geju(after).notes;
  assert.ok(g.some((t) => /請核對出生證明/.test(t)) && !g.some((t) => /補上出生時間/.test(t)), g.join('／'));
  // 交接時刻帶秒數：16:20 要晚到 16:28 才過立春，是 8 分鐘不是 7 分鐘
  const before = at({ y: 2024, m: 2, d: 4 }, 16, 20);
  assert.deepEqual([before.edges.month.minutes, before.edges.month.need], [7, 8]);
  assert.deepEqual(before.edges.month.pillars, { 年柱: '甲辰', 月柱: '丙寅' });
  assert.equal(at({ y: 2024, m: 2, d: 4 }, 15, 30).edges.month, null);
  // 一般的節只換月柱：1990 驚蟄 = 3/6 04:19:18
  assert.deepEqual(at({ y: 1990, m: 3, d: 6 }, 4, 0).edges.month.pillars, { 月柱: '己卯' });
  // 海外出生用絕對時刻：洛杉磯 2/4 00:30 = 北京 16:30，離立春約 3 分鐘
  assert.equal(at({ y: 2024, m: 2, d: 4 }, 0, 30, 'America/Los_Angeles').edges.month.minutes, 3);
  // 沒填時間、出生當天交節氣：這時格局才提醒補時間
  const noTime = buildBazi({ date: { y: 2024, m: 2, d: 4 }, time: null, tz: 'Asia/Taipei', place: null });
  assert.equal(noTime.edges.month.byDay, true);
  assert.ok(geju(noTime).notes.some((t) => /補上出生時間/.test(t)));
});

test('交界提醒：標準時間和真太陽時落在不同時辰，兩種設定都講另一種的結果', () => {
  // 台北 2 月中：經度 +6 分、均時差約 −14 分 → 標準時間 13:05 是未時，真太陽時 12:56 是午時
  const input = { date: { y: 1990, m: 2, d: 10 }, time: { h: 13, mi: 5 }, tz: 'Asia/Taipei', place: { lat: 25.04, lon: 121.5 } };
  const std = buildBazi(input);
  assert.equal(std.edges.solar, true);
  assert.match(std.uncertain[0], /真太陽時（經度與均時差校正後是 12:56）排，會是午時，不是未時/);
  assert.match(buildBazi(input, { solarTime: 'true' }).uncertain[0], /從未時（13:05）變成午時（12:56）/);
  assert.equal(buildBazi({ ...input, time: { h: 13, mi: 30 } }).edges.solar, false);
  assert.equal(buildBazi({ ...input, place: null }).edges.solar, false);
});

test('回歸：1984-02-04 23:30 剛過立春，兩種子時換日的時柱都是甲子；1994-07-07 12:00 女命約 10 年 4 個月起運', () => {
  const input = { date: { y: 1984, m: 2, d: 4 }, time: { h: 23, mi: 30 }, tz: 'Asia/Taipei', place: null };
  for (const sect of [1, 2]) {
    const b = buildBazi(input, { sect });
    assert.equal(b.pillars[0].gan + b.pillars[0].zhi, '甲子');
    assert.equal(b.pillars[3].gan + b.pillars[3].zhi, '甲子');
    assert.equal(b.edges.month.name, '立春'); // 立春 23:18 多，差 11 分鐘：要提醒
  }
  const f = buildBazi({ date: { y: 1994, m: 7, d: 7 }, time: { h: 12, mi: 0 }, tz: 'Asia/Taipei', place: null }, { gender: '女', today: { y: 2026, m: 11, d: 24 } });
  assert.equal(f.yun.forward, false); // 甲戌陽年女命逆行，往回數到芒種（6/6 06:04）約 31 天
  assert.deepEqual([f.yun.start.years, f.yun.start.months], [10, 4]);
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

// ── 喜用神（扶抑法）：用手排的四柱檢查身強身弱與取用，再用一個真實命盤確認接得上 buildBazi
const GW = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const ZW = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
function fakeBazi(gzs) {
  const labels = ['年柱', '月柱', '日柱', '時柱'];
  const pillars = gzs.map((gz, i) => ({ label: labels[i], gan: gz[0], zhi: gz[1], ganWx: GW[gz[0]], zhiWx: ZW[gz[1]], hidden: LunarUtil.ZHI_HIDE_GAN[gz[1]].map((g) => ({ gan: g, wx: GW[g] })) }));
  const withHidden = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const p of pillars) {
    withHidden[p.ganWx] += 1;
    for (const hg of p.hidden) withHidden[hg.wx] += 1;
  }
  return { ok: true, dayMaster: { gan: gzs[2][0], wx: GW[gzs[2][0]] }, pillars, wuxing: { withHidden } };
}

test('喜用神：身強比劫多取官殺、印多取財，身弱取印比，中和補最弱', () => {
  // 甲木生寅月、滿盤木：木 7、火 3.2、土 1.2 → 幫身 61%；比劫多取官殺（金），財（土）生官殺為輔
  const strongBi = yongShen(fakeBazi(['甲寅', '丙寅', '甲寅', '丙寅']));
  assert.equal(strongBi.strength, '身強');
  assert.deepEqual([strongBi.primary, strongBi.secondary, strongBi.roles.primary, strongBi.roles.secondary], ['金', '土', '官殺', '財']);
  assert.deepEqual(strongBi.avoid, ['水', '木']);
  assert.match(strongBi.reasons[0], /得令/);
  // 甲木生子月、滿盤水（印）：幫身 86%，印比比劫多 → 取財（土）；冬天缺火要提調候
  const strongYin = yongShen(fakeBazi(['壬子', '壬子', '甲子', '壬申']));
  assert.equal(strongYin.strength, '身強');
  assert.deepEqual([strongYin.primary, strongYin.roles.primary], ['土', '財']);
  assert.match(strongYin.tiaohou, /冬天出生/);
  // 甲木生酉月、滿盤金：幫身 15% → 取印（水）、比劫（木），忌官殺（金）與財（土）
  const weak = yongShen(fakeBazi(['庚申', '乙酉', '甲申', '庚午']));
  assert.equal(weak.strength, '身弱');
  assert.deepEqual([weak.primary, weak.secondary, weak.roles.primary], ['水', '木', '印']);
  assert.deepEqual(weak.avoid, ['金', '土']);
  assert.match(weak.reasons[0], /失令/);
  // 丁火：幫身 44% → 中和，補最弱的火，其次土；最旺的木不要再加
  const mid = yongShen(fakeBazi(['甲子', '己卯', '丁酉', '壬子']));
  assert.equal(mid.strength, '中和');
  assert.deepEqual([mid.primary, mid.secondary, mid.avoid], ['火', '土', ['木']]);
  assert.equal(yongShen(null), null);
  assert.equal(yongShen({ ok: false }), null);
});

test('喜用神：剛好 40% 算中和（不會因為小數誤差判成身弱），門檻附近並列另一種看法', () => {
  // 幫身 4.2、總和 10.5：小數相加會算成 0.39999…，以前被判成身弱、畫面卻寫「占 40%」
  const r = yongShen(fakeBazi(['乙卯', '丁亥', '丁未', '庚戌']));
  assert.equal(r.strength, '中和');
  assert.match(r.reasons[1], /占 40%：中和/);
  assert.equal(r.borderline, true);
  assert.equal(r.alt.strength, '身弱');
  assert.match(r.reasons.join(''), /分界附近/);
  // 比例遠離門檻的盤沒有這段
  assert.equal(yongShen(fakeBazi(['庚申', '乙酉', '甲申', '庚午'])).borderline, false);
});

test('喜用神：可能是化氣、從格、專旺時並列另一派的喜用，主要的喜用不變', () => {
  const hua = yongShen(fakeBazi(['壬辰', '辛亥', '丙申', '辛卯'])); // 丙辛合、亥月水當令又最旺
  assert.deepEqual([hua.special.kind, hua.special.name, hua.special.alt.primary, hua.special.alt.secondary], ['化氣', '化水格', '水', '金']);
  assert.equal(hua.primary, '木'); // 扶抑法的結果照常保留
  const cong = yongShen(fakeBazi(['庚申', '乙酉', '丙申', '乙丑'])); // 丙火在地支連藏干都無根、酉月金（財）當令
  assert.deepEqual([cong.special.kind, cong.special.name, cong.special.alt.primary], ['從格', '從財格', '金']);
  const zhuan = yongShen(fakeBazi(['甲辰', '丙寅', '乙卯', '癸未'])); // 乙木寅月、寅卯辰成方、無金
  assert.deepEqual([zhuan.special.kind, zhuan.special.alt.primary, zhuan.special.alt.secondary], ['專旺', '木', '火']);
  assert.match(zhuan.reasons.join(''), /專旺格.*兩種看法都列出來/);
  // 一般盤不標特殊格局
  assert.equal(yongShen(fakeBazi(['甲寅', '丙寅', '甲寅', '丙寅'])).special, null); // 比劫多但沒成方局：寅寅寅寅不成寅卯辰
});

test('喜用神：真實命盤（1990-08-15 06:20 庚午 甲申 壬子 癸卯）', () => {
  const b = buildBazi({ date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: null, fold: null }, {});
  const r = yongShen(b);
  // 壬水生申月（金生水，得令），印（金）比比劫（水）多 → 身強取財（火），食傷（木）為輔
  assert.equal(r.strength, '身強');
  assert.deepEqual([r.primary, r.secondary, r.avoid], ['火', '木', ['金', '水']]);
  assert.match(r.reasons.join(''), /申月.*得令.*身強.*印/);
});

test('農民曆：中元節與台灣常拜的神明生日（白名單、台灣說法），不混進「天君下降」這類日子', () => {
  // 中元節不在 getFestivals() 裡，以前完全不會出現
  assert.ok(almanac({ y: 2026, m: 8, d: 27 }).festivals.includes('中元節（普渡）'));
  assert.ok(almanac({ y: 2026, m: 5, d: 9 }).festivals.includes('媽祖生'));
  assert.ok(almanac({ y: 2027, m: 1, d: 23 }).festivals.includes('尾牙'));
  assert.ok(almanac({ y: 2026, m: 2, d: 25 }).festivals.includes('天公生'));
  const year = [];
  for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 86400000) {
    const d = new Date(t);
    year.push(...folkDays(Solar.fromYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()).getLunar()));
  }
  assert.ok(year.length >= 15 && year.length <= 25, String(year.length));
  assert.ok(year.every((n) => !/[下降天君]{3}|简|关|妈|观/.test(n)), year.join('、'));
});

test('農民曆：吉神凶煞、胎神（台灣寫「占」）、二十八宿、物候、數九三伏、年度項目', () => {
  const a = almanac({ y: 2027, m: 1, d: 5 });
  assert.ok(a.jiShen.length && a.xiongSha.length);
  assert.match(a.tai, /^占門爐/); // tw() 會把占轉成佔，要改回台灣農民曆的寫法
  assert.match(a.xiu, /^翼火蛇（凶）$/);
  assert.match(a.wuhou, /小寒 初候：雁北鄉/);
  assert.deepEqual(a.season, ['二九第6天']);
  assert.deepEqual(almanac({ y: 2026, m: 7, d: 25 }).season, ['中伏第1天']);
  assert.deepEqual(almanac({ y: 2026, m: 11, d: 24 }).yearItems, ['七龍治水', '四牛耕田', '五人分餅', '十日得金', '三鼠偷糧']);
});

test('八字盤面：十二長生、日柱空亡、胎元、命宮、身宮（和函式庫的 EightChar 一致）', () => {
  // 1990-05-15 12:00：庚午 辛巳 庚辰 壬午
  const b = buildBazi({ date: { y: 1990, m: 5, d: 15 }, time: { h: 12, mi: 0 }, tz: 'Asia/Taipei', place: null, fold: null }, {});
  assert.deepEqual(b.pillars.map((p) => p.gan + p.zhi), ['庚午', '辛巳', '庚辰', '壬午']);
  assert.deepEqual(b.extra.changSheng, ['沐浴', '長生', '養', '沐浴']);
  assert.equal(b.extra.kong, '申酉');
  assert.deepEqual(b.extra.kongPillars, []);
  assert.deepEqual([b.extra.taiYuan, b.extra.mingGong, b.extra.shenGong], ['壬申', '壬午', '戊子']);
  // 沒有出生時間：命宮、身宮不算
  const noTime = buildBazi({ date: { y: 1990, m: 5, d: 15 }, time: null, tz: 'Asia/Taipei', place: null, fold: null }, {});
  assert.equal(noTime.extra.mingGong, null);
  assert.equal(noTime.extra.changSheng.length, 4);
  assert.equal(noTime.extra.changSheng[3], null);
});

test('流年：伏吟、天剋地沖、歲運並臨、流年沖大運', () => {
  // 庚午 甲申 壬子 癸卯，男：大運乙酉 1998–2007、丙戌 2008–2017、丁亥 2018–2027
  const b = buildBazi({ date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: null, fold: null }, { gender: '男', today: { y: 2026, m: 11, d: 24 } });
  const byYear = Object.fromEntries(liunian(b, [1999, 2004, 2005, 2010, 2026]).map((ln) => [ln.year, ln.triggers.map((t) => t.type)]));
  assert.deepEqual(byYear[2004], ['伏吟']); // 甲申＝月柱
  assert.deepEqual(byYear[2005], ['歲運並臨']); // 乙酉＝大運
  assert.deepEqual(byYear[1999], ['沖大運']); // 卯沖大運乙酉的酉
  assert.deepEqual(byYear[2010], ['天剋地沖']); // 庚寅對月柱甲申：甲庚沖、寅申沖
  assert.deepEqual(byYear[2026], ['天剋地沖']); // 丙午對日柱壬子：丙壬沖、子午沖
  const t2026 = liunian(b, [2026])[0].triggers[0];
  assert.match(t2026.text, /日柱壬子天剋地沖/);
});

test('農民曆神煞：函式庫漏翻的代碼（sn.xxx）不會出現在畫面上，能確定的對回中文', async () => {
  const { almanac, shenSha } = await import('../js/core/calendar.js');
  assert.deepEqual(shenSha(['sn.sanSang', 'sn.guiKu', 'sn.siLi', 'sn.daTui', '天恩']), ['三喪', '鬼哭', '四離', '天恩']);
  // 2026 全年掃一遍：吉神、凶煞都不可以有英文代碼
  for (let i = 0; i < 365; i += 1) {
    const dt = new Date(Date.UTC(2026, 0, 1 + i));
    const a = almanac({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
    for (const x of [...a.jiShen, ...a.xiongSha]) assert.doesNotMatch(x, /[a-z]/, `${dt.toISOString().slice(0, 10)} ${x}`);
  }
  assert.ok(almanac({ y: 2026, m: 12, d: 29 }).xiongSha.includes('三喪'));
});

test('神煞：庚午 甲申 壬子 癸卯 → 天乙貴人在時柱、日刃、桃花在時柱、驛馬在月柱；流年干支分喜忌', async () => {
  const { buildBazi, shensha, liunian, ganzhiTone } = await import('../js/core/bazi.js');
  const b = buildBazi({ date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, lat: 25.04, lon: 121.5, tz: 'Asia/Taipei' }, { gender: '男', today: { y: 2026, m: 11, d: 24 } });
  const ss = Object.fromEntries(shensha(b).map((x) => [x.name, x.at]));
  assert.deepEqual(ss, { 天乙貴人: ['時柱'], 羊刃: ['日柱'], 桃花: ['時柱'], 驛馬: ['月柱'] });
  // 魁罡：庚辰日
  const kg = buildBazi({ date: { y: 2000, m: 1, d: 10 }, time: { h: 12, mi: 0 }, lat: 25.04, lon: 121.5, tz: 'Asia/Taipei' }, { today: { y: 2026, m: 11, d: 24 } });
  if (`${kg.pillars[2].gan}${kg.pillars[2].zhi}` === '庚辰') assert.ok(shensha(kg).some((x) => x.name === '魁罡'));
  // 身強喜火木、忌金水：丙午年干支都喜、戊申年地支是忌
  const [y26, , y28] = liunian(b, [2026, 2027, 2028]);
  assert.deepEqual([y26.tone.gan, y26.tone.zhi], ['喜', '喜']);
  assert.deepEqual([y28.tone.gan, y28.tone.zhi], ['平', '忌']);
  assert.equal(ganzhiTone(b, '庚子').text, '天干、地支都是忌神：壓力大的一段，守成為主，重大決定多想一步。');
});

test('稱骨加深：21～72 兩都有人生三段；分類、骨重區間、百分位', async () => {
  const { STAGES, patternOf, bandOf, percentileOf, PATTERNS } = await import('../js/core/chenggu.js');
  for (let t = 21; t <= 72; t += 1) {
    assert.match(STAGES[t], /^[苦平順]{3}$/, String(t));
    const pat = patternOf(t);
    assert.ok(PATTERNS[pat.key] && pat.text && pat.stages.length === 3, String(t));
  }
  // 依歌訣：26「晚來衣祿自無憂」晚成、30「老來稍可免憂愁」自立、32「到得中年衣食旺」中年起飛、68「十年不比前番事」少年得志
  assert.equal(patternOf(26).key, 'late');
  assert.equal(patternOf(30).key, 'selfmade');
  assert.equal(patternOf(32).key, 'midrise');
  assert.equal(patternOf(68).key, 'early');
  assert.equal(patternOf(21).key, 'hard');
  assert.equal(patternOf(51).key, 'steady');
  assert.equal(bandOf(30).name, '偏輕');
  assert.equal(bandOf(31).name, '中等');
  assert.equal(bandOf(42).name, '中上');
  assert.equal(bandOf(51).name, '偏重');
  // 百分位：最輕 0、越重越高、最重的 7 兩 1 錢不到 100（無條件捨去）
  assert.equal(percentileOf(21), 0);
  for (let t = 22; t <= 71; t += 1) assert.ok(percentileOf(t) >= percentileOf(t - 1), String(t));
  assert.ok(percentileOf(71) < 100 && percentileOf(71) >= 99);
  assert.equal(patternOf(20), null);
});
