// 家人關係：兩人互相影響（生剋、喜用互補、生肖與日柱合沖、通關）、從我的命盤看家人、全家概況。
// 用固定生日的實際命盤，離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBazi, yongShen } from '../js/core/bazi.js';
import { personalDirections } from '../js/core/fengshui.js';
import { buildZiwei } from '../js/core/ziwei.js';
import { memberOf, pairOf, seenFromMe, familyOverview, BRIDGE } from '../js/core/family.js';

const TODAY = { y: 2026, m: 11, d: 24 };
const at = (date, time) => ({ date, time, lat: 25.04, lon: 121.5, tz: 'Asia/Taipei' });
function member(id, name, gender, date, time, relation = '') {
  const bazi = buildBazi(at(date, time), { gender, today: TODAY });
  return memberOf({ id, name, gender, relation, self: id === 'me', bazi, ys: yongShen(bazi), kua: personalDirections(date, gender) });
}
// 你：庚午 甲申 壬子 癸卯（壬水，身強喜火、木）
const ME = member('me', '我', '男', { y: 1990, m: 8, d: 15 }, { h: 6, mi: 20 });
const DAD = member('dad', '爸爸', '男', { y: 1960, m: 3, d: 10 }, { h: 9, mi: 0 }, 'parent');
const MOM = member('mom', '媽媽', '女', { y: 1962, m: 11, d: 20 }, null, 'parent');
const WIFE = member('wife', '老婆', '女', { y: 1991, m: 12, d: 1 }, { h: 22, mi: 10 }, 'spouse');
const SIS = member('sis', '妹妹', '女', { y: 1993, m: 5, d: 5 }, null, 'sibling');

test('兩人之間：爸爸（丁火）是你（壬水）的喜用、日主丁壬相合、生肖子午沖 → 爸爸是你的助力，通關用木', () => {
  assert.deepEqual([ME.dm, ME.dayGan, ME.animal, DAD.dm, DAD.dayGan, DAD.animal], ['水', '壬', '馬', '火', '丁', '鼠']);
  const r = pairOf(ME, DAD, '你', '爸爸');
  assert.equal(r.tone, 'good');
  assert.equal(r.label, '爸爸是你的助力');
  const all = r.notes.map((n) => n.text).join('');
  assert.match(all, /你的水剋爸爸的火/);
  assert.match(all, /爸爸的火正好是你需要的五行/);
  assert.match(all, /生肖六沖/);
  assert.match(all, /日主壬、丁相合/);
  assert.equal(r.bridge, '木');
  assert.match(r.tips[0], /用「木」通關：水剋火，但水生木、木生火/);
});

test('兩人之間：同屬水、互為忌 → 容易摩擦；你的喜用是老婆、你卻是老婆的忌 → 講明你要多體諒老婆', () => {
  const mom = pairOf(ME, MOM, '你', '媽媽');
  assert.equal(mom.tone, 'care');
  assert.equal(mom.label, '容易摩擦，要多溝通');
  assert.match(mom.notes[0].text, /日主都屬水/);
  const wife = pairOf(ME, WIFE, '你', '老婆');
  assert.equal(wife.label, '老婆幫你比較多，你要多體諒老婆');
  assert.equal(wife.tone, 'mid');
  assert.ok(wife.notes.some((n) => /生肖六合/.test(n.text)));
  // 方向對調，結論跟著對調
  assert.equal(pairOf(WIFE, ME, '老婆', '你').label, '老婆幫你比較多，你要多體諒老婆');
});

test('通關五行：任何一方剋另一方時，通關五行一定是「攻方所生、又能生守方」', () => {
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const people = [ME, DAD, MOM, WIFE, SIS];
  let seen = 0;
  for (const a of people) {
    for (const b of people) {
      if (a === b) continue;
      const r = pairOf(a, b);
      if (KE[a.dm] === b.dm || KE[b.dm] === a.dm) {
        const [x, y] = KE[a.dm] === b.dm ? [a.dm, b.dm] : [b.dm, a.dm];
        assert.equal(SHENG[x], r.bridge);
        assert.equal(SHENG[r.bridge], y);
        assert.ok(BRIDGE[r.bridge]);
        seen += 1;
      } else assert.equal(r.bridge, null);
      assert.ok(r.tips.length >= 1 && r.tips.length <= 3);
    }
  }
  assert.ok(seen >= 4);
});

test('從我的命盤看家人：另一半看財星與日支夫妻宮（被年柱沖、2026 流年再沖），母親看印星，紫微看對應宮', () => {
  const zw = buildZiwei(at({ y: 1990, m: 8, d: 15 }, { h: 6, mi: 20 }), { gender: '男', at: TODAY });
  const spouse = seenFromMe(ME, 'spouse', '女', { ziwei: zw, year: 2026 });
  assert.equal(spouse.who, '另一半');
  const s = spouse.lines.map((l) => l.text).join('');
  assert.match(s, /另一半星（正財、偏財）藏在地支裡/);
  assert.match(s, /日支（夫妻宮）被年柱沖/);
  assert.match(s, /今年（2026）流年午沖到日支（夫妻宮）/);
  assert.match(s, /紫微夫妻宮是太陽（旺）、巨門（廟）/);
  assert.match(s, /太陽有化祿/);
  const mom = seenFromMe(ME, 'parent', '女', { ziwei: zw, year: 2026 });
  assert.equal(mom.who, '母親');
  assert.match(mom.lines[0].text, /母親星（正印、偏印）透出天干/);
  // 沒有出生時間的子女宮、沒有性別的另一半星
  const noTime = member('x', 'x', '女', { y: 1993, m: 5, d: 5 }, null);
  assert.match(seenFromMe(noTime, 'child', '男', { year: 2026 }).lines.map((l) => l.text).join(''), /沒有出生時間，看不到時柱/);
  assert.match(seenFromMe(noTime, 'spouse', '男', { myGender: '', year: 2026 }).lines[0].text, /要知道你的性別/);
  assert.equal(seenFromMe(ME, 'relative', '男', { year: 2026 }), null);
});

test('全家：五行分布、家裡的貴人、全家最需要的五行、今年要注意的人、房間方位', () => {
  const o = familyOverview([ME, DAD, MOM, WIFE, SIS], 2026);
  assert.deepEqual(o.missing, ['土', '金']);
  assert.deepEqual(o.byWx.火, ['爸爸', '妹妹']);
  assert.equal(o.helpers[0].name, '爸爸');
  assert.deepEqual(o.helpers[0].helps, ['我', '媽媽', '妹妹']);
  assert.equal(o.topNeed.wx, '木');
  assert.deepEqual(o.watch.map((w) => w.name), ['我', '爸爸']);
  assert.match(o.watch[0].items.join(''), /值太歲.*天剋地沖/);
  assert.equal(o.rooms.length, 5);
  assert.deepEqual(o.groups, { 東四命: 3, 西四命: 2 });
  assert.match(o.rooms[0].text, /床頭朝天醫（東）/); // 坎卦
});
