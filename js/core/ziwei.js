// 紫微斗數命盤：交給 iztro（MIT，SylarLong），輸出設定為繁體中文（zh-TW）。
// 時辰用與八字相同的「標準時間」（日光節約時間已扣回），可選真太陽時；23 點起為晚子時（iztro 序號 12）。
// 這個模組只在使用者打開紫微命盤時才被載入（iztro 約 51KB gzip）。

import { astro } from '../../vendor/iztro.js';
import { baziClock, clockEdge, clockEdgeLead } from './bazi.js';

// 命盤格子位置：傳統排法，寅在左下、依逆時針排列地支；4×4 的外圈 12 格
export const GRID = {
  巳: [0, 0], 午: [0, 1], 未: [0, 2], 申: [0, 3],
  辰: [1, 0], 酉: [1, 3],
  卯: [2, 0], 戌: [2, 3],
  寅: [3, 0], 丑: [3, 1], 子: [3, 2], 亥: [3, 3],
};

export const STAR_TEXT = {
  紫微: '帝星，重尊嚴與主導，有領導氣質，也需要被尊重。',
  天機: '智慧星，反應快、善規劃，想得多也容易多變。',
  太陽: '光明熱情，樂於付出、重名譽，適合公眾舞台。',
  武曲: '財星，務實果斷、重執行，對金錢與目標敏銳。',
  天同: '福星，溫和隨緣、重享受，人緣好。',
  廉貞: '次桃花，精明有原則，情緒與能量都強烈。',
  天府: '庫星，穩重保守、善管理資源，重安全感。',
  太陰: '溫柔細膩，重家庭與內在感受，理財有耐心。',
  貪狼: '多才多藝、交際廣，慾望與好奇心強。',
  巨門: '口才與分析力好，追根究柢，留意口舌是非。',
  天相: '印星，重形象與公平，擅長協調與輔佐。',
  天梁: '蔭星，有長者風範，喜照顧人，重原則。',
  七殺: '將星，獨立有魄力，敢衝敢闖，變動較多。',
  破軍: '開創與破舊立新，勇於改變，起伏也較大。',
};

const MUTAGEN_NAME = { 祿: '化祿', 權: '化權', 科: '化科', 忌: '化忌' };

/** 時（0–23）→ iztro 時辰序號（0 早子、1 丑 … 11 亥、12 晚子） */
export function timeIndexOf(h) {
  if (h === 23) return 12;
  return Math.floor((h + 1) / 2);
}

function star(s) {
  return { name: s.name, brightness: s.brightness || '', mutagen: s.mutagen ? MUTAGEN_NAME[s.mutagen] || s.mutagen : '' };
}

/**
 * 紫微的派別（iztro 本身支援的設定；選項清單在 schools.js）：
 * - school：default 通行版／zhongzhou 中州派（實測 504 張盤：主星、四化相同，差在劫殺、大耗、龍德、截空、天使天傷這些雜曜）
 * - yearDivide：normal 農曆正月初一換年（預設）／exact 立春換年（立春到春節之間出生的人年干不同，四化跟著變）
 * - sect：和八字的「子時換日」一致——1＝23 點起算隔天（iztro 的 forward），2＝0 點換日（current）
 */
// iztro 的設定是全域的：每次排盤前設好、排完改回預設，不讓一次的選擇影響到別的畫面
function withConfig({ school = 'default', yearDivide = 'normal', sect = 1 }, fn) {
  astro.config({ algorithm: school === 'zhongzhou' ? 'zhongzhou' : 'default', yearDivide: yearDivide === 'exact' ? 'exact' : 'normal', dayDivide: sect === 2 ? 'current' : 'forward' });
  try {
    return fn();
  } finally {
    astro.config({ algorithm: 'default', yearDivide: 'normal', dayDivide: 'forward' });
  }
}

/**
 * @param {{date, time, tz, place, fold}} input
 * @param {{gender:'男'|'女', solarTime?:'standard'|'true', at?:{y,m,d}, sect?:1|2, school?:string, yearDivide?:string}} options
 */
export function buildZiwei(input, { gender, solarTime = 'standard', at = null, sect = 1, school = 'default', yearDivide = 'normal' } = {}) {
  if (!input.time) return { ok: false, error: '紫微命盤需要出生時間（命宮看時辰）。請在名單裡補上時間。' };
  if (gender !== '男' && gender !== '女') return { ok: false, error: '紫微命盤需要性別（大限順逆行看性別）。請在名單裡選擇性別。' };
  return withConfig({ school, yearDivide, sect }, () => chartOf(input, { gender, solarTime, at, school }));
}

function chartOf(input, { gender, solarTime, at, school }) {
  const clk = baziClock(input, { solarTime });
  if (!clk.ok) return clk;
  const { y, m, d, h } = clk.clock;
  const chart = astro.bySolar(`${y}-${m}-${d}`, timeIndexOf(h), gender, true, 'zh-TW');
  const uncertain = [...clk.warnings];
  // 命宮看時辰：出生時間靠近換時辰的時刻，差幾分鐘命宮就移一格、主星全換。用另一邊的時間重排一次來比，
  // 不自己推算：iztro 把 23 點後的晚子時當成隔天，0 點那條線兩邊其實是同一張盤，比過才知道要不要提醒。
  const ce = clockEdge(clk.clock);
  if (ce) {
    const o = ce.other;
    const alt = astro.bySolar(`${o.y}-${o.m}-${o.d}`, timeIndexOf(o.h), gender, true, 'zh-TW');
    const ming = (c) => {
      const p = c.palaces.find((q) => q.name === '命宮');
      return `「${c.earthlyBranchOfSoulPalace}」宮（${p && p.majorStars.length ? p.majorStars.map((s) => s.name).join('、') : '沒有主星'}）`;
    };
    if (ming(alt) !== ming(chart)) {
      uncertain.push(`${clockEdgeLead(clk.clock, ce)}就是${alt.time}，命宮會在${ming(alt)}，不是現在的${ming(chart)}。出生證明的時間如果是約略記的，兩張盤都參考。`);
    }
  }
  const palaces = chart.palaces.map((p) => ({
    index: p.index,
    name: p.name,
    stem: p.heavenlyStem,
    branch: p.earthlyBranch,
    isBody: p.isBodyPalace,
    major: p.majorStars.map(star),
    minor: p.minorStars.map(star),
    adjective: p.adjectiveStars.map((s) => s.name),
    decadal: p.decadal.range,
    grid: GRID[p.earthlyBranch],
  }));
  let horoscope = null;
  if (at) {
    const hs = chart.horoscope(`${at.y}-${at.m}-${at.d}`);
    horoscope = {
      age: hs.age ? hs.age.nominalAge : null,
      decadalIndex: hs.decadal.index,
      yearlyIndex: hs.yearly.index,
      yearlyMutagen: hs.yearly.mutagen,
      yearlyStemBranch: `${hs.yearly.heavenlyStem}${hs.yearly.earthlyBranch}`,
    };
  }
  return {
    ok: true,
    school,
    notes: clk.notes,
    uncertain,
    gender,
    solarDate: chart.solarDate,
    lunarDate: chart.lunarDate,
    chineseDate: chart.chineseDate,
    time: `${chart.time}（${chart.timeRange}）`,
    zodiac: chart.zodiac,
    soul: chart.soul,
    body: chart.body,
    fiveElementsClass: chart.fiveElementsClass,
    soulBranch: chart.earthlyBranchOfSoulPalace,
    bodyBranch: chart.earthlyBranchOfBodyPalace,
    palaces,
    horoscope,
  };
}
