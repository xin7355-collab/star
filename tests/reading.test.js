// 綜合解讀與多胞胎：七個面向、共同點統計、紫微借宮、沒有時間或性別時也能用。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReading, rotateZiwei, twinsInfo, dominantShishen, PALACE_SEQ } from '../js/core/reading.js';
import { buildBazi } from '../js/core/bazi.js';
import { buildZiwei } from '../js/core/ziwei.js';
import { buildNatal } from '../js/core/natal.js';
import { computeMaya } from '../js/core/maya.js';
import { CHENGGU_PLAIN, SEAL_TAGS, TAGS } from '../js/core/reading-texts.js';
import { BLOOD, BLOOD_TYPES, bloodMatch } from '../js/core/blood.js';

const INPUT = { date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: { lon: 121.5, lat: 25.04 }, fold: null };
const TODAY = { y: 2026, m: 11, d: 24 };
const natal = buildNatal(INPUT);
const bazi = buildBazi(INPUT, { gender: '男', today: TODAY });
const ziwei = buildZiwei(INPUT, { gender: '男', at: TODAY });

test('完整資料：七個面向都有內容，每點都標出系統', () => {
  const r = buildReading({ natal, bazi, ziwei, birth: INPUT.date, maya: computeMaya(INPUT.date), today: TODAY, gender: '男' });
  assert.deepEqual(r.areas.map((a) => a.id), ['personality', 'career', 'wealth', 'love', 'health', 'social', 'year']);
  for (const a of r.areas) {
    assert.ok(a.points.length >= 2, `${a.title} 至少兩個系統`);
    assert.ok(a.points.every((p) => p.system && p.text && !p.text.includes('undefined')), a.title);
  }
  const systems = new Set(r.areas.flatMap((a) => a.points.map((p) => p.system)));
  for (const s of ['占星', '八字', '紫微', '生命靈數', '瑪雅']) assert.ok(systems.has(s), s);
});

test('共同點：至少兩個系統一致才算，並附上來源', () => {
  const r = buildReading({ natal, bazi, ziwei, birth: INPUT.date, today: TODAY, gender: '男' });
  for (const t of r.traits) {
    assert.ok(t.count >= 2);
    // 算的是「幾個系統」：同一個系統說兩句（太陽、上升都說有主見）只算一個
    assert.equal(new Set(t.systems).size, t.count);
    assert.ok(t.sources.length >= t.count);
    assert.ok(new Set(t.sources.map((s) => s.split('：')[0].split(' ')[0])).size >= 2, '要來自不同系統');
  }
  assert.ok(r.areas[0].summary.includes('至少兩個系統一致'));
});

test('沒有出生時間、沒有性別：不出錯，紫微與上升略過', () => {
  const input = { ...INPUT, time: null };
  const n = buildNatal(input);
  const b = buildBazi(input, { today: TODAY });
  const r = buildReading({ natal: n, bazi: b, ziwei: null, birth: input.date, today: TODAY });
  assert.ok(r.areas.every((a) => a.points.every((p) => p.system !== '紫微')));
  assert.ok(r.areas[0].points.length >= 3);
});

test('十神分組：找出最多的一組', () => {
  const d = dominantShishen(bazi);
  assert.ok(['比劫', '食傷', '財', '官殺', '印'].includes(d.group));
  assert.ok(d.value >= Math.max(...Object.values(d.score)));
});

test('多胞胎借宮：老二以兄弟宮當命宮，宮名整圈輪轉', () => {
  const r = rotateZiwei(ziwei, 1);
  const oldSibling = ziwei.palaces.find((p) => p.name === '兄弟');
  const newMing = r.palaces.find((p) => p.name === '命宮');
  assert.equal(newMing.index, oldSibling.index);
  assert.equal(newMing.originalName, '兄弟');
  assert.deepEqual([...new Set(r.palaces.map((p) => p.name))].sort(), [...PALACE_SEQ].sort());
  // 遷移宮派：老二用遷移宮
  const t = rotateZiwei(ziwei, 6);
  assert.equal(t.palaces.find((p) => p.name === '命宮').originalName, '遷移');
});

test('多胞胎說明：一樣與不一樣的地方都講清楚', () => {
  const first = twinsInfo({ birthOrder: 1, natal, hasTime: true });
  assert.equal(first.shift, 0);
  const second = twinsInfo({ birthOrder: 2, natal, hasTime: true });
  assert.equal(second.shift, 1);
  assert.ok(second.lines.some((l) => l.includes('兄弟')));
  const travel = twinsInfo({ birthOrder: 2, natal, hasTime: true, method: 'travel' });
  assert.equal(travel.shift, 6);
  const third = twinsInfo({ birthOrder: 3, hasTime: false });
  assert.equal(third.shift, 2);
  assert.ok(third.lines.some((l) => l.includes('沒有填出生時間')));
  assert.equal(twinsInfo({ birthOrder: 0 }), null);
});

test('多胞胎的瑪雅曆：加上各自的出生時分後結果不同，解讀寫明有加', () => {
  const plain = computeMaya(INPUT.date);
  const older = computeMaya(INPUT.date, { h: 6, mi: 20 });
  const younger = computeMaya(INPUT.date, { h: 6, mi: 35 });
  assert.equal(plain.twin, false);
  assert.equal(older.twin, true);
  // 1990+8+15=2013 → 6；加 6 時 20 分 → 2039 → 14；加 6 時 35 分 → 2054 → 11
  assert.deepEqual([plain, older, younger].map((m) => m.items.find((x) => x.key === 'D').value), [6, 14, 11]);
  const line = (maya) => buildReading({ natal, bazi, ziwei, birth: INPUT.date, maya, today: TODAY, gender: '男', birthOrder: 2 })
    .areas.find((a) => a.id === 'personality').points.find((pt) => pt.system === '瑪雅' && pt.text.startsWith('瑪雅密碼')).text;
  assert.match(line(older), /已把出生時分加進計算/);
  assert.doesNotMatch(line(plain), /出生時分/);
});

test('稱骨白話：21～72 兩都有', () => {
  for (let w = 21; w <= 72; w += 1) assert.ok(CHENGGU_PLAIN[w] && CHENGGU_PLAIN[w].includes('現代看法'), String(w));
});

test('血型：四型文字齊全、配對不分順序；解讀列入共同點投票並標明流行文化，沒填就不出現', () => {
  for (const t of BLOOD_TYPES) {
    for (const k of ['personality', 'strengths', 'watch', 'work', 'love', 'stress', 'cope', 'advice']) assert.ok(BLOOD[t][k].length > 8, `${t} ${k}`);
    assert.ok(BLOOD[t].jobs.length >= 5 && BLOOD[t].tags.length === 2);
  }
  for (const a of BLOOD_TYPES) {
    for (const b of BLOOD_TYPES) {
      const m = bloodMatch(a, b);
      assert.ok(m && m.text.length > 10, `${a}×${b}`);
      assert.equal(m.text, bloodMatch(b, a).text);
    }
  }
  assert.equal(bloodMatch('A', ''), null);
  assert.equal(bloodMatch('C', 'A'), null);
  const base = { natal, bazi, ziwei, birth: INPUT.date, maya: computeMaya(INPUT.date), today: TODAY, gender: '男' };
  const r = buildReading({ ...base, bloodType: 'AB' });
  assert.ok(r.ranked.some((t) => t.sources.includes('血型 AB 型（流行文化）')));
  for (const id of ['personality', 'career', 'love', 'health']) assert.ok(r.areas.find((a) => a.id === id).points.some((p) => p.system === '血型'), id);
  const none = buildReading({ ...base, bloodType: '' });
  assert.ok(!none.areas.some((a) => a.points.some((p) => p.system === '血型')));
});

test('紫微：命宮以外的宮不再套命宮的個性；上升用自己的文案；瑪雅 D、E 同一個詞只講一次', async () => {
  const { ZIWEI_STARS, RISING_TEXT, mutagenIn } = await import('../js/core/reading-texts.js');
  const r = buildReading({ natal, bazi, ziwei, birth: INPUT.date, maya: computeMaya(INPUT.date), today: TODAY, gender: '男' });
  const social = r.areas.find((a) => a.id === 'social').points.filter((p) => p.system === '紫微').map((p) => p.text).join('');
  assert.match(social, /這些特質會表現在/);
  for (const [name, t] of Object.entries(ZIWEI_STARS)) assert.ok(!social.includes(t.ming), `${name} 的命宮文案出現在交友、遷移宮`);
  const personality = r.areas.find((a) => a.id === 'personality').points.map((p) => p.text).join('');
  assert.ok(RISING_TEXT.some((t) => personality.includes(t)));
  assert.match(mutagenIn('化忌', '疾厄'), /^化忌在疾厄：身體狀況/);
  // D 和 E 同一個詞：1950 年代～2025 年出生的人大多如此
  const { MAYA_KEYWORD_TEXT } = await import('../js/core/reading-texts.js');
  const kw = Object.keys(MAYA_KEYWORD_TEXT)[0];
  const maya = { ...computeMaya(INPUT.date), twin: false };
  maya.items = maya.items.map((x) => (x.key === 'D' || x.key === 'E' ? { ...x, keyword: kw } : x));
  const same = buildReading({ natal, bazi, ziwei, birth: INPUT.date, maya, today: TODAY, gender: '男' });
  const mayaText = same.areas.flatMap((a) => a.points).filter((p) => p.system === '瑪雅').map((p) => p.text).join('');
  assert.match(mayaText, /表象 D 和小宇宙 E 都是/);
  assert.equal(mayaText.split(`${kw}（`).length - 1, 1);
});

test('瑪雅銀河印記：參加共同點統計，個性、事業、人際、今年各一點；瑪雅密碼標明是另一套算法', () => {
  const r = buildReading({ natal, bazi, ziwei, birth: INPUT.date, maya: computeMaya(INPUT.date), today: TODAY, gender: '男' });
  const maya = (id) => r.areas.find((a) => a.id === id).points.filter((p) => p.system === '瑪雅').map((p) => p.text);
  // 1990/8/15＝KIN 109 超頻紅月：支持超頻白狗、挑戰超頻藍風暴；2026/11/24 的流年從 2026/8/15 起＝KIN 249 月亮紅月
  assert.match(maya('personality')[0], /^銀河印記 KIN 109「超頻紅月」：情感細膩.*調性「超頻」的關鍵是光芒/);
  assert.match(maya('personality')[1], /^瑪雅密碼（另一套算法）：/);
  assert.deepEqual(maya('career'), ['紅月的天賦：同理心強，能撫平別人的情緒，也能帶動改變。']);
  assert.match(maya('social')[0], /支持位是超頻白狗（愛、忠誠、心）.*挑戰位是超頻藍風暴/);
  assert.match(maya('year')[0], /^流年印記是 KIN 249「月亮紅月」（2026\/8\/15 生日起的一年）：關鍵字「淨化、流動、宇宙之水」，這一年常問自己：擋在前面的是什麼？$/);
  const sources = r.ranked.flatMap((t) => t.sources);
  assert.equal(sources.filter((s) => s === '瑪雅：銀河印記超頻紅月').length, SEAL_TAGS[9].length);
  // 還沒過今年生日：流年看去年生日那天
  const before = buildReading({ birth: INPUT.date, today: { y: 2026, m: 8, d: 14 } });
  assert.match(before.areas.find((a) => a.id === 'year').points.find((p) => p.system === '瑪雅').text, /2025\/8\/15 生日起的一年/);
});

test('20 個圖騰都對到兩個存在的特質；多胞胎說明寫明銀河印記一樣、瑪雅密碼加時分', () => {
  for (let n = 1; n <= 20; n += 1) {
    assert.equal(SEAL_TAGS[n].length, 2, String(n));
    for (const t of SEAL_TAGS[n]) assert.ok(TAGS[t], `${n}：${t}`);
  }
  const lines = twinsInfo({ birthOrder: 1 }).lines.join('');
  assert.match(lines, /稱骨、瑪雅銀河印記通常完全一樣/);
  assert.match(lines, /瑪雅密碼（另一套算法）會把出生的時與分加進去計算/);
});
