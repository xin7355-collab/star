// 分享圖卡的匿名版：名字、出生時間、提問要拿掉，其他內容不能被換壞。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anonymizeSpec, namesOf } from '../js/core/privacy.js';
import { crossAspects } from '../js/core/synastry.js';
import { buildNatal } from '../js/core/natal.js';

test('名字＋「的」整段拿掉，其他地方的名字換成「某人」；長名字先換', () => {
  const spec = { title: '王小明的八字', subtitle: '出生 1990/8/15 06:20', private: ['subtitle'], lines: ['王小明和小明不是同一個人', '日主甲木'] };
  const out = anonymizeSpec(spec, ['小明', '王小明']);
  assert.equal(out.title, '八字');
  assert.ok(!('subtitle' in out) && !('private' in out));
  assert.deepEqual(out.lines, ['某人和某人不是同一個人', '日主甲木']);
  // 原本的圖卡內容不會被改到
  assert.equal(spec.title, '王小明的八字');
  assert.equal(spec.subtitle, '出生 1990/8/15 06:20');
});

test('一個字的暱稱只在標題、前後是分隔符號時才換，一般句子不動', () => {
  const out = anonymizeSpec({ title: '我的星盤：獅子座', lines: ['我們都想被理解', '媽媽說的話'] }, ['我', '媽']);
  assert.equal(out.title, '星盤：獅子座');
  assert.deepEqual(out.lines, ['我們都想被理解', '媽媽說的話']);
  assert.equal(anonymizeSpec({ title: '我 × 媽' }, ['我', '媽']).title, '某人 × 某人');
  assert.equal(anonymizeSpec({ title: '我 × 王大同' }, ['我', '王大同']).title, '某人 × 某人');
  // 標題整個都是名字：留個保底標題，不要空白
  assert.equal(anonymizeSpec({ title: '王小明' }, ['王小明']).title, '某人');
  assert.equal(anonymizeSpec({ title: '王小明的' }, ['王小明']).title, '星座手帳');
});

test('名單的名字：暱稱、本名、藝名都要藏；空的、重複的略過', () => {
  const people = [
    { name: '我', fullName: '王小明', altNames: [{ kind: '藝名', name: '王明星' }] },
    { name: '媽媽', fullName: '' },
  ];
  assert.deepEqual(namesOf(people), [['我', '王小明', '王明星'], ['媽媽']]);
  const out = anonymizeSpec({ title: '王明星・姓名分析', bigLabel: '媽媽的綜合分', lines: ['王小明的人格 23'] }, namesOf(people));
  assert.equal(out.title, '某人・姓名分析');
  assert.equal(out.bigLabel, '綜合分');
  assert.deepEqual(out.lines, ['人格 23']);
});

test('多人圖卡（配對）：依出現順序換成 A、B，同一個人的暱稱和本名是同一個字母，看得出誰是誰', () => {
  const people = [{ name: '小明', fullName: '王小明' }, { name: '小華', fullName: '陳小華' }];
  const spec = { title: '小明 × 小華', subtitle: '星座配對', multi: true, lines: ['小華的金星 合相 王小明的火星（差 1.2°）', '小明的太陽 三分相 陳小華的月亮（差 3°）'] };
  const out = anonymizeSpec(spec, namesOf(people));
  assert.equal(out.title, 'A × B');
  assert.equal(out.subtitle, '星座配對');
  assert.deepEqual(out.lines, ['B的金星 合相 A的火星（差 1.2°）', 'A的太陽 三分相 B的月亮（差 3°）']);
  assert.ok(!('multi' in out));
  assert.equal(spec.title, '小明 × 小華');
});

test('多人圖卡：一個字的暱稱內文也要換（一般句子不動）；合盤每一組都看得出是誰', () => {
  const names = [['我'], ['媽'], ['王大同']];
  const pair = anonymizeSpec({ title: '我 × 媽', multi: true, lines: ['我的太陽 三分相 媽的月亮（差 2°）', '我們的默契很好', '媽媽說的話'] }, names);
  assert.equal(pair.title, 'A × B');
  assert.deepEqual(pair.lines, ['A的太陽 三分相 B的月亮（差 2°）', '我們的默契很好', '媽媽說的話']);
  const group = anonymizeSpec({ title: '3 人合盤', multi: true, lines: ['王大同 × 媽：82', '我 × 王大同：70', '媽 × 我：65'] }, names);
  assert.equal(group.title, '3 人合盤');
  assert.deepEqual(group.lines, ['A × B：82', 'C × A：70', 'B × C：65']);
});

test('多人圖卡：用配對真正產生的相位文字檢查，匿名後圖上不留任何名字', () => {
  const natal = (y, m, d, time) => buildNatal({ date: { y, m, d }, time, tz: 'Asia/Taipei', place: null });
  const a = { name: '我', natal: natal(1990, 8, 15, { h: 6, mi: 20 }) };
  const b = { name: '媽媽', natal: natal(1962, 11, 20, null) };
  const aspects = crossAspects(a, b).slice(0, 3);
  assert.ok(aspects.length > 0);
  const lines = aspects.map((x) => `${x.title}（差 ${x.dev}°）`);
  const out = anonymizeSpec({ title: '我 × 媽媽', multi: true, lines }, namesOf([{ name: '我', fullName: '王小明' }, { name: '媽媽', fullName: '陳美玲' }]));
  assert.equal(out.title, 'A × B');
  for (const l of out.lines) {
    assert.match(l, /^[AB]的\S+ \S+ [AB]的\S+（差 [\d.]+°）$/, l);
    assert.ok(!/我|媽/.test(l), l);
  }
});
