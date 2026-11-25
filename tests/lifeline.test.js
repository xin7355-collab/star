// 人生時間軸：未來 10 年的分數、標籤、可能遇到的事；占星回歸用天文週期驗證；接下來 12 個月的流月。離線可跑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBazi } from '../js/core/bazi.js';
import { buildNatal } from '../js/core/natal.js';
import { bodyLongitude } from '../js/core/astro.js';
import { buildLifeline, monthsAhead, levelOf, returnsIn, WARN_TAGS, GOOD_TAGS } from '../js/core/lifeline.js';
import { SHISHEN_YEAR, LEVEL_TEXT, TAISUI_TEXT } from '../js/core/lifeline-texts.js';
import { addDays, isoDate } from '../js/core/date.js';

const INPUT = { date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: { lon: 121.5, lat: 25.04 }, fold: null };
const TODAY = { y: 2026, m: 11, d: 25 };
const bazi = buildBazi(INPUT, { gender: '男', today: TODAY });
const natal = buildNatal(INPUT);
const L = buildLifeline({ bazi, natal, birth: INPUT.date, today: TODAY, gender: '男' });
const year = (y) => L.years.find((x) => x.year === y);

test('未來 10 年：每年都有等級、標籤和各系統的說明，沒有程式值', () => {
  assert.deepEqual(L.years.map((y) => y.year), [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
  for (const y of L.years) {
    assert.equal(y.level, levelOf(y.score));
    assert.ok(LEVEL_TEXT[y.level]);
    assert.equal(y.age, y.year - 1990);
    assert.ok(y.events.length >= 6, String(y.year));
    for (const e of y.events) {
      assert.ok(['八字', '占星', '生命靈數', '瑪雅'].includes(e.system));
      assert.ok(['good', 'bad', 'info'].includes(e.tone));
      assert.doesNotMatch(e.text, /undefined|null|NaN/);
    }
    for (const t of y.tags) assert.ok(t.endsWith('年') || WARN_TAGS.includes(t) || GOOD_TAGS.includes(t), `${y.year} 的標籤「${t}」沒有分類`);
  }
});

test('壬子日柱、屬馬：2026 丙午天剋地沖＋值太歲＋沖日支；2032 壬子伏吟＋沖太歲是最要小心的一年', () => {
  for (const t of ['天剋地沖', '值太歲', '沖日支']) assert.ok(year(2026).tags.includes(t), t);
  assert.ok(year(2032).tags.includes('伏吟') && year(2032).tags.includes('沖太歲'));
  assert.equal(year(2032).level, '小心');
  assert.equal(L.watch[0].year, 2032);
  assert.ok(year(2026).events.some((e) => e.text === TAISUI_TEXT.值太歲));
  // 偏財年：男命傳統說法（財星也代表伴侶）只對男命出現
  assert.ok(year(2026).events.some((e) => e.text.includes('男命的財星也代表伴侶')));
  const female = buildLifeline({ bazi, natal, birth: INPUT.date, today: TODAY, gender: '女' });
  assert.ok(!female.years[0].events.some((e) => e.text.includes('男命')));
  // 流年十神的工作、財務、感情都有寫
  for (const y of L.years) for (const k of ['work', 'money', 'love']) assert.ok(y.events.some((e) => e.text.includes(SHISHEN_YEAR[y.shishen][k])), `${y.year} ${k}`);
  // 交大運的那一年會標出來
  const starts = bazi.yun.list.map((d) => d.startYear).filter((y) => y >= 2026 && y <= 2035);
  for (const y of starts) assert.ok(year(y).tags.includes('交大運'), String(y));
});

test('等級門檻：單純干支都忌是「注意」，疊上沖剋才是「小心」', () => {
  assert.equal(levelOf(2), '順');
  assert.equal(levelOf(0.5), '小順');
  assert.equal(levelOf(0), '平');
  assert.equal(levelOf(-0.5), '平');
  assert.equal(levelOf(-1), '注意');
  assert.equal(levelOf(-2), '注意');
  assert.equal(levelOf(-2.5), '小心');
  // 順的年份不會拿壓力類標籤當理由（也不會出現在順的清單裡）
  for (const y of L.good) assert.ok(y.level === '順' || y.level === '小順');
  for (const y of L.watch) assert.ok(y.level === '注意' || y.level === '小心');
});

test('占星的人生轉折點符合天文週期：土星回歸 27～31 歲、木星回歸每 12 年、天王星對分 38～46 歲', () => {
  for (const birthYear of [1975, 1988, 2000]) {
    const ms = Date.UTC(birthYear, 0, 15, 4);
    const pos = { Jupiter: bodyLongitude('Jupiter', ms), Saturn: bodyLongitude('Saturn', ms), Uranus: bodyLongitude('Uranus', ms) };
    const ages = (key, from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((a) => returnsIn(birthYear + a, pos)[key]);
    const saturn = ages('saturn', 20, 35);
    assert.ok(saturn.length >= 1 && saturn.every((a) => a >= 27 && a <= 31), `${birthYear} 土星回歸 ${saturn}`);
    const jupiter = ages('jupiter', 5, 30);
    assert.ok(jupiter.some((a) => a >= 11 && a <= 13) && jupiter.some((a) => a >= 23 && a <= 25), `${birthYear} 木星回歸 ${jupiter}`);
    assert.ok(jupiter.every((a) => [11, 12, 13, 23, 24, 25].includes(a)), `${birthYear} 木星回歸 ${jupiter}`);
    const uranus = ages('uranus', 30, 50);
    assert.ok(uranus.length >= 1 && uranus.every((a) => a >= 38 && a <= 46), `${birthYear} 天王星對分 ${uranus}`);
  }
});

test('接下來 12 個月：以節氣換月、首尾相接、第一個月包含今天，水星逆行和日月食標在對的月份', () => {
  const M = monthsAhead({ bazi, today: TODAY });
  assert.equal(M.length, 12);
  assert.ok(isoDate(M[0].start) <= isoDate(TODAY) && isoDate(M[0].end) >= isoDate(TODAY));
  for (let i = 1; i < M.length; i += 1) assert.equal(isoDate(M[i].start), isoDate(addDays(M[i - 1].end, 1)));
  for (const m of M) {
    assert.match(m.ganzhi, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    assert.ok(SHISHEN_YEAR[m.shishen]);
    assert.equal(m.level, levelOf(m.score));
  }
  // 2026/12/7 大雪起是庚子月（子午沖：屬馬的人沖生肖）
  const zi = M.find((m) => m.ganzhi === '庚子');
  assert.deepEqual(zi.start, { y: 2026, m: 12, d: 7 });
  assert.ok(zi.notes.some((n) => n.text.startsWith('沖生肖')));
  // 2027 年 2 月的水星逆行（2/10～3/3）落在寅月
  assert.ok(M.find((m) => m.ganzhi === '壬寅').notes.some((n) => n.text.startsWith('水星逆行 2/10～3/3')));
});
