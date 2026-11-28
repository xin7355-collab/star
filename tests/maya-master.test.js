import test from 'node:test';
import assert from 'node:assert/strict';
import { kinInfo, pairSummary, dayRelation, kinOf, mayaKin, yearKin } from '../js/core/maya-kin.js';
import { mayaPairMaster, sharedMayaDays, methodCompare, mayaSelfMaster, mayaCodeMaster } from '../js/core/maya-master.js';
import { SEAL_SELF, TONE_HOW, YEAR_KIN_TEXT, CODE_KW } from '../js/core/maya-texts.js';
import { KEYWORDS } from '../js/core/maya.js';
import { computeMaya, compareMaya, explainCompare } from '../js/core/maya.js';
import { MAYA_KEYWORD_TEXT } from '../js/core/reading-texts.js';

const person = (kin, name) => ({ ...kinInfo(kin), name });
const FROM = { y: 2026, m: 11, d: 27 };

test('老師解盤（KIN 157 磁性紅地球 × KIN 24 光譜黃種子）：指名道姓，講出誰的長處補誰的卡點、號碼怎麼算', () => {
  const a = person(157, '你');
  const b = person(24, '對方');
  const code = explainCompare(compareMaya(computeMaya({ y: 1993, m: 4, d: 4 }), computeMaya({ y: 1998, m: 6, d: 2 })), '你', '對方', MAYA_KEYWORD_TEXT);
  const m = mayaPairMaster({ a, b, sum: pairSummary(157, 24), code, days: sharedMayaDays(157, 24, FROM) });
  assert.equal(m.badge.text, '隱藏推動');
  assert.match(m.verdict, /^你（紅地球）和對方（黃種子）互為「隱藏推動」/);
  // 交叉：對方的卡點配你的長處、你的卡點配對方的長處
  assert.match(m.verdict, /對方卡在「固執，急著看到成果，或覺得自己長得不夠快」的時候，你的「掌握時機、帶領方向，把人凝聚起來」能推一把/);
  assert.match(m.why[0].text, /圖騰號碼相加是 21（紅地球 17＋黃種子 4）/);
  assert.match(m.why[1].text, /你是紅色（開創）.*對方是黃色（成熟）.*推動色/);
  assert.match(m.why[2].text, /調性 1「目的」.*調性 11「解放」/);
  assert.ok(m.why.some((w) => /瑪雅密碼（另一套算法）5 個位置/.test(w.text)));
  assert.deepEqual(m.remedies.map((r) => r.title), ['對方卡住時，你可以這樣做', '你卡住時，對方可以這樣做', '相處原則（隱藏推動）']);
  assert.match(m.remedies[0].steps[2], /^對方自己可以：一次只種一顆種子/);
  assert.ok(m.boosts[0].startsWith('一起做事的分工：你負責「掌握時機'));
  assert.match(m.boosts[0], /（紅色擅長起頭）.*（黃色擅長收尾）/);
  assert.ok(m.combos.every((c) => Array.isArray(c.go) && c.go.length === 2));
});

test('兩個人都順的日子：最多 3 天、依日期排、兩個人都不在挑戰位；算法和「今日」同一套', () => {
  const days = sharedMayaDays(157, 24, FROM);
  assert.ok(days.length >= 1 && days.length <= 3);
  const ms = days.map((d) => Date.UTC(d.date.y, d.date.m - 1, d.date.d));
  assert.deepEqual([...ms].sort((x, y) => x - y), ms);
  for (const d of days) {
    const kin = kinOf(d.date);
    assert.equal(kin, d.kin);
    for (const k of [157, 24]) assert.ok(!['antipode', 'none'].includes(dayRelation(kin, k)), `${d.label}`);
    assert.match(d.label, /^\d+\/\d+（週[日一二三四五六]）$/);
  }
  assert.deepEqual(sharedMayaDays(157, 24, { y: 1700, m: 1, d: 1 }), []);
});

test('每一種配對都組得出完整的解盤：沒有 undefined、斷語帶兩個人的名字、引導分得出誰引導誰', () => {
  for (let x = 1; x <= 260; x += 7) {
    for (let y = 1; y <= 260; y += 11) {
      const m = mayaPairMaster({ a: person(x, '甲'), b: person(y, '乙'), sum: pairSummary(x, y), days: [] });
      const all = [m.verdict, ...m.why.map((w) => w.text), ...m.remedies.flatMap((r) => [r.title, ...r.steps]), ...m.boosts];
      for (const t of all) assert.ok(t && !/undefined|null|NaN/.test(t), `${x}/${y}: ${t}`);
      assert.ok(/甲/.test(m.verdict) && /乙/.test(m.verdict), `${x}/${y}`);
      assert.equal(m.remedies.length, 3);
    }
  }
  // KIN 57 紅地球是 KIN 109 紅月的引導（單向）
  const g = mayaPairMaster({ a: person(109, '你'), b: person(57, '小華'), sum: pairSummary(109, 57) });
  assert.match(g.verdict, /^小華（紅地球）是你（紅月）的「引導」/);
  // 同調性：問題不重複列兩次
  assert.match(g.boosts.find((t) => /調性的問題|兩個問題/.test(t)), /一起問一次/);
});

test('算法對照：同一對人用不同算法各算一次，標出哪一種會落在挑戰（會被講成不合）；兩個 KIN 相加另外列', () => {
  const c = methodCompare({ name: '你', date: { y: 1990, m: 8, d: 15 } }, { name: '媽媽', date: { y: 1962, m: 11, d: 20 } });
  const by = Object.fromEntries(c.rows.map((x) => [x.key, x]));
  assert.deepEqual(c.rows.map((x) => x.key), ['dreamspell', 'traditional', 'leapday']);
  assert.equal(by.dreamspell.mainLabel, '支持色');
  assert.equal(by.dreamspell.hard, false);
  // 同一對人換成傳統馬雅曆（混合做法）或算錯閏日，就落在「挑戰」
  assert.equal(by.traditional.a.kin, 56);
  assert.equal(by.traditional.hard, true);
  assert.equal(by.leapday.hard, true);
  assert.equal(c.composite.kin, 235);
  // 生日在 2013 年附近時算錯版和 13 月亮曆一樣，不另外列
  const near = methodCompare({ name: '甲', date: { y: 2013, m: 8, d: 1 } }, { name: '乙', date: { y: 2013, m: 9, d: 1 } });
  assert.ok(!near.rows.some((x) => x.key === 'leapday'));
  // 兩人都順的日子也跟著算法換
  const t = sharedMayaDays(56, 66, FROM, { count: 'traditional' });
  for (const d of t) assert.equal(kinOf(d.date, 'traditional'), d.kin);
});

test('個人盤的老師解盤：260 個 KIN 都講得出「你是誰、誰幫你、你缺什麼、迷惘時往哪走」，沒有空值', () => {
  assert.equal(Object.keys(SEAL_SELF).length, 20);
  assert.equal(Object.keys(TONE_HOW).length, 13);
  for (const k of Object.keys(YEAR_KIN_TEXT)) assert.ok(YEAR_KIN_TEXT[k], k);
  for (let kin = 1; kin <= 260; kin += 1) {
    const mine = kinInfo(kin);
    const m = mayaSelfMaster(mine, {});
    assert.match(m.verdict, new RegExp(`^老師看你的銀河印記：你是「${mine.title}」`));
    assert.match(m.verdict, /最好的幫手是擅長「.+」的人（支持位），最大的功課是「.+」（挑戰位）/);
    for (const t of [m.verdict, ...m.why.map((w) => w.text), ...m.remedies.flatMap((r) => [r.title, ...r.steps]), ...m.boosts]) assert.ok(t && !/undefined|null|NaN/.test(t), `KIN ${kin}：${t}`);
  }
});

test('個人盤的特殊位置：調性 1、6、11 的引導是自己；調性 1 是波符的第一天；流年印記落在哪個位置', () => {
  // KIN 157 磁性紅地球：調性 1 → 引導就是自己、紅地球波符第一天；支持白風、挑戰藍手、隱藏推動黃種子
  const m = mayaSelfMaster(kinInfo(157), {});
  assert.match(m.verdict, /迷惘時相信自己就好（引導位是自己）/);
  assert.match(m.verdict, /最好的幫手是擅長「溝通表達」的人（支持位），最大的功課是「動手實作、把事做完」（挑戰位）/);
  assert.ok(m.why.some((w) => /^引導位就是你自己/.test(w.text)));
  assert.ok(m.why.some((w) => /^出生在紅地球波符的第一天/.test(w.text)));
  assert.ok(m.why.some((w) => /^隱藏推動「宇宙黃種子」/.test(w.text)));
  // KIN 109 超頻紅月（調性 5）：引導是別的圖騰，波符是紅蛇第 5 天
  const r = mayaSelfMaster(kinInfo(109), { name: '媽媽' });
  assert.match(r.verdict, /^老師看媽媽的銀河印記/);
  assert.match(r.verdict, /迷惘時往「抓時機、帶方向」的方向走（引導位）/);
  assert.ok(r.why.some((w) => /^出生在「紅蛇波符」的第 5 天/.test(w.text)));
  // 流年印記：1990/8/15 生日起的一年（2026/8/15–2027/8/14）是 KIN 109＋365×36 天的那一格，和本命同圖騰
  const birth = { y: 1990, m: 8, d: 15 };
  const yk = yearKin(birth, { y: 2026, m: 11, d: 28 });
  const withYear = mayaSelfMaster(mayaKin(birth), { yearKin: yk });
  assert.equal(withYear.yearRel, dayRelation(yk.kin, 109));
  assert.ok(withYear.why.some((w) => w.text.includes(`流年印記「${yk.title}」`) && w.text.includes(YEAR_KIN_TEXT[withYear.yearRel])));
});

test('瑪雅密碼的老師解盤：重複的關鍵字是主題；外表和內心一不一樣；天生的習慣和這輩子的課題；例外年份 A、B 不適用', () => {
  assert.deepEqual(Object.keys(CODE_KW).sort(), [...KEYWORDS].sort());
  for (const [k, v] of Object.entries(CODE_KW)) for (const f of ['look', 'core', 'gift', 'lesson', 'drive', 'verb', 'practice']) assert.ok(v[f], `${k}.${f}`);
  // 1990/8/15：A 9 圓滿、B 0 本源、C 9 圓滿、D＝E 6 承擔 → 主題「圓滿」（A、C）；D、E 一樣
  const m = mayaCodeMaster(computeMaya({ y: 1990, m: 8, d: 15 }));
  assert.equal(m.theme, '圓滿');
  assert.match(m.verdict, /「圓滿」出現在前世 A、潛意識 C，是你這套密碼的主題/);
  assert.match(m.verdict, /外表和內心一致（表象 D、小宇宙 E 都是「承擔」）/);
  assert.match(m.verdict, /卡關時別只用「包容、把事情收好尾」這個老方法，改成「回到初心想清楚」看看/);
  assert.deepEqual(m.remedies.map((r) => r.title), ['卡關時：練「本源」']);
  // 只有 D、E 一樣時不另外當成主題（上面那句已經講了）
  for (let y = 1950; y <= 2025; y += 1) {
    for (const [mm, dd] of [[1, 3], [6, 18], [12, 29]]) {
      const c = computeMaya({ y, m: mm, d: dd });
      const r = mayaCodeMaster(c);
      for (const t of [r.verdict, ...r.why.map((w) => w.text), ...r.remedies.flatMap((x) => [x.title, ...x.steps]), ...r.boosts]) assert.ok(t && !/undefined|null|NaN/.test(t), `${y}/${mm}/${dd}：${t}`);
      const [D, E] = ['D', 'E'].map((k) => c.items.find((x) => x.key === k).keyword);
      if (D !== E) assert.match(r.verdict, /外表看起來.+（表象 D「.+」），內心其實.+（小宇宙 E「.+」）/);
      if (r.theme) assert.ok(c.items.filter((x) => x.keyword === r.theme).length >= 2);
    }
  }
  // 2015 年（例外年份）：A、B 不適用，斷語不講前世今生
  const ex = mayaCodeMaster(computeMaya({ y: 2015, m: 6, d: 9 }), { name: '妹妹' });
  assert.match(ex.verdict, /^老師看妹妹的瑪雅密碼/);
  assert.ok(!/前世 A「/.test(ex.verdict));
  assert.equal(ex.why.filter((w) => /不適用/.test(w.text)).length, 2);
});
