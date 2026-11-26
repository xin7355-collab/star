// 各工具的「老師怎麼看」：算出來不好時一定有化解、好的地方有怎麼用，民俗做法標明是民俗。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyMaster, periodMaster, yearMaster, baziMaster, ziweiMaster, TAISUI_FIX, JI_FIX, WX_BOOST, LIUHE, liuheAnimal, FIXED_DATE_FIX } from '../js/core/master-texts.js';
import { dailyIndex, luckyItems } from '../js/core/daily.js';
import { buildBazi, yongShen } from '../js/core/bazi.js';
import { hourGuide } from '../js/core/timing.js';
import { PALACE_SEQ } from '../js/core/reading.js';

const day = (level, factors) => ({ score: 50, level, advice: '', parts: [], factors });
const HOURS = [
  { start: '05:00', end: '06:59', good: true },
  { start: '09:00', end: '10:59', good: true },
  { start: '11:00', end: '12:59', good: false },
  { start: '13:00', end: '14:59', good: true },
];

test('六合：子丑、午未…，屬馬的六合是羊、屬鼠的六合是牛', () => {
  for (const [a, b] of Object.entries(LIUHE)) assert.equal(LIUHE[b], a);
  assert.equal(liuheAnimal('午'), '羊');
  assert.equal(liuheAnimal('子'), '牛');
});

test('今日：沖生肖給化解（今天的吉時、六合生肖的民俗做法），忌神日給喜用色與方位，壓力日給做法', () => {
  const m = dailyMaster(day('宜守', { clash: ['生肖'], harmony: [], avoid: '水', primary: '火', shishen: '七殺', black: true, tianShen: '天刑', animal: '馬', zodiacIndex: 6 }), {
    lucky: { xi: '東南', cai: '正北' }, hours: HOURS,
  });
  assert.match(m.verdict, /^老師看你今天：今天宜守不宜攻/);
  const titles = m.remedies.map((r) => r.title);
  assert.deepEqual(titles, ['化解：沖生肖（屬馬）', '化解：忌神日（水）', '化解：壓力日（七殺）']);
  assert.match(m.remedies[0].steps[0], /09:00–10:59、13:00–14:59/); // 清晨 5 點不算（不是醒著辦事的時間）
  assert.match(m.remedies[0].steps.at(-1), /民俗做法：身上帶一個屬羊的小物/);
  assert.match(m.remedies[1].steps[0], new RegExp(WX_BOOST['火'].color));
  assert.match(m.remedies[1].steps[1], /喜神方（東南）或財神方（正北）/);
  assert.match(m.remedies[1].note, /傳統/);
  assert.ok(m.why.some((w) => w.tone === 'bad' && /沖你的生肖/.test(w.text)));
  assert.ok(m.combos.some((c) => c.go[0] === 'oracle'));
});

test('今日：好日子沒有化解、有「好的地方怎麼用」；看家人時用名字', () => {
  const m = dailyMaster(day('大吉', { clash: [], harmony: ['日支'], avoid: null, favor: '木', primary: '木', shishen: '正印', black: false, tianShen: '青龍', animal: '虎', zodiacIndex: 2 }), { name: '媽媽' });
  assert.equal(m.remedies.length, 0);
  assert.ok(m.boosts.length >= 2);
  assert.match(m.verdict, /^老師看媽媽今天：順風日/);
  assert.ok(m.why.some((w) => /青龍黃道吉日/.test(w.text)));
});

test('今日：用實際的八字算出來的指數帶 factors，餵給 dailyMaster 不會出錯', () => {
  const bazi = buildBazi({ date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, lat: 25.04, lon: 121.5, tz: 'Asia/Taipei' }, { gender: '男', today: { y: 2026, m: 11, d: 26 } });
  for (const d of [24, 25, 26, 27, 28, 29, 30]) {
    const date = { y: 2026, m: 11, d };
    const daily = dailyIndex({ date, bazi, signIndex: 4, birth: { y: 1990, m: 8, d: 15 } });
    assert.ok(daily.factors && typeof daily.factors.black === 'boolean' && daily.factors.animal === '馬');
    const m = dailyMaster(daily, { lucky: luckyItems({ date, bazi }), hours: hourGuide(date, bazi) });
    assert.ok(m.verdict.length > 10);
    for (const r of m.remedies) assert.ok(r.steps.length >= 1 && r.steps.every((t) => typeof t === 'string' && t.length > 5));
  }
});

test('時運：弱的領域（< 45）逐項化解、強的領域（≥ 70）講怎麼用、不順的行星給做法；今年講最順和最要保守的月份', () => {
  const f = {
    period: 'year',
    scores: { overall: 42, love: 38, career: 72, money: 44, health: 55 },
    highlights: [{ key: 'Saturn', tone: 'bad', text: '' }, { key: 'Mars', tone: 'bad', text: '' }, { key: 'Jupiter', tone: 'good', text: '' }],
    best: { m: 3 }, worst: { m: 9 },
  };
  const m = periodMaster(f, { label: '今年' });
  assert.match(m.verdict, /^老師看你今年：宜守/);
  assert.deepEqual(m.remedies.map((r) => r.title), ['化解：感情運低', '化解：財運低', '化解：不順的行星角度']);
  assert.match(m.remedies[2].steps[0], /土星/);
  assert.ok(m.boosts.some((t) => /事業運旺/.test(t)));
  assert.ok(m.boosts.some((t) => /3 月/.test(t) && /9 月/.test(t)));
});

test('流年：每一種犯太歲都有白話和做法；有犯太歲就附安太歲（民俗、六合生肖）；「小心」的年份給守成做法', () => {
  for (const t of ['值太歲', '沖太歲', '刑太歲', '害太歲', '破太歲']) assert.ok(TAISUI_FIX[t] && TAISUI_FIX[t].steps.length >= 2, t);
  const m = yearMaster({ year: 2026, animal: '鼠', zodiacZhi: '子', taisui: ['沖太歲'], level: '小心', goodYears: [2028, 2030], hardMonths: ['3/5～4/3'] });
  const titles = m.remedies.map((r) => r.title);
  assert.deepEqual(titles, ['化解：沖太歲', '民俗做法：安太歲', '化解：小心的年份', '這幾個月特別小心']);
  assert.match(m.remedies[1].steps[0], /屬牛的小擺件（和屬鼠六合）/);
  assert.match(m.remedies[1].note, /民俗/);
  assert.ok(m.boosts.some((t) => /2028、2030 年比較順/.test(t)));
  assert.match(m.verdict, /要多用心的一年/);
  const good = yearMaster({ year: 2027, animal: '鼠', zodiacZhi: '子', taisui: [], level: '順' });
  assert.equal(good.remedies.length, 0);
  assert.match(good.verdict, /順風年/);
});

test('八字：照喜用神補運（顏色、方位、擺設、生活），破格、逆風大運給化解，順風大運講怎麼用', () => {
  const bazi = buildBazi({ date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, lat: 25.04, lon: 121.5, tz: 'Asia/Taipei' }, { gender: '男', today: { y: 2026, m: 11, d: 26 } });
  const ys = yongShen(bazi);
  const m = baziMaster({ ys, gejuStatus: '破格', dayun: { ganzhi: '戊子', tone: { gan: '忌', zhi: '忌', text: '' } } });
  assert.match(m.remedies[0].title, new RegExp(`補運：多接觸「${ys.primary}」`));
  assert.ok(m.remedies[0].steps.some((t) => t.includes(WX_BOOST[ys.primary].color)));
  assert.ok(m.remedies[0].steps.some((t) => t.includes(WX_BOOST[ys.primary].dir)));
  assert.match(m.remedies[0].note, /傳統/);
  assert.ok(m.remedies.some((r) => r.title === '化解：格局有缺口'));
  assert.ok(m.remedies.some((r) => r.title === '化解：逆風的大運'));
  // 每一行都要是真的文字（曾經印出「undefined」：喜用神的理由欄位名稱用錯）
  for (const line of [m.verdict, ...m.why.map((w) => w.text), ...m.remedies.flatMap((r) => [r.title, ...r.steps])]) assert.ok(line && !/undefined|null/.test(line), line);
  assert.equal(m.why[0].text, ys.reasons[0]);
  const up = baziMaster({ ys, gejuStatus: '成格', dayun: { ganzhi: '庚辰', tone: { gan: '喜', zhi: '喜', text: '' } } });
  assert.ok(up.boosts.some((t) => /順風運/.test(t)));
  assert.ok(up.why.some((w) => w.tone === 'good' && /成格/.test(w.text)));
});

test('紫微：化忌在哪一宮就給那一宮的化解（十二宮都有）；流年化忌在別宮再多一項', () => {
  for (const p of PALACE_SEQ) assert.ok(JI_FIX[p], p);
  const m = ziweiMaster({ natalJi: { star: '太陰', palace: '財帛' }, yearJi: { star: '文昌', palace: '夫妻' }, year: 2026 });
  assert.deepEqual(m.remedies.map((r) => r.title), ['化解：化忌在財帛', '今年的化解：流年化忌在夫妻']);
  assert.match(m.remedies[0].steps[0], /自動扣款存錢/);
  assert.match(m.verdict, /化忌在財帛/);
  const same = ziweiMaster({ natalJi: { star: '太陰', palace: '財帛' }, yearJi: { star: '武曲', palace: '財帛' } });
  assert.equal(same.remedies.length, 1);
});

test('擇日：日子改不了時有做法（吉時、拆步驟、準備、民俗儀式）', () => {
  assert.ok(FIXED_DATE_FIX.steps.length >= 4);
  assert.ok(FIXED_DATE_FIX.steps.some((t) => /吉時/.test(t)));
  assert.ok(FIXED_DATE_FIX.steps.some((t) => /民俗/.test(t)));
});
