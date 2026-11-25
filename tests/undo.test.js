// 復原／重做堆疊（掌紋描線用）：順序、說明文字、新動作讓重做作廢、步數上限。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUndo } from '../js/core/undo.js';

test('復原、重做照順序；說明文字對應下一個會動到的步驟', () => {
  const u = createUndo();
  assert.equal(u.undo('S0'), null);
  assert.equal(u.redo('S0'), null);
  u.push('點第 1 個位置', 'S0');
  u.push('描生命線', 'S1');
  assert.equal(u.nextUndo(), '描生命線');
  assert.equal(u.nextRedo(), '');
  // 復原：拿回描生命線之前的狀態；現在的狀態留給重做
  const a = u.undo('S2');
  assert.deepEqual(a, { label: '描生命線', state: 'S1' });
  assert.equal(u.nextUndo(), '點第 1 個位置');
  assert.equal(u.nextRedo(), '描生命線');
  // 重做：回到描完生命線的狀態
  const b = u.redo('S1');
  assert.deepEqual(b, { label: '描生命線', state: 'S2' });
  assert.equal(u.nextUndo(), '描生命線');
  // 連續復原到底
  assert.equal(u.undo('S2').state, 'S1');
  assert.equal(u.undo('S1').state, 'S0');
  assert.equal(u.undo('S0'), null);
  assert.deepEqual(u.states().sort(), ['S1', 'S2']); // 都在重做那邊
});

test('復原後做了新動作：原本可以重做的作廢；超過上限丟掉最舊的；清空', () => {
  const u = createUndo({ limit: 3 });
  u.push('a', 0);
  u.push('b', 1);
  u.undo(2);
  assert.equal(u.nextRedo(), 'b');
  u.push('c', 1);
  assert.equal(u.nextRedo(), '');
  for (const [label, st] of [['d', 2], ['e', 3], ['f', 4]]) u.push(label, st);
  assert.deepEqual(u.states(), [2, 3, 4]);
  assert.equal(u.nextUndo(), 'f');
  u.clear();
  assert.equal(u.nextUndo(), '');
  assert.deepEqual(u.states(), []);
});
