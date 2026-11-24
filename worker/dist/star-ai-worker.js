// 星座手帳 AI 短評 Worker（由 npm run build:worker 自動產生，請勿手改；原始碼在 worker/worker.js）
// 部署：Cloudflare 後台 → 你的 Worker → Edit code → 整份貼上這個檔案 → Deploy。設定方式見 worker/README.md。
// 內含 skl ai-model-router（model_router.js）。
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// worker/model_router.cjs
var require_model_router = __commonJS({
  "worker/model_router.cjs"(exports, module) {
    (function(root) {
      "use strict";
      const TIERS = ["fast", "smart", "best"];
      const PROVIDERS = {
        groq: { list: "https://api.groq.com/openai/v1/models", chat: "https://api.groq.com/openai/v1/chat/completions", style: "openai", paid: false },
        openrouter: { list: "https://openrouter.ai/api/v1/models", chat: "https://openrouter.ai/api/v1/chat/completions", style: "openai", paid: "free_suffix" },
        gemini: {
          list: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
          chat: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
          style: "gemini",
          paid: false
        },
        anthropic: { list: "https://api.anthropic.com/v1/models?limit=100", chat: "https://api.anthropic.com/v1/messages", style: "anthropic", paid: true }
      };
      const DEFAULT_MAX_CALLS = 12;
      const MAX_WAIT = 60, QUOTA_COOLDOWN = 3600, QUOTA_MIN_COOLDOWN = 300, MAX_COOLDOWN = 86400;
      function isPaid(cfg, model, override) {
        if (override != null) return !!override;
        const p = cfg.paid == null ? true : cfg.paid;
        if (p === "free_suffix") return !String(model).endsWith(":free");
        return !!p;
      }
      const PREFS = {
        groq: {
          fast: [/llama-\d+(\.\d+)?-8b/i, /instant/i, /gpt-oss-20b/i, /qwen/i, /llama/i],
          smart: [/qwen/i, /llama-\d+(\.\d+)?-70b/i, /gpt-oss-120b/i, /70b/i, /llama/i],
          best: [/gpt-oss-120b/i, /qwen/i, /llama-4/i, /70b/i, /llama/i]
        },
        openrouter: {
          fast: [/llama-\d+(\.\d+)?-8b.*:free$/i, /:free$/i],
          smart: [/70b.*:free$/i, /(qwen|deepseek).*:free$/i, /:free$/i],
          best: [/(deepseek|qwen).*:free$/i, /70b.*:free$/i, /:free$/i]
        },
        gemini: {
          fast: [/^gemini-\d+(\.\d+)?-flash-lite$/i, /^gemini-\d+(\.\d+)?-flash$/i],
          smart: [/^gemini-\d+(\.\d+)?-flash$/i, /^gemini-\d+(\.\d+)?-pro$/i],
          best: [/^gemini-\d+(\.\d+)?-pro$/i, /^gemini-\d+(\.\d+)?-flash$/i]
        },
        anthropic: { fast: [/haiku/i], smart: [/sonnet/i], best: [/opus/i, /sonnet/i] }
      };
      const NON_CHAT = /whisper|tts|orpheus|speech|audio|embed|guard|moderation|rerank|image|vision-only|live|aqa|playai/i;
      const UNSTABLE = /preview|exp|experimental|beta/i;
      const TTL = 6 * 3600 * 1e3;
      const MODEL_MISSING = /model_not_found|model_decommissioned|decommissioned|\bmodels?\b[\s\S]{0,160}?(?:does not exist|not found|no longer (?:available|supported)|has been (?:deprecated|retired|removed))|not_found_error[\s\S]{0,80}?\bmodel\b|not a valid model|no endpoints found for/i;
      const BILLING = /insufficient[_\s-]?(?:balance|credits?|funds|quota)|credit balance is too low|(?:out of|no remaining|not enough) credits?|requires more credits|can only afford|credits? (?:are |have been )?(?:depleted|exhausted)|prepayment|payment required|(?:billing|spend(?:ing)?) (?:hard )?limit|exceeded (?:your |the )?(?:monthly )?(?:budget|spend(?:ing)?)\b|reached your specified (?:api )?usage limits?|billing[_\s]not[_\s]active|billing account[\s\S]{0,60}?(?:disabled|closed|suspended)|account[_\s](?:is[_\s])?(?:deactivated|suspended|inactive|not[_\s]active)|arrears/i;
      const LONG_WINDOW = /per[\s_-]?(?:day|week|month)|\b(?:rpd|tpd)\b|\b(?:daily|weekly|monthly)\b/i;
      const TEXT_DELAY = /(?:try again|retry)\s+(?:in|after)\s+((?:\d+(?:\.\d+)?(?:ms|h|m|s))+|\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)?/i;
      const NUMBER = /^\d+(?:\.\d+)?$/;
      const DURATION = /^(?:\d+(?:\.\d+)?(?:ms|h|m|s))+$/i;
      const DUR_PART = /(\d+(?:\.\d+)?)(ms|h|m|s)/gi;
      const UNIT = { ms: 1e-3, h: 3600, m: 60, s: 1 };
      const HTTP_DATE = /^(?:[A-Za-z]{3},\s*)?\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}(?::\d{2})?\s*(?:GMT|UTC|[+-]\d{4})$/;
      const SIZE = /(\d+(?:\.\d+)?)b(?![a-z0-9])/gi;
      const THINK = /^\s*<think>[\s\S]*?<\/think>\s*/i, THINK_OPEN = /^\s*<think>/i;
      const HEADER_KEYS = [["retry-after", "_retry_after"], ["x-ratelimit-reset", "_ratelimit_reset"]];
      const COOL_NOTE = { rate: "\u9650\u6D41", quota: "\u984D\u5EA6\u7528\u5B8C" };
      const COOLDOWNS = /* @__PURE__ */ new Map();
      const MISSING = /* @__PURE__ */ Symbol("missing"), ESCALATE = /* @__PURE__ */ Symbol("escalate");
      function resetCooldowns() {
        COOLDOWNS.clear();
      }
      function fingerprint(keys) {
        let h = 2166136261;
        for (const b of new TextEncoder().encode(keys.join("\n"))) h = Math.imul(h ^ b, 16777619) >>> 0;
        return h.toString(16).padStart(8, "0");
      }
      function versionKey(id) {
        const sizes = Array.from(id.matchAll(SIZE), (m) => Number(m[1]));
        const nums = (id.replace(SIZE, " ").match(/\d+/g) || []).map(Number);
        return [nums, sizes, id.length];
      }
      function cmpDesc(a, b) {
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          const x = a[i] == null ? -1 : a[i], y = b[i] == null ? -1 : b[i];
          if (x !== y) return y - x;
        }
        return 0;
      }
      function versionCmp(a, b) {
        const ka = versionKey(a), kb = versionKey(b);
        return cmpDesc(ka[0], kb[0]) || cmpDesc(ka[1], kb[1]) || ka[2] - kb[2];
      }
      function rank(ids, provider, tier, avoid) {
        const av = new Set(avoid || []);
        const pool = ids.filter((m) => !av.has(m) && !NON_CHAT.test(m));
        const out = [];
        for (const stableOnly of [true, false])
          for (const re of PREFS[provider][tier])
            pool.filter((m) => re.test(m) && (!stableOnly || !UNSTABLE.test(m))).sort(versionCmp).forEach((m) => {
              if (!out.includes(m)) out.push(m);
            });
        return out.slice(0, 5);
      }
      function pickTier(messages, hint) {
        if (TIERS.includes(hint)) return hint;
        const text = messages.map((m) => String(m.content || "")).join(" "), low = text.toLowerCase();
        if (/程式|code|debug|架構|重構|規格|長篇|完整報告|refactor|architecture/.test(low) || text.length > 6e4) return "best";
        if (/分析|推理|為什麼|比較|策略|評估|判斷|預測|analy|reason|why|compare|evaluate|strategy/.test(low) || text.length > 8e3) return "smart";
        return "fast";
      }
      function parseDelay(v, nowSec) {
        if (v == null || typeof v === "boolean") return null;
        if (typeof v === "number") return v >= 0 && isFinite(v) ? v : null;
        const s = String(v).trim();
        if (NUMBER.test(s)) return parseFloat(s);
        if (DURATION.test(s)) {
          let total = 0;
          for (const m of s.matchAll(DUR_PART)) total += parseFloat(m[1]) * UNIT[m[2].toLowerCase()];
          return total;
        }
        if (HTTP_DATE.test(s)) {
          const ms = Date.parse(s);
          if (isNaN(ms)) return null;
          return Math.max(0, ms / 1e3 - (nowSec == null ? Date.now() / 1e3 : nowSec));
        }
        return null;
      }
      function textDelay(text) {
        const m = String(text || "").match(TEXT_DELAY);
        if (!m) return null;
        const num = m[1], unit = (m[2] || "").toLowerCase();
        if (!NUMBER.test(num)) return parseDelay(num);
        const mult = unit.startsWith("min") ? 60 : unit.startsWith("hour") || unit.startsWith("hr") ? 3600 : 1;
        return parseFloat(num) * mult;
      }
      function resetDelay(v, nowSec) {
        let x = Number(v);
        if (x > 1e12) x /= 1e3;
        return x > 1e9 ? Math.max(0, x - nowSec) : null;
      }
      function flat(body, limit) {
        const out = [];
        const walk = (v, depth) => {
          if (depth > 20) return;
          if (typeof v === "string") out.push(v);
          else if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
          else if (v && typeof v === "object") Object.values(v).forEach((x) => walk(x, depth + 1));
        };
        walk(body, 0);
        return out.join(" | ").slice(0, limit || 4e3);
      }
      function geminiDetails(b) {
        const err = b && b.error && typeof b.error === "object" ? b.error : null;
        const ids = [];
        let retry = null, zero = false;
        for (const d of err && Array.isArray(err.details) ? err.details : []) {
          if (!d || typeof d !== "object") continue;
          const kind = String(d["@type"] || "");
          if (kind.endsWith("QuotaFailure")) {
            for (const v of Array.isArray(d.violations) ? d.violations : []) {
              if (v && typeof v === "object" && v.quotaId) {
                ids.push(String(v.quotaId));
                zero = zero || String(v.quotaValue) === "0";
              }
            }
          } else if (kind.endsWith("RetryInfo") && retry == null) retry = d.retryDelay;
        }
        return [ids, retry, zero];
      }
      function metaReset(b) {
        const h = b && b.error && b.error.metadata && b.error.metadata.headers;
        if (h && typeof h === "object" && !Array.isArray(h)) {
          for (const k of Object.keys(h)) if (k.toLowerCase() === "x-ratelimit-reset") return h[k];
        }
        return null;
      }
      const first = (...vals) => {
        for (const v of vals) if (v != null) return v;
        return null;
      };
      function withHeaders(body, headers) {
        if (!body || typeof body !== "object" || Array.isArray(body) || !headers) return body;
        const get = typeof headers.get === "function" ? (n) => headers.get(n) : (n) => {
          const k = Object.keys(headers).find((x) => x.toLowerCase() === n);
          return k == null ? null : headers[k];
        };
        for (const [name, field] of HEADER_KEYS) {
          const v = get(name);
          if (v != null && v !== "" && !(field in body)) body[field] = String(v);
        }
        return body;
      }
      function classify(status, body, nowSec) {
        const now = nowSec == null ? Date.now() / 1e3 : nowSec;
        const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
        const text = flat(body);
        if (status === 402 || [400, 401, 403, 429].includes(status) && BILLING.test(text)) return { kind: "billing", delay: null };
        if ((status === 400 || status === 404) && MODEL_MISSING.test(text)) return { kind: "missing", delay: null };
        if (status === 404) return { kind: "config", delay: null };
        if (status === 401 || status === 403) return { kind: "auth", delay: null };
        if (status !== 429 && status !== 0 && status < 500) return { kind: "other", delay: null };
        const [ids, retry, zero] = geminiDetails(b);
        if (status === 429 && zero) return { kind: "quota", delay: null };
        const delay = first(
          parseDelay(b._retry_after, now),
          parseDelay(retry, now),
          textDelay(text),
          resetDelay(b._ratelimit_reset, now),
          resetDelay(metaReset(b), now)
        );
        if (status === 429) {
          const longWindow = ids.length ? ids.some((i) => LONG_WINDOW.test(i)) : LONG_WINDOW.test(text);
          return { kind: longWindow ? "quota" : "rate", delay };
        }
        return { kind: "server", delay };
      }
      function stripThink(text) {
        const out = String(text || "").replace(THINK, "");
        return THINK_OPEN.test(out) ? "" : out;
      }
      function human(sec) {
        const s = Math.max(0, Number(sec));
        if (s < 90) return Math.floor(s + 0.5) + " \u79D2";
        if (s < 5400) return Math.floor(s / 60 + 0.5) + " \u5206\u9418";
        return Math.floor(s / 3600 + 0.5) + " \u5C0F\u6642";
      }
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      class ModelRouter2 {
        constructor(provider, opts) {
          if (!PROVIDERS[provider]) throw new Error("\u4E0D\u652F\u63F4\u7684\u4F9B\u61C9\u5546\uFF1A" + provider + "\uFF08\u53EF\u7528\uFF1A" + Object.keys(PROVIDERS).join("\u3001") + "\uFF09");
          opts = opts || {};
          this.p = provider;
          this.cfg = PROVIDERS[provider];
          this.keys = (opts.keys || []).filter(Boolean);
          this.fetch = opts.fetch || ((...a) => fetch(...a));
          this.sleep = opts.sleep || sleep;
          this.now = opts.now || (() => Date.now());
          this.override = opts.override || {};
          this.log = opts.log || ((m) => console.warn(m));
          this.timeoutMs = opts.timeoutMs || 6e4;
          const mc = opts.maxCalls == null ? DEFAULT_MAX_CALLS : Math.floor(Number(opts.maxCalls));
          this.maxCalls = mc >= 1 ? mc : DEFAULT_MAX_CALLS;
          if (!(mc >= 1)) this.log("\u26A0\uFE0F maxCalls=" + opts.maxCalls + " \u770B\u4E0D\u61C2\uFF08\u8981\u586B 1 \u4EE5\u4E0A\u7684\u6574\u6578\uFF09\uFF0C\u6539\u7528\u9810\u8A2D " + DEFAULT_MAX_CALLS);
          this.paid = opts.paid == null ? null : !!opts.paid;
          this._ids = null;
          this._at = 0;
          this._good = {};
          this._calls = 0;
          this._fp = fingerprint(this.keys);
        }
        _headers(key) {
          const st = this.cfg.style;
          if (st === "gemini") return { "x-goog-api-key": key };
          if (st === "anthropic") return { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
          return { Authorization: "Bearer " + key };
        }
        async _http(method, url, headers, payload) {
          const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
          const timer = ctl ? setTimeout(() => ctl.abort(), this.timeoutMs) : null;
          try {
            const r = await this.fetch(url, {
              method,
              headers: Object.assign({}, headers, payload ? { "Content-Type": "application/json" } : {}),
              body: payload ? JSON.stringify(payload) : void 0,
              signal: ctl ? ctl.signal : void 0
            });
            let body = {};
            if (typeof r.text === "function") {
              const raw = await r.text();
              try {
                body = raw ? JSON.parse(raw) : {};
              } catch (e) {
                body = { _raw: String(raw).slice(0, 500) };
              }
            } else {
              try {
                body = await r.json();
              } catch (e) {
                body = {};
              }
            }
            if (!body || typeof body !== "object" || Array.isArray(body)) body = { _raw: JSON.stringify(body).slice(0, 500) };
            return [r.status, withHeaders(body, r.headers)];
          } catch (e) {
            return [0, {}];
          } finally {
            if (timer) clearTimeout(timer);
          }
        }
        async models(refresh) {
          if (!refresh && this._ids && Date.now() - this._at < TTL) return this._ids;
          let last = "";
          for (let i = 0; i < Math.max(1, this.keys.length); i++) {
            const [st, body] = await this._http("GET", this.cfg.list, this._headers(this.keys[i] || ""));
            if (st === 200) {
              const data = body.data || body.models || [];
              this._ids = data.filter((m) => !Array.isArray(m.supportedGenerationMethods) || m.supportedGenerationMethods.includes("generateContent")).map((m) => String(m.id || m.name || "").replace(/^models\//, "")).filter(Boolean);
              this._at = Date.now();
              return this._ids;
            }
            last = "\u7B2C " + (i + 1) + " \u628A\u91D1\u9470 HTTP " + st;
          }
          this.log("\u26A0\uFE0F [" + this.p + "] \u53D6\u4E0D\u5230\u6A21\u578B\u6E05\u55AE\uFF08" + last + "\uFF09\uFF0C\u6539\u7528\u4E0A\u6B21\u6210\u529F\u904E\u7684\u6A21\u578B");
          this._ids = [];
          this._at = Date.now();
          return [];
        }
        // ── 冷卻（記在模型上，不是整家供應商）──
        _ck(model) {
          return this.p + "\0" + this._fp + "\0" + model;
        }
        _cooling(model) {
          const c = COOLDOWNS.get(this._ck(model));
          return c && c.until > this.now() ? c : null;
        }
        _cool(model, seconds, why) {
          seconds = Math.min(MAX_COOLDOWN, Math.max(0, Number(seconds)));
          const until = this.now() + seconds * 1e3, k = this._ck(model), old = COOLDOWNS.get(k);
          if (!old || old.until < until) COOLDOWNS.set(k, { until, why });
          return seconds;
        }
        async _candidates(tier, avoid) {
          const av = new Set(avoid || []);
          const c = this.override[tier] ? [this.override[tier]] : [];
          const ids = await this.models();
          rank(ids, this.p, tier, av).forEach((m) => {
            if (!c.includes(m)) c.push(m);
          });
          const g = this._good[tier];
          if (g && !av.has(g) && !c.includes(g)) c.push(g);
          if (!c.length && ids.length) this.log("\u26A0\uFE0F [" + this.p + "] \u7B49\u7D1A " + tier + " \u6C92\u914D\u5230\u6A21\u578B\uFF1B\u76EE\u524D\u6709\uFF1A" + ids.slice(0, 25).join(", "));
          const ready = [], cooling = [];
          for (const m of c) {
            const x = this._cooling(m);
            if (x) cooling.push([m, x]);
            else ready.push(m);
          }
          return { ready, cooling };
        }
        // 這個等級現在要依序嘗試的模型（冷卻中的先跳過）
        async pick(tier, avoid) {
          return (await this._candidates(tier, avoid)).ready;
        }
        _request(model, messages, maxTokens) {
          const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
          const chat = messages.filter((m) => m.role !== "system"), st = this.cfg.style;
          if (st === "gemini") {
            const body = { contents: chat.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })) };
            if (sys) body.systemInstruction = { parts: [{ text: sys }] };
            return [this.cfg.chat.replace("{model}", encodeURIComponent(model)), body];
          }
          if (st === "anthropic") {
            const body = { model, max_tokens: maxTokens, messages: chat };
            if (sys) body.system = sys;
            return [this.cfg.chat, body];
          }
          return [this.cfg.chat, { model, messages, max_tokens: maxTokens }];
        }
        _text(b) {
          const st = this.cfg.style;
          if (st === "gemini") return (((b.candidates || [{}])[0].content || {}).parts || []).map((p) => p.text || "").join("");
          if (st === "anthropic") return (b.content || []).filter((x) => x.type === "text").map((x) => x.text).join("");
          return stripThink(((b.choices || [{}])[0].message || {}).content || "");
        }
        async _post(url, key, payload, tried) {
          if (this._calls >= this.maxCalls)
            throw new Error("[" + this.p + "] \u9019\u6B21\u5DF2\u7D93\u9001\u51FA " + this._calls + " \u6B21 AI \u8ACB\u6C42\uFF08\u4E0A\u9650 " + this.maxCalls + "\uFF09\u9084\u6C92\u6210\u529F\uFF0C\u70BA\u4E86\u907F\u514D\u8CBB\u7528\u5931\u63A7\u5148\u505C\u4E0B\u3002\u8A66\u904E\uFF1A" + (tried.join("\uFF1B") || "\uFF08\u7121\uFF09") + "\u3002\u8ACB\u78BA\u8A8D\u91D1\u9470\u6709\u8A2D\u5B9A\u3001\u984D\u5EA6\u9084\u5920\uFF0C\u7A0D\u5F8C\u518D\u8A66\uFF1B\u78BA\u5B9A\u8981\u591A\u8A66\u5E7E\u6B21\u5C31\u8ABF\u9AD8 maxCalls \u9078\u9805\u3002");
          this._calls++;
          return this._http("POST", url, this._headers(key), payload);
        }
        // 供應商回應的摘要：先把自己的金鑰遮掉再截斷，截斷不會留下半把金鑰
        _excerpt(body) {
          let s = flat(body);
          for (const k of this.keys) if (k) s = s.split(k).join("***");
          return s.slice(0, 200) || "\uFF08\u6C92\u6709\u5167\u5BB9\uFF09";
        }
        async _call(model, messages, maxTokens, tried) {
          const [url, payload] = this._request(model, messages, maxTokens);
          const paid = isPaid(this.cfg, model, this.paid);
          let noMoney = false;
          for (let ki = 0; ki < Math.max(1, this.keys.length); ki++) {
            for (let attempt = 0; attempt < 4; attempt++) {
              const [st, body] = await this._post(url, this.keys[ki] || "", payload, tried);
              if (st === 200) {
                const t = this._text(body);
                if (t.trim()) {
                  COOLDOWNS.delete(this._ck(model));
                  return t;
                }
                tried.push(model + "\uFF08\u56DE\u4E86\u7A7A\u767D\uFF09");
                return null;
              }
              const { kind, delay } = classify(st, body, this.now() / 1e3);
              if (kind === "missing") {
                tried.push(model + "\uFF08\u5DF2\u4E0B\u67B6\u6216\u4E0D\u5B58\u5728\uFF09");
                this._ids = null;
                return MISSING;
              }
              if (kind === "config") {
                tried.push(model + "\uFF08HTTP 404\uFF0C\u56DE\u61C9\u6C92\u8AAA\u662F\u6A21\u578B\u4E0D\u5B58\u5728\uFF09");
                throw new Error("[" + this.p + "] \u547C\u53EB " + model + " \u56DE HTTP 404\uFF0C\u4F46\u56DE\u61C9\u6C92\u8AAA\u662F\u6A21\u578B\u4E0D\u5B58\u5728\uFF1A\u591A\u534A\u662F\u7DB2\u5740\u8A2D\u5B9A\u932F\uFF08API \u8DEF\u5F91\u3001\u7248\u672C\uFF0C\u6216\u4E2D\u9593\u7684 Proxy\uFF0FWorker\uFF09\uFF0C\u4E0D\u662F\u6A21\u578B\u4E0B\u67B6\uFF0C\u6240\u4EE5\u6C92\u6709\u628A\u6A21\u578B\u6A19\u6210\u4E0B\u67B6\u3002\u8ACB\u6AA2\u67E5 PROVIDERS \u88E1 " + this.p + " \u7684 chat \u7DB2\u5740\u3002\u4F9B\u61C9\u5546\u56DE\u61C9\uFF1A" + this._excerpt(body));
              }
              if (kind === "billing") {
                tried.push(model + "\uFF08\u7B2C " + (ki + 1) + " \u628A\u91D1\u9470\uFF1A\u5E33\u6236\u9918\u984D\u6216\u984D\u5EA6\u4E0D\u8DB3 " + st + "\uFF09");
                noMoney = true;
                break;
              }
              if (kind === "auth") {
                tried.push(model + "\uFF08\u7B2C " + (ki + 1) + " \u628A\u91D1\u9470\u88AB\u62D2 " + st + "\uFF09");
                break;
              }
              if (kind === "quota") {
                const cd = this._cool(model, delay == null ? QUOTA_COOLDOWN : Math.max(delay, QUOTA_MIN_COOLDOWN), "quota");
                tried.push(model + "\uFF08\u6BCF\u65E5\uFF0F\u6BCF\u6708\u984D\u5EA6\u7528\u5B8C\uFF0C\u7D04 " + human(cd) + " \u5F8C\u6062\u5FA9\uFF1B\u4E0D\u91CD\u8A66\uFF0C\u63DB\u4E0B\u4E00\u500B\u6A21\u578B\uFF09");
                this.log("\u26A0\uFE0F [" + this.p + "] " + model + " \u6BCF\u65E5\uFF0F\u6BCF\u6708\u984D\u5EA6\u7528\u5B8C\uFF0C\u7D04 " + human(cd) + " \u5F8C\u6062\u5FA9\uFF1B\u9019\u6BB5\u6642\u9593\u6539\u7528\u540C\u4E00\u5BB6\u7684\u5176\u4ED6\u6A21\u578B");
                return null;
              }
              if (st === 0 && paid) {
                tried.push(model + "\uFF08\u903E\u6642\u6216\u9023\u7DDA\u4E2D\u65B7\uFF1B\u4ED8\u8CBB\u670D\u52D9\u4E0D\u91CD\u9001\uFF0C\u907F\u514D\u91CD\u8907\u6536\u8CBB\uFF09");
                return null;
              }
              let wait = Math.min(30, 2 ** (attempt + 1));
              if (delay != null) wait = Math.max(wait, delay);
              if (kind === "rate") {
                if (wait > MAX_WAIT) {
                  this._cool(model, wait, "rate");
                  tried.push(model + "\uFF08\u9650\u6D41\uFF0C\u5C0D\u65B9\u8981\u6C42\u7B49 " + human(wait) + "\uFF1B\u5148\u63DB\u4E0B\u4E00\u500B\u6A21\u578B\uFF09");
                  return null;
                }
                if (attempt < 3) {
                  await this.sleep(wait * 1e3);
                  continue;
                }
                this._cool(model, wait, "rate");
                tried.push(model + "\uFF08\u9650\u6D41 429\uFF0C\u7B49\u4E86 3 \u6B21\u9084\u662F\u6EFF\uFF1B\u5148\u63DB\u4E0B\u4E00\u500B\u6A21\u578B\uFF09");
                return null;
              }
              if (kind === "server") {
                if (attempt < 3) {
                  await this.sleep(Math.min(MAX_WAIT, wait) * 1e3);
                  continue;
                }
                tried.push(model + "\uFF08\u670D\u52D9\u5FD9\u788C " + st + "\uFF09");
                return null;
              }
              tried.push(model + "\uFF08HTTP " + st + "\uFF09");
              return null;
            }
          }
          if (noMoney)
            throw new Error("[" + this.p + "] \u5E33\u6236\u9918\u984D\u6216\u984D\u5EA6\u4E0D\u8DB3\uFF1A\u9019\u4E0D\u662F\u9650\u6D41\uFF0C\u7B49\u591A\u4E45\u90FD\u4E0D\u6703\u6062\u5FA9\uFF0C\u6240\u4EE5\u5DF2\u505C\u6B62\u5617\u8A66 " + this.p + " \u7684\u5176\u4ED6\u6A21\u578B\u3002\u8ACB\u5230\u4F9B\u61C9\u5546\u5F8C\u53F0\u6AA2\u67E5\u5E33\u55AE\u2014\u2014\u5132\u503C\u9918\u984D\u3001\u4ED8\u6B3E\u65B9\u5F0F\u3001\u6BCF\u6708\u82B1\u8CBB\u4E0A\u9650\u3002\u8A66\u904E\uFF1A" + tried.join("\uFF1B") + "\u3002");
          return null;
        }
        // 處理一次 _call 的結果：成功回文字；ESCALATE＝不合格要升級；null＝換下一個
        _settle(t, model, r, validate, tried, avoid, done) {
          if (r === MISSING) {
            avoid.add(model);
            return null;
          }
          if (r == null) {
            if (!this._cooling(model)) done.add(model);
            return null;
          }
          if (validate && !validate(r)) {
            tried.push(model + "\uFF08\u56DE\u8986\u4E0D\u5408\u683C\uFF0C\u5347\u7D1A\uFF09");
            done.add(model);
            return ESCALATE;
          }
          this._good[t] = model;
          return r;
        }
        async chat(tier, messages, opts) {
          opts = opts || {};
          tier = tier === "auto" ? pickTier(messages) : tier;
          if (!TIERS.includes(tier)) throw new Error("\u4E0D\u8A8D\u8B58\u7684\u7B49\u7D1A\uFF1A" + tier + "\uFF08\u7528 fast\uFF0Fsmart\uFF0Fbest\uFF0Fauto\uFF09");
          this._calls = 0;
          const order = opts.escalate === false ? [tier] : TIERS.slice(TIERS.indexOf(tier));
          const maxTokens = opts.maxTokens || 1024, validate = opts.validate;
          const tried = [], avoid = /* @__PURE__ */ new Set(), done = /* @__PURE__ */ new Set(), seen = [];
          for (const t of order) {
            const { ready, cooling } = await this._candidates(t, /* @__PURE__ */ new Set([...avoid, ...done]));
            for (const [m, c] of cooling) {
              if (!seen.some(([, s]) => s === m))
                tried.push(m + "\uFF08" + (COOL_NOTE[c.why] || "\u51B7\u537B") + "\uFF0C\u51B7\u537B\u4E2D\uFF0C\u7D04 " + human((c.until - this.now()) / 1e3) + " \u5F8C\u6062\u5FA9\uFF0C\u9019\u6B21\u8DF3\u904E\uFF09");
              seen.push([t, m]);
            }
            for (const model of ready) {
              seen.push([t, model]);
              const r = this._settle(t, model, await this._call(model, messages, maxTokens, tried), validate, tried, avoid, done);
              if (r === ESCALATE) break;
              if (r != null) return r;
            }
          }
          const r2 = await this._secondPass(seen, avoid, done, messages, maxTokens, tried, validate);
          if (r2 != null) return r2;
          const now = this.now();
          const lefts = seen.filter(([, m]) => !avoid.has(m)).map(([, m]) => this._cooling(m)).filter(Boolean).map((c) => (c.until - now) / 1e3);
          const soon = lefts.length ? "\u51B7\u537B\u4E2D\u7684\u6A21\u578B\u6700\u5FEB\u7D04 " + human(Math.min(...lefts)) + " \u5F8C\u6062\u5FA9\uFF0C\u5230\u6642\u518D\u8A66\uFF1B" : "";
          throw new Error("[" + this.p + "] \u6240\u6709\u6A21\u578B\u90FD\u5931\u6557\u4E86\uFF0C\u8A66\u904E\uFF1A" + (tried.join("\uFF1B") || "\u6C92\u6709\u53EF\u7528\u7684\u6A21\u578B") + "\u3002" + soon + "\u8ACB\u78BA\u8A8D\u91D1\u9470\u6709\u8A2D\u5B9A\u3001\u984D\u5EA6\u9084\u5920\uFF1B\u8981\u6307\u5B9A\u6A21\u578B\u53EF\u50B3 { override: { \u7B49\u7D1A: \u6A21\u578B\u540D\u7A31 } }\u3002");
        }
        // 第一輪全失敗、而且有模型只是在冷卻（多半是每分鐘限流）：挑 60 秒內會恢復的，從最快的開始等一下再試。
        // 不這樣做的話，批次工作遇到每個模型剛好都在限流，接下來每一筆都會直接失敗
        async _secondPass(seen, avoid, done, messages, maxTokens, tried, validate) {
          const now = this.now(), queue = [], picked = /* @__PURE__ */ new Set();
          for (const [t, m] of seen) {
            if (picked.has(m) || avoid.has(m) || done.has(m)) continue;
            picked.add(m);
            const c = this._cooling(m), left = c ? (c.until - now) / 1e3 : 0;
            if (left <= MAX_WAIT) queue.push([left, t, m]);
          }
          queue.sort((a, b) => a[0] - b[0]);
          for (const [, t, model] of queue) {
            const c = this._cooling(model);
            if (c && c.until > this.now()) await this.sleep(c.until - this.now());
            const r = this._settle(t, model, await this._call(model, messages, maxTokens, tried), validate, tried, avoid, done);
            if (r != null && r !== ESCALATE) return r;
          }
          return null;
        }
      }
      async function selftest(opts) {
        opts = opts || {};
        let ok = true;
        const t = (c, n) => {
          console.log((c ? "PASS " : "FAIL ") + n);
          ok = ok && !!c;
        };
        resetCooldowns();
        const ids = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "whisper-large-v3", "llama-3.5-8b-instant"];
        t(rank(ids, "groq", "fast")[0] === "llama-3.5-8b-instant", "fast \u6311\u6700\u65B0\u7684 8b");
        t(rank(["gemini-2.5-flash", "gemini-3.0-flash-preview", "gemini-2.5-flash-image"], "gemini", "smart")[0] === "gemini-2.5-flash", "\u6B63\u5F0F\u7248\u512A\u5148\u3001\u5716\u7247\u6A21\u578B\u6FFE\u6389");
        t(pickTier([{ content: "\u5206\u6790\u9019\u6A94\u80A1\u7968" }]) === "smart" && pickTier([{ content: "\u7FFB\u6210\u4E2D\u6587" }]) === "fast", "auto \u5224\u65B7\u96E3\u5EA6");
        const mk = (models, chatFn) => async (url, init) => {
          const json2 = async () => init.method === "GET" ? { data: models.map((id) => ({ id })) } : chatFn(JSON.parse(init.body).model, init.headers)[1];
          const status = init.method === "GET" ? 200 : chatFn(JSON.parse(init.body).model, init.headers)[0];
          return { status, json: json2, headers: { get: () => null } };
        };
        let r = new ModelRouter2("groq", {
          keys: ["k"],
          sleep: async () => {
          },
          log: () => {
          },
          fetch: mk(ids, (m) => m === "llama-3.5-8b-instant" ? [404, { error: "model_decommissioned" }] : [200, { choices: [{ message: { content: "ok:" + m } }] }])
        });
        t(await r.chat("fast", [{ role: "user", content: "hi" }]) === "ok:llama-3.1-8b-instant", "\u4E0B\u67B6 \u2192 \u81EA\u52D5\u63DB\u4E0B\u4E00\u500B");
        r = new ModelRouter2("groq", {
          keys: ["k"],
          sleep: async () => {
          },
          log: () => {
          },
          fetch: mk(ids, (m) => [200, { choices: [{ message: { content: m.includes("8b") ? "\u58DE" : "\u597D\u7684\u5206\u6790" } }] }])
        });
        t(await r.chat("fast", [{ role: "user", content: "x" }], { validate: (s) => s.length > 2 }) === "\u597D\u7684\u5206\u6790", "\u4E0D\u5408\u683C \u2192 \u81EA\u52D5\u5347\u7D1A");
        r = new ModelRouter2("groq", { keys: ["secret-123"], sleep: async () => {
        }, log: () => {
        }, fetch: mk(ids, () => [500, {}]) });
        try {
          await r.chat("best", [{ role: "user", content: "x" }]);
          t(false, "\u5168\u90E8\u5931\u6557\u8981\u4E1F\u932F");
        } catch (e) {
          t(!String(e.message).includes("secret-123") && e.message.includes("\u8A66\u904E"), "\u5168\u90E8\u5931\u6557\uFF1A\u4E2D\u6587\u932F\u8AA4\u3001\u4E0D\u6D29\u6F0F\u91D1\u9470");
        }
        const hang = async (url, init) => init.method === "GET" ? { status: 200, json: async () => ({ data: [{ id: "llama-3.1-8b-instant" }] }), headers: { get: () => null } } : new Promise((_, rej) => {
          if (init.signal) init.signal.addEventListener("abort", () => rej(new Error("aborted")));
        });
        let calls = 0;
        r = new ModelRouter2("groq", { keys: ["k"], sleep: async () => {
          calls++;
        }, log: () => {
        }, fetch: hang, timeoutMs: 20 });
        const out = await Promise.race([
          r.chat("fast", [{ role: "user", content: "x" }], { escalate: false }).catch((e) => e),
          new Promise((res2) => setTimeout(() => res2("\u5361\u4F4F"), 3e3))
        ]);
        t(out instanceof Error && calls === 3 && out.message.includes("\u670D\u52D9\u5FD9\u788C"), "\u5C0D\u65B9\u4E0D\u56DE\u61C9\uFF1A\u903E\u6642\u5F8C\u9000\u907F\u91CD\u8A66 3 \u6B21\uFF0C\u518D\u4E1F\u51FA\u4E2D\u6587\u932F\u8AA4\uFF08\u4E0D\u6703\u5361\u4F4F\uFF09");
        const antSeq = (script) => {
          const posts2 = [];
          const f = async (url, init) => {
            if (init.method === "GET") return { status: 200, json: async () => ({ data: [{ id: "claude-haiku-5-5" }, { id: "claude-haiku-4-5-20251001" }] }), headers: { get: () => null } };
            const m = JSON.parse(init.body).model;
            posts2.push(m);
            const [st2, b] = script(m, posts2.length);
            if (st2 === 0) throw new TypeError("network");
            return { status: st2, json: async () => b, headers: { get: () => null } };
          };
          return [f, posts2];
        };
        let waits = [];
        let [fa, posts] = antSeq((m, n) => n === 1 ? [0, {}] : [200, { content: [{ type: "text", text: "ok:" + m }] }]);
        r = new ModelRouter2("anthropic", { keys: ["k1", "k2"], sleep: async (ms) => {
          waits.push(ms);
        }, log: () => {
        }, fetch: fa });
        const o1 = await r.chat("fast", [{ role: "user", content: "x" }], { escalate: false });
        t(
          JSON.stringify(posts) === JSON.stringify(["claude-haiku-5-5", "claude-haiku-4-5-20251001"]) && o1 === "ok:claude-haiku-4-5-20251001" && !waits.length,
          // guardrails: ignore（範例／測試資料）
          "\u4ED8\u8CBB\uFF08Claude\uFF09\u903E\u6642\uFF1A\u540C\u4E00\u8ACB\u6C42\u4E0D\u91CD\u9001\u3001\u4E0D\u63DB\u91D1\u9470\u91CD\u9001\uFF0C\u76F4\u63A5\u63DB\u4E0B\u4E00\u500B\u5019\u9078"
        );
        [fa, posts] = antSeq(() => [0, {}]);
        r = new ModelRouter2("anthropic", { keys: ["k"], sleep: async () => {
        }, log: () => {
        }, fetch: fa });
        try {
          await r.chat("fast", [{ role: "user", content: "x" }], { escalate: false });
          t(false, "\u4ED8\u8CBB\u5168\u90E8\u903E\u6642\u8981\u4E1F\u932F");
        } catch (e) {
          t(posts.length === 2 && e.message.includes("\u4E0D\u91CD\u9001"), "\u4ED8\u8CBB\u5168\u90E8\u903E\u6642\uFF1A\u6BCF\u500B\u5019\u9078\u53EA\u9001\u4E00\u6B21\uFF0C\u932F\u8AA4\u8AAA\u660E\u70BA\u4EC0\u9EBC\u6C92\u91CD\u8A66");
        }
        waits = [];
        [fa, posts] = antSeq((m, n) => n === 1 ? [429, {}] : n === 2 ? [529, {}] : [200, { content: [{ type: "text", text: "ok" }] }]);
        r = new ModelRouter2("anthropic", { keys: ["k"], sleep: async (ms) => {
          waits.push(ms);
        }, log: () => {
        }, fetch: fa });
        t(
          await r.chat("fast", [{ role: "user", content: "x" }]) === "ok" && waits.join() === "2000,4000" && posts.length === 3,
          "\u4ED8\u8CBB\u9047\u5230 429\uFF0F5xx\uFF08\u4F3A\u670D\u5668\u660E\u78BA\u62D2\u7D55\u3001\u6C92\u8655\u7406\uFF09\u7167\u820A\u9000\u907F\u91CD\u8A66"
        );
        const seen = [];
        const orf = async (url, init) => {
          if (init.method === "GET") return { status: 200, json: async () => ({ data: [{ id: "test/free-model:free" }] }), headers: { get: () => null } };
          seen.push(1);
          if (seen.length < 3) throw new TypeError("network");
          return { status: 200, json: async () => ({ choices: [{ message: { content: "free-ok" } }] }), headers: { get: () => null } };
        };
        r = new ModelRouter2("openrouter", { keys: ["k"], sleep: async () => {
        }, log: () => {
        }, fetch: orf });
        t(await r.chat("fast", [{ role: "user", content: "x" }]) === "free-ok" && seen.length === 3, "OpenRouter \u7684 :free \u6A21\u578B\u4E0D\u6536\u8CBB \u2192 \u903E\u6642\u7167\u6A23\u91CD\u8A66");
        t(isPaid(PROVIDERS.openrouter, "vendor/paid-model") && !isPaid(PROVIDERS.openrouter, "x:free") && isPaid(PROVIDERS.anthropic, "x") && !isPaid(PROVIDERS.groq, "x") && isPaid(PROVIDERS.groq, "x", true) && isPaid({}, "x"), "\u4ED8\u8CBB\u5224\u65B7\uFF1A\u770B PROVIDERS\u3001\u53EF\u8986\u5BEB\u3001\u6C92\u6A19\u7684\u7576\u4ED8\u8CBB");
        let cnt = 0;
        const f500 = async (url, init) => init.method === "GET" ? { status: 200, json: async () => ({ data: ids.map((id) => ({ id })) }), headers: { get: () => null } } : (cnt++, { status: 500, json: async () => ({}), headers: { get: () => null } });
        r = new ModelRouter2("groq", { keys: ["a", "b"], sleep: async () => {
        }, log: () => {
        }, fetch: f500, maxCalls: 5 });
        try {
          await r.chat("fast", [{ role: "user", content: "x" }]);
          t(false, "\u8D85\u904E\u4E0A\u9650\u8981\u4E1F\u932F");
        } catch (e) {
          t(cnt === 5 && e.message.includes("\u4E0A\u9650 5") && e.message.includes("maxCalls"), "\u7E3D\u6B21\u6578\u4E0A\u9650\uFF1A\u9001\u6EFF 5 \u6B21\u5C31\u505C\uFF0C\u4E2D\u6587\u8AAA\u660E\u600E\u9EBC\u8ABF");
        }
        cnt = 0;
        try {
          await r.chat("fast", [{ role: "user", content: "x" }]);
        } catch (e) {
        }
        t(cnt === 5, "\u4E0A\u9650\u6BCF\u6B21 chat() \u5404\u81EA\u8A08\u7B97\uFF08\u4E0B\u4E00\u6B21\u91CD\u65B0\u7B97\uFF09");
        const warned = [];
        t(
          new ModelRouter2("groq", { log: (m) => warned.push(m), maxCalls: "abc" }).maxCalls === DEFAULT_MAX_CALLS && warned.length === 1,
          "maxCalls \u770B\u4E0D\u61C2 \u2192 \u7528\u9810\u8A2D\u4E26\u63D0\u9192"
        );
        t(new ModelRouter2("groq", { log: () => {
        } }).maxCalls === 12, "\u9810\u8A2D\u4E0A\u9650 12");
        const res = (status, raw, hdrs) => ({
          status,
          text: async () => raw,
          headers: { get: (n) => {
            const k = Object.keys(hdrs).find((x) => x.toLowerCase() === n.toLowerCase());
            return k == null ? null : hdrs[k];
          } }
        });
        r = new ModelRouter2("groq", {
          keys: ["k"],
          log: () => {
          },
          fetch: async () => res(429, '{"error":{"message":"slow down"}}', { "Retry-After": "Fri, 15 Jan 2027 08:00:30 GMT", "X-RateLimit-Reset": "1800000060" })
        });
        let [st, body] = await r._http("POST", "https://example.invalid/x", {}, { a: 1 });
        t(
          st === 429 && body._retry_after === "Fri, 15 Jan 2027 08:00:30 GMT" && body._ratelimit_reset === "1800000060" && JSON.stringify(classify(st, body, 18e8)) === JSON.stringify({ kind: "rate", delay: 30 }),
          "_http\uFF1ARetry-After \u662F\u65E5\u671F\u4E5F\u4FDD\u7559\u539F\u5B57\u4E32\uFF08\u820A\u7248\u53EA\u6536\u7D14\u6578\u5B57\uFF09\uFF0Cx-ratelimit-reset \u4E5F\u5E36\u4E0A"
        );
        r = new ModelRouter2("groq", { keys: ["k"], log: () => {
        }, fetch: async () => res(404, "<html><h1>404 Not Found</h1></html>", {}) });
        [st, body] = await r._http("POST", "https://example.invalid/x", {}, { a: 1 });
        t(st === 404 && String(body._raw).includes("404 Not Found") && classify(st, body).kind === "config", "_http\uFF1AHTML \u932F\u8AA4\u9801\u653E\u9032 _raw\uFF0C404 \u5224\u65B7\u6210\u7DB2\u5740\u8A2D\u5B9A\u932F");
        r = new ModelRouter2("groq", {
          keys: ["sk-test-SECRET-123"],
          log: () => {
          },
          sleep: async () => {
          },
          fetch: async (url, init) => init.method === "GET" ? res(200, '{"data":[{"id":"openai/gpt-oss-20b"}]}', {}) : res(404, '{"error":{"message":"no route for key sk-test-SECRET-123"}}', {})
        });
        try {
          await r.chat("fast", [{ role: "user", content: "x" }]);
          t(false, "404 \u7DB2\u5740\u932F\u8981\u4E1F\u932F");
        } catch (e) {
          t(!e.message.includes("SECRET") && e.message.includes("***") && e.message.includes("\u7DB2\u5740"), "404 \u7DB2\u5740\u932F\uFF1A\u8A0A\u606F\u9644\u56DE\u61C9\u6458\u8981\u3001\u91D1\u9470\u906E\u6210 ***");
        }
        await runShared(t, opts.strict);
        console.log("\n\u81EA\u6211\u6E2C\u8A66" + (ok ? "\u5168\u90E8\u901A\u904E" : "\u6709\u5931\u6557"));
        return ok ? 0 : 1;
      }
      const same = (a, b) => a == null || b == null ? a == null && b == null : Math.abs(a - b) < 1e-6;
      const show = (v) => v == null ? "None" : String(v);
      const fakeRes = (status, body, hdrs) => ({
        status,
        text: async () => body && typeof body._raw === "string" && Object.keys(body).length === 1 ? body._raw : JSON.stringify(body),
        headers: { get: (n) => {
          const k = Object.keys(hdrs || {}).find((x) => x.toLowerCase() === n.toLowerCase());
          return k == null ? null : hdrs[k];
        } }
      });
      function okBody(provider, text) {
        const st = PROVIDERS[provider].style;
        if (st === "gemini") return { candidates: [{ content: { parts: [{ text }] } }] };
        if (st === "anthropic") return { content: [{ type: "text", text }] };
        return { choices: [{ message: { content: text } }] };
      }
      async function runShared(t, strict) {
        const fs = __require("fs"), path = __require("path");
        const p = [path.join(__dirname, "router_cases.json"), path.join(__dirname, "..", "assets", "router_cases.json")].find((x) => fs.existsSync(x));
        if (!p) {
          if (strict) t(false, "\u627E\u4E0D\u5230 router_cases.json\uFF08\u5169\u500B\u8A9E\u8A00\u5171\u7528\u7684\u6E2C\u8A66\u6848\u4F8B\uFF1B--strict \u4E00\u5B9A\u8981\u6709\uFF09");
          else console.log("\u26A0\uFE0F \u627E\u4E0D\u5230 router_cases.json\uFF0C\u5171\u7528\u6848\u4F8B\u6C92\u8DD1\u3002\u53EA\u628A\u6A21\u7D44\u8907\u88FD\u9032 App \u6642\u662F\u6B63\u5E38\u7684\uFF1B\u8981\u8DD1\u5B8C\u6574\u6E2C\u8A66\u5C31\u628A assets/router_cases.json \u653E\u5728\u6A21\u7D44\u65C1\u908A\uFF0C\u6216\u5728 skl \u88E1\u8DD1\u3002");
          return;
        }
        const C = JSON.parse(fs.readFileSync(p, "utf8"));
        const t0 = C.now;
        const sample = (item) => JSON.parse(JSON.stringify(typeof item === "string" ? C.samples[item] : item));
        const idsOf = (v) => typeof v === "string" ? C.model_responses[v].data.map((m) => m.id) : v;
        for (const c of C.delays) {
          const got = parseDelay(c.value, c.now);
          t(same(got, c.seconds), "\u7B49\u5F85\u6642\u9593\uFF1A" + c.name + "\uFF08" + JSON.stringify(c.value) + " \u2192 \u671F\u671B " + show(c.seconds) + "\uFF0C\u5F97\u5230 " + show(got) + "\uFF09");
        }
        for (const c of C.text_delays) {
          const got = textDelay(c.text);
          t(same(got, c.seconds), "\u8A0A\u606F\u88E1\u7684\u7B49\u5F85\u6642\u9593\uFF1A" + JSON.stringify(c.text) + " \u2192 \u671F\u671B " + show(c.seconds) + "\uFF0C\u5F97\u5230 " + show(got));
        }
        for (const c of C.classify) {
          const s = sample(c.sample);
          const info = classify(s.status, withHeaders(s.body || {}, s.headers), c.now != null ? c.now : t0);
          t(
            info.kind === c.kind && same(info.delay, c.delay),
            "\u5206\u985E\uFF1A" + c.name + "\uFF08\u671F\u671B " + c.kind + " " + show(c.delay) + "\uFF0C\u5F97\u5230 " + info.kind + " " + show(info.delay) + "\uFF09"
          );
        }
        for (const c of C.think) {
          const got = stripThink(c.text);
          t(got === c.out, "<think> \u8655\u7406\uFF1A" + JSON.stringify(c.text) + " \u2192 " + JSON.stringify(got));
        }
        for (const c of C.rank) {
          const got = rank(idsOf(c.ids), c.provider, c.tier);
          t(JSON.stringify(got) === JSON.stringify(c.expect), "\u6392\u5E8F\uFF1A" + c.name + "\uFF08\u5F97\u5230 " + JSON.stringify(got) + "\uFF09");
        }
        for (const c of C.pick) {
          const resp = C.model_responses[c.response];
          const r = new ModelRouter2(c.provider, { keys: ["k"], log: () => {
          }, sleep: async () => {
          }, fetch: async () => fakeRes(200, resp, {}) });
          const got = {};
          for (const tier of Object.keys(c.expect)) got[tier] = await r.pick(tier);
          t(JSON.stringify(got) === JSON.stringify(c.expect), "\u6311\u6A21\u578B\uFF1A" + c.name + "\uFF08\u5F97\u5230 " + JSON.stringify(got) + "\uFF09");
        }
        for (const sc of C.scenarios) await runScenario(t, C, sc, sample);
      }
      async function runScenario(t, C, sc, sample) {
        resetCooldowns();
        let clock = C.now;
        const queues = {};
        for (const [k, v] of Object.entries(sc.responses || {})) queues[k] = v.slice();
        for (const [i, step] of sc.steps.entries()) {
          if (step.advance != null) {
            clock += step.advance;
            continue;
          }
          const posts = [], waits = [];
          const fetchFn = async (url, init) => {
            if (init.method === "GET") {
              if (typeof sc.models === "string") return fakeRes(200, C.model_responses[sc.models], {});
              return fakeRes(200, sc.provider === "gemini" ? { models: sc.models.map((m) => ({ name: "models/" + m, supportedGenerationMethods: ["generateContent"] })) } : { data: sc.models.map((id) => ({ id })) }, {});
            }
            const sent = init.body ? JSON.parse(init.body) : {};
            const model = sent.model || decodeURIComponent((url.match(/\/models\/([^/:]+):generateContent/) || [])[1] || "");
            const h = init.headers || {};
            const key = (h.Authorization || "").replace(/^Bearer /, "") || h["x-goog-api-key"] || h["x-api-key"] || "";
            posts.push(model);
            const q = queues[model + "#" + key] || queues[model];
            const spec = sample(q ? q.length > 1 ? q.shift() : q[0] : "ok");
            if (spec.status === 200) return fakeRes(200, okBody(sc.provider, spec.text != null ? spec.text : "ok:" + model), {});
            if (spec.status === 0) throw new TypeError("network");
            return fakeRes(spec.status, spec.body || {}, spec.headers || {});
          };
          const r = new ModelRouter2(sc.provider, {
            keys: step.keys || ["k"],
            fetch: fetchFn,
            log: () => {
            },
            maxCalls: step.max_calls,
            sleep: async (ms) => {
              waits.push(ms / 1e3);
              clock += ms / 1e3;
            },
            now: () => clock * 1e3
          });
          let out = null, err = null;
          try {
            out = await r.chat(step.tier || "fast", [{ role: "user", content: "x" }], { escalate: step.escalate !== false });
          } catch (e) {
            err = String(e && e.message || e);
          }
          const exp = step.expect;
          let good = JSON.stringify(posts) === JSON.stringify(exp.posts);
          if (exp.waits) good = good && waits.length === exp.waits.length && exp.waits.every((w, j) => same(waits[j], w));
          if ("result" in exp) good = good && out === exp.result;
          if (exp.error_has) good = good && err != null && exp.error_has.every((s) => err.includes(s));
          t(good, "\u60C5\u5883\uFF1A" + sc.name + "\uFF08\u7B2C " + (i + 1) + " \u6B65\uFF09" + (good ? "" : " posts=" + JSON.stringify(posts) + " waits=" + JSON.stringify(waits) + " out=" + out + " err=" + err));
        }
        resetCooldowns();
      }
      const api = {
        ModelRouter: ModelRouter2,
        rank,
        pickTier,
        isPaid,
        classify,
        parseDelay,
        textDelay,
        stripThink,
        withHeaders,
        resetCooldowns,
        selftest,
        TIERS,
        PROVIDERS
      };
      if (typeof module !== "undefined" && module.exports) module.exports = api;
      else Object.assign(root, api);
      if (typeof __require !== "undefined" && typeof module !== "undefined" && __require.main === module && process.argv[2] === "selftest")
        selftest({ strict: process.argv.includes("--strict") }).then((c) => process.exit(c));
    })(typeof globalThis !== "undefined" ? globalThis : exports);
  }
});

// worker/worker.js
var import_model_router = __toESM(require_model_router(), 1);
var { ModelRouter } = import_model_router.default;
var TZ_OFFSET_HOURS = 8;
var SIGNS = [
  ["aries", "\u7261\u7F8A\u5EA7"],
  ["taurus", "\u91D1\u725B\u5EA7"],
  ["gemini", "\u96D9\u5B50\u5EA7"],
  ["cancer", "\u5DE8\u87F9\u5EA7"],
  ["leo", "\u7345\u5B50\u5EA7"],
  ["virgo", "\u8655\u5973\u5EA7"],
  ["libra", "\u5929\u79E4\u5EA7"],
  ["scorpio", "\u5929\u880D\u5EA7"],
  ["sagittarius", "\u5C04\u624B\u5EA7"],
  ["capricorn", "\u6469\u7FAF\u5EA7"],
  ["aquarius", "\u6C34\u74F6\u5EA7"],
  ["pisces", "\u96D9\u9B5A\u5EA7"]
];
var PERIODS = ["today", "tomorrow", "week", "month", "year"];
var PROMPT_VERSION = "v2";
var MAX_AI_CALLS = 6;
var DAY_MS = 864e5;
var pad2 = (n) => String(n).padStart(2, "0");
function taipeiDate(nowMs) {
  const t = new Date(nowMs + TZ_OFFSET_HOURS * 36e5);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
function addDays({ y, m, d }, n) {
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
function taipeiMidnightUtc({ y, m, d }) {
  return Date.UTC(y, m - 1, d) - TZ_OFFSET_HOURS * 36e5;
}
var iso = ({ y, m, d }) => `${y}-${pad2(m)}-${pad2(d)}`;
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
function periodInfo(period, nowMs) {
  const today = taipeiDate(nowMs);
  const nextMidnight = taipeiMidnightUtc(addDays(today, 1));
  if (period === "today" || period === "tomorrow") {
    const day = period === "today" ? today : addDays(today, 1);
    return {
      key: `daily:${iso(day)}`,
      label: `${day.y} \u5E74 ${day.m} \u6708 ${day.d} \u65E5`,
      expiresAt: taipeiMidnightUtc(addDays(day, 1)) + 36e5,
      validUntil: nextMidnight
    };
  }
  if (period === "week") {
    const monday = addDays(today, 1 - isoWeekday(today));
    const sunday = addDays(monday, 6);
    const w = isoWeek(today);
    const end = taipeiMidnightUtc(addDays(sunday, 1));
    return { key: `weekly:${w.year}-W${pad2(w.week)}`, label: `${monday.m}/${monday.d}\u2013${sunday.m}/${sunday.d} \u9019\u4E00\u9031`, expiresAt: end + 36e5, validUntil: end };
  }
  if (period === "month") {
    const nextFirst = today.m === 12 ? { y: today.y + 1, m: 1, d: 1 } : { y: today.y, m: today.m + 1, d: 1 };
    const end = taipeiMidnightUtc(nextFirst);
    return { key: `monthly:${today.y}-${pad2(today.m)}`, label: `${today.y} \u5E74 ${today.m} \u6708`, expiresAt: end + 36e5, validUntil: end };
  }
  if (period === "year") {
    const end = taipeiMidnightUtc({ y: today.y + 1, m: 1, d: 1 });
    return { key: `yearly:${today.y}`, label: `${today.y} \u5E74`, expiresAt: end + 36e5, validUntil: end };
  }
  throw new Error("invalid period");
}
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
}
function corsHeaders(origin) {
  return origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "accept", "Access-Control-Max-Age": "86400", Vary: "Origin" } : { Vary: "Origin" };
}
function json(status, body, origin, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", ...corsHeaders(origin), ...extra }
  });
}
var SYSTEM_PROMPT = [
  "\u4F60\u662F\u53F0\u7063\u661F\u5EA7\u751F\u6D3B\u5C08\u6B04\u7684\u4F5C\u8005\uFF0C\u66FF\u4E00\u500B\u5A1B\u6A02\u6027\u8CEA\u7684\u661F\u5EA7 App \u64B0\u5BEB\u5341\u4E8C\u661F\u5EA7\u7684\u77ED\u8A55\u3002",
  "\u8B80\u8005\u662F\u53F0\u7063\u7684\u4E00\u822C\u4F7F\u7528\u8005\uFF0C\u8ACB\u4F7F\u7528\u7E41\u9AD4\u4E2D\u6587\u8207\u53F0\u7063\u6163\u7528\u8A9E\uFF08\u4F8B\u5982\uFF1A\u7261\u7F8A\u5EA7\u3001\u6377\u904B\u3001\u4E0A\u73ED\u65CF\u3001\u8CC7\u8A0A\u3001\u54C1\u8CEA\uFF09\u3002",
  "\u6BCF\u500B\u661F\u5EA7\u5BEB 50 \u5230 90 \u500B\u5B57\uFF0C\u8A9E\u6C23\u6EAB\u6696\u3001\u5177\u9AD4\u3001\u53EF\u884C\u52D5\uFF0C\u4F8B\u5982\u7D66\u4E00\u500B\u53EF\u4EE5\u99AC\u4E0A\u505A\u7684\u5C0F\u5EFA\u8B70\u3002",
  "\u9019\u662F\u5A1B\u6A02\u5167\u5BB9\uFF1A\u4E0D\u8981\u505A\u91AB\u7642\u3001\u6295\u8CC7\u3001\u6CD5\u5F8B\u65B9\u9762\u7684\u5177\u9AD4\u5EFA\u8B70\u6216\u4FDD\u8B49\uFF0C\u4E0D\u8981\u88FD\u9020\u6050\u61FC\uFF0C\u4E0D\u8981\u63D0\u53CA\u5176\u4ED6 App \u6216\u54C1\u724C\u3002",
  "\u6BCF\u500B\u661F\u5EA7\u7684\u5167\u5BB9\u8981\u5F7C\u6B64\u4E0D\u540C\uFF0C\u4E0D\u8981\u91CD\u8907\u540C\u6A23\u7684\u53E5\u578B\u3002",
  "\u53EA\u8F38\u51FA\u4E00\u500B JSON \u7269\u4EF6\uFF0C\u4E0D\u8981\u52A0\u4EFB\u4F55\u8AAA\u660E\u3001\u6A19\u984C\u6216 Markdown \u7A0B\u5F0F\u78BC\u6846\u3002"
].join("\n");
function periodPrompt(period, info) {
  const scope = { week: "\u4E00\u9031", month: "\u4E00\u500B\u6708", year: "\u4E00\u6574\u5E74" }[period] || "\u4E00\u5929";
  const keys = SIGNS.map(([id, name]) => `"${id}"\uFF08${name}\uFF09`).join("\u3001");
  return `\u8ACB\u70BA\u5341\u4E8C\u661F\u5EA7\u5206\u5225\u64B0\u5BEB\u300C${scope}\uFF08${info.label}\uFF09\u300D\u7684\u751F\u6D3B\u77ED\u8A55\u3002
\u8F38\u51FA\u683C\u5F0F\uFF1A{"aries":"\u2026\u2026","taurus":"\u2026\u2026", \u2026}\uFF0C\u9375\u5FC5\u9808\u525B\u597D\u662F\u9019 12 \u500B\uFF1A${keys}\uFF0C\u503C\u662F\u77ED\u8A55\u6587\u5B57\u3002`;
}
function parseSigns(text) {
  let s = String(text || "").trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence) s = fence[1];
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  const parsed = JSON.parse(s.slice(start, end + 1));
  const signs = {};
  for (const [id] of SIGNS) {
    const v = parsed[id];
    if (typeof v !== "string" || !v.trim()) throw new Error(`missing ${id}`);
    signs[id] = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
  }
  return signs;
}
async function callClaude(env, period, info, { fetchImpl, sleep } = {}) {
  const keys = String(env.ANTHROPIC_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean);
  if (!keys.length) throw new Error("missing ANTHROPIC_API_KEY");
  const router = new ModelRouter("anthropic", {
    keys,
    fetch: fetchImpl,
    sleep,
    override: env.MODEL ? { smart: String(env.MODEL) } : void 0,
    maxCalls: MAX_AI_CALLS,
    timeoutMs: 12e4,
    log: (m) => console.warn(m)
  });
  const text = await router.chat(
    "smart",
    [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: periodPrompt(period, info) }],
    {
      maxTokens: 16e3,
      validate: (t) => {
        try {
          parseSigns(t);
          return true;
        } catch {
          return false;
        }
      }
    }
  );
  return { signs: parseSigns(text) };
}
async function getOrGenerate(env, period, nowMs, options = {}) {
  const info = periodInfo(period, nowMs);
  const dataKey = `${PROMPT_VERSION}:data:${info.key}`;
  const lockKey = `${PROMPT_VERSION}:lock:${info.key}`;
  const failKey = `${PROMPT_VERSION}:fail:${info.key}`;
  const cached = await env.FORTUNE_KV.get(dataKey, "json");
  if (cached) return { status: 200, body: { ...cached, period, validUntil: new Date(info.validUntil).toISOString() } };
  if (await env.FORTUNE_KV.get(lockKey)) return { status: 202, body: { status: "pending" }, retryAfter: 5 };
  if (await env.FORTUNE_KV.get(failKey)) return { status: 503, body: { error: "temporarily unavailable" }, retryAfter: 60 };
  await env.FORTUNE_KV.put(lockKey, "1", { expirationTtl: 120 });
  try {
    const { signs } = await callClaude(env, period, info, options);
    const record = { key: info.key, generatedAt: new Date(nowMs).toISOString(), signs };
    const expiration = Math.floor(info.expiresAt / 1e3);
    await env.FORTUNE_KV.put(dataKey, JSON.stringify(record), { expiration: Math.max(expiration, Math.floor(nowMs / 1e3) + 120) });
    return { status: 200, body: { ...record, period, validUntil: new Date(info.validUntil).toISOString() } };
  } catch (err) {
    console.error("generate failed", info.key, err && err.message);
    await env.FORTUNE_KV.put(failKey, "1", { expirationTtl: 60 });
    return { status: 503, body: { error: "temporarily unavailable" }, retryAfter: 60 };
  } finally {
    await env.FORTUNE_KV.delete(lockKey);
  }
}
async function handleRequest(request, env, nowMs = Date.now(), options = {}) {
  const url = new URL(request.url);
  const origin = (request.headers.get("origin") || "").replace(/\/+$/, "");
  const allow = allowedOrigins(env);
  const originOk = allow.length === 0 ? true : allow.includes(origin);
  const corsOrigin = originOk && origin ? origin : null;
  if (request.method === "OPTIONS") {
    return originOk ? new Response(null, { status: 204, headers: corsHeaders(corsOrigin) }) : new Response(null, { status: 403 });
  }
  if (request.method !== "GET") return json(405, { error: "method not allowed" }, corsOrigin);
  if (url.pathname === "/" || url.pathname === "") return json(200, { ok: true, service: "star-ai" }, corsOrigin);
  if (url.pathname !== "/fortune") return json(404, { error: "not found" }, corsOrigin);
  if (!originOk) return json(403, { error: "origin not allowed" }, null);
  const period = url.searchParams.get("period");
  if (!PERIODS.includes(period)) return json(400, { error: "period must be today, tomorrow, week, month or year" }, corsOrigin);
  if (!env.FORTUNE_KV) return json(500, { error: "KV not configured" }, corsOrigin);
  const r = await getOrGenerate(env, period, nowMs, options);
  const extra = r.retryAfter ? { "retry-after": String(r.retryAfter) } : r.status === 200 ? { "cache-control": "public, max-age=600" } : {};
  return json(r.status, r.body, corsOrigin, extra);
}
var worker_default = {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      console.error("unhandled", err && err.message);
      return json(500, { error: "internal error" }, null);
    }
  },
  // 排程：依序預先產生（一次一個，避免同時大量呼叫）
  async scheduled(event, env) {
    const now = Date.now();
    for (const period of PERIODS) {
      try {
        await getOrGenerate(env, period, now);
      } catch (err) {
        console.error("scheduled", period, err && err.message);
      }
    }
  }
};
export {
  callClaude,
  worker_default as default,
  handleRequest,
  parseSigns,
  periodInfo,
  taipeiDate
};
