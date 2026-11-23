import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, periodInfo, parseResult, taipeiDate } from '../worker/worker.js';

const IDS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

function memoryKV() {
  const store = new Map();
  return {
    store,
    async get(k, type) {
      const v = store.get(k);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(k, v, opts) {
      store.set(k, v);
      this.lastOpts = opts;
    },
    async delete(k) {
      store.delete(k);
    },
  };
}

function okResponse() {
  const text = JSON.stringify(Object.fromEntries(IDS.map((id) => [id, `${id} 今天適合整理桌面。`])));
  return new Response(JSON.stringify({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] }), { status: 200 });
}

const ORIGIN = 'https://example.github.io';
const req = (path, origin = ORIGIN, method = 'GET') => new Request(`https://w.example${path}`, { method, headers: origin ? { origin } : {} });
const NOW = Date.parse('2026-11-23T23:30:00Z'); // 台灣 11/24 07:30

test('快取鍵用台灣日期（UTC 還是 11/23，台灣已經是 11/24）', () => {
  assert.deepEqual(taipeiDate(NOW), { y: 2026, m: 11, d: 24 });
  assert.equal(periodInfo('today', NOW).key, 'daily:2026-11-24');
  assert.equal(periodInfo('tomorrow', NOW).key, 'daily:2026-11-25');
  assert.equal(periodInfo('week', NOW).key, 'weekly:2026-W48');
  assert.equal(periodInfo('month', NOW).key, 'monthly:2026-11');
  assert.equal(new Date(periodInfo('today', NOW).validUntil).toISOString(), '2026-11-24T16:00:00.000Z');
});

test('擋掉未授權網站、錯誤期間', async () => {
  const env = { ALLOWED_ORIGINS: ORIGIN, FORTUNE_KV: memoryKV(), ANTHROPIC_API_KEY: 'test' };
  assert.equal((await handleRequest(req('/fortune?period=today', 'https://evil.example'), env, NOW)).status, 403);
  assert.equal((await handleRequest(req('/fortune?period=year'), env, NOW)).status, 400);
  assert.equal((await handleRequest(req('/fortune?period=today', ORIGIN, 'POST'), env, NOW)).status, 405);
});

test('同一期間只呼叫一次 AI，之後都從 KV 快取讀', async () => {
  const kv = memoryKV();
  const env = { ALLOWED_ORIGINS: ORIGIN, FORTUNE_KV: kv, ANTHROPIC_API_KEY: 'test' };
  let calls = 0;
  let sent = null;
  const fetchImpl = async (url, init) => {
    calls += 1;
    sent = { url, init };
    return okResponse();
  };
  const r1 = await handleRequest(req('/fortune?period=today'), env, NOW, { fetchImpl });
  assert.equal(r1.status, 200);
  assert.equal(r1.headers.get('access-control-allow-origin'), ORIGIN);
  const body = await r1.json();
  assert.equal(Object.keys(body.signs).length, 12);
  const r2 = await handleRequest(req('/fortune?period=today'), env, NOW + 60000, { fetchImpl });
  assert.equal(r2.status, 200);
  assert.equal(calls, 1);

  // 請求內容檢查：金鑰在 header、結構化輸出、備援模型、無 temperature
  const payload = JSON.parse(sent.init.body);
  assert.equal(sent.init.headers['x-api-key'], 'test');
  assert.equal(sent.init.headers['anthropic-version'], '2026-10-21');
  assert.equal(payload.model, 'claude-opus-5-5');
  assert.equal(payload.fallbacks, 'default');
  assert.equal(sent.init.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(payload.output_config.format.type, 'json_schema');
  assert.equal('temperature' in payload, false);
  assert.equal('thinking' in payload, false);
});

test('AI 暫時失敗會退避重試；持續失敗回 503 並冷卻，不會一直重打', async () => {
  const env = { ALLOWED_ORIGINS: ORIGIN, FORTUNE_KV: memoryKV(), ANTHROPIC_API_KEY: 'test' };
  let calls = 0;
  const flaky = async () => {
    calls += 1;
    return calls < 3 ? new Response('busy', { status: 529 }) : okResponse();
  };
  const ok = await handleRequest(req('/fortune?period=week'), env, NOW, { fetchImpl: flaky, baseDelayMs: 1 });
  assert.equal(ok.status, 200);
  assert.equal(calls, 3);

  let failCalls = 0;
  const broken = async () => {
    failCalls += 1;
    return new Response('down', { status: 500 });
  };
  const env2 = { ALLOWED_ORIGINS: ORIGIN, FORTUNE_KV: memoryKV(), ANTHROPIC_API_KEY: 'test' };
  const f1 = await handleRequest(req('/fortune?period=month'), env2, NOW, { fetchImpl: broken, baseDelayMs: 1 });
  assert.equal(f1.status, 503);
  assert.equal(f1.headers.get('retry-after'), '60');
  const before = failCalls;
  const f2 = await handleRequest(req('/fortune?period=month'), env2, NOW, { fetchImpl: broken, baseDelayMs: 1 });
  assert.equal(f2.status, 503);
  assert.equal(failCalls, before); // 冷卻中，不再呼叫 AI
});

test('設定錯誤（401）不重試', async () => {
  const env = { ALLOWED_ORIGINS: ORIGIN, FORTUNE_KV: memoryKV(), ANTHROPIC_API_KEY: 'bad' };
  let calls = 0;
  const unauthorized = async () => {
    calls += 1;
    return new Response('no', { status: 401 });
  };
  const r = await handleRequest(req('/fortune?period=today'), env, NOW, { fetchImpl: unauthorized, baseDelayMs: 1 });
  assert.equal(r.status, 503);
  assert.equal(calls, 1);
});

test('產生中時其他請求回 202', async () => {
  const kv = memoryKV();
  await kv.put('v1:lock:daily:2026-11-24', '1');
  const env = { ALLOWED_ORIGINS: ORIGIN, FORTUNE_KV: kv, ANTHROPIC_API_KEY: 'test' };
  const r = await handleRequest(req('/fortune?period=today'), env, NOW, { fetchImpl: async () => okResponse() });
  assert.equal(r.status, 202);
  assert.equal(r.headers.get('retry-after'), '5');
});

test('AI 婉拒或內容不完整時不寫入快取', () => {
  assert.throws(() => parseResult({ stop_reason: 'refusal', content: [] }));
  assert.throws(() => parseResult({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"aries":"x"}' }] }));
});
