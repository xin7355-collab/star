// 行事曆檔（.ics，RFC 5545）：全天事件＋提醒，加到 iPhone 行事曆後時間到手機自己會跳通知，不需要伺服器。
// 容易出錯的地方：文字裡的逗號、分號、換行要跳脫；每行最多 75 位元組（UTF-8），中文一字 3 位元組，
// 折行不能把一個字切成兩半；全天事件的 DTEND 是「最後一天的隔天」。純函式，可在 Node 測試。

const CRLF = '\r\n';
const enc = new TextEncoder();

/** 文字欄位跳脫（反斜線、分號、逗號、換行） */
export function escapeText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** 超過 75 位元組的行折成多行：後面的行開頭空一格（那一格也算在 75 裡），不把一個字切開 */
export function foldLine(line) {
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
      limit = 74;
    }
    cur += ch;
    bytes += b;
  }
  if (cur) out.push(cur);
  return out.join(`${CRLF} `);
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.y}${pad(d.m)}${pad(d.d)}`;
const nextDay = (d) => {
  const t = new Date(Date.UTC(d.y, d.m - 1, d.d + 1));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** 提醒時間（相對全天事件當天 0 點）：當天早上 9 點、前一天早上 9 點 */
const ALARM = { morning: 'PT9H', dayBefore: '-PT15H' };

/**
 * @param {Array<{id:string, date:{y,m,d}, end?:{y,m,d}, title:string, desc?:string, alarm?:'morning'|'dayBefore'}>} events
 *   全天事件；end 是最後一天（含），沒有就是單日
 * @param {{calName?:string, now?:number}} [opts]
 */
export function buildIcs(events, { calName = '星座手帳', now = Date.now() } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//star-app//reminders//ZH-TW', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(calName)}`];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@star-app`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(e.end || e.date))}`,
      `SUMMARY:${escapeText(e.title)}`,
    );
    if (e.desc) lines.push(`DESCRIPTION:${escapeText(e.desc)}`);
    // 全天的提醒不佔用「忙碌」時段，不會擋到別人約你的時間
    lines.push('TRANSP:TRANSPARENT');
    if (e.alarm) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(e.title)}`, `TRIGGER:${ALARM[e.alarm]}`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
