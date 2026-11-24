// 八字命盤、大運、流年、犯太歲。曆法交給 lunar-typescript（MIT，6tail）。
//
// 時間處理（命理排盤最容易錯的地方）：
// ・年柱、月柱看「節氣」這個絕對時刻：把出生時刻換成 UTC+8（函式庫的節氣以東八區計算）再排，
//   海外出生也不會錯月（參考 lilith-diviner / tianji 的作法）。
// ・日柱、時柱看當地時間：出生在日光節約時間時，自動扣回標準時間（台灣 1945–1979 年夏季要減 1 小時）；
//   可選用真太陽時（經度時差＋均時差，均時差公式參考 tianji，MIT）。
// ・23:00 起算隔天的子時（sect 1，同 lilith-diviner 的選擇）；可改成 0 點換日（sect 2）。
// 五行統計只看字面；喜用神用 yongShen（扶抑法簡化版）。解說文字為本 App 撰寫，僅供參考。

import { Solar, LunarUtil } from '../../vendor/lunar.js';
import { tw } from './zh.js';
import { localToUtc, offsetMinutes, formatOffset } from './tz.js';
import { folkZodiac, SHENGXIAO, ZHI } from './calendar.js';

export const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export { ZHI };
export const WUXING = ['木', '火', '土', '金', '水'];
const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };

const pairSet = (pairs) => new Set(pairs.map(([a, b]) => [a, b].sort().join('')));
const has = (set, a, b) => set.has([a, b].sort().join(''));
// 地支關係表（同 tianji fortune_calc.py，MIT）
const LIU_HE = pairSet([['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']]);
const SAN_HE = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];
const LIU_CHONG = pairSet([['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']]);
const XIANG_HAI = pairSet([['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']]);
const XIANG_XING = pairSet([['寅', '巳'], ['巳', '申'], ['寅', '申'], ['丑', '戌'], ['戌', '未'], ['丑', '未'], ['子', '卯']]);
const ZI_XING = new Set(['辰', '午', '酉', '亥']);
const XIANG_PO = pairSet([['子', '酉'], ['午', '卯'], ['申', '巳'], ['寅', '亥'], ['辰', '丑'], ['戌', '未']]);

const isYang = (gan) => GAN.indexOf(gan) % 2 === 0;
const gen = (wx) => WUXING[(WUXING.indexOf(wx) + 1) % 5]; // 我生
const ovc = (wx) => WUXING[(WUXING.indexOf(wx) + 2) % 5]; // 我剋

/** 十神：以日主看其他天干 */
export function shiShen(dayGan, otherGan) {
  const a = GAN_WX[dayGan];
  const b = GAN_WX[otherGan];
  const same = isYang(dayGan) === isYang(otherGan);
  if (a === b) return same ? '比肩' : '劫財';
  if (gen(a) === b) return same ? '食神' : '傷官';
  if (ovc(a) === b) return same ? '偏財' : '正財';
  if (ovc(b) === a) return same ? '七殺' : '正官';
  return same ? '偏印' : '正印';
}

export const SHISHEN_TEXT = {
  比肩: '同儕與朋友的力量變強，適合合作，但各有主見，權責要先講清楚。',
  劫財: '社交與開銷變多，留意衝動消費、借貸與合夥的金錢往來。',
  食神: '心情較放鬆，創意、口福與學才藝的運氣不錯，適合享受生活。',
  傷官: '表達欲強、想突破框架，有利創作；說話與面對規章時多留一分餘地。',
  偏財: '機會財與人脈帶來收入的機會增加，投資理財記得設停損。',
  正財: '正職收入穩定，適合理財規劃、腳踏實地累積。',
  七殺: '壓力與挑戰增加，也是展現魄力的時機；留意健康與行車安全。',
  正官: '責任、考核與升遷相關的事變多，守規矩、按部就班較順利。',
  偏印: '想法獨特，適合進修、研究、學專業技能；留意想太多或孤單感。',
  正印: '貴人、長輩與學習運較佳，適合考證照、充電與照顧身心。',
};

const WX_TEXT = {
  木: '木：重成長與規劃，仁厚、有理想，像樹一樣需要空間慢慢長大。',
  火: '火：熱情、外向、重表現，行動快，也需要學會讓情緒降溫。',
  土: '土：穩重、包容、重承諾，是團體裡讓人安心的角色。',
  金: '金：講原則、果斷、重效率，做事有標準，也要記得柔軟。',
  水: '水：聰明、靈活、善於溝通與適應，想得多，需要找到方向。',
};

const PILLAR_NAMES = ['年柱', '月柱', '日柱', '時柱'];
const RELATION_SCOPE = { 年柱: '家庭長輩與大環境', 月柱: '工作與兄弟同儕', 日柱: '自己與伴侶', 時柱: '子女晚輩與規劃' };

function fieldsOf(ms) {
  const t = new Date(ms);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes() };
}

function eightChar({ y, m, d, h, mi }, sect) {
  const ec = Solar.fromYmdHms(y, m, d, h, mi, 0).getLunar().getEightChar();
  ec.setSect(sect);
  return ec;
}

/** 均時差（分鐘）：真太陽時 − 平太陽時。公式同 tianji calc_true_solar_time（MIT） */
export function equationOfTime(utcMs) {
  const n = utcMs / 86400000 + 2440587.5 - 2451545.0;
  const rad = Math.PI / 180;
  const L = (((280.46 + 0.9856474 * n) % 360) + 360) % 360;
  const g = ((((357.528 + 0.9856003 * n) % 360) + 360) % 360) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;
  const y = Math.tan(eps / 2) ** 2;
  const e = 0.0167;
  const Lr = L * rad;
  const eot = y * Math.sin(2 * Lr) - 2 * e * Math.sin(g) + 4 * e * y * Math.sin(g) * Math.cos(2 * Lr)
    - 0.5 * y * y * Math.sin(4 * Lr) - 1.25 * e * e * Math.sin(2 * g);
  return (eot / rad) * 4;
}

/**
 * 排盤用的時間。
 * @returns {{ok:true, instantUtc:number, clock:{y,m,d,h,mi}, notes:string[]} | {ok:false, error:string, needFold?:boolean}}
 */
export function baziClock({ date, time, tz, place, fold }, { solarTime = 'standard' } = {}) {
  const conv = localToUtc({ ...date, h: time.h, mi: time.mi }, tz, fold);
  if (conv.status === 'nonexistent') return { ok: false, error: '這個時刻因日光節約時間被跳過，在當地不存在，請核對出生證明。' };
  if (conv.status === 'ambiguous') return { ok: false, needFold: true, error: '這個時刻因日光節約時間結束出現兩次，請先在「我的」選擇第一次或第二次。' };
  const utc = conv.utcMs;
  const notes = [];
  const off = offsetMinutes(utc, tz);
  const std = Math.min(offsetMinutes(Date.UTC(date.y, 0, 1, 12), tz), offsetMinutes(Date.UTC(date.y, 6, 1, 12), tz));
  if (off > std) {
    notes.push(`出生時是日光節約時間（${formatOffset(off)}），已換回標準時間（${formatOffset(std)}）排盤，也就是減 ${(off - std) / 60} 小時。`);
  }
  let clockMs = utc + std * 60000;
  if (solarTime === 'true') {
    if (place) {
      const lonMin = place.lon * 4;
      const eot = equationOfTime(utc);
      clockMs = utc + (lonMin + eot) * 60000;
      notes.push(`使用真太陽時：經度修正 ${Math.round(lonMin - std)} 分、均時差 ${Math.round(eot)} 分。`);
    } else {
      notes.push('沒有出生地，無法換算真太陽時，改用標準時間。');
    }
  }
  return { ok: true, instantUtc: utc, clock: fieldsOf(clockMs), notes };
}

function pillar(label, gan, zhi, dayGan) {
  const hidden = (LunarUtil.ZHI_HIDE_GAN[zhi] || []).map((g) => ({ gan: g, wx: GAN_WX[g], shishen: shiShen(dayGan, g) }));
  return {
    label,
    gan,
    zhi,
    ganWx: GAN_WX[gan],
    zhiWx: ZHI_WX[zhi],
    shishen: label === '日柱' ? '日主' : shiShen(dayGan, gan),
    hidden,
    nayin: tw(LunarUtil.NAYIN[gan + zhi] || ''),
  };
}

/**
 * 八字命盤。
 * @param {{date, time, tz, place, fold}} input  與 natal.js 相同的出生資料
 * @param {{gender?:'男'|'女'|null, sect?:1|2, solarTime?:'standard'|'true', today?:{y,m,d}}} options
 */
export function buildBazi(input, { gender = null, sect = 1, solarTime = 'standard', today = null } = {}) {
  const notes = [];
  const uncertain = [];
  let yearMonthEc;
  let dayTimeEc = null;
  let instantFields;
  let dayFields;

  if (input.time) {
    const clk = baziClock(input, { solarTime });
    if (!clk.ok) return clk;
    notes.push(...clk.notes);
    instantFields = fieldsOf(clk.instantUtc + 8 * 3600000);
    dayFields = clk.clock;
    yearMonthEc = eightChar(instantFields, sect);
    dayTimeEc = eightChar(dayFields, sect);
  } else {
    // 沒有時間：用當天中午排三柱；若當天交節氣，列出另一個可能的月柱／年柱
    dayFields = { ...input.date, h: 12, mi: 0 };
    instantFields = dayFields;
    yearMonthEc = eightChar(dayFields, sect);
    const early = eightChar({ ...input.date, h: 0, mi: 0 }, sect);
    const late = eightChar({ ...input.date, h: 23, mi: 59 }, 2);
    if (early.getMonth() !== late.getMonth()) uncertain.push(`出生當天交節氣，月柱可能是 ${early.getMonth()} 或 ${late.getMonth()}，補上出生時間才能確定。`);
    if (early.getYear() !== late.getYear()) uncertain.push(`出生當天是立春，年柱可能是 ${early.getYear()} 或 ${late.getYear()}。`);
    notes.push('沒有出生時間：只排年、月、日三柱，時柱與起運歲數無法確定。');
  }

  const dayEc = dayTimeEc || yearMonthEc;
  const yearGz = yearMonthEc.getYear();
  const monthGz = yearMonthEc.getMonth();
  const dayGz = dayEc.getDay();
  const timeGz = dayTimeEc ? dayTimeEc.getTime() : null;
  const dayGan = dayGz[0];

  const pillars = [
    pillar('年柱', yearGz[0], yearGz[1], dayGan),
    pillar('月柱', monthGz[0], monthGz[1], dayGan),
    pillar('日柱', dayGz[0], dayGz[1], dayGan),
    timeGz ? pillar('時柱', timeGz[0], timeGz[1], dayGan) : null,
  ];

  const counts = Object.fromEntries(WUXING.map((w) => [w, 0]));
  const withHidden = Object.fromEntries(WUXING.map((w) => [w, 0]));
  for (const p of pillars.filter(Boolean)) {
    counts[p.ganWx] += 1;
    counts[p.zhiWx] += 1;
    withHidden[p.ganWx] += 1;
    for (const hg of p.hidden) withHidden[hg.wx] += 1;
  }

  const result = {
    ok: true,
    sect,
    solarTime,
    clockText: input.time ? `${dayFields.y}-${String(dayFields.m).padStart(2, '0')}-${String(dayFields.d).padStart(2, '0')} ${String(dayFields.h).padStart(2, '0')}:${String(dayFields.mi).padStart(2, '0')}` : null,
    notes,
    uncertain,
    pillars,
    dayMaster: { gan: dayGan, wx: GAN_WX[dayGan], yinYang: isYang(dayGan) ? '陽' : '陰', text: WX_TEXT[GAN_WX[dayGan]] },
    wuxing: { counts, withHidden, missing: WUXING.filter((w) => counts[w] === 0) },
    zodiac: folkZodiac(input.date),
    yun: null,
  };

  if (gender === '男' || gender === '女') {
    // 起運用出生的絕對時刻計算（與節氣距離），以分鐘數換算（sect 2，同 lilith-diviner）
    const yun = yearMonthEc.getYun(gender === '男' ? 1 : 0, 2);
    const nowYear = (today || {}).y || new Date().getFullYear();
    const list = yun.getDaYun(10).slice(1).map((dy) => {
      const gz = dy.getGanZhi();
      return {
        ganzhi: gz,
        startYear: dy.getStartYear(),
        endYear: dy.getEndYear(),
        startAge: dy.getStartAge(),
        endAge: dy.getEndAge(),
        shishen: shiShen(dayGan, gz[0]),
        current: nowYear >= dy.getStartYear() && nowYear <= dy.getEndYear(),
      };
    });
    result.yun = {
      forward: yun.isForward(),
      start: { years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay() },
      approx: !input.time,
      list,
    };
  } else {
    notes.push('沒有選性別：大運順逆行要看性別，暫不排大運。');
  }
  return result;
}

// 五行生剋：生我＝印、我生＝食傷、我剋＝財、剋我＝官殺
const MOTHER = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };
const CHILD = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const WEALTH_OF = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
const OFFICER_OF = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' };
const ROLE_NAME = (dm, wx) => (wx === dm ? '比劫' : wx === MOTHER[dm] ? '印' : wx === CHILD[dm] ? '食傷' : wx === WEALTH_OF[dm] ? '財' : '官殺');
const MONTH_WEIGHT = 3; // 月令（月支）最重要：同一個字在月支的影響力約是其他位置的三倍（扶抑法的通則）
const SIDE_QI = 0.3; // 地支藏干的中氣、餘氣

/**
 * 喜用神（扶抑法，簡化版）。
 * 為什麼不用「缺什麼補什麼」：五行最少的那個，可能正好是讓本來就弱的日主更弱的五行（例如身弱還去補財），
 * 和命理書的主流看法相反；開運佈置、幸運色、樂透尾數、姓名搭配都改用這裡的結果，全 App 說法一致。
 * 1. 日主力量：天干各 1，地支本氣各 1、月支本氣 3，藏干中氣餘氣各 0.3；同五行（比劫）與生我（印）算幫身。
 * 2. 幫身的力量不小於剋洩耗（占 50% 以上）算身強，不到 40% 算身弱，中間算中和。
 *    1950–2010 年取 4032 個樣本盤：身強 32%、中和 15%、身弱 53%（比劫＋印只占五行中的兩種，所以身弱較多）。
 * 3. 身弱喜印、比劫；身強時幫身主要來自印就喜財（財制印）、食傷為輔（食傷生財），
 *    主要來自比劫就喜官殺（官殺制比劫）、財為輔（財生官殺）。輔助的五行要和主要的相生，不能互剋（例如官殺配食傷會互相抵消）；
 *    中和取最弱的五行。另外冬天出生缺火、夏天出生缺水時，附上「調候」的提醒。
 */
export function yongShen(bazi) {
  if (!bazi || !bazi.ok || !Array.isArray(bazi.pillars)) return null;
  const dm = bazi.dayMaster.wx;
  const weight = Object.fromEntries(WUXING.map((w) => [w, 0]));
  for (const p of bazi.pillars.filter(Boolean)) {
    if (p.label !== '日柱') weight[p.ganWx] += 1;
    weight[p.zhiWx] += p.label === '月柱' ? MONTH_WEIGHT : 1;
    for (const hg of p.hidden.slice(1)) weight[hg.wx] += SIDE_QI;
  }
  const round = (n) => Math.round(n * 100) / 100;
  const bi = weight[dm];
  const yin = weight[MOTHER[dm]];
  const self = bi + yin;
  const total = WUXING.reduce((a, w) => a + weight[w], 0);
  const ratio = total ? self / total : 0.5;
  const strength = ratio >= 0.5 ? '身強' : ratio < 0.4 ? '身弱' : '中和';
  const monthZhi = bazi.pillars[1].zhi;
  const monthWx = ZHI_WX[monthZhi];
  const deLing = monthWx === dm || monthWx === MOTHER[dm];
  const reasons = [`日主「${bazi.dayMaster.gan}${dm}」生在${monthZhi}月：月令屬${monthWx}，${deLing ? `${monthWx === dm ? '和日主同五行' : `${monthWx}生${dm}`}，算「得令」` : '不幫日主，算「失令」'}。`];
  reasons.push(`幫身的力量（比劫＋印）占 ${Math.round(ratio * 100)}%：${strength}。`);
  let primary;
  let secondary;
  let avoid;
  if (strength === '身弱') {
    primary = MOTHER[dm];
    secondary = dm;
    avoid = [OFFICER_OF[dm], WEALTH_OF[dm]];
    reasons.push(`身弱需要生扶：取生你的「${primary}」（印）為主，同類的「${secondary}」（比劫）為輔。`);
  } else if (strength === '身強') {
    primary = yin > bi ? WEALTH_OF[dm] : OFFICER_OF[dm];
    secondary = yin > bi ? CHILD[dm] : WEALTH_OF[dm];
    avoid = [MOTHER[dm], dm];
    reasons.push(yin > bi
      ? `身強而且主要是印（生你的${MOTHER[dm]}）多：取「${primary}」（財）為主，財能制印，把多的能量變成成果；「${secondary}」（食傷）為輔，食傷生財。`
      : `身強而且主要是比劫（同類的${dm}）多：取「${primary}」（官殺）為主，用規矩與目標約束過旺的自己；「${secondary}」（財）為輔，財生官殺。`);
  } else {
    const sorted = [...WUXING].sort((a, b) => weight[a] - weight[b]);
    [primary, secondary] = sorted;
    avoid = [sorted[4]];
    reasons.push(`日主力量中和：取最弱的「${primary}」補平衡，其次是「${secondary}」。`);
  }
  let tiaohou = null;
  const c = bazi.wuxing.withHidden;
  if (['亥', '子', '丑'].includes(monthZhi) && c.火 <= 1) tiaohou = '冬天出生、八字偏寒：民間也重視用「火」調候（暖色、向陽、多運動），可以和喜用一起參考。';
  if (['巳', '午', '未'].includes(monthZhi) && c.水 <= 1) tiaohou = '夏天出生、八字偏燥：民間也重視用「水」調候（冷色、親水、多喝水），可以和喜用一起參考。';
  return {
    strength,
    ratio: round(ratio),
    weight: Object.fromEntries(WUXING.map((w) => [w, round(weight[w])])),
    primary,
    secondary,
    avoid,
    roles: { primary: ROLE_NAME(dm, primary), secondary: ROLE_NAME(dm, secondary) },
    reasons,
    tiaohou,
  };
}

/** 某個西元年的流年干支（以立春為界的那一年） */
export function yearGanZhi(year) {
  const i = (((year - 4) % 60) + 60) % 60;
  return GAN[i % 10] + ZHI[i % 12];
}

/** 兩個地支的關係（可能同時有好幾種） */
export function branchRelations(a, b) {
  const out = [];
  if (a === b) {
    out.push('同支');
    if (ZI_XING.has(a)) out.push('自刑');
    return out;
  }
  if (has(LIU_HE, a, b)) out.push('六合');
  if (SAN_HE.some((g) => g.includes(a) && g.includes(b))) out.push('三合');
  if (has(LIU_CHONG, a, b)) out.push('六沖');
  if (has(XIANG_XING, a, b)) out.push('相刑');
  if (has(XIANG_HAI, a, b)) out.push('相害');
  if (has(XIANG_PO, a, b)) out.push('相破');
  return out;
}

const RELATION_TEXT = {
  六合: '和合，人際與合作的助力',
  三合: '同氣相助，容易得到支持',
  六沖: '變動與拉扯，宜預留彈性',
  相刑: '摩擦與規範壓力，留意健康與法規',
  相害: '小人或誤會，溝通要清楚',
  相破: '計畫容易被打亂，重要事多確認',
  自刑: '自我要求高，容易鑽牛角尖',
};

/**
 * 犯太歲（民俗：以農曆生肖對照流年地支）
 * @returns {string[]} 例如 ['值太歲','刑太歲']；空陣列 = 沒有犯太歲
 */
export function taiSui(personZhi, yearZhi) {
  const rel = branchRelations(personZhi, yearZhi);
  const out = [];
  if (rel.includes('同支')) out.push('值太歲');
  if (rel.includes('六沖')) out.push('沖太歲');
  if (rel.includes('相刑') || rel.includes('自刑')) out.push('刑太歲');
  if (rel.includes('相害')) out.push('害太歲');
  if (rel.includes('相破')) out.push('破太歲');
  return out;
}

/** 某年犯太歲的生肖一覽 */
export function taiSuiList(year) {
  const yz = yearGanZhi(year)[1];
  return ZHI.map((z, i) => ({ zhi: z, animal: SHENGXIAO[i], types: taiSui(z, yz) })).filter((x) => x.types.length);
}

/**
 * 流年：日主看流年天干的十神，流年地支與命盤四柱地支的關係，加上犯太歲。
 * @param bazi buildBazi 的結果
 * @param {number[]} years 西元年
 */
export function liunian(bazi, years) {
  const dayGan = bazi.dayMaster.gan;
  const personZhi = ZHI[bazi.zodiac.index];
  return years.map((year) => {
    const gz = yearGanZhi(year);
    const zhi = gz[1];
    const ss = shiShen(dayGan, gz[0]);
    const relations = [];
    for (const p of bazi.pillars.filter(Boolean)) {
      for (const r of branchRelations(p.zhi, zhi)) {
        if (r === '同支') continue;
        relations.push({ pillar: p.label, type: r, text: `流年${zhi}與${p.label}${p.zhi}${r}：${RELATION_SCOPE[p.label]}方面${RELATION_TEXT[r]}。` });
      }
    }
    const dayun = bazi.yun ? bazi.yun.list.find((d) => year >= d.startYear && year <= d.endYear) || null : null;
    return {
      year,
      ganzhi: gz,
      animal: SHENGXIAO[ZHI.indexOf(zhi)],
      shishen: ss,
      shishenText: SHISHEN_TEXT[ss],
      relations,
      taisui: taiSui(personZhi, zhi),
      dayun,
    };
  });
}
