import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { handleRequest, periodInfo, parseSigns, taipeiDate } from '../worker/worker.js';

const require = createRequire(import.meta.url);
const { resetCooldowns } = require('../worker/model_router.cjs');

const IDS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
// 模擬的模型清單（測試資料，不是 App 寫死的模型）
const MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']; // guardrails: ignore（測試資料）

function memoryKV() {
  const store = new Map();
  return {
    store,
    async get(k, type) {
      const v = store.get(k);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(k, v) {
      store.set(k, v);
    },
    async delete(k) {
      store.delete(k);
    },
  };
}

const goodText = () => JSON.stringify(Object.fromEntries(IDS.map((id) => [id, `${id} 今天適合整理桌面。`])));
const messageResponse = (text, model) => new Response(JSON.stringify({ model, stop_reason: 'end_turn', content: [{ type: 'text', text }] }), { status: 200 });

/** 假的 Anthropic API：GET 回模型清單，POST 依 plan(model, 第幾次) 回應 */
function fakeApi(plan) {
  const posts = [];
  const fetchImpl = async (url, init) => {
    if (!init || init.method === 'GET') return new Response(JSON.stringify({ data: MODELS.map((id) => ({ id })) }), { status: 200 });
    const body = JSON.parse(init.body);
    posts.push({ url, headers: init.headers, body });
    return plan(body.model, posts.length);
  };
  return { fetchImpl, posts };
}

const ORIGIN = 'https://example.github.io';
const req = (path, origin = ORIGIN, method = 'GET') => new Request(`https://w.example${path}`, { method, headers: origin ? { origin } : {} });
const NOW = Date.parse('2026-11-23T23:30:00Z'); // 台灣 11/24 07:30
const noSleep = async () => {};
const env = (extra = {}) => ({ ALLOWED_ORIGINS: ORIGIN, FORTUNE_KV: memoryKV(), ANTHROPIC_API_KEY: 'test-key', ...extra });

test.beforeEach(() => resetCooldowns());

test('快取鍵用台灣日期（UTC 還是 11/23，台灣已經是 11/24）', () => {
  assert.deepEqual(taipeiDate(NOW), { y: 2026, m: 11, d: 24 });
  assert.equal(periodInfo('today', NOW).key, 'daily:2026-11-24');
  assert.equal(periodInfo('tomorrow', NOW).key, 'daily:2026-11-25');
  assert.equal(periodInfo('week', NOW).key, 'weekly:2026-W48');
  assert.equal(periodInfo('month', NOW).key, 'monthly:2026-11');
  assert.equal(periodInfo('year', NOW).key, 'yearly:2026');
  assert.equal(new Date(periodInfo('today', NOW).validUntil).toISOString(), '2026-11-24T16:00:00.000Z');
});

test('擋掉未授權網站、錯誤期間、非 GET', async () => {
  const e = env();
  assert.equal((await handleRequest(req('/fortune?period=today', 'https://evil.example'), e, NOW)).status, 403);
  assert.equal((await handleRequest(req('/fortune?period=decade'), e, NOW)).status, 400);
  assert.equal((await handleRequest(req('/fortune?period=today', ORIGIN, 'POST'), e, NOW)).status, 405);
});

test('不寫死模型：smart 等級自動挑 Sonnet；同一期間只呼叫一次 AI，之後讀 KV', async () => {
  const e = env();
  const api = fakeApi((model) => messageResponse(goodText(), model));
  const r1 = await handleRequest(req('/fortune?period=today'), e, NOW, { fetchImpl: api.fetchImpl, sleep: noSleep });
  assert.equal(r1.status, 200);
  assert.equal(r1.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(Object.keys((await r1.json()).signs).length, 12);
  const r2 = await handleRequest(req('/fortune?period=today'), e, NOW + 60000, { fetchImpl: api.fetchImpl, sleep: noSleep });
  assert.equal(r2.status, 200);
  assert.equal(api.posts.length, 1);
  const sent = api.posts[0];
  assert.match(sent.body.model, /sonnet/);
  assert.equal(sent.headers['x-api-key'], 'test-key');
  assert.ok(!sent.url.includes('test-key'), '金鑰不能出現在網址');
  assert.match(sent.body.system, /台灣/);
});

test('可用環境變數 MODEL 指定優先模型', async () => {
  const api = fakeApi((model) => messageResponse(goodText(), model));
  await handleRequest(req('/fortune?period=week'), env({ MODEL: 'claude-opus-5-5' }), NOW, { fetchImpl: api.fetchImpl, sleep: noSleep }); // guardrails: ignore（測試資料）
  assert.equal(api.posts[0].body.model, 'claude-opus-5-5'); // guardrails: ignore（測試資料）
});

test('回覆不是合格 JSON：自動升級到 best 等級重試', async () => {
  const api = fakeApi((model) => (/sonnet/.test(model) ? messageResponse('抱歉我無法提供', model) : messageResponse(goodText(), model)));
  const r = await handleRequest(req('/fortune?period=month'), env(), NOW, { fetchImpl: api.fetchImpl, sleep: noSleep });
  assert.equal(r.status, 200);
  assert.ok(api.posts.length >= 2);
  assert.match(api.posts[api.posts.length - 1].body.model, /opus/);
});

test('AI 暫時忙碌（529）會退避重試後成功', async () => {
  const api = fakeApi((model, n) => (n === 1 ? new Response('{"type":"error","error":{"type":"overloaded_error"}}', { status: 529 }) : messageResponse(goodText(), model)));
  const r = await handleRequest(req('/fortune?period=year'), env(), NOW, { fetchImpl: api.fetchImpl, sleep: noSleep });
  assert.equal(r.status, 200);
  assert.equal(api.posts.length, 2);
});

test('持續失敗回 503 並冷卻 60 秒；請求數有上限、不會一直重打', async () => {
  const e = env();
  const api = fakeApi(() => new Response('{"error":"down"}', { status: 500 }));
  const f1 = await handleRequest(req('/fortune?period=today'), e, NOW, { fetchImpl: api.fetchImpl, sleep: noSleep });
  assert.equal(f1.status, 503);
  assert.equal(f1.headers.get('retry-after'), '60');
  assert.ok(api.posts.length <= 6, `送出 ${api.posts.length} 次`);
  const before = api.posts.length;
  const f2 = await handleRequest(req('/fortune?period=today'), e, NOW, { fetchImpl: api.fetchImpl, sleep: noSleep });
  assert.equal(f2.status, 503);
  assert.equal(api.posts.length, before);
});

test('產生中時其他請求回 202', async () => {
  const kv = memoryKV();
  await kv.put('v2:lock:daily:2026-11-24', '1');
  const r = await handleRequest(req('/fortune?period=today'), env({ FORTUNE_KV: kv }), NOW, { fetchImpl: fakeApi(() => messageResponse(goodText())).fetchImpl, sleep: noSleep });
  assert.equal(r.status, 202);
  assert.equal(r.headers.get('retry-after'), '5');
});

test('解析回覆：可處理程式碼框；缺星座就算不合格', () => {
  assert.equal(Object.keys(parseSigns('```json\n' + goodText() + '\n```')).length, 12);
  assert.throws(() => parseSigns('{"aries":"x"}'));
  assert.throws(() => parseSigns('沒有 JSON'));
  // 回覆裡以 \u0007 跳脫的控制字元，解析後要被清掉
  const dirty = parseSigns(JSON.stringify(Object.fromEntries(IDS.map((id) => [id, `${id}\u0007今天`]))));
  assert.ok(!/\u0007/.test(dirty.aries));
});

test('打包後的單一檔案（要貼進 Cloudflare 的那份）可以正常運作，且與原始碼同步', async () => {
  const bundled = await import('../worker/dist/star-ai-worker.js');
  assert.equal(typeof bundled.default.fetch, 'function');
  assert.equal(typeof bundled.default.scheduled, 'function');
  const api = fakeApi((model) => messageResponse(goodText(), model));
  const r = await bundled.handleRequest(req('/fortune?period=today'), env(), NOW, { fetchImpl: api.fetchImpl, sleep: noSleep });
  assert.equal(r.status, 200);
  assert.equal(api.posts.length, 1);
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../worker/worker.js', import.meta.url), 'utf8');
  const dist = readFileSync(new URL('../worker/dist/star-ai-worker.js', import.meta.url), 'utf8');
  for (const marker of ['PROMPT_VERSION = "v2"', 'MAX_AI_CALLS = 6']) {
    assert.ok(dist.includes(marker), `打包檔缺少「${marker}」：原始碼改過後請執行 npm run build:worker`);
  }
  assert.ok(src.includes("PROMPT_VERSION = 'v2'"));
});

test('ai-model-router 的自我測試（共用 router_cases.json）', async () => {
  const { selftest } = require('../worker/model_router.cjs');
  const code = await selftest({ strict: true });
  assert.equal(code, 0);
});
