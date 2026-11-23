// 星座手帳 AI 短評代理（Cloudflare Workers，單一檔案，可直接貼到 Cloudflare 網頁後台）
//
// 設計重點：
// 1. API Key 只存在 Cloudflare Secret（ANTHROPIC_API_KEY），前端與 GitHub 都看不到。
// 2. 內容只依「期間」產生、12 星座一次產生，並以「台灣日期」為快取鍵存進 KV：
//    不論多少人使用，每天最多約 1 次 AI 呼叫（週、月各再 1 次），費用有上限。
//    （修正 mastra-fortune-telling 用 UTC 日期，導致台灣早上 8 點前拿到昨天的問題）
// 3. 同一份內容產生中時，其他請求回 202 請前端稍後再試；失敗後冷卻 60 秒，避免被反覆觸發。
// 4. 呼叫 AI 失敗（429／5xx／網路）時指數退避重試。
// 5. 只接受 ALLOWED_ORIGINS 列出的網站呼叫（CORS）。
//
// 需要的設定（Cloudflare 後台 → Workers → 你的 Worker → Settings）：
//   Secret   ANTHROPIC_API_KEY  你的 Anthropic API Key
//   KV 綁定  FORTUNE_KV         一個 KV namespace
//   變數     ALLOWED_ORIGINS    例：https://你的帳號.github.io （多個用逗號分隔）
//   變數     MODEL（選填）      預設 claude-opus-5-5
// 排程（選填）：Triggers → Cron → `5 16 * * *`（台灣 00:05）預先產生當天內容。
//
// 註：因為要能在手機上直接貼進 Cloudflare 後台（無法用 npm 打包 SDK），這裡用 REST API 呼叫。

const TZ_OFFSET_HOURS = 8; // 台灣自 1980 年起固定 UTC+8，無日光節約
const SIGNS = [
  ['aries', '牡羊座'], ['taurus', '金牛座'], ['gemini', '雙子座'], ['cancer', '巨蟹座'],
  ['leo', '獅子座'], ['virgo', '處女座'], ['libra', '天秤座'], ['scorpio', '天蠍座'],
  ['sagittarius', '射手座'], ['capricorn', '摩羯座'], ['aquarius', '水瓶座'], ['pisces', '雙魚座'],
];
const PERIODS = ['today', 'tomorrow', 'week', 'month'];
const DEFAULT_MODEL = 'claude-opus-5-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
const PROMPT_VERSION = 'v1';

// ── 台灣日期工具 ─────────────────────────────────────────────
const DAY_MS = 86400000;
const pad2 = (n) => String(n).padStart(2, '0');

export function taipeiDate(nowMs) {
  const t = new Date(nowMs + TZ_OFFSET_HOURS * 3600000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
function addDays({ y, m, d }, n) {
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
/** 台灣某日 00:00 的 UTC 毫秒 */
function taipeiMidnightUtc({ y, m, d }) {
  return Date.UTC(y, m - 1, d) - TZ_OFFSET_HOURS * 3600000;
}
const iso = ({ y, m, d }) => `${y}-${pad2(m)}-${pad2(d)}`;
function isoWeekday({ y, m, d }) {
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}
function isoWeek({ y, m, d }) {
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return { year: date.getUTCFullYear(), week: Math.ceil(((date.getTime() - yearStart) / DAY_MS + 1) / 7) };
}

/**
 * 期間 → 快取鍵、日期範圍、到期時間
 * @returns {{key:string, label:string, start:{y,m,d}, end:{y,m,d}, expiresAt:number, validUntil:number}}
 */
export function periodInfo(period, nowMs) {
  const today = taipeiDate(nowMs);
  const nextMidnight = taipeiMidnightUtc(addDays(today, 1));
  if (period === 'today' || period === 'tomorrow') {
    const day = period === 'today' ? today : addDays(today, 1);
    return {
      key: `daily:${iso(day)}`,
      label: `${day.y} 年 ${day.m} 月 ${day.d} 日`,
      start: day,
      end: day,
      expiresAt: taipeiMidnightUtc(addDays(day, 1)) + 3600000,
      validUntil: nextMidnight,
    };
  }
  if (period === 'week') {
    const monday = addDays(today, 1 - isoWeekday(today));
    const sunday = addDays(monday, 6);
    const w = isoWeek(today);
    const end = taipeiMidnightUtc(addDays(sunday, 1));
    return { key: `weekly:${w.year}-W${pad2(w.week)}`, label: `${monday.m}/${monday.d}–${sunday.m}/${sunday.d} 這一週`, start: monday, end: sunday, expiresAt: end + 3600000, validUntil: end };
  }
  if (period === 'month') {
    const first = { y: today.y, m: today.m, d: 1 };
    const nextFirst = today.m === 12 ? { y: today.y + 1, m: 1, d: 1 } : { y: today.y, m: today.m + 1, d: 1 };
    const end = taipeiMidnightUtc(nextFirst);
    return { key: `monthly:${today.y}-${pad2(today.m)}`, label: `${today.y} 年 ${today.m} 月`, start: first, end: addDays(nextFirst, -1), expiresAt: end + 3600000, validUntil: end };
  }
  throw new Error('invalid period');
}

// ── CORS ─────────────────────────────────────────────────────
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}
function corsHeaders(origin) {
  return origin
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'accept', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
    : { Vary: 'Origin' };
}
function json(status, body, origin, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', ...corsHeaders(origin), ...extra },
  });
}

// ── AI 呼叫 ──────────────────────────────────────────────────
const SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(SIGNS.map(([id]) => [id, { type: 'string' }])),
  required: SIGNS.map(([id]) => id),
  additionalProperties: false,
};

const SYSTEM_PROMPT = [
  '你是台灣星座生活專欄的作者，替一個娛樂性質的星座 App 撰寫十二星座的短評。',
  '讀者是台灣的一般使用者，請使用繁體中文與台灣慣用語（例如：牡羊座、捷運、上班族、資訊、品質）。',
  '每個星座寫 50 到 90 個字，語氣溫暖、具體、可行動，例如給一個今天可以做的小建議。',
  '這是娛樂內容：不要做醫療、投資、法律方面的具體建議或保證，不要製造恐懼，不要提及其他 App 或品牌。',
  '每個星座的內容要彼此不同，不要重複同樣的句型。',
].join('\n');

function periodPrompt(period, info) {
  const scope = period === 'week' ? `一週（${info.label}）` : period === 'month' ? `一個月（${info.label}）` : `一天（${info.label}）`;
  return `請為十二星座分別撰寫「${scope}」的生活短評。依 JSON 格式輸出，鍵為星座英文代號：${SIGNS.map(([id, name]) => `${id}=${name}`).join('、')}。`;
}

function supportsServerFallback(model) {
  return /^claude-(opus-5|fable-5|sonnet-5-5|mythos-5)/.test(model);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 呼叫 Claude API，429／5xx／529／網路錯誤時指數退避重試 */
export async function callClaude(env, period, info, { fetchImpl = fetch, maxAttempts = 3, baseDelayMs = 2000 } = {}) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('missing ANTHROPIC_API_KEY');
  const model = env.MODEL || DEFAULT_MODEL;
  const body = {
    model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: periodPrompt(period, info) }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
  };
  const headers = {
    'content-type': 'application/json',
    'x-api-key': env.ANTHROPIC_API_KEY,
    'anthropic-version': '2026-10-21',
  };
  if (supportsServerFallback(model)) {
    // 遭安全分類器婉拒時，由伺服器自動改用建議的備援模型重跑
    body.fallbacks = 'default';
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }

  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let res = null;
    try {
      res = await fetchImpl(API_URL, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (err) {
      lastError = new Error(`network: ${err.message}`);
    }
    if (res && res.ok) {
      const data = await res.json();
      return parseResult(data);
    }
    if (res) {
      const retryable = res.status === 429 || res.status >= 500;
      lastError = new Error(`anthropic http ${res.status}`);
      if (!retryable) throw lastError; // 400／401／403 等設定錯誤不重試
    }
    if (attempt < maxAttempts - 1) {
      const ra = res ? Number(res.headers.get('retry-after')) : NaN;
      const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 20000) : baseDelayMs * 2 ** attempt;
      await sleep(wait + Math.random() * wait * 0.25);
    }
  }
  throw lastError || new Error('anthropic failed');
}

export function parseResult(data) {
  if (!data || !Array.isArray(data.content)) throw new Error('bad response');
  if (data.stop_reason === 'refusal') throw new Error('refused');
  if (data.stop_reason === 'max_tokens') throw new Error('truncated');
  const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const parsed = JSON.parse(text);
  const signs = {};
  for (const [id] of SIGNS) {
    const v = parsed[id];
    if (typeof v !== 'string' || !v.trim()) throw new Error(`missing ${id}`);
    // 去除控制字元、限制長度（前端也只用 textContent 顯示）
    signs[id] = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
  }
  return { signs, model: data.model || null };
}

// ── 產生並快取 ───────────────────────────────────────────────
async function getOrGenerate(env, period, nowMs, options = {}) {
  const info = periodInfo(period, nowMs);
  const dataKey = `${PROMPT_VERSION}:data:${info.key}`;
  const lockKey = `${PROMPT_VERSION}:lock:${info.key}`;
  const failKey = `${PROMPT_VERSION}:fail:${info.key}`;

  const cached = await env.FORTUNE_KV.get(dataKey, 'json');
  if (cached) return { status: 200, body: { ...cached, period, validUntil: new Date(info.validUntil).toISOString() } };
  if (await env.FORTUNE_KV.get(lockKey)) return { status: 202, body: { status: 'pending' }, retryAfter: 5 };
  if (await env.FORTUNE_KV.get(failKey)) return { status: 503, body: { error: 'temporarily unavailable' }, retryAfter: 60 };

  await env.FORTUNE_KV.put(lockKey, '1', { expirationTtl: 120 });
  try {
    const { signs, model } = await callClaude(env, period, info, options);
    const record = { key: info.key, generatedAt: new Date(nowMs).toISOString(), model, signs };
    const expiration = Math.floor(info.expiresAt / 1000);
    await env.FORTUNE_KV.put(dataKey, JSON.stringify(record), { expiration: Math.max(expiration, Math.floor(nowMs / 1000) + 120) });
    return { status: 200, body: { ...record, period, validUntil: new Date(info.validUntil).toISOString() } };
  } catch (err) {
    console.error('generate failed', info.key, err.message); // 只記在 Cloudflare 日誌，不回傳細節
    await env.FORTUNE_KV.put(failKey, '1', { expirationTtl: 60 });
    return { status: 503, body: { error: 'temporarily unavailable' }, retryAfter: 60 };
  } finally {
    await env.FORTUNE_KV.delete(lockKey);
  }
}

export async function handleRequest(request, env, nowMs = Date.now(), options = {}) {
  const url = new URL(request.url);
  const origin = (request.headers.get('origin') || '').replace(/\/+$/, '');
  const allow = allowedOrigins(env);
  const originOk = allow.length === 0 ? true : allow.includes(origin);
  const corsOrigin = originOk && origin ? origin : null;

  if (request.method === 'OPTIONS') {
    return originOk ? new Response(null, { status: 204, headers: corsHeaders(corsOrigin) }) : new Response(null, { status: 403 });
  }
  if (request.method !== 'GET') return json(405, { error: 'method not allowed' }, corsOrigin);
  if (url.pathname === '/' || url.pathname === '') return json(200, { ok: true, service: 'star-ai' }, corsOrigin);
  if (url.pathname !== '/fortune') return json(404, { error: 'not found' }, corsOrigin);
  if (!originOk) return json(403, { error: 'origin not allowed' }, null);

  const period = url.searchParams.get('period');
  if (!PERIODS.includes(period)) return json(400, { error: 'period must be today, tomorrow, week or month' }, corsOrigin);
  if (!env.FORTUNE_KV) return json(500, { error: 'KV not configured' }, corsOrigin);

  const r = await getOrGenerate(env, period, nowMs, options);
  const extra = r.retryAfter ? { 'retry-after': String(r.retryAfter) } : r.status === 200 ? { 'cache-control': 'public, max-age=600' } : {};
  return json(r.status, r.body, corsOrigin, extra);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      console.error('unhandled', err && err.message);
      return json(500, { error: 'internal error' }, null);
    }
  },
  // 排程：依序預先產生（一次一個，避免同時大量呼叫）
  async scheduled(event, env, ctx) {
    const now = Date.now();
    for (const period of PERIODS) {
      try {
        await getOrGenerate(env, period, now);
      } catch (err) {
        console.error('scheduled', period, err && err.message);
      }
    }
  },
};
