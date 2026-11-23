// 生日輸入解析（民國／西元）。
// 刻意不用 new Date("YYYY-MM-DD")：那會被當成 UTC 午夜解析，
// 在美洲等負時區的手機上會少一天（已在 V1 瑪雅計算器實測到此錯誤）。

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;
export const ROC_OFFSET = 1911;

const FULLWIDTH_DIGITS = /[０-９]/g;

/** 全形數字轉半形、去空白 */
export function normalizeDigits(value) {
  return String(value ?? '')
    .replace(FULLWIDTH_DIGITS, (ch) => String(ch.charCodeAt(0) - 0xff10))
    .trim();
}

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y, m) {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

function toInt(value) {
  const s = normalizeDigits(value);
  if (!/^\d{1,4}$/.test(s)) return NaN;
  return parseInt(s, 10);
}

/**
 * 解析生日。
 * @param {{era:'roc'|'ad', year:any, month:any, day:any}} input
 * @returns {{ok:true, value:{y:number,m:number,d:number}} | {ok:false, error:string}}
 */
export function parseBirthDate({ era, year, month, day }) {
  const rawYear = toInt(year);
  const m = toInt(month);
  const d = toInt(day);
  if (Number.isNaN(rawYear)) return { ok: false, error: '請輸入出生年份（數字）' };
  if (Number.isNaN(m) || m < 1 || m > 12) return { ok: false, error: '月份要在 1 到 12 之間' };

  let y;
  if (era === 'roc') {
    if (rawYear < 1) return { ok: false, error: '民國年請填 1 以上；民國前出生請切換成西元' };
    y = rawYear + ROC_OFFSET;
  } else {
    y = rawYear;
  }
  if (y < MIN_YEAR || y > MAX_YEAR) {
    const rocMin = MIN_YEAR - ROC_OFFSET;
    return {
      ok: false,
      error: era === 'roc'
        ? `民國年請填 1 到 ${MAX_YEAR - ROC_OFFSET}`
        : `西元年請填 ${MIN_YEAR} 到 ${MAX_YEAR}（民國前 ${-rocMin} 年起）`,
    };
  }
  if (Number.isNaN(d) || d < 1) return { ok: false, error: '請輸入出生日' };
  const max = daysInMonth(y, m);
  if (d > max) return { ok: false, error: `${y} 年 ${m} 月只有 ${max} 天` };
  return { ok: true, value: { y, m, d } };
}

/**
 * 解析 "HH:MM"（iPhone 的 time 欄位輸出格式）。
 * @returns {{ok:true, value:{h:number, mi:number}} | {ok:false, error:string}}
 */
export function parseTime(text) {
  const s = normalizeDigits(text);
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!match) return { ok: false, error: '請輸入出生時間（例如 08:30）' };
  const h = parseInt(match[1], 10);
  const mi = parseInt(match[2], 10);
  if (h > 23 || mi > 59) return { ok: false, error: '時間格式不正確' };
  return { ok: true, value: { h, mi } };
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 顯示用日期：民國 89 年 3 月 21 日／2000 年 3 月 21 日 */
export function formatDate({ y, m, d }, era = 'roc') {
  if (era === 'roc' && y > ROC_OFFSET) return `民國 ${y - ROC_OFFSET} 年 ${m} 月 ${d} 日`;
  return `${y} 年 ${m} 月 ${d} 日`;
}

export function isoDate({ y, m, d }) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** 民用日期加減天數（以 UTC 計算，不受裝置時區影響） */
export function addDays({ y, m, d }, n) {
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** 星期一=1 … 星期日=7 */
export function isoWeekday({ y, m, d }) {
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

/** ISO 週次（週一開始），回傳 {year, week} */
export function isoWeek({ y, m, d }) {
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}
