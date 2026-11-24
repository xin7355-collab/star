// 農曆與農民曆：國曆↔農曆換算（含閏月）、今日宜忌、沖煞、節氣、吉神方位。
// 計算交給 lunar-typescript（MIT，6tail）；它的輸出是簡體，這裡一律經 tw() 轉台灣繁體。
// 註：農曆年的生肖以「正月初一」為界（民俗用法）；八字年柱以「立春」為界，見 bazi.js。

import { Solar, Lunar, LunarYear, LunarMonth } from '../../vendor/lunar.js';
import { tw, twList } from './zh.js';
import { MIN_YEAR, MAX_YEAR } from './date.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
export const SHENGXIAO = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬'];
export const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function lunarFields(lunar) {
  const month = lunar.getMonth();
  const isLeap = month < 0;
  return {
    year: lunar.getYear(),
    month: Math.abs(month),
    day: lunar.getDay(),
    isLeap,
    yearGanZhi: lunar.getYearInGanZhi(),
    zodiac: tw(lunar.getYearShengXiao()),
    // getMonthInChinese() 遇閏月本身已帶「閏」字（例如「閏二」），不要再加一次
    monthName: `${tw(lunar.getMonthInChinese())}月`,
    dayName: tw(lunar.getDayInChinese()),
  };
}

/** 國曆 → 農曆 */
export function solarToLunar({ y, m, d }) {
  const f = lunarFields(Solar.fromYmd(y, m, d).getLunar());
  return { ...f, text: `${f.yearGanZhi}年（${f.zodiac}）${f.monthName}${f.dayName}` };
}

/** 某農曆年的閏月（0 = 沒有閏月） */
export function leapMonthOf(year) {
  return LunarYear.fromYear(year).getLeapMonth();
}

/** 農曆某月的天數；月份不存在時回傳 0 */
export function lunarMonthDays(year, month, isLeap = false) {
  const lm = LunarMonth.fromYm(year, isLeap ? -month : month);
  return lm ? lm.getDayCount() : 0;
}

/**
 * 農曆 → 國曆（含檢查：沒有這個閏月、這個月只有 29 天等）
 * @returns {{ok:true, value:{y,m,d}} | {ok:false, error:string}}
 */
export function lunarToSolar({ year, month, day, isLeap = false }) {
  if (!(year >= MIN_YEAR && year <= MAX_YEAR - 1)) return { ok: false, error: `農曆年請填 ${MIN_YEAR} 到 ${MAX_YEAR - 1}（西元）` };
  if (!(month >= 1 && month <= 12)) return { ok: false, error: '農曆月份要在 1 到 12 之間' };
  if (isLeap) {
    const leap = leapMonthOf(year);
    if (leap !== month) {
      return { ok: false, error: leap ? `這一年閏的是 ${leap} 月，不是閏 ${month} 月` : '這一年沒有閏月' };
    }
  }
  const days = lunarMonthDays(year, month, isLeap);
  if (!(day >= 1 && day <= days)) return { ok: false, error: `這個農曆月只有 ${days} 天` };
  const s = Lunar.fromYmd(year, isLeap ? -month : month, day).getSolar();
  return { ok: true, value: { y: s.getYear(), m: s.getMonth(), d: s.getDay() } };
}

function jieQiInfo(jq) {
  if (!jq) return null;
  const s = jq.getSolar();
  return { name: tw(jq.getName()), date: { y: s.getYear(), m: s.getMonth(), d: s.getDay() } };
}

/** 某一天的農民曆 */
export function almanac({ y, m, d }) {
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();
  const f = lunarFields(lunar);
  const todayJieQi = lunar.getJieQi();
  return {
    solar: { y, m, d },
    weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
    lunar: f,
    lunarText: `農曆${f.monthName}${f.dayName}`,
    ganzhi: { year: lunar.getYearInGanZhi(), month: lunar.getMonthInGanZhi(), day: lunar.getDayInGanZhi() },
    yi: twList(lunar.getDayYi()),
    ji: twList(lunar.getDayJi()),
    chong: tw(lunar.getDayChongDesc()),
    chongShengXiao: tw(lunar.getDayChongShengXiao()),
    sha: tw(lunar.getDaySha()),
    pengzu: [tw(lunar.getPengZuGan()), tw(lunar.getPengZuZhi())],
    positions: {
      xi: tw(lunar.getDayPositionXiDesc()),
      cai: tw(lunar.getDayPositionCaiDesc()),
      fu: tw(lunar.getDayPositionFuDesc()),
    },
    zhiXing: tw(lunar.getZhiXing()),
    tianShen: `${tw(lunar.getDayTianShen())}（${tw(lunar.getDayTianShenType())}）`,
    jieqi: todayJieQi ? tw(todayJieQi) : '',
    prevJieQi: jieQiInfo(lunar.getPrevJieQi(true)),
    nextJieQi: jieQiInfo(lunar.getNextJieQi(true)),
    festivals: twList(lunar.getFestivals()),
  };
}

/** 民俗生肖（以農曆正月初一為界） */
export function folkZodiac({ y, m, d }) {
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  const name = tw(lunar.getYearShengXiao());
  return { name, index: SHENGXIAO.indexOf(name), yearGanZhi: lunar.getYearInGanZhi() };
}
