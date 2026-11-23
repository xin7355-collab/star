// 時區換算：當地鐘錶時間 → UTC，處理夏令時「不存在」與「重複」的時刻。
// 依賴瀏覽器內建的 IANA 時區資料（iPhone Safari / Chrome / Node 皆內建），
// 因此台灣 1945–1979 年的日光節約時間、1937–1945 年的 UTC+9 都會自動套用。
// 絕對不要把台灣寫死成 +8。
// 設計參考 lilith-diviner scripts/astrology.py parse_datetime()（MIT），以 JS 重寫。

import { pad2 } from './date.js';

export const DEFAULT_TZ = 'Asia/Taipei';

const formatterCache = new Map();

function getFormatter(tz) {
  let fmt = formatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatterCache.set(tz, fmt);
  }
  return fmt;
}

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    getFormatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** UTC 毫秒 → 該時區的鐘錶欄位 */
export function wallFields(utcMs, tz) {
  const parts = getFormatter(tz).formatToParts(new Date(utcMs));
  const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
  let h = get('hour');
  if (h === 24) h = 0; // 舊引擎的午夜表示法
  return { y: get('year'), m: get('month'), d: get('day'), h, mi: get('minute'), s: get('second') };
}

/** 該時刻在該時區相對 UTC 的偏移（分鐘，東正西負） */
export function offsetMinutes(utcMs, tz) {
  const f = wallFields(utcMs, tz);
  const wallAsUtc = Date.UTC(f.y, f.m - 1, f.d, f.h, f.mi, f.s);
  const truncated = Math.floor(utcMs / 1000) * 1000;
  return Math.round((wallAsUtc - truncated) / 60000);
}

/**
 * 當地鐘錶時間 → UTC。
 * @returns {{status:'ok', utcMs:number}
 *   | {status:'ambiguous', candidates:number[]}   // 夏令時結束、同一時刻出現兩次
 *   | {status:'nonexistent'}}                     // 夏令時開始、該時刻被跳過
 */
export function localToUtc({ y, m, d, h = 0, mi = 0 }, tz, fold) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const offsets = new Set([
    offsetMinutes(guess - 86400000, tz),
    offsetMinutes(guess, tz),
    offsetMinutes(guess + 86400000, tz),
  ]);
  const candidates = [];
  for (const off of offsets) {
    const utc = guess - off * 60000;
    if (offsetMinutes(utc, tz) === off && !candidates.includes(utc)) candidates.push(utc);
  }
  candidates.sort((a, b) => a - b);
  if (candidates.length === 0) return { status: 'nonexistent' };
  if (candidates.length === 1) return { status: 'ok', utcMs: candidates[0] };
  if (fold === 0 || fold === 1) return { status: 'ok', utcMs: candidates[fold] };
  return { status: 'ambiguous', candidates };
}

/** 寬鬆版：用於「某一天的 00:00」這種邊界，遇到跳過的時刻就往後找第一個存在的時刻 */
export function localToUtcLenient(fields, tz) {
  const r = localToUtc(fields, tz);
  if (r.status === 'ok') return r.utcMs;
  if (r.status === 'ambiguous') return r.candidates[0];
  const base = Date.UTC(fields.y, fields.m - 1, fields.d, fields.h || 0, fields.mi || 0);
  for (let step = 15; step <= 180; step += 15) {
    const w = new Date(base + step * 60000);
    const t = localToUtc(
      { y: w.getUTCFullYear(), m: w.getUTCMonth() + 1, d: w.getUTCDate(), h: w.getUTCHours(), mi: w.getUTCMinutes() },
      tz,
    );
    if (t.status !== 'nonexistent') return t.status === 'ok' ? t.utcMs : t.candidates[0];
  }
  throw new Error('無法換算該日期的時區');
}

/** 某時區「今天」的民用日期 */
export function zoneToday(tz = DEFAULT_TZ, nowMs = Date.now()) {
  const f = wallFields(nowMs, tz);
  return { y: f.y, m: f.m, d: f.d };
}

/** UTC 毫秒 → 該時區 "HH:MM" */
export function formatZoneTime(utcMs, tz) {
  const f = wallFields(utcMs, tz);
  return `${pad2(f.h)}:${pad2(f.mi)}`;
}

/** 偏移顯示：UTC+8、UTC+9、UTC-7:30 */
export function formatOffset(minutes) {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const mm = abs % 60;
  return `UTC${sign}${h}${mm ? ':' + pad2(mm) : ''}`;
}

/** 可選時區清單（Safari 15.4+ 支援 supportedValuesOf；舊版退回常用清單） */
export function listTimeZones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const all = Intl.supportedValuesOf('timeZone');
      if (all.length) return all.includes(DEFAULT_TZ) ? all : [DEFAULT_TZ, ...all];
    }
  } catch {
    /* 退回清單 */
  }
  return [
    'Asia/Taipei', 'Asia/Hong_Kong', 'Asia/Macau', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
    'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok', 'Asia/Manila', 'Australia/Sydney',
    'Australia/Melbourne', 'Pacific/Auckland', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Vancouver', 'America/Toronto', 'UTC',
  ];
}
