// 時辰不確定模式：不知道出生時間（或出生證明的時間是約略記的）時，把 13 個時辰各排一次，
// 分成「不管哪個時辰都一樣」（可以放心看）和「會跟著時辰變」兩部分。
//
// 為什麼不幫你猜時辰：用個性、測驗或人生大事去挑「最像你的那張盤」是循環論證——13 張盤裡總有一張看起來很合，
// 挑出來的當然像你（是照你挑的），拿去算流年大運也不會因此變準；八字、紫微、星盤各自挑出的時辰還可能互相打架。
// 家人記得的大概時段（早上、半夜）是真的資訊，可以拿來縮小範圍（hour-windows.js）。
//
// 這個模組會載入八字與紫微的函式庫，只在使用者打開「時辰不確定」工具時才載入。

import { HOUR_SLOTS, HOUR_WINDOWS, slotOfHour } from './hour-windows.js';
import { buildBazi, baziClock, yongShen } from './bazi.js';
import { geju } from './geju.js';
import { buildZiwei } from './ziwei.js';
import { positionsAt, anglesAt } from './astro.js';
import { SIGNS, signOfLongitude } from './zodiac.js';
import { chengGu } from './chenggu.js';
import { solarToLunar } from './calendar.js';
import { offsetMinutes } from './tz.js';

/** 出生那年的標準時差（分鐘）：冬、夏各取一次，小的那個是標準時間（同 bazi.js baziClock） */
const stdOffset = (y, tz) => Math.min(offsetMinutes(Date.UTC(y, 0, 1, 12), tz), offsetMinutes(Date.UTC(y, 6, 1, 12), tz));

/**
 * 候選時辰的出生資料：h、mi 是排盤用的標準時間。出生那天如果是日光節約時間，換成當時的鐘面時間再交給排盤
 * （排盤會再扣回去）；晚子時加一小時可能變成隔天的鐘面時間，日期也一起換。
 */
export function slotInput(input, slot) {
  const { y, m, d } = input.date;
  const std = stdOffset(y, input.tz);
  const utcMs = Date.UTC(y, m - 1, d, slot.h, slot.mi) - std * 60000;
  const off = offsetMinutes(utcMs, input.tz);
  const local = new Date(utcMs + off * 60000);
  return {
    utcMs,
    input: {
      ...input,
      date: { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate() },
      time: { h: local.getUTCHours(), mi: local.getUTCMinutes() },
      // 日光節約結束那一小時會出現兩次：用第一次（還是夏令）或第二次（已回標準）由實際時差決定
      fold: off > std ? 0 : 1,
    },
  };
}

/** 出生那天是不是日光節約時間（畫面要提醒：出生證明上的鐘面時間要減 1 小時才是這裡的範圍） */
export function isDstDay(input) {
  const { y, m, d } = input.date;
  return offsetMinutes(Date.UTC(y, m - 1, d, 4), input.tz) > stdOffset(y, input.tz);
}

/**
 * 13 個時辰各排一次。
 * @param input ctx.inputOf(p)（time 可以是 null）
 * @param {{gender?:'男'|'女'|'', sect?:1|2, place?:{lat,lon}|null, today?:{y,m,d}}} o
 *   place：算上升星座用；沒填時間的人，出生地由畫面從名單的出生地帶入
 */
export function hourCandidates(input, { gender = '', sect = 1, place = null, today = null, ziweiSchool = 'default', ziweiYear = 'normal' } = {}) {
  return HOUR_SLOTS.map((slot) => {
    const { utcMs, input: ci } = slotInput(input, slot);
    // 候選本身就是「標準時間的某個時辰」，用標準時間排（真太陽時的差別在畫面上另外說明）
    const bz = buildBazi(ci, { gender: gender || null, sect, solarTime: 'standard', today });
    let bazi = null;
    let chenggu = null;
    if (bz.ok) {
      const ys = yongShen(bz);
      const g = geju(bz);
      bazi = {
        year: bz.pillars[0].gan + bz.pillars[0].zhi,
        month: bz.pillars[1].gan + bz.pillars[1].zhi,
        day: bz.pillars[2].gan + bz.pillars[2].zhi,
        hour: bz.pillars[3] ? bz.pillars[3].gan + bz.pillars[3].zhi : '',
        dayMaster: `${bz.dayMaster.gan}${bz.dayMaster.wx}`,
        ys: ys ? `${ys.primary}、${ys.secondary}` : '',
        strength: ys ? ys.strength : '',
        geju: g ? g.name : '',
      };
      // 稱骨和綜合解讀同一套：年柱干支＋排盤時鐘的農曆月日＋時辰
      const clk = baziClock(ci, { solarTime: 'standard' });
      if (clk.ok) {
        const l = solarToLunar(clk.clock);
        const cg = chengGu({ yearGanZhi: bazi.year, lunarMonth: l.month, lunarDay: l.day, hour: clk.clock.h });
        if (cg.ok) chenggu = { total: cg.total, text: cg.text };
      }
    }
    let ziwei = null;
    if (gender === '男' || gender === '女') {
      const zw = buildZiwei(ci, { gender, solarTime: 'standard', sect, school: ziweiSchool, yearDivide: ziweiYear });
      if (zw.ok) {
        const ming = zw.palaces.find((p) => p.name === '命宮');
        const body = zw.palaces.find((p) => p.isBody);
        ziwei = {
          ming: ming && ming.major.length ? ming.major.map((s) => s.name).join('、') : '空宮',
          branch: zw.soulBranch,
          body: body ? body.name : '',
          ju: zw.fiveElementsClass,
        };
      }
    }
    const pos = positionsAt(utcMs, ['Sun', 'Moon']);
    let rising = null;
    if (place) {
      try {
        rising = signOfLongitude(anglesAt(utcMs, place.lat, place.lon).ASC);
      } catch {
        rising = null; // 極圈內上升點不穩定：不列
      }
    }
    return { ...slot, bazi, ziwei, sun: pos.Sun.sign, moon: pos.Moon.sign, rising, chenggu };
  });
}

/** 比對的項目：get 回傳 null 代表這一項沒有算（沒有性別、沒有出生地） */
export const HOUR_FIELDS = [
  { key: 'year', system: '八字', label: '年柱', get: (c) => (c.bazi ? c.bazi.year : null) },
  { key: 'month', system: '八字', label: '月柱', get: (c) => (c.bazi ? c.bazi.month : null) },
  { key: 'day', system: '八字', label: '日柱（日主）', get: (c) => (c.bazi ? `${c.bazi.day}（${c.bazi.dayMaster}）` : null) },
  { key: 'geju', system: '八字', label: '格局', get: (c) => (c.bazi && c.bazi.geju ? c.bazi.geju : null) },
  { key: 'strength', system: '八字', label: '身強弱', get: (c) => (c.bazi && c.bazi.strength ? c.bazi.strength : null) },
  { key: 'ys', system: '八字', label: '喜用神', get: (c) => (c.bazi && c.bazi.ys ? c.bazi.ys : null) },
  { key: 'hour', system: '八字', label: '時柱', get: (c) => (c.bazi && c.bazi.hour ? c.bazi.hour : null) },
  { key: 'sun', system: '星座', label: '太陽星座', get: (c) => SIGNS[c.sun].name },
  { key: 'moon', system: '星座', label: '月亮星座', get: (c) => SIGNS[c.moon].name },
  { key: 'rising', system: '星座', label: '上升星座', get: (c) => (c.rising === null ? null : SIGNS[c.rising].name) },
  { key: 'ming', system: '紫微', label: '命宮主星', get: (c) => (c.ziwei ? c.ziwei.ming : null) },
  { key: 'body', system: '紫微', label: '身宮', get: (c) => (c.ziwei && c.ziwei.body ? `在${c.ziwei.body}` : null) },
  { key: 'ju', system: '紫微', label: '五行局', get: (c) => (c.ziwei ? c.ziwei.ju : null) },
  { key: 'gu', system: '稱骨', label: '骨重', get: (c) => (c.chenggu ? c.chenggu.text : null) },
];

/**
 * 幾個候選的名字：「丑、寅時」；連續三個以上合成「早子～亥時」（12 個時辰一個一個列，手機上一大串讀不下去）
 */
export function slotNames(slots) {
  const idx = slots.map((s) => HOUR_SLOTS.findIndex((x) => x.id === s.id)).sort((a, b) => a - b);
  const runs = [];
  for (const i of idx) {
    const last = runs[runs.length - 1];
    if (last && i === last[1] + 1) last[1] = i;
    else runs.push([i, i]);
  }
  const text = runs.map(([a, b]) => (b - a >= 2 ? `${HOUR_SLOTS[a].name}～${HOUR_SLOTS[b].name}` : HOUR_SLOTS.slice(a, b + 1).map((x) => x.name).join('、')));
  return `${text.join('、')}時`;
}

/**
 * 分成「都一樣」和「會變」：會變的依出現次數排，最多的在前（例如喜用神 10 個時辰一樣、3 個不同）。
 * @param slotIds 只看這幾個時辰（家人記得的大概時段）；不給就看全部
 */
export function summarizeHours(cands, slotIds = null) {
  const list = slotIds && slotIds.length ? cands.filter((c) => slotIds.includes(c.id)) : cands;
  const stable = [];
  const vary = [];
  for (const f of HOUR_FIELDS) {
    const groups = new Map();
    for (const c of list) {
      const v = f.get(c);
      if (v === null || v === undefined || v === '') continue;
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push(c);
    }
    if (!groups.size) continue;
    const g = [...groups].map(([value, slots]) => ({ value, slots })).sort((a, b) => b.slots.length - a.slots.length);
    (g.length === 1 ? stable : vary).push({ key: f.key, system: f.system, label: f.label, value: g[0].value, groups: g });
  }
  return { count: list.length, stable, vary };
}

/** 已經知道出生時間：排盤用的時刻落在哪個候選（標記「你填的時間」） */
export function knownSlot(input, { solarTime = 'standard' } = {}) {
  if (!input || !input.time) return null;
  const clk = baziClock(input, { solarTime });
  return clk.ok ? slotOfHour(clk.clock.h) : null;
}

export { HOUR_SLOTS, HOUR_WINDOWS };
