import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithBackoff, enqueue, aiEnabled } from '../js/ui/ai.js';

const res = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers });

test('沒設定 Worker 網址時 AI 功能關閉', () => {
  assert.equal(aiEnabled(), false);
});

test('202／5xx 會退避重試，成功就回傳', async () => {
  const seq = [res(202, { status: 'pending' }), res(503), res(200, { signs: { aries: 'ok' } })];
  let calls = 0;
  const data = await fetchWithBackoff('https://x/fortune', { baseMs: 1, fetchImpl: async () => seq[calls++] });
  assert.equal(calls, 3);
  assert.equal(data.signs.aries, 'ok');
});

test('retry-after 很長時等待有上限', async () => {
  let calls = 0;
  const t0 = Date.now();
  await fetchWithBackoff('https://x', {
    maxWaitMs: 20,
    fetchImpl: async () => (calls++ === 0 ? res(503, {}, { 'retry-after': '60' }) : res(200, { ok: 1 })),
  });
  assert.ok(Date.now() - t0 < 2000);
});

test('400 類錯誤不重試', async () => {
  let calls = 0;
  await assert.rejects(fetchWithBackoff('https://x', { baseMs: 1, fetchImpl: async () => { calls += 1; return res(403); } }));
  assert.equal(calls, 1);
});

test('重試次數用完就放棄', async () => {
  let calls = 0;
  await assert.rejects(fetchWithBackoff('https://x', { retries: 2, baseMs: 1, fetchImpl: async () => { calls += 1; return res(500); } }));
  assert.equal(calls, 3);
});

test('佇列：同時呼叫也會一個接一個執行', async () => {
  let running = 0;
  let maxRunning = 0;
  const order = [];
  const task = (id) => async () => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((r) => setTimeout(r, 5));
    order.push(id);
    running -= 1;
    return id;
  };
  const results = await Promise.all([enqueue(task(1)), enqueue(task(2)), enqueue(task(3))]);
  assert.deepEqual(results, [1, 2, 3]);
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(maxRunning, 1);
});
