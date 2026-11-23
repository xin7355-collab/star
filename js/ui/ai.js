// AI 短評（選用功能）：前端只呼叫自己的 Cloudflare Worker，金鑰不在前端。
// ・請求排隊：同一時間只送一個（修正 StarSignDivination／ChooseDay 一次併發多個請求的問題）
// ・指數退避重試：202（產生中）、429、5xx、網路錯誤會等待 1s→2s→4s→8s（加隨機抖動）再試
// ・本機快取：同一期間的結果在有效期限內不重複請求

import { AI_ENDPOINT } from '../config.js';
import { load, save } from './storage.js';

let chain = Promise.resolve();

/** 佇列：任務依序執行 */
export function enqueue(task) {
  const run = chain.then(task, task);
  chain = run.catch(() => {});
  return run;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithBackoff(url, { retries = 4, baseMs = 1000, maxWaitMs = 15000, timeoutMs = 90000, fetchImpl = fetch } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res = null;
    let netError = null;
    try {
      res = await fetchImpl(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    } catch (err) {
      netError = err;
    } finally {
      clearTimeout(timer);
    }
    if (res && res.status === 200) return res.json();
    const retryable = netError || res.status === 202 || res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= retries) {
      throw new Error(netError ? '網路連線失敗，請稍後再試' : `AI 服務暫時無法使用（${res.status}）`);
    }
    const retryAfter = res ? Number(res.headers.get('retry-after')) : NaN;
    const wanted = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseMs * 2 ** attempt;
    const wait = Math.min(wanted, maxWaitMs); // 不讓使用者乾等太久
    await sleep(wait + Math.random() * wait * 0.3);
  }
}

export function aiEnabled() {
  return typeof AI_ENDPOINT === 'string' && /^https:\/\/[^\s]+$/.test(AI_ENDPOINT);
}

/** 取某期間 12 星座的 AI 短評；回傳 {period, key, validUntil, signs:{aries:"..."}} */
export async function getAiFortune(period) {
  if (!aiEnabled()) return null;
  const cacheKey = `ai.${period}`;
  const cached = load(cacheKey);
  if (cached && cached.validUntil && Date.parse(cached.validUntil) > Date.now()) return cached;
  const url = `${AI_ENDPOINT.replace(/\/+$/, '')}/fortune?period=${encodeURIComponent(period)}`;
  const data = await enqueue(() => fetchWithBackoff(url));
  if (!data || typeof data !== 'object' || !data.signs) throw new Error('AI 回應格式不正確');
  save(cacheKey, data);
  return data;
}
