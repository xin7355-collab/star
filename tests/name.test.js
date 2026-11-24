// 姓名學：康熙筆畫、五格四種姓名結構、三才、81 數理、注音、錯誤處理。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadNameData, analyzeName, wuge, sancai, reduce81, elementOfNumber, splitName, charInfo, relationTo } from '../js/core/name.js';
import { NUMBERS_81 } from '../js/core/name-texts.js';
import { toZhuyin } from '../js/core/zhuyin.js';
import { STROKES } from '../js/core/kangxi-data.js';

const data = await loadNameData();

test('康熙筆畫：部首還原成本字（氵4、艹6、阝左8右7、王字旁5、礻5、忄4、扌4）', () => {
  const cases = {
    王: 4, 陳: 16, 林: 8, 蔡: 17, 鄭: 19, 洪: 10, 葉: 15, 萬: 15, 張: 11, 黃: 12, 劉: 15, 曾: 12, 郭: 15, 邱: 12,
    玲: 10, 志: 7, 明: 8, 怡: 9, 淑: 12, 芬: 10, 郁: 13, 瑜: 14, 華: 14, 承: 8, 浩: 11, 祥: 11, 隆: 17, 都: 16,
    姜: 9, 丑: 4, 岳: 8, 溫: 14,
  };
  for (const [ch, n] of Object.entries(cases)) assert.equal(charInfo(ch, data).strokes, n, ch);
});

test('國字數字一～十以數值計', () => {
  const nums = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  for (const [ch, n] of Object.entries(nums)) {
    const c = charInfo(ch, data);
    assert.equal(c.strokes, n, ch);
    assert.equal(c.source, '數字以數值計');
  }
});

test('資料完整：13063 個 Big5 字，筆畫都在 1～48', () => {
  const total = STROKES.reduce((a, s) => a + Array.from(s).length, 0);
  assert.equal(total, 13063);
  assert.equal(STROKES[0], '');
  assert.equal(STROKES.length - 1, 48);
  assert.equal(data.strokes.size, 13063);
  assert.ok(data.reads.size > 13000);
});

test('五格：單姓複名（王小明）', () => {
  const g = wuge([4], [3, 8]);
  assert.deepEqual([g.天格.value, g.人格.value, g.地格.value, g.外格.value, g.總格.value], [5, 7, 11, 9, 15]);
});

test('五格：單姓單名的外格固定是 2（李白）', () => {
  const g = wuge([7], [5]);
  assert.deepEqual([g.天格.value, g.人格.value, g.地格.value, g.外格.value, g.總格.value], [8, 12, 6, 2, 12]);
});

test('五格：複姓單名（司馬光）外格＝姓首字＋1', () => {
  const r = analyzeName('司馬光', data);
  assert.equal(r.ok, true);
  assert.deepEqual(r.surname.map((c) => c.char), ['司', '馬']);
  const g = r.grids;
  assert.deepEqual([g.天格.value, g.人格.value, g.地格.value, g.外格.value, g.總格.value], [15, 16, 7, 6, 21]);
});

test('五格：複姓複名（歐陽娜娜）外格＝姓首字＋名末字', () => {
  const r = analyzeName('歐陽娜娜', data);
  const g = r.grids;
  assert.deepEqual([g.天格.value, g.人格.value, g.地格.value, g.外格.value, g.總格.value], [32, 27, 20, 25, 52]);
  assert.ok(r.phonetics.notes.some((n) => n.includes('疊字')));
});

test('冠夫姓／雙姓可指定姓氏 2 個字', () => {
  assert.deepEqual(splitName('陳林美玲', 2).surname, ['陳', '林']);
  assert.deepEqual(splitName('陳林美玲').surname, ['陳']); // 不在複姓表就當單姓
});

test('81 數理：1～81 都有資料，超過 81 減 80，五行看個位數', () => {
  for (let n = 1; n <= 81; n += 1) {
    assert.ok(NUMBERS_81[n], `缺 ${n}`);
    assert.ok(['good', 'mixed', 'bad'].includes(NUMBERS_81[n].grade));
    assert.ok(NUMBERS_81[n].text.length > 10);
  }
  assert.equal(reduce81(82), 2);
  assert.equal(reduce81(90), 10);
  assert.equal(reduce81(161), 81);
  assert.deepEqual([11, 23, 35, 47, 59, 20].map(elementOfNumber), ['木', '火', '土', '金', '水', '水']);
});

test('三才：相生順、地格剋人格最傷', () => {
  assert.equal(relationTo('木', '火'), '生');
  assert.equal(relationTo('水', '火'), '剋');
  assert.equal(relationTo('土', '火'), '洩');
  assert.equal(sancai('木', '火', '土').grade, 'good');
  assert.equal(sancai('木', '火', '水').grade, 'bad');
  assert.equal(sancai('木', '木', '木').grade, 'good');
});

test('注音：零聲母、捲舌音、ü、兒化與輕聲', () => {
  assert.equal(toZhuyin('wang', 2), 'ㄨㄤˊ');
  assert.equal(toZhuyin('lv', 4), 'ㄌㄩˋ');
  assert.equal(toZhuyin('zhi', 1), 'ㄓ');
  assert.equal(toZhuyin('ju', 4), 'ㄐㄩˋ');
  assert.equal(toZhuyin('yuan', 2), 'ㄩㄢˊ');
  assert.equal(toZhuyin('wei', 4), 'ㄨㄟˋ');
  assert.equal(toZhuyin('you', 3), 'ㄧㄡˇ');
  assert.equal(toZhuyin('er', 2), 'ㄦˊ');
  assert.equal(toZhuyin('de', 5), '˙ㄉㄜ');
  assert.equal(toZhuyin('xiong', 2), 'ㄒㄩㄥˊ');
  assert.equal(charInfo('曾', data, { asSurname: true }).zhuyin, 'ㄗㄥ'); // 姓氏讀音
});

test('唸法：全部同聲調會提醒；連續三聲說明變調', () => {
  const r = analyzeName('王小明', data);
  assert.equal(r.phonetics.ok, true);
  assert.deepEqual(r.phonetics.chars.map((c) => c.zhuyin), ['ㄨㄤˊ', 'ㄒㄧㄠˇ', 'ㄇㄧㄥˊ']);
  assert.equal(r.phonetics.pattern, '平仄平');
  const same = analyzeName('李美好', data);
  assert.ok(same.phonetics.notes.some((n) => n.includes('三聲')));
});

test('錯誤處理：非中文、太短、罕用字要手動輸入筆畫', () => {
  assert.equal(analyzeName('A小明', data).ok, false);
  assert.equal(analyzeName('王', data).ok, false);
  const rare = analyzeName('王𠀋', data);
  assert.equal(rare.ok, false);
  assert.deepEqual(rare.needStrokes, ['𠀋']);
  const fixed = analyzeName('王𠀋', data, { overrides: { '𠀋': 3 } });
  assert.equal(fixed.ok, true);
  assert.equal(fixed.given[0].source, '手動輸入');
});

test('與八字搭配：名字補到最弱的五行會說明', () => {
  const bazi = { ok: true, wuxing: { withHidden: { 木: 5, 火: 3, 土: 2, 金: 2, 水: 0 } } };
  const r = analyzeName('王小明', data, { bazi });
  assert.ok(r.bazi.lines[0].includes('最弱的是「水」'));
  // 王小明：人格 7 金、地格 11 木、總格 15 土，都不是水
  assert.equal(r.bazi.helps.length, 0);
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.ok(r.summary.length >= 3);
});
