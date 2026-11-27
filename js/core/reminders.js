// 行事曆提醒：從人生時間軸、天象、瑪雅曆挑出接下來的重要日子，變成全天事件（交給 core/ics.js 產生 .ics）。
// 內容只寫提醒和原因，不寫生日；別人的提醒在標題加名字，方便在行事曆裡分辨。純函式，可在 Node 測試。

import { buildLifeline, monthsAhead, WARN_TAGS } from './lifeline.js';
import { LEVEL_TEXT, SHISHEN_YEAR } from './lifeline-texts.js';
import { retrogradePeriods, eclipsesBetween, monthChangesBetween } from './timing.js';
import { mayaKin, nextKinDate } from './maya-kin.js';
import { addDays, isoDate } from './date.js';

export const REMINDER_KINDS = [
  { id: 'months', label: '要注意的月份（每月一開始提醒）' },
  { id: 'mercury', label: '水星逆行（前一天提醒）' },
  { id: 'eclipse', label: '日食、月食' },
  { id: 'kin', label: '銀河生日（瑪雅曆，260 天一次）' },
  { id: 'years', label: '要注意的年份（立春那天）與交大運' },
];

const md = (d) => `${d.m}/${d.d}`;
const dayMs = (d) => Date.UTC(d.y, d.m - 1, d.d);

/** 某一年的立春（八字的一年從立春開始；約 2/3～2/5） */
export function lichunOf(year) {
  const hit = monthChangesBetween({ y: year, m: 1, d: 25 }, 20).find((x) => x.name === '立春');
  return hit ? hit.date : { y: year, m: 2, d: 4 };
}

/**
 * @param {{bazi?:object, natal?:object, birth:{y,m,d}, today:{y,m,d}, gender?:string, personId?:string, name?:string,
 *          self?:boolean, kinds?:string[], lifeline?:object, months?:object[]}} input kinds 不給就全部；
 *   lifeline、months 是畫面已經算好的 buildLifeline、monthsAhead 結果，給了就不重算（手機上省約 40 毫秒）
 * @returns {Array<{id,kind,date,end?,title,desc,alarm}>} 依日期排序；只有今天以後的
 */
export function reminderEvents({ bazi = null, natal = null, birth, today, gender = '', personId = 'me', name = '', self = true, kinds = REMINDER_KINDS.map((k) => k.id), lifeline = null, months = null, mayaCount = 'dreamspell' }) {
  const want = new Set(kinds);
  const who = self || !name ? '' : `（${name}）`;
  const todayIso = isoDate(today);
  const yearAhead = dayMs(today) + 370 * 86400000;
  const out = [];
  const add = (kind, date, ev) => {
    if (isoDate(date) < todayIso) return;
    out.push({ id: `${personId}-${kind}-${isoDate(date)}`, kind, date, ...ev });
  };

  if (want.has('months') && bazi) {
    for (const m of months || monthsAhead({ bazi, today })) {
      if (m.level !== '注意' && m.level !== '小心') continue;
      // 這個月已經開始了：提醒放今天
      const start = isoDate(m.start) < todayIso ? today : m.start;
      add('months', start, { title: `本月${m.level}${who}：${m.ganzhi}月`, desc: `${md(m.start)}～${md(m.end)}。${m.notes.map((n) => n.text).join(' ')}`, alarm: 'morning' });
    }
  }
  if (want.has('mercury')) {
    for (const p of retrogradePeriods('Mercury', today, 370)) {
      const start = isoDate(p.start) < todayIso ? today : p.start;
      add('mercury', start, { end: p.end, title: '水星逆行', desc: `${md(p.start)}～${md(p.end)}：溝通、合約、交通、3C 容易出包，重要文件多檢查、簽約多看一次。`, alarm: 'dayBefore' });
    }
  }
  if (want.has('eclipse')) {
    for (const e of eclipsesBetween(today, 370)) {
      add('eclipse', e.date, { title: `${e.type}${e.kind === 'lunar' ? '月食' : '日食'}`, desc: '傳統上的轉折點，重大決定避開前後幾天。', alarm: 'morning' });
    }
  }
  if (want.has('kin') && birth) {
    const mine = mayaKin(birth, mayaCount);
    let from = today;
    for (let i = 0; mine && i < 3; i += 1) {
      const nx = nextKinDate(from, mine.kin, mayaCount);
      if (!nx || dayMs(nx.date) > yearAhead) break;
      add('kin', nx.date, { title: `銀河生日${who}：KIN ${mine.kin} ${mine.title}`, desc: '260 天一次回到你的主印記：適合回顧這一輪、替下一輪許個願。', alarm: 'morning' });
      from = addDays(nx.date, 1);
    }
  }
  if (want.has('years') && bazi) {
    const L = lifeline || buildLifeline({ bazi, natal, birth, today, gender, years: 10, mayaCount });
    for (const y of L.years) {
      if (y.level !== '注意' && y.level !== '小心') continue;
      const why = WARN_TAGS.filter((t) => y.tags.includes(t)).slice(0, 3).join('、') || y.tags[0] || '';
      add('years', lichunOf(y.year), { title: `${y.year} 年${y.level}${who}${why ? `：${why}` : ''}`, desc: `${LEVEL_TEXT[y.level]}細節在「人生時間軸」的 ${y.year} 年。`, alarm: 'morning' });
    }
    // 交大運：出生日加上起運的年月日是第一步，之後每 10 年一步（和萬年曆函式庫的起運年核對過）
    if (bazi.yun && bazi.yun.start) {
      const s = bazi.yun.start;
      bazi.yun.list.forEach((d, i) => {
        const t = new Date(Date.UTC(birth.y + s.years + i * 10, birth.m - 1 + s.months, birth.d + s.days));
        const date = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
        if (date.y > today.y + 10) return;
        add('years', date, { title: `交大運${who}：${d.ganzhi}（${d.shishen}）`, desc: `接下來十年的重心是「${SHISHEN_YEAR[d.shishen].core}」，生活重心會轉換。`, alarm: 'dayBefore' });
      });
    }
  }
  return out.sort((a, b) => isoDate(a.date).localeCompare(isoDate(b.date)) || a.kind.localeCompare(b.kind));
}
