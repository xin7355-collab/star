// 自訂牌組：檔名認牌（中文、英文、編號、牌背）；對不到或有兩種可能時不亂猜。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchCardFile, mapFiles } from '../js/core/tarot-deck.js';
import { DECK } from '../js/core/tarot.js';

const id = (name) => (matchCardFile(name) || {}).id || null;

test('中文牌名：78 張的正式名稱都認得', () => {
  for (const d of DECK) assert.equal(id(`${d.name}.jpg`), d.id, d.name);
  assert.equal(id('星幣10.jpg'), '錢幣-9');
  assert.equal(id('魔法師.png'), 'major-1');
  assert.equal(id('倒吊人.png'), 'major-12');
  // 「皇后」單獨是大牌，前面有花色才是宮廷牌
  assert.equal(id('皇后.jpg'), 'major-3');
  assert.equal(id('寶劍皇后.jpg'), '寶劍-12');
});

test('英文名與常見編號', () => {
  const cases = {
    'the-fool.jpg': 'major-0', 'The_High_Priestess.png': 'major-2', 'wheel_of_fortune.jpg': 'major-10', 'judgment.jpg': 'major-20',
    'ace-of-cups.png': '聖杯-0', 'page_of_wands.jpg': '權杖-10', 'knight of swords.jpg': '寶劍-11', 'queen-pentacles.jpg': '錢幣-12',
    'Wands01.jpg': '權杖-0', 'Cups14.jpg': '聖杯-13', 'Pents03.jpg': '錢幣-2', 'Swords10.jpg': '寶劍-9',
    'RWS_Tarot_08_Strength.jpg': 'major-8', 'm00.jpg': 'major-0', '00.jpg': 'major-0', 'ar21.png': 'major-21', 'major-13.jpg': 'major-13',
    'fool-v2.jpg': 'major-0', '08_justice.jpg': 'major-11',
  };
  for (const [name, want] of Object.entries(cases)) assert.equal(id(name), want, name);
});

test('不亂猜：對不到、兩種花色、兩張不同的大牌、只有宮廷頭銜，都回傳 null；牌背另外認', () => {
  for (const name of ['IMG_1234.jpg', 'sun-and-moon.jpg', 'cups-swords.jpg', 'king.jpg', 'wands 2 copy 3.jpg', '', 'photo.heic']) assert.equal(matchCardFile(name), null, name);
  assert.deepEqual(matchCardFile('back.png'), { back: true });
  assert.deepEqual(matchCardFile('牌背.jpg'), { back: true });
});

test('一批檔案：同一張牌重複的留第一個，對不到的列出來', () => {
  const r = mapFiles(['愚者.jpg', 'the-fool.png', 'x.jpg', 'back.png', '牌背.jpg', 'cups-03.png']);
  assert.deepEqual([...r.mapped.entries()], [['major-0', '愚者.jpg'], ['聖杯-2', 'cups-03.png']]);
  assert.equal(r.back, 'back.png');
  assert.deepEqual(r.unknown, ['x.jpg']);
  assert.deepEqual(r.duplicate, ['the-fool.png', '牌背.jpg']);
});
