// 星座手帳 AI 短評代理（Cloudflare Workers）。
// 原始碼在這裡；要貼到 Cloudflare 後台的是打包好的單一檔案 worker/dist/star-ai-worker.js（npm run build:worker）。
//
// 設計重點：
// 1. API Key 只存在 Cloudflare Secret（ANTHROPIC_API_KEY），前端與 GitHub 都看不到；金鑰只走 HTTP 標頭。
// 2. 不寫死模型名稱：用 skl 的 ai-model-router，只指定等級 smart（寫一段像樣的文字）；
//    模型下架自動換、回覆不是合格 JSON 就自動升級到 best；一次最多送 6 個請求，避免費用失控。
// 3. 內容只依「期間」產生、12 星座一次產生，並以「台灣日期」為快取鍵存進 KV：
//    不論多少人使用，每天約 1 次 AI 呼叫（週、月、年各再 1 次），費用有上限。
//    （修正 mastra-fortune-telling 用 UTC 日期，導致台灣早上 8 點前拿到昨天的問題）
// 4. 同一份內容產生中時，其他請求回 202 請前端稍後再試；失敗後冷卻 60 秒，避免被反覆觸發。
// 5. 只接受 ALLOWED_ORIGINS 列出的網站呼叫（CORS）。
//
// 需要的設定（Cloudflare 後台 → Workers → 你的 Worker → Settings）：
//   Secret   ANTHROPIC_API_KEY  你的 Anthropic API Key（可用逗號放多把）
//   KV 綁定  FORTUNE_KV         一個 KV namespace
//   變數     ALLOWED_ORIGINS    例：https://你的帳號.github.io （多個用逗號分隔）
//   變數     MODEL（選填）      指定優先使用的模型；不填就自動挑最新的 Sonnet 等級
// 排程（選填）：Triggers → Cron → `5 16 * * *`（台灣 00:05）預先產生當天內容。

import routerModule from './model_router.cjs';

const { ModelRouter } = routerModule;
const TZ_OFFSET_HOURS = 8; // 台灣自 1980 年起固定 UTC+8，無日光節約
const SIGNS = [
  ['aries', '牡羊座'], ['taurus', '金牛座'], ['gemini', '雙子座'], ['cancer', '巨蟹座'],
  ['leo', '獅子座'], ['virgo', '處女座'], ['libra', '天秤座'], ['scorpio', '天蠍座'],
  ['sagittarius', '射手座'], ['capricorn', '摩羯座'], ['aquarius', '水瓶座'], ['pisces', '雙魚座'],
];
const PERIODS = ['today', 'tomorrow', 'week', 'month', 'year'];
const PROMPT_VERSION = 'v2';
const MAX_AI_CALLS = 6;

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
 * 期間 → 快取鍵、說明文字、到期時間
 * @returns {{key:string, label:string, expiresAt:number, validUntil:number}}
 */
export function periodInfo(period, nowMs) {
  const today = taipeiDate(nowMs);
  const nextMidnight = taipeiMidnightUtc(addDays(today, 1));
  if (period === 'today' || period === 'tomorrow') {
    const day = period === 'today' ? today : addDays(today, 1);
    return {
      key: `daily:${iso(day)}`,
      label: `${day.y} 年 ${day.m} 月 ${day.d} 日`,
      expiresAt: taipeiMidnightUtc(addDays(day, 1)) + 3600000,
      validUntil: nextMidnight,
    };
  }
  if (period === 'week') {
    const monday = addDays(today, 1 - isoWeekday(today));
    const sunday = addDays(monday, 6);
    const w = isoWeek(today);
    const end = taipeiMidnightUtc(addDays(sunday, 1));
    return { key: `weekly:${w.year}-W${pad2(w.week)}`, label: `${monday.m}/${monday.d}–${sunday.m}/${sunday.d} 這一週`, expiresAt: end + 3600000, validUntil: end };
  }
  if (period === 'month') {
    const nextFirst = today.m === 12 ? { y: today.y + 1, m: 1, d: 1 } : { y: today.y, m: today.m + 1, d: 1 };
    const end = taipeiMidnightUtc(nextFirst);
    return { key: `monthly:${today.y}-${pad2(today.m)}`, label: `${today.y} 年 ${today.m} 月`, expiresAt: end + 3600000, validUntil: end };
  }
  if (period === 'year') {
    const end = taipeiMidnightUtc({ y: today.y + 1, m: 1, d: 1 });
    return { key: `yearly:${today.y}`, label: `${today.y} 年`, expiresAt: end + 3600000, validUntil: end };
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

// ── AI 呼叫（ai-model-router） ───────────────────────────────
const SYSTEM_PROMPT = [
  '你是台灣星座生活專欄的作者，替一個娛樂性質的星座 App 撰寫十二星座的短評。',
  '讀者是台灣的一般使用者，請使用繁體中文與台灣慣用語（例如：牡羊座、捷運、上班族、資訊、品質）。',
  '每個星座寫 50 到 90 個字，語氣溫暖、具體、可行動，例如給一個可以馬上做的小建議。',
  '這是娛樂內容：不要做醫療、投資、法律方面的具體建議或保證，不要製造恐懼，不要提及其他 App 或品牌。',
  '每個星座的內容要彼此不同，不要重複同樣的句型。',
  '只輸出一個 JSON 物件，不要加任何說明、標題或 Markdown 程式碼框。',
].join('\n');

function periodPrompt(period, info) {
  const scope = { week: '一週', month: '一個月', year: '一整年' }[period] || '一天';
  const keys = SIGNS.map(([id, name]) => `"${id}"（${name}）`).join('、');
  return `請為十二星座分別撰寫「${scope}（${info.label}）」的生活短評。\n輸出格式：{"aries":"……","taurus":"……", …}，鍵必須剛好是這 12 個：${keys}，值是短評文字。`;
}

/** 從 AI 回覆取出 12 個星座的短評；格式不合格就丟錯（router 會因此升級等級重試） */
export function parseSigns(text) {
  let s = String(text || '').trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence) s = fence[1];
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no json');
  const parsed = JSON.parse(s.slice(start, end + 1));
  const signs = {};
  for (const [id] of SIGNS) {
    const v = parsed[id];
    if (typeof v !== 'string' || !v.trim()) throw new Error(`missing ${id}`);
    // 去除控制字元、限制長度（前端也只用 textContent 顯示）
    signs[id] = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
  }
  return signs;
}

export async function callClaude(env, period, info, { fetchImpl, sleep } = {}) {
  const keys = String(env.ANTHROPIC_API_KEY || '').split(',').map((k) => k.trim()).filter(Boolean);
  if (!keys.length) throw new Error('missing ANTHROPIC_API_KEY');
  const router = new ModelRouter('anthropic', {
    keys,
    fetch: fetchImpl,
    sleep,
    override: env.MODEL ? { smart: String(env.MODEL) } : undefined,
    maxCalls: MAX_AI_CALLS,
    timeoutMs: 120000,
    log: (m) => console.warn(m),
  });
  const text = await router.chat(
    'smart',
    [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: periodPrompt(period, info) }],
    {
      maxTokens: 16000,
      validate: (t) => {
        try {
          parseSigns(t);
          return true;
        } catch {
          return false;
        }
      },
    },
  );
  return { signs: parseSigns(text) };
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
    const { signs } = await callClaude(env, period, info, options);
    const record = { key: info.key, generatedAt: new Date(nowMs).toISOString(), signs };
    const expiration = Math.floor(info.expiresAt / 1000);
    await env.FORTUNE_KV.put(dataKey, JSON.stringify(record), { expiration: Math.max(expiration, Math.floor(nowMs / 1000) + 120) });
    return { status: 200, body: { ...record, period, validUntil: new Date(info.validUntil).toISOString() } };
  } catch (err) {
    console.error('generate failed', info.key, err && err.message); // 只記在 Cloudflare 日誌（router 的訊息不含金鑰）
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
  if (!PERIODS.includes(period)) return json(400, { error: 'period must be today, tomorrow, week, month or year' }, corsOrigin);
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
  async scheduled(event, env) {
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
