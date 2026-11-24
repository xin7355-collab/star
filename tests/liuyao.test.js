// 六爻納甲：八宮卦序、世應、納甲、六親、六神、旺衰（月破、日破、暗動、入墓、旬空）、動變、用神取捨、伏神、應期。
// 卦序和世應對照傳統京房八宮表；日子都用萬年曆查得到的實際干支，離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Solar } from '../vendor/lunar.js';
import { castHexagram, hexagram } from '../js/core/iching.js';
import { analyzeLiuyao, palaceOf, branchesOf, qinOf, ORDER_NAME } from '../js/core/liuyao.js';

const linesOf = (hx) => [...hx.lower.lines, ...hx.upper.lines];
// 2026-11-24 15:00 壬寅日、亥月、旬空辰巳；11-25 癸卯日；11-26 甲辰日、旬空寅卯
const D24 = { y: 2026, m: 11, d: 24, h: 15, mi: 0 };
const D25 = { y: 2026, m: 11, d: 25, h: 9, mi: 0 };
const D26 = { y: 2026, m: 11, d: 26, h: 9, mi: 0 };
const zhiOf = ({ y, m, d }) => Solar.fromYmd(y, m, d).getLunar().getDayZhi();

test('八宮卦序：64 卦全部歸宮，和京房八宮傳統表一字不差', () => {
  const TABLE = {
    乾: '乾為天 天風姤 天山遯 天地否 風地觀 山地剝 火地晉 火天大有',
    坎: '坎為水 水澤節 水雷屯 水火既濟 澤火革 雷火豐 地火明夷 地水師',
    艮: '艮為山 山火賁 山天大畜 山澤損 火澤睽 天澤履 風澤中孚 風山漸',
    震: '震為雷 雷地豫 雷水解 雷風恆 地風升 水風井 澤風大過 澤雷隨',
    巽: '巽為風 風天小畜 風火家人 風雷益 天雷無妄 火雷噬嗑 山雷頤 山風蠱',
    離: '離為火 火山旅 火風鼎 火水未濟 山水蒙 風水渙 天水訟 天火同人',
    坤: '坤為地 地雷復 地澤臨 地天泰 雷天大壯 澤天夬 水天需 水地比',
    兌: '兌為澤 澤水困 澤地萃 澤山咸 水山蹇 地山謙 雷山小過 雷澤歸妹',
  };
  const got = {};
  for (let u = 1; u <= 8; u += 1) {
    for (let l = 1; l <= 8; l += 1) {
      const hx = hexagram(u, l);
      const p = palaceOf(linesOf(hx));
      got[p.name] = got[p.name] || [];
      got[p.name][p.order] = hx.name;
    }
  }
  for (const [name, list] of Object.entries(TABLE)) assert.equal(got[name].join(' '), list, name);
});

test('世應：一世卦世在初爻、四世在四爻、遊魂世四應初、歸魂世三應上', () => {
  const cases = [
    [1, 5, '乾', '一世卦', 1, 4], // 天風姤
    [2, 3, '坎', '四世卦', 4, 1], // 澤火革
    [8, 1, '坤', '三世卦', 3, 6], // 地天泰
    [3, 8, '乾', '遊魂卦', 4, 1], // 火地晉
    [3, 1, '乾', '歸魂卦', 3, 6], // 火天大有
    [1, 1, '乾', '本宮卦', 6, 3], // 乾為天
  ];
  for (const [u, l, palace, order, shi, ying] of cases) {
    const c = castHexagram(u, l, 1);
    const r = analyzeLiuyao(c, { when: D24, topic: 'decide' });
    assert.equal(`${r.palace.name}${r.palace.orderName}`, `${palace}${order}`, c.base.name);
    assert.equal(r.rows.find((x) => x.shi).pos, shi, c.base.name);
    assert.equal(r.rows.find((x) => x.ying).pos, ying, c.base.name);
  }
  assert.equal(ORDER_NAME.length, 8);
});

test('納甲與六親：乾為天子寅辰午申戌；坎宮澤火革卯丑亥亥酉未', () => {
  assert.equal(branchesOf([1, 1, 1, 1, 1, 1]).join(''), '子寅辰午申戌');
  assert.equal(branchesOf(linesOf(hexagram(2, 3))).join(''), '卯丑亥亥酉未');
  assert.equal(branchesOf(linesOf(hexagram(8, 1))).join(''), '子寅辰丑亥酉'); // 地天泰：內乾外坤
  const qin = ['子', '寅', '辰', '午', '申', '戌'].map((z) => qinOf('金', { 子: '水', 寅: '木', 辰: '土', 午: '火', 申: '金', 戌: '土' }[z]));
  assert.deepEqual(qin, ['子孫', '妻財', '父母', '官鬼', '兄弟', '父母']);
});

test('六神看日干：壬日由玄武起、甲日由青龍起、癸日由玄武起', () => {
  const c = castHexagram(1, 1, 3);
  assert.deepEqual(analyzeLiuyao(c, { when: D24, topic: 'work' }).rows.map((r) => r.shen), ['玄武', '青龍', '朱雀', '勾陳', '螣蛇', '白虎']);
  assert.equal(analyzeLiuyao(c, { when: D26, topic: 'work' }).rows[0].shen, '青龍');
  assert.equal(analyzeLiuyao(c, { when: D25, topic: 'work' }).rows[0].shen, '玄武');
});

test('旺衰：月破真破與動爻不真破、入日墓、旬空假空、日破、日辰長生', () => {
  // 火地晉二爻動，11/26 甲辰日、亥月、旬空寅卯
  const r = analyzeLiuyao(castHexagram(3, 8, 2), { when: D26, topic: 'health' });
  const at = (pos) => r.rows[pos - 1];
  assert.equal(r.kong, '寅卯');
  assert.ok(at(6).j.po && at(6).j.notes.some((n) => n.includes('真破')), '上爻巳火靜而月破');
  assert.ok(at(2).j.po && at(2).j.notes.some((n) => n.includes('動爻不算真破')), '二爻巳火動而月破');
  assert.ok(at(5).j.mu && at(5).j.level === 0, '五爻未土逢辰日入墓');
  assert.equal(at(3).j.kong, 'jia', '三爻卯木有月生，旬空是假空');
  assert.equal(at(4).j.level, 2, '四爻酉金日生日合');
  // 乾為天，11/24 壬寅日：申金休囚逢寅日沖 → 日破；午火月剋日生 → 相敵
  const q = analyzeLiuyao(castHexagram(1, 1, 3), { when: D24, topic: 'work' });
  assert.ok(q.rows[4].j.notes.some((n) => n.startsWith('日破')));
  assert.equal(q.rows[3].j.level, 1);
  assert.ok(q.rows[3].j.notes.includes('日生、日辰長生'));
});

test('暗動：有氣的靜爻被日辰沖起；動變：化進、化退、回頭剋、化空', () => {
  // 11/25 癸卯日：地天泰上爻酉金被卯日沖，月令休 → 日破（不是暗動）
  const t = analyzeLiuyao(castHexagram(8, 1, 5), { when: D25, topic: 'money' });
  assert.equal(t.rows[5].j.anDong, false);
  assert.equal(t.rows[4].change.type, '回頭剋'); // 亥水化戌土
  // 暗動：11/27 乙巳日沖亥；亥水臨月建有氣 → 澤火革三、四爻亥水被沖起（巳火不剋水，不帶剋）
  const D27 = { y: 2026, m: 11, d: 27, h: 9, mi: 0 };
  const g = analyzeLiuyao(castHexagram(2, 3, 1), { when: D27, topic: 'decide' });
  assert.ok(g.rows[2].j.anDong && g.rows[3].j.anDong);
  assert.ok(g.rows[2].j.notes.includes('暗動（有力的靜爻被日辰沖起來）'));
  // 化進：震為雷二爻寅木 → 兌卯木；化退：乾為天三爻辰土 → 丑土；化空：澤火革初爻卯 → 辰（旬空辰巳）
  assert.equal(analyzeLiuyao(castHexagram(4, 4, 2), { when: D24, topic: 'money' }).rows[1].change.type, '化進');
  assert.equal(analyzeLiuyao(castHexagram(1, 1, 3), { when: D24, topic: 'money' }).rows[2].change.type, '化退');
  assert.equal(analyzeLiuyao(castHexagram(2, 3, 1), { when: D24, topic: 'money' }).rows[0].change.type, '化空');
});

test('無力又受傷的動爻生剋不了別人：乾為天三爻辰土化退、被日剋，不去剋初爻子水', () => {
  const r = analyzeLiuyao(castHexagram(1, 1, 3), { when: D24, topic: 'work' });
  assert.equal(r.rows[2].j.level, 0);
  assert.ok(!r.rows[0].j.notes.some((n) => n.includes('動爻剋制')));
  assert.ok(!r.rows[5].j.notes.some((n) => n.includes('動爻生扶')));
});

test('用神：依困擾取六親；感情看性別；問自己看世爻；多現時持世優先', () => {
  const c = castHexagram(1, 1, 3); // 乾為天：子孫子、妻財寅、父母辰、官鬼午、兄弟申、父母戌
  const pick = (topic, gender = null) => analyzeLiuyao(c, { when: D24, topic, gender }).yong;
  assert.equal(pick('work').qin, '官鬼');
  assert.equal(pick('money').qin, '妻財');
  assert.equal(pick('love', '男').qin, '妻財');
  assert.equal(pick('love', '女').qin, '官鬼');
  assert.ok(pick('love').ying, '沒填性別用應爻');
  assert.ok(pick('decide').shi);
  assert.ok(pick('health').shi);
  // 父母兩現（三爻辰、上爻戌）：上爻持世優先
  const f = analyzeLiuyao(c, { when: D24, topic: 'study' });
  assert.equal(f.yong.pos, 6);
  assert.match(f.pickNote, /出現 2 次/);
});

test('伏神：澤火革問錢，本卦沒有妻財，坎宮本宮午火伏在三爻亥水下面（飛神剋伏神）', () => {
  const r = analyzeLiuyao(castHexagram(2, 3, 1), { when: D24, topic: 'money' });
  assert.equal(r.yong.source, 'fu');
  assert.deepEqual([r.yong.pos, r.yong.zhi, r.yong.wx, r.yong.fei.zhi], [3, '午', '火', '亥']);
  assert.ok(r.yong.hard);
  assert.ok(r.bad.includes('伏藏難出'));
  assert.match(r.verdict, /^用神一助一傷，又有伏藏難出的問題/);
  // 應期：午日出現或巳日沖開飛神
  assert.deepEqual(r.timing[0].zhis, ['午', '巳']);
  for (const d of r.timing[0].dates) assert.ok(['午', '巳'].includes(zhiOf(d)));
});

test('六沖卦、六合卦與世應關係', () => {
  assert.match(analyzeLiuyao(castHexagram(1, 1, 3), { when: D24, topic: 'work' }).shape, /^六沖卦/);
  assert.match(analyzeLiuyao(castHexagram(8, 1, 5), { when: D25, topic: 'work' }).shape, /^六合卦/);
  assert.equal(analyzeLiuyao(castHexagram(2, 3, 1), { when: D24, topic: 'work' }).shape, '');
  assert.match(analyzeLiuyao(castHexagram(3, 8, 2), { when: D26, topic: 'health' }).shiYing, /^應爻生世爻/);
});

test('應期：合住待沖、日合待沖，列出的日子地支都對；月破要過了節氣才算', () => {
  // 地天泰女問感情：官鬼寅木被亥月合住 → 逢申或巳日沖開
  const love = analyzeLiuyao(castHexagram(8, 1, 5), { when: D25, topic: 'love', gender: '女' });
  assert.equal(love.yong.zhi, '寅');
  const he = love.timing.find((t) => t.why.includes('合住'));
  assert.deepEqual(he.zhis, ['申', '巳']);
  for (const d of he.dates) assert.ok(he.zhis.includes(zhiOf(d)));
  assert.equal(love.tone, 'good');
  // 每個條件最多列兩天，都在 30 天內
  for (const t of love.timing) assert.ok(t.dates.length <= 2);
  // 月破的用神：找一卦用神巳火逢亥月破，應期日子都在大雪（12/7）以後
  const c = castHexagram(3, 8, 2); // 火地晉：官鬼巳火兩現，都月破
  const work = analyzeLiuyao(c, { when: D26, topic: 'work' });
  assert.ok(work.yong.j.po);
  const po = work.timing.find((t) => t.why.includes('月破'));
  assert.ok(po.dates.length > 0);
  for (const d of po.dates) assert.ok(Date.UTC(d.y, d.m - 1, d.d) >= Date.UTC(2026, 11, 7), `${d.m}/${d.d}`);
  assert.equal(work.tone, 'care');
  assert.match(work.verdict, /^用神沒力又受傷（月破/);
  // 用神偏弱但沒受傷：不說「有好有壞」，指向轉機的日子
  // 火地晉問健康，11/24 壬寅日：世爻酉金月令休、逢寅日絕 → 無力但沒有空破、沒有忌神動
  const weak = analyzeLiuyao(castHexagram(3, 8, 2), { when: D24, topic: 'health' });
  assert.deepEqual([weak.yong.zhi, weak.yong.j.level, weak.bad], ['酉', 0, []]);
  assert.match(weak.verdict, /^用神偏弱，但沒有受傷/);
  assert.equal(weak.tone, 'mid');
  assert.equal(weak.timing.find((t) => t.kind === 'good').zhis.join(''), '辰戌丑未申酉');
});

test('健康另外看官鬼（病）與子孫（醫藥）有沒有動', () => {
  // 窮舉找一個子孫發動、能作用的卦
  let hit = null;
  for (let u = 1; u <= 8 && !hit; u += 1) {
    for (let l = 1; l <= 8 && !hit; l += 1) {
      for (let m = 1; m <= 6 && !hit; m += 1) {
        const r = analyzeLiuyao(castHexagram(u, l, m), { when: D24, topic: 'health' });
        if (r.godNotes.some((n) => n.text.startsWith('子孫（醫藥）發動'))) hit = r;
      }
    }
  }
  assert.ok(hit);
  assert.ok(hit.yong.shi);
});
