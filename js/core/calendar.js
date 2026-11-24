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

// 台灣常拜的節日與神明生日。為什麼要白名單：函式庫的道教、佛教、民俗節日一年有 260 多筆，
// 很多是「某某天君下降」這類一般人不拜的日子；而且中元節不在 getFestivals() 裡（只在 getOtherFestivals()），
// 只讀 getFestivals() 會漏掉台灣最重要的普渡。名稱改成台灣說法；同一天重複的（中元節與中元地官大帝）只留一個。
const FOLK_DAYS = new Map([
  ['中元节', '中元節（普渡）'], ['下元节', '下元節'], ['尾牙', '尾牙'], ['祭灶日', '送神'], ['接神日', '接神'], ['地藏节', '地藏王菩薩聖誕'],
  ['玉皇上帝圣诞', '天公生'], ['上元天官圣诞', '上元天官大帝聖誕'], ['土地正神诞', '土地公生（頭牙）'], ['文昌梓潼帝君圣诞', '文昌帝君聖誕'],
  ['玄天上帝圣诞', '玄天上帝聖誕'], ['财神赵公元帅圣诞', '武財神聖誕'], ['天后妈祖圣诞', '媽祖生'], ['城隍爷圣诞', '城隍爺聖誕'],
  ['关圣帝君圣诞', '關公生（關聖帝君聖誕）'],
  ['观音大士诞', '觀世音菩薩聖誕'], ['观世音菩萨成道', '觀世音菩薩成道日'],
  // 函式庫把九月十九標成「觀世音菩薩誕」，台灣多稱為出家紀念日
  ['观世音菩萨诞', '觀世音菩薩出家日'], ['释迦牟尼佛诞', '佛誕節（浴佛節）'],
]);

/** 這一天的台灣民俗節日與神明生日（白名單過濾、台灣說法） */
export function folkDays(lunar) {
  const names = [...lunar.getOtherFestivals(), ...lunar.getTao().getFestivals().map((f) => f.getName()), ...lunar.getFoto().getFestivals().map((f) => f.getName())];
  return [...new Set(names.map((n) => FOLK_DAYS.get(n)).filter(Boolean))];
}

function jieQiInfo(jq) {
  if (!jq) return null;
  const s = jq.getSolar();
  return { name: tw(jq.getName()), date: { y: s.getYear(), m: s.getMonth(), d: s.getDay() } };
}

// lunar-typescript 1.8.6 有幾個神煞沒有任何語言的翻譯，會直接吐出「sn.sanSang」這種代碼（2020–2027 掃過一遍只有這四個）。
// 拼音能確定對應通行名稱的三個對回中文；「sn.daTui」查不到可靠的名稱，寧可不顯示也不猜。其他沒翻譯的代碼一律不顯示。
const SHEN_SHA_FIX = { 'sn.siLi': '四離', 'sn.sanSang': '三喪', 'sn.guiKu': '鬼哭' };
export function shenSha(list) {
  return twList((list || []).map((x) => SHEN_SHA_FIX[x] || x)).filter((x) => !/^[a-z]+\.[A-Za-z]+$/.test(x));
}

/** 某一天的農民曆 */
export function almanac({ y, m, d }) {
  // 取中午：月建、節氣當天的值以白天為準（午夜那一刻常常還沒交節）
  const solar = Solar.fromYmdHms(y, m, d, 12, 0, 0);
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
    festivals: [...twList(lunar.getFestivals()), ...folkDays(lunar)],
    jiShen: shenSha(lunar.getDayJiShen()),
    xiongSha: shenSha(lunar.getDayXiongSha()),
    // 台灣農民曆寫「胎神占方」的「占」；tw() 的通用對照會把占轉成佔，這裡改回來
    tai: tw(lunar.getDayPositionTai()).replace(/佔/g, '占'),
    xiu: `${tw(lunar.getXiu() + lunar.getZheng() + lunar.getAnimal())}（${tw(lunar.getXiuLuck())}）`,
    wuhou: `${tw(lunar.getHou())}：${tw(lunar.getWuHou())}`,
    season: [lunar.getShuJiu(), lunar.getFu()].filter(Boolean).map((x) => tw(x.toFullString())),
    yearItems: (() => {
      const ly = LunarYear.fromYear(lunar.getYear());
      return [ly.getZhiShui(), ly.getGengTian(), ly.getFenBing(), ly.getDeJin(), ly.getTouLiang()].map(tw);
    })(),
  };
}

/** 民俗生肖（以農曆正月初一為界） */
export function folkZodiac({ y, m, d }) {
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  const name = tw(lunar.getYearShengXiao());
  return { name, index: SHENGXIAO.indexOf(name), yearGanZhi: lunar.getYearInGanZhi() };
}
