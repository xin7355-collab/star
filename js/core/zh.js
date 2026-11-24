// lunar-typescript 的簡體輸出轉台灣繁體（對照表由 scripts/gen-zh-map.py 用 OpenCC 產生）。
// 先查整個詞（處理「谷雨→穀雨」這類要看上下文的詞），查不到才逐字轉。

import { CHAR, PHRASE } from './zh-data.js';

export function tw(text) {
  if (text === null || text === undefined) return text;
  const s = String(text);
  if (Object.prototype.hasOwnProperty.call(PHRASE, s)) return PHRASE[s];
  let out = '';
  for (const ch of s) out += Object.prototype.hasOwnProperty.call(CHAR, ch) ? CHAR[ch] : ch;
  return out;
}

export function twList(list) {
  return (list || []).map(tw);
}
