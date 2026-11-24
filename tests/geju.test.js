// 月令格局：取格（祿刃、月劫、會局、透干、本氣、四庫比劫）與成敗救應，用手排的四柱逐條檢查；
// 再用真實命盤確認接得上 buildBazi（大運、沒有時間的提醒）。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LunarUtil } from '../vendor/lunar.js';
import { buildBazi, shiShen } from '../js/core/bazi.js';
import { geju, gejuTone, GEJU_INFO, STATUS_TEXT } from '../js/core/geju.js';

const GW = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const ZW = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
function fakeBazi(gzs) {
  const labels = ['年柱', '月柱', '日柱', '時柱'];
  const dm = gzs[2][0];
  const pillars = gzs.map((gz, i) => ({
    label: labels[i],
    gan: gz[0],
    zhi: gz[1],
    ganWx: GW[gz[0]],
    zhiWx: ZW[gz[1]],
    shishen: i === 2 ? '日主' : shiShen(dm, gz[0]),
    hidden: LunarUtil.ZHI_HIDE_GAN[gz[1]].map((g) => ({ gan: g, wx: GW[g], shishen: shiShen(dm, g) })),
  }));
  const withHidden = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const p of pillars) {
    withHidden[p.ganWx] += 1;
    for (const hg of p.hidden) withHidden[hg.wx] += 1;
  }
  return { ok: true, uncertain: [], yun: null, dayMaster: { gan: dm, wx: GW[dm] }, pillars, wuxing: { withHidden } };
}
// 手排的四柱也要是真的排得出來的：月干照五虎遁（年干定寅月干）、時干照五鼠遁（日干定子時干）
const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const TIGER = { 甲: 2, 己: 2, 乙: 4, 庚: 4, 丙: 6, 辛: 6, 丁: 8, 壬: 8, 戊: 0, 癸: 0 };
const RAT = { 甲: 0, 己: 0, 乙: 2, 庚: 2, 丙: 4, 辛: 4, 丁: 6, 壬: 6, 戊: 8, 癸: 8 };
function G(s) {
  const [y, m, d, h] = s.split(' ');
  assert.equal(m[0], GAN[(TIGER[y[0]] + ((ZHI.indexOf(m[1]) - 2 + 12) % 12)) % 10], `${s}：月柱和年干對不上`);
  assert.equal(h[0], GAN[(RAT[d[0]] + ZHI.indexOf(h[1])) % 10], `${s}：時柱和日干對不上`);
  return geju(fakeBazi([y, m, d, h]));
}
const tones = (g) => g.items.map((x) => x.tone);

test('取格：祿刃與月劫優先，其次會局、透干、本氣', () => {
  assert.equal(G('己亥 丙寅 甲子 辛未').name, '建祿格'); // 寅是甲的祿
  assert.equal(G('甲午 丁卯 甲寅 丙寅').name, '羊刃格'); // 卯是甲的羊刃
  assert.equal(G('乙丑 戊寅 乙亥 丙子').name, '月劫格'); // 陰干乙生寅月，本氣甲是劫財
  // 甲日辰月，地支申子辰三合水局，年干壬透出 → 照透出的壬定為偏印（《子平真詮》「會支」的例子）
  const ju = G('壬申 甲辰 甲子 丙寅');
  assert.equal(ju.name, '偏印格');
  assert.match(ju.how, /三合成水局，年干壬透出，照它定為偏印/);
  // 酉月沒有透辛 → 仍取本氣正官
  const ben = G('甲子 癸酉 甲辰 甲子');
  assert.equal(ben.name, '正官格');
  assert.match(ben.how, /沒有透出天干，以本氣辛/);
  // 戊日辰月：本氣戊是比肩不取；餘氣癸透出 → 正財格；什麼都沒透 → 歸月劫
  assert.equal(G('癸亥 丙辰 戊午 甲寅').name, '正財格');
  const jie = G('甲子 戊辰 戊午 甲寅');
  assert.equal(jie.name, '月劫格');
  assert.match(jie.how, /只有本氣戊（比肩）透出在月干戊，四庫月透出比劫歸月劫/);
});

test('正官格：財印相生成格、傷官見官破格、有印能救、成格又帶傷是「成中帶忌」', () => {
  const ok = G('戊辰 辛酉 甲子 丙寅');
  assert.equal(ok.status, '成格');
  assert.match(ok.items[0].text, /^財生官（年干戊）/);
  const broken = G('丙午 丁酉 甲寅 甲子');
  assert.equal(broken.status, '破格');
  assert.match(broken.items.find((x) => x.tone === 'bad').text, /^傷官見官（月干丁）/);
  const saved = G('丙午 丁酉 甲寅 壬申');
  assert.equal(saved.status, '敗中有救');
  assert.match(saved.items.find((x) => x.tone === 'good').text, /^官印相生（時干壬）/);
  assert.match(saved.items.find((x) => x.tone === 'rescue').text, /但有印（時干壬）制住傷官/);
  // 官逢刑也算：月支酉、時支酉自刑，又沒有合來解
  const xing = G('丙午 丁酉 甲寅 癸酉');
  assert.equal(xing.status, '成中帶忌');
  assert.match(xing.items.find((x) => x.tone === 'bad' && /相刑/.test(x.text)).text, /^月令酉和時支酉相刑/);
  const mixed = G('丁亥 己酉 甲子 丙寅');
  assert.equal(mixed.status, '成中帶忌');
  assert.deepEqual(tones(mixed), ['good', 'bad']);
  // 時支卯沖月令酉、年支辰六合酉：合能解沖
  const chong = G('戊辰 辛酉 甲子 丁卯');
  assert.match(chong.items.find((x) => x.tone === 'rescue').text, /被時支卯沖.*但年支辰合住月令/);
});

test('五合要緊鄰才合得住：年干、月干相合能合殺留官，隔著日主的月干、時干不算合', () => {
  // 正官格，年干庚（七殺）緊鄰月干乙 → 乙庚合，七殺被合住
  const he = G('庚子 乙酉 甲寅 丙寅');
  assert.equal(he.status, '敗中有救');
  assert.match(he.items[0].text, /官殺混雜（年干庚）.*但七殺被合住/);
  // 建祿格用官：月干丙、時干辛中間隔著日主，不算丙辛合，官星沒被合走
  const lu = G('己亥 丙寅 甲子 辛未');
  assert.equal(lu.use, '用官');
  assert.equal(lu.status, '成格');
  assert.ok(!lu.items.some((x) => /被合/.test(x.text)));
});

test('七殺、食神、傷官、羊刃、建祿月劫的成敗', () => {
  // 七殺當令、身弱、沒有食傷也沒有印 → 殺重身輕
  const sha = G('乙酉 甲申 甲辰 甲戌');
  assert.equal(sha.name, '七殺格');
  assert.equal(sha.status, '破格');
  assert.match(sha.items[0].text, /^殺重身輕/);
  // 食神格遇偏印（梟神奪食），有財制梟 → 敗中有救，食神生財仍成立
  const food = G('壬辰 乙巳 甲戌 己巳');
  assert.equal(food.name, '食神格');
  assert.equal(food.status, '敗中有救');
  assert.match(food.items.map((x) => x.text).join(''), /食神生財（時干己）.*梟神奪食（年干壬）.*但有財（時干己）/);
  // 傷官見官沒有印 → 破格；金水傷官（庚日子月）見官反而是好事
  assert.equal(G('辛未 甲午 甲申 甲子').status, '破格');
  const js = G('丁亥 壬子 庚辰 丙子');
  assert.equal(js.name, '傷官格');
  assert.equal(js.status, '成格');
  assert.match(js.items.map((x) => x.text).join(''), /金水傷官喜見官/);
  assert.ok(js.likes.includes('正官'));
  // 羊刃沒有官殺 → 破格
  const ren = G('甲午 丁卯 甲寅 丙寅');
  assert.equal(ren.status, '破格');
  assert.match(ren.items[0].text, /^陽刃無官殺/);
  // 月劫用財、有食傷生財 → 成格；四庫比劫只透七殺、沒有制 → 破格
  const jie = G('乙丑 戊寅 乙亥 丙子');
  assert.deepEqual([jie.use, jie.status], ['用財', '成格']);
  const bare = G('甲子 戊辰 戊午 甲寅');
  assert.deepEqual([bare.use, bare.status], ['用殺', '破格']);
});

test('格局喜忌：印重時改喜財與食傷，大運天干地支各自對照', () => {
  const g = G('壬申 甲辰 甲子 丙寅'); // 會成水局 → 印一定重
  assert.deepEqual(g.likes, ['食神', '傷官', '正財', '偏財']);
  assert.equal(gejuTone(g, '正財'), '喜');
  assert.equal(gejuTone(g, '七殺'), '忌');
  assert.equal(gejuTone(g, '比肩'), '平');
  assert.equal(gejuTone(null, '正財'), '');
});

test('審查修正：取格順序、四庫藏干名稱、會局的正偏與化劫', () => {
  // 本氣已透就不因會局改格：申月庚透月干 → 七殺格（以前被申子辰水局改成正印格，透出的七殺完全沒提到）
  const ben = G('癸巳 庚申 甲辰 甲子');
  assert.equal(ben.name, '七殺格');
  assert.match(ben.how, /本氣庚（七殺）透出在月干庚/);
  // 丙生申月、庚不透、壬透，會子會辰 → 化為煞（照透出的壬定七殺，不是一律照中神定正官）
  assert.equal(G('甲子 壬申 丙辰 戊子').name, '七殺格');
  // 亥卯未會成比劫局 → 化為劫，歸月劫（以前只加一句備註、仍當印格論成敗）
  const jie = G('辛卯 己亥 乙丑 癸未');
  assert.equal(jie.name, '月劫格');
  assert.match(jie.how, /化為劫/);
  // 辰月藏戊乙癸：乙是餘氣、癸是中氣；只透出乙（劫財）→ 月劫（「透乙則用月劫」），以前退回本氣偏財格
  const yu = G('乙丑 庚辰 甲午 丙寅');
  assert.equal(yu.name, '月劫格');
  assert.match(yu.how, /只有餘氣乙（劫財）透出在年干乙/);
  // 寅月只透出比劫戊：說明不能寫「沒有透出天干」
  assert.match(G('庚寅 戊寅 己亥 乙丑').how, /能取格的字都沒透（比劫透出不取格）/);
  // 未月的丁是餘氣（午月留下的），不是中氣
  assert.match(G('壬辰 丁未 戊辰 壬子').how, /餘氣丁（正印）透出/);
});

test('審查修正：成敗救應', () => {
  // 財印相合是兩個都被綁住，不是「合財存印」
  const heyin = G('壬辰 丁未 戊辰 壬子');
  assert.equal(heyin.status, '破格');
  assert.ok(heyin.items.some((x) => x.tone === 'bad' && /^財印相合/.test(x.text)));
  assert.ok(!heyin.items.some((x) => /合財存印/.test(x.text)));
  // 七殺格：食傷透出制殺又透印 → 帶忌；食傷只在地支時印走殺印相生，不算帶忌
  assert.ok(G('丙子 丙申 甲午 癸酉').items.some((x) => x.tone === 'bad' && /^殺逢食制又透印（時干癸）/.test(x.text)));
  const shaYin = G('甲午 丙寅 戊申 丙辰');
  assert.ok(!shaYin.items.some((x) => /殺逢食制又透印/.test(x.text)));
  assert.equal(shaYin.status, '成格');
  // 財格：財生官又逢傷官、沒有印 → 成中帶忌
  const cai = G('辛亥 戊戌 甲申 丁卯');
  assert.equal(cai.name, '偏財格');
  assert.equal(cai.status, '成中帶忌');
  assert.ok(cai.items.some((x) => x.tone === 'bad' && /^財生官又逢傷官（時干丁）/.test(x.text)));
  // 傷官格：佩印又遭財剋（財印緊貼）→ 帶忌
  const pei = G('丙申 辛卯 壬寅 庚子');
  assert.equal(pei.status, '成中帶忌');
  assert.ok(pei.items.some((x) => x.tone === 'bad' && /^佩印又遭財剋/.test(x.text)));
  // 食神格：生財露殺書上列為敗，不能因為「食神生財」判成成中帶忌
  const food = G('壬辰 庚戌 丙申 戊子');
  assert.equal(food.status, '破格');
  assert.ok(!food.items.some((x) => x.tone === 'good'));
  // 羊刃只能用官殺：只透財時不標「用財」；大運遇食神是格局怕的
  const ren = G('甲午 丁卯 甲寅 戊辰');
  assert.deepEqual([ren.name, ren.use], ['羊刃格', '']);
  assert.equal(gejuTone(ren, '食神'), '忌');
});

test('接上真實命盤：有大運就評目前這步運；沒有出生時間要提醒時柱沒算', () => {
  const b = buildBazi({ date: { y: 1990, m: 8, d: 15 }, time: { h: 10, mi: 30 }, tz: 'Asia/Taipei', place: null }, { gender: '女', today: { y: 2026, m: 11, d: 24 } });
  const g = geju(b);
  assert.equal(g.name, '偏印格'); // 庚午 甲申 壬子 乙巳：申月本氣庚透年干
  assert.equal(g.status, '成格');
  assert.equal(g.dayun.ganzhi, '庚辰');
  assert.deepEqual([g.dayun.gan.ss, g.dayun.gan.tone, g.dayun.zhi.ss, g.dayun.zhi.tone], ['偏印', '忌', '七殺', '忌']);
  const noTime = geju(buildBazi({ date: { y: 1990, m: 8, d: 15 }, time: null, tz: 'Asia/Taipei', place: null }, {}));
  assert.ok(noTime.notes.some((t) => /沒有出生時間/.test(t)));
  assert.equal(noTime.dayun, undefined);
  assert.equal(geju(null), null);
  assert.equal(geju({ ok: false }), null);
});

test('掃 2928 張真實命盤：每張都有格局、狀態在五種之內、每條說明都有內容', () => {
  const seen = new Set();
  for (let y = 1950; y <= 2010; y += 1) {
    for (let m = 1; m <= 12; m += 1) {
      for (const d of [5, 21]) {
        for (const h of [3, 15]) {
          const g = geju(buildBazi({ date: { y, m, d }, time: { h, mi: 0 }, tz: 'Asia/Taipei', place: null }, { gender: '男', today: { y: 2026, m: 11, d: 24 } }));
          assert.ok(GEJU_INFO[g.kind], g.kind);
          assert.ok(STATUS_TEXT[g.status], g.status);
          for (const it of g.items) assert.ok(it.text.length > 10 && !/undefined|NaN/.test(it.text), it.text);
          seen.add(g.name);
        }
      }
    }
  }
  assert.equal(seen.size, 11); // 八正格（財、印分正偏）＋建祿、月劫、羊刃
});
