// 分享圖卡的匿名版：名字、出生時間、提問要拿掉，其他內容不能被換壞。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anonymizeSpec, namesOf } from '../js/core/privacy.js';

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
  assert.deepEqual(namesOf(people), ['我', '王小明', '王明星', '媽媽']);
  const out = anonymizeSpec({ title: '王明星・姓名分析', bigLabel: '媽媽的綜合分', lines: ['王小明的人格 23'] }, namesOf(people));
  assert.equal(out.title, '某人・姓名分析');
  assert.equal(out.bigLabel, '綜合分');
  assert.deepEqual(out.lines, ['人格 23']);
});
