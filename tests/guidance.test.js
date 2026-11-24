// 工作方向、開運佈置、解惑：命卦、九宮飛星、財庫、梅花易數、工作性質共識、未來三年。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Lunar } from '../vendor/lunar.js';
import { buildBazi, yongShen } from '../js/core/bazi.js';
import { buildZiwei } from '../js/core/ziwei.js';
import { buildNatal } from '../js/core/natal.js';
import { kuaNumber, liChunYear, flyingStars, personalDirections, wealthCorner, fishAdvice, baziWealthStore, buildFengshui, ELEMENT_ITEMS, place } from '../js/core/fengshui.js';
import { HEXAGRAMS } from '../js/core/iching-texts.js';
import { hexagram, castHexagram, castByTime, castByNumbers, trigramsOf } from '../js/core/iching.js';
import { buildCareer, NATURES, INDUSTRY } from '../js/core/career.js';
import { TOPICS, overall } from '../js/core/jiehuo.js';

const INPUT = { date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: { lon: 121.5, lat: 25.04 }, fold: null };
const TODAY = { y: 2026, m: 11, d: 24 };
const BAZI = buildBazi(INPUT, { gender: '男', today: TODAY });
const ZIWEI = buildZiwei(INPUT, { gender: '男', at: TODAY });
const NATAL = buildNatal(INPUT);

// ── 開運佈置
test('命卦：男 11－年數字和、女 4＋年數字和，5 男歸坤女歸艮；沒性別回傳 null', () => {
  const cases = [[1990, '男', 1], [1990, '女', 8], [2000, '男', 9], [2000, '女', 6], [1984, '男', 7], [1984, '女', 8], [1995, '男', 2], [1975, '男', 7]];
  for (const [y, g, k] of cases) assert.equal(kuaNumber(y, g), k, `${y}${g}`);
  assert.equal(kuaNumber(1990, ''), null);
  // 立春前出生算前一年：1990-02-03 是 1989 年（立春在 2/4）
  assert.equal(liChunYear({ y: 1990, m: 2, d: 3 }), 1989);
  assert.equal(liChunYear({ y: 1990, m: 2, d: 5 }), 1990);
  assert.equal(liChunYear({ y: 2026, m: 2, d: 3 }), 2025);
  const pd = personalDirections(INPUT.date, '男');
  assert.equal(pd.name, '坎卦');
  assert.equal(pd.group, '東四命');
  assert.deepEqual(pd.stars.filter((s) => s.good).map((s) => `${s.key}${s.dir}`), ['生氣東南', '天醫東', '延年南', '伏位北']);
});

test('九宮飛星：五黃 2024 西、2025 東北、2026 南、2027 北；2026 九紫東南、八白東、二黑西北；太歲與歲破', () => {
  const five = (y) => flyingStars(y).stars.find((s) => s.star === 5).dir;
  assert.deepEqual([2024, 2025, 2026, 2027].map(five), ['西', '東北', '南', '北']);
  const f = flyingStars(2026);
  assert.equal(f.center, 1);
  assert.deepEqual([f.at.東南, f.at.東, f.at.西北, f.at.東北], [9, 8, 2, 4]);
  assert.deepEqual(f.taisui, { dir: '南', zhi: '午', breaker: '北' });
  assert.equal(flyingStars(2027).center, 9);
  assert.equal(place('中'), '房子中央');
});

test('明財位、魚缸建議依主要喜用五行決定', () => {
  assert.deepEqual(wealthCorner('left').corners, ['right']);
  assert.deepEqual(wealthCorner('right').corners, ['left']);
  assert.deepEqual(wealthCorner('middle').corners, ['left', 'right']);
  const fit = (primary, secondary, avoid) => fishAdvice({ primary, secondary, avoid }).fit;
  assert.equal(fit('水', '金', ['土', '火']), 'great');
  assert.equal(fit('木', '水', ['金', '土']), 'good');
  assert.equal(fit('火', '木', ['金', '水']), 'no');
  assert.equal(fit('土', '金', ['水', '木']), 'no');
  assert.equal(fit('金', '水', ['火', '木']), 'good');
  assert.equal(fit('土', '火', ['木', '金']), 'ok');
  assert.equal(fishAdvice(null), null);
  for (const [wx, it] of Object.entries(ELEMENT_ITEMS)) {
    assert.ok(it.crystals.length >= 3 && it.plants.length >= 2 && it.flowers.length >= 2 && it.plantNote && it.desk, wx);
  }
});

test('財庫：財星的庫在不在命盤、有沒有沖開、哪一年沖開', () => {
  // 壬水日主，財星是火，火庫在戌；命盤庚午 甲申 壬子 癸卯沒有戌 → 沒有財庫，下一個辰年（2036）沖動戌庫
  const s = baziWealthStore(BAZI, 2026);
  assert.deepEqual([s.wealthWx, s.kuList, s.have, s.openYears], ['火', ['戌'], [], [2036]]);
  assert.match(s.lines[1], /沒有財庫/);
  // 手排：甲木日主（財星土，庫在辰或戌），命盤同時有辰和戌 → 有財庫且被沖開
  const fake = { ok: true, dayMaster: { wx: '木' }, pillars: [{ zhi: '辰' }, { zhi: '戌' }, { zhi: '子' }, null] };
  const o = baziWealthStore(fake, 2026);
  assert.deepEqual(o.have, ['辰', '戌']);
  assert.deepEqual(o.opened, ['辰', '戌']);
  assert.match(o.lines[1], /已經被沖開/);
});

test('開運佈置總表：財位步驟、今年財星與煞位、辦公桌、魚、命裡財庫都有', () => {
  const r = buildFengshui({ bazi: BAZI, ziwei: ZIWEI, birth: INPUT.date, gender: '男', today: TODAY, door: 'left' });
  assert.equal(r.year, 2026);
  assert.equal(r.ys.primary, '火');
  assert.ok(r.plan.length >= 5);
  assert.match(r.plan.join(''), /右手邊最裡面.*生氣方）在「東南」.*九紫在「東南」.*五黃在「南」/s);
  assert.equal(r.fish.fit, 'no');
  // 喜火的有利方位「南」2026 年剛好是五黃與太歲：要提醒改放次要喜用（木）的東、東南
  assert.deepEqual(r.clash, [{ dir: '南', what: ['五黃', '太歲'] }]);
  assert.match(r.plan.join(''), /「南」今年剛好是五黃、太歲所在.*「東、東南」/);
  assert.ok(r.desk[0].includes('東南'));
  assert.ok(r.store.ziwei.lines.length >= 1);
  // 沒有性別：個人吉方無法算，其他照常
  const noGender = buildFengshui({ bazi: BAZI, birth: INPUT.date, gender: null, today: TODAY });
  assert.equal(noGender.personal, null);
  assert.ok(noGender.plan.length >= 3);
});

// ── 梅花易數
test('六十四卦：卦名拆得出上下卦，8×8 每個組合剛好一卦、卦序 1～64 不重複', () => {
  assert.equal(HEXAGRAMS.length, 64);
  assert.deepEqual([...new Set(HEXAGRAMS.map((x) => x[0]))].sort((a, b) => a - b), Array.from({ length: 64 }, (_, i) => i + 1));
  const seen = new Set();
  for (let u = 1; u <= 8; u += 1) {
    for (let l = 1; l <= 8; l += 1) {
      const hx = hexagram(u, l);
      assert.ok(hx, `${u}-${l}`);
      seen.add(hx.name);
    }
  }
  assert.equal(seen.size, 64);
  assert.equal(trigramsOf('水雷屯').upper.name, '坎');
  assert.equal(trigramsOf('水雷屯').lower.name, '震');
  assert.equal(trigramsOf('乾為天').lower.name, '乾');
});

test('觀梅占：辰年十二月十七日申時 → 澤火革初爻動，互天風姤、變澤山咸，用離火剋體兌金為凶', () => {
  const r = castHexagram(2, 3, 1);
  assert.deepEqual([r.base.name, r.hu.name, r.bian.name], ['澤火革', '天風姤', '澤山咸']);
  assert.deepEqual([r.ti.name, r.yong.name, r.relation, r.verdict.level], ['兌', '離', '用剋體', '凶']);
  // 用真實日期起卦：農曆 2000 年（庚辰）十二月十七日，申時（16 點）
  const s = Lunar.fromYmd(2000, 12, 17).getSolar();
  const t = castByTime({ y: s.getYear(), m: s.getMonth(), d: s.getDay(), h: 16 });
  assert.equal(t.base.name, '澤火革');
  assert.equal(t.moving, 1);
  assert.match(t.basis, /辰年.*12月17日申時/);
});

test('數字起卦與體用：比和為吉；不合法的數字給白話錯誤', () => {
  const r = castHexagram(1, 2, 1); // 天澤履，動在下卦兌（金）為用，體乾（金）→ 比和
  assert.equal(r.base.name, '天澤履');
  assert.equal(r.relation, '比和');
  assert.equal(r.verdict.level, '吉');
  const n = castByNumbers(8, 16, 6); // 8、16 都是坤，6 → 上爻動
  assert.equal(n.ok, true);
  assert.equal(n.base.name, '坤為地');
  assert.equal(n.moving, 6);
  assert.match(n.position, /上爻/);
  for (const bad of [[0, 1, 1], ['a', 2, 3], [1, 2, 10000]]) assert.equal(castByNumbers(...bad).ok, false);
});

test('解惑：九類困擾都有四個具體步驟；結論把卦象和今年運勢一起看', () => {
  assert.equal(TOPICS.length, 9);
  for (const t of TOPICS) assert.equal(t.steps.length, 4, t.id);
  assert.ok(TOPICS.find((t) => t.id === 'health').steps.some((s) => s.includes('1925')));
  assert.ok(TOPICS.find((t) => t.id === 'love').steps.some((s) => s.includes('113')));
  const good = castHexagram(1, 2, 1);
  const bad = castHexagram(2, 3, 1);
  assert.equal(overall(good, 'good').tone, 'good');
  assert.equal(overall(bad, 'hard').tone, 'care');
  assert.equal(overall(bad, 'good').tone, 'mid');
});

// ── 工作方向
test('工作性質：兩個以上系統一致才算，每一票標出依據；喜用五行對應行業', () => {
  const r = buildCareer({ natal: NATAL, bazi: BAZI, ziwei: ZIWEI, birth: INPUT.date, bloodType: 'O', today: TODAY, lifePathNumber: 6 });
  assert.equal(r.consensus, true);
  for (const n of r.natures) {
    assert.ok(n.count >= 2 && n.sources.length === n.count && NATURES[n.key], n.key);
  }
  assert.equal(r.natures[0].label, '公眾溝通型');
  assert.ok(r.points.some((p) => p.system === '血型'));
  assert.equal(r.industries.primary, yongShen(BAZI).primary);
  assert.deepEqual(r.industries.list.slice(0, 3), INDUSTRY.火.slice(0, 3));
});

test('未來方向：三年各有重點與宜忌，大運、紫微大限都算得出來；沒有時間與性別也不出錯', () => {
  const r = buildCareer({ natal: NATAL, bazi: BAZI, ziwei: ZIWEI, birth: INPUT.date, today: TODAY, lifePathNumber: 6 });
  const f = r.future;
  assert.deepEqual(f.years.map((y) => y.year), [2026, 2027, 2028]);
  // 2026 丙午、2027 丁未：天干火是喜用 → 順；2028 戊申：土不是喜用也不是忌 → 平
  assert.deepEqual(f.years.map((y) => y.tone), ['good', 'good', 'mid']);
  assert.ok(f.years.every((y) => y.headline && y.doList.length && y.points.length >= 2));
  assert.match(f.years[0].points.find((p) => p.system === '占星').text, /木星（機會）走到第 12 宮獅子座/);
  assert.deepEqual([f.dayun.current.ganzhi, f.dayun.next.ganzhi], ['丁亥', '戊子']);
  assert.deepEqual([f.decade.current.palace, f.decade.next.palace], ['田宅', '官祿']);
  const bare = { date: INPUT.date, time: null, tz: 'Asia/Taipei', place: null, fold: null };
  const r2 = buildCareer({ natal: buildNatal(bare), bazi: buildBazi(bare, {}), ziwei: null, birth: INPUT.date, today: TODAY, lifePathNumber: 6 });
  assert.ok(r2.natures.length >= 1);
  assert.equal(r2.future.dayun, null);
  assert.equal(r2.future.decade, null);
});
