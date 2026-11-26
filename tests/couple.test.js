// 配對的「老師怎麼看」：星盤＋八字合婚合成一個斷語、依關係狀態給的建議、化解、紅燈與專線、兩人都順的日子。
// 用固定生日的實際命盤，離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBazi, yongShen } from '../js/core/bazi.js';
import { personalDirections } from '../js/core/fengshui.js';
import { memberOf, pairOf, familyOverview, BRIDGE } from '../js/core/family.js';
import { coupleReading, sharedDays, STATUSES, RED_FLAGS, LEVELS } from '../js/core/couple.js';
import { chooseDays } from '../js/core/timing.js';

const TODAY = { y: 2026, m: 11, d: 24 };
const at = (date, time) => ({ date, time, lat: 25.04, lon: 121.5, tz: 'Asia/Taipei' });
function member(name, gender, date, time) {
  const bazi = buildBazi(at(date, time), { gender, today: TODAY });
  return memberOf({ id: name, name, gender, bazi, ys: yongShen(bazi), kua: personalDirections(date, gender) });
}
// 和 tests/family.test.js 同一組：你（壬水、屬馬）、爸爸（丁火、屬鼠）＝爸爸是你的助力、生肖子午沖、通關用木
const ME = member('小明', '男', { y: 1990, m: 8, d: 15 }, { h: 6, mi: 20 });
const DAD = member('小華', '男', { y: 1960, m: 3, d: 10 }, { h: 9, mi: 0 });
const MOM = member('小美', '女', { y: 1962, m: 11, d: 20 }, null);

const bands = (emotion, attraction, talk, bond) => [
  { id: 'emotion', score: emotion }, { id: 'attraction', score: attraction }, { id: 'talk', score: talk }, { id: 'bond', score: bond },
];
const astro = (total, b) => ({ total, label: '', mode: 'aspects', bands: b, aspects: [] });
const baziOf = (a, b) => ({ pair: pairOf(a, b, a.name, b.name), a, b });

test('三種關係狀態都有：還在認識、交往中、已婚／同居', () => {
  assert.deepEqual(STATUSES.map((s) => s.value), ['dating', 'couple', 'married']);
  assert.deepEqual(LEVELS.map((l) => l.label), ['挑戰較多', '用心經營', '合得來', '天作之合']);
});

test('星盤和八字都好 → 斷語是好組合；星盤好、八字容易摩擦 → 「火花型」；星盤差、八字互相幫忙 → 「日久見真情型」', () => {
  const good = baziOf(ME, DAD); // 互為助力
  assert.equal(good.pair.tone, 'good');
  const great = coupleReading({ astro: astro(88, bands(80, 82, 75, 78)), bazi: good, status: 'couple', names: ['小明', '小華'] });
  assert.ok(['great', 'good'].includes(great.level));
  assert.match(great.verdict, /^老師看小明和小華這一對：/);

  const care = baziOf(ME, MOM); // 容易摩擦
  assert.equal(care.pair.tone, 'care');
  const spark = coupleReading({ astro: astro(78, bands(72, 85, 70, 66)), bazi: care, status: 'couple', names: ['小明', '小美'] });
  assert.equal(spark.pattern, 'spark');
  assert.match(spark.verdict, /很來電/);

  const slow = coupleReading({ astro: astro(50, bands(50, 48, 52, 55)), bazi: good, status: 'couple', names: ['小明', '小華'] });
  assert.equal(slow.pattern, 'slow');
  assert.match(slow.verdict, /日久見真情/);

  const hard = coupleReading({ astro: astro(45, bands(40, 50, 45, 42)), bazi: care, status: 'dating', names: ['小明', '小美'] });
  assert.equal(hard.level, 'hard');
  assert.match(hard.verdict, /不會叫你們分開/);
});

test('弱的星盤項目逐項給化解（最弱的兩項，低於 60 才算）；強的項目給「怎麼用」', () => {
  const r = coupleReading({ astro: astro(62, bands(52, 78, 61, 48)), status: 'couple', names: ['A', 'B'] });
  assert.deepEqual(r.remedies.map((x) => x.title), ['化解：長期壓力大', '化解：情緒不同步']);
  for (const x of r.remedies) assert.ok(x.steps.length >= 3);
  assert.ok(r.boosts.some((t) => /吸引力是天生的優勢/.test(t)));
  assert.ok(r.why.some((w) => w.tone === 'good' && /吸引力最好/.test(w.text)));
});

test('八字合婚的化解：通關五行（家裡擺什麼、一起做什麼）、生肖六沖的民俗化解（雙方的六合生肖）', () => {
  const r = coupleReading({ astro: astro(66, bands(60, 62, 64, 61)), bazi: baziOf(ME, DAD), status: 'married', names: ['小明', '小華'] });
  const bridge = r.remedies.find((x) => /通關/.test(x.title));
  assert.ok(bridge);
  assert.match(bridge.title, /用「木」通關/);
  assert.ok(bridge.steps.some((t) => t.includes(BRIDGE['木'].items)));
  assert.match(bridge.note, /民俗|傳統/);
  // 屬馬（午）的六合是羊（未），屬鼠（子）的六合是牛（丑）
  const clash = r.remedies.find((x) => /生肖相沖/.test(x.title));
  assert.ok(clash);
  assert.match(clash.steps[0], /羊和牛|牛和羊/);
  assert.match(clash.steps[1], /先私下商量/);
});

test('只有太陽星座（快速配對）：照星座相位給化解，四分相給「情緒不同步」', () => {
  const r = coupleReading({ astro: { total: 60, label: '', bands: [], story: { aspect: '四分相', summary: '四分相：步調不同。', flavor: '' } }, status: 'dating', names: ['A', 'B'] });
  assert.equal(r.remedies[0].title, '化解：情緒不同步');
  const trine = coupleReading({ astro: { total: 90, label: '', bands: [], story: { aspect: '三分相', summary: '三分相。', flavor: '' } }, status: 'dating', names: ['A', 'B'] });
  assert.equal(trine.remedies.length, 0);
  assert.ok(trine.boosts.length >= 1);
});

test('依關係狀態給不同的下一步：還在認識問「要不要繼續」（三件事）、交往中談婚前五件事、已婚不談分談經營（附家庭教育專線）', () => {
  const base = { astro: astro(50, bands(45, 50, 48, 46)), names: ['A', 'B'] };
  const dating = coupleReading({ ...base, status: 'dating' });
  assert.match(dating.path.title, /要不要繼續/);
  assert.equal(dating.path.checklist.length, 3);
  assert.match(dating.path.rule, /及早放手/);
  assert.match(dating.path.lead, /放慢腳步/); // 挑戰多：不急著定下來
  const couple = coupleReading({ ...base, status: 'couple' });
  assert.match(couple.path.title, /走向婚姻/);
  assert.equal(couple.path.checklist.length, 5);
  assert.match(couple.path.lead, /先同住|長途旅行/);
  const married = coupleReading({ ...base, status: 'married' });
  assert.match(married.path.title, /不談分/);
  assert.match(married.path.help, /412-8185/);
  assert.equal(dating.path.help, null);
  // 搭配工具：還在認識不需要家人關係、人生時間軸
  assert.ok(!dating.combos.some((c) => c.label === '家人關係'));
  assert.ok(married.combos.some((c) => c.label === '家人關係'));
  assert.ok(married.combos.every((c) => Array.isArray(c.go) && c.go.length === 2));
});

test('紅燈與專線：不管命盤多合都列出，含 110、113 保護專線、1925 安心專線', () => {
  const r = coupleReading({ astro: astro(95, bands(90, 90, 90, 90)), status: 'married', names: ['A', 'B'] });
  assert.equal(r.redFlags, RED_FLAGS);
  assert.ok(RED_FLAGS.items.length >= 5);
  for (const n of ['110', '113', '1925']) assert.ok(RED_FLAGS.help.includes(n), n);
  assert.match(RED_FLAGS.note, /不值得你留下/);
});

test('今年要多體諒誰：交往中、已婚才列（familyOverview 的 watch）；還在認識不列', () => {
  const watch = familyOverview([ME, DAD], 2026).watch;
  const married = coupleReading({ astro: astro(70, bands(70, 70, 70, 70)), bazi: baziOf(ME, DAD), status: 'married', names: ['小明', '小華'], watch });
  assert.equal(married.thisYear.length, watch.filter((w) => w.items.length).length);
  const dating = coupleReading({ astro: astro(70, bands(70, 70, 70, 70)), bazi: baziOf(ME, DAD), status: 'dating', names: ['小明', '小華'], watch });
  assert.equal(dating.thisYear.length, 0);
});

test('兩個人都順的日子：兩人都沒被排除、分數都至少 60，依比較低的那個分數排', () => {
  const a = chooseDays('love', { from: TODAY, days: 45, bazi: ME.bazi, gender: '男' }).days;
  const b = chooseDays('love', { from: TODAY, days: 45, bazi: MOM.bazi, gender: '女' }).days;
  const r = sharedDays(a, b, 3);
  assert.ok(r.length <= 3);
  for (const d of r) {
    const x = a.find((q) => q.iso === d.iso);
    const y = b.find((q) => q.iso === d.iso);
    assert.ok(!x.marks.length && !y.marks.length);
    assert.equal(d.score, Math.min(x.score, y.score));
    assert.ok(d.score >= 60);
  }
  for (let i = 1; i < r.length; i += 1) assert.ok(r[i - 1].score >= r[i].score);
  // 合成資料：一方很順、一方很低的日子不推薦
  const fake = (iso, score, marks = []) => ({ iso, label: iso, score, marks, reasons: [{ tone: 'good', text: '宜' }], ganzhi: '' });
  const s = sharedDays([fake('d1', 90), fake('d2', 80), fake('d3', 95, ['歲破'])], [fake('d1', 50), fake('d2', 70), fake('d3', 90)]);
  assert.deepEqual(s.map((d) => d.iso), ['d2']);
});
