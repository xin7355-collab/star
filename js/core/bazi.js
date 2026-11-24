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
const GAN_CHONG = pairSet([['甲', '庚'], ['乙', '辛'], ['丙', '壬'], ['丁', '癸']]);
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
 * 十二長生（星運）：日主在某個地支的狀態。公式同 lunar-typescript 的 EightChar.getDiShi，
 * 但套在我們自己排的四柱上：海外出生時，函式庫 EightChar 的日柱可能和我們依當地時間排的不同。
 */
export function changSheng(dayGan, zhi) {
  const gi = GAN.indexOf(dayGan);
  const zi = ZHI.indexOf(zhi);
  const i = (((LunarUtil.CHANG_SHENG_OFFSET[dayGan] + (gi % 2 === 0 ? zi : -zi)) % 12) + 12) % 12;
  return tw(LunarUtil.CHANG_SHENG[i]);
}

/** 胎元、命宮、身宮（公式同 lunar-typescript 的 EightChar，改吃我們的四柱；沒有時柱就不算命宮、身宮） */
export function palacesOf(yearGan, monthGan, monthZhi, timeZhi) {
  const MZ = LunarUtil.MONTH_ZHI; // 以寅為 1 的地支順序
  const G1 = LunarUtil.GAN; // 以甲為 1
  const taiYuan = GAN[(GAN.indexOf(monthGan) + 1) % 10] + ZHI[(ZHI.indexOf(monthZhi) + 3) % 12];
  if (!timeZhi) return { taiYuan, mingGong: null, shenGong: null };
  const ganOf = (offset) => {
    let gi = (GAN.indexOf(yearGan) + 1) * 2 + offset;
    while (gi > 10) gi -= 10;
    return G1[gi];
  };
  let off = MZ.indexOf(monthZhi) + MZ.indexOf(timeZhi);
  off = (off >= 14 ? 26 : 14) - off;
  let off2 = MZ.indexOf(monthZhi) + LunarUtil.ZHI.indexOf(timeZhi);
  if (off2 > 12) off2 -= 12;
  return { taiYuan, mingGong: ganOf(off) + MZ[off], shenGong: ganOf(off2) + MZ[off2] };
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
  // 十二長生、日柱空亡（旬空）、胎元、命宮、身宮
  const kong = LunarUtil.getXunKong(dayGz);
  result.extra = {
    changSheng: pillars.map((p) => (p ? changSheng(dayGan, p.zhi) : null)),
    kong,
    kongPillars: pillars.filter((p) => p && p.label !== '日柱' && kong.includes(p.zhi)).map((p) => p.label),
    ...palacesOf(yearGz[0], monthGz[0], monthGz[1], timeGz ? timeGz[1] : null),
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
// 權重用「十分之一」的整數計：0.3 這類小數相加會有誤差（4.2÷10.5 算成 0.39999…），
// 剛好 40% 的盤曾被判成身弱、畫面卻寫「占 40%」，自相矛盾。整數比較就沒有這個問題。
const STEM_W = 10;
const BRANCH_W = 10;
const MONTH_W = 30; // 月令（月支）最重要：同一個字在月支的影響力約是其他位置的三倍（扶抑法的通則）
const SIDE_QI_W = 3; // 地支藏干的中氣、餘氣
const HE_HUA = { 甲: ['己', '土'], 己: ['甲', '土'], 乙: ['庚', '金'], 庚: ['乙', '金'], 丙: ['辛', '水'], 辛: ['丙', '水'], 丁: ['壬', '木'], 壬: ['丁', '木'], 戊: ['癸', '火'], 癸: ['戊', '火'] };

/** 兩個天干的關係：五合（甲己、乙庚、丙辛、丁壬、戊癸）或相沖（甲庚、乙辛、丙壬、丁癸），都不是回傳空字串 */
export function ganRelation(a, b) {
  if (HE_HUA[a] && HE_HUA[a][0] === b) return '五合';
  if (has(GAN_CHONG, a, b)) return '相沖';
  return '';
}

/** 依身強弱決定喜用（扶抑法） */
function pickByStrength(strength, dm, weight) {
  const bi = weight[dm];
  const yin = weight[MOTHER[dm]];
  if (strength === '身弱') {
    return { primary: MOTHER[dm], secondary: dm, avoid: [OFFICER_OF[dm], WEALTH_OF[dm]], reason: `身弱需要生扶：取生你的「${MOTHER[dm]}」（印）為主，同類的「${dm}」（比劫）為輔。` };
  }
  if (strength === '身強') {
    return yin > bi
      ? { primary: WEALTH_OF[dm], secondary: CHILD[dm], avoid: [MOTHER[dm], dm], reason: `身強而且主要是印（生你的${MOTHER[dm]}）多：取「${WEALTH_OF[dm]}」（財）為主，財能制印，把多的能量變成成果；「${CHILD[dm]}」（食傷）為輔，食傷生財。` }
      : { primary: OFFICER_OF[dm], secondary: WEALTH_OF[dm], avoid: [MOTHER[dm], dm], reason: `身強而且主要是比劫（同類的${dm}）多：取「${OFFICER_OF[dm]}」（官殺）為主，用規矩與目標約束過旺的自己；「${WEALTH_OF[dm]}」（財）為輔，財生官殺。` };
  }
  const sorted = [...WUXING].sort((a, b) => weight[a] - weight[b]);
  return { primary: sorted[0], secondary: sorted[1], avoid: [sorted[4]], reason: `日主力量中和：取最弱的「${sorted[0]}」補平衡，其次是「${sorted[1]}」。` };
}

/**
 * 忌神為什麼不好，依身強弱講：身強的忌是幫身的五行（已經夠旺）；身弱的忌是剋身的官殺、耗身的財；
 * 中和的忌是最多的那個五行。不能一律說「已經夠多」——身弱的人忌官殺，是因為官殺剋身，不是因為它多。
 */
export function avoidReason(ys) {
  if (!ys) return '';
  if (ys.strength === '身強') return '你本身已經夠旺，再加會過頭';
  if (ys.strength === '身弱') return '它會剋你或耗你的力';
  return '它已經最多，再加會失衡';
}

// 三會方、三合局（專旺格要地支成方或成局，避免只是「比劫偏多」的一般盤被當成專旺）
const SAN_HUI = { 木: ['寅', '卯', '辰'], 火: ['巳', '午', '未'], 金: ['申', '酉', '戌'], 水: ['亥', '子', '丑'] };
const SAN_HE_JU = { 木: ['亥', '卯', '未'], 火: ['寅', '午', '戌'], 金: ['巳', '酉', '丑'], 水: ['申', '子', '辰'] };
const KE_OF = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' }; // 剋某五行的五行

/**
 * 可能的特殊格局（化氣、從格、專旺）。命理書對這類盤的喜用和扶抑法相反，App 不替使用者選邊，
 * 只把另一派的看法並列出來。條件取各派共通、最嚴格的部分：寬鬆的條件在 4032 個樣本盤裡會標出一成四，
 * 遠多於命理書說的「少數」，反而讓一般人誤以為自己是特殊格局。現在的條件：從格 0.4%、化氣 0.8%、專旺 0.3%。
 */
function specialPattern(bazi, dm, weight, ratio) {
  const [, month, day, hour] = bazi.pillars;
  const monthWx = ZHI_WX[month.zhi];
  const others = bazi.pillars.filter((p) => p && p.label !== '日柱');
  const branches = bazi.pillars.filter(Boolean).map((p) => p.zhi);
  const strongest = [...WUXING].sort((a, b) => weight[b] - weight[a])[0];
  // 化氣：日干和月干或時干相合、化神當令且是全盤最旺，天干也沒有剋化神的字
  const hua = HE_HUA[day.gan];
  if (hua && [month, hour].some((p) => p && p.gan === hua[0]) && monthWx === hua[1] && strongest === hua[1] && !others.some((p) => p.ganWx === KE_OF[hua[1]])) {
    return { kind: '化氣', name: `化${hua[1]}格`, desc: `日主${day.gan}和旁邊的${hua[0]}相合，化出的「${hua[1]}」當令又是全盤最旺`, alt: { primary: hua[1], secondary: MOTHER[hua[1]] } };
  }
  // 從格：地支（連藏干都算）完全沒有比劫、印的根，天干的比劫印也就虛浮無根；幫身不到兩成，要跟從的五行又當令
  const rooted = bazi.pillars.some((p) => p && p.hidden.some((hg) => hg.wx === dm || hg.wx === MOTHER[dm]));
  const follow = [CHILD[dm], WEALTH_OF[dm], OFFICER_OF[dm]].sort((a, b) => weight[b] - weight[a])[0];
  if (ratio < 0.2 && !rooted && monthWx === follow) {
    const name = follow === WEALTH_OF[dm] ? '從財格' : follow === OFFICER_OF[dm] ? '從殺格' : '從兒格';
    return { kind: '從格', name, desc: `日主在地支和天干都沒有幫手、幫身的力量不到兩成，「${follow}」又特別旺`, alt: { primary: follow, secondary: follow === CHILD[dm] ? WEALTH_OF[dm] : follow === WEALTH_OF[dm] ? CHILD[dm] : WEALTH_OF[dm] } };
  }
  // 專旺：日主當令、地支成方或成局、整盤沒有剋日主的字（土的稼穡格要辰戌丑未四庫）
  const officer = OFFICER_OF[dm];
  const hasOfficer = others.some((p) => p.ganWx === officer) || bazi.pillars.some((p) => p && p.zhiWx === officer);
  const formed = dm === '土' ? ['辰', '戌', '丑', '未'].every((z) => branches.includes(z)) : [SAN_HUI[dm], SAN_HE_JU[dm]].some((g) => g.every((z) => branches.includes(z)));
  if (ratio >= 0.6 && monthWx === dm && formed && !hasOfficer) {
    return { kind: '專旺', name: '專旺格', desc: `日主當令、地支成「${dm}」的方或局，整盤又沒有剋它的「${officer}」`, alt: { primary: dm, secondary: CHILD[dm] } };
  }
  return null;
}

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
 * 4. 落在門檻 ±2% 內的盤（樣本中 14.8%）標成「分界附近」，並列另一種看法；可能是化氣、從格、專旺的盤（合計約 1.5%），
 *    也並列另一派的喜用。主要的喜用仍取扶抑法，其他模組（開運、幸運色、姓名）不會因為「可能」而整套翻轉。
 */
export function yongShen(bazi) {
  if (!bazi || !bazi.ok || !Array.isArray(bazi.pillars)) return null;
  const dm = bazi.dayMaster.wx;
  const w10 = Object.fromEntries(WUXING.map((w) => [w, 0]));
  for (const p of bazi.pillars.filter(Boolean)) {
    if (p.label !== '日柱') w10[p.ganWx] += STEM_W;
    w10[p.zhiWx] += p.label === '月柱' ? MONTH_W : BRANCH_W;
    for (const hg of p.hidden.slice(1)) w10[hg.wx] += SIDE_QI_W;
  }
  const self = w10[dm] + w10[MOTHER[dm]];
  const total = WUXING.reduce((a, w) => a + w10[w], 0);
  const ratio = total ? self / total : 0.5;
  // 整數比較：self/total ≥ 1/2 身強；self/total < 2/5 身弱
  const strength = self * 2 >= total ? '身強' : self * 5 < total * 2 ? '身弱' : '中和';
  const near40 = Math.abs(self * 100 - total * 40) <= total * 2;
  const near50 = Math.abs(self * 100 - total * 50) <= total * 2;
  const monthZhi = bazi.pillars[1].zhi;
  const monthWx = ZHI_WX[monthZhi];
  const deLing = monthWx === dm || monthWx === MOTHER[dm];
  const reasons = [`日主「${bazi.dayMaster.gan}${dm}」生在${monthZhi}月：月令屬${monthWx}，${deLing ? `${monthWx === dm ? '和日主同五行' : `${monthWx}生${dm}`}，算「得令」` : '不幫日主，算「失令」'}。`];
  reasons.push(`幫身的力量（比劫＋印）占 ${Math.round(ratio * 100)}%：${strength}。`);
  const pick = pickByStrength(strength, dm, w10);
  reasons.push(pick.reason);
  let alt = null;
  if (near40 || near50) {
    const other = near50 ? (strength === '身強' ? '中和' : '身強') : (strength === '身弱' ? '中和' : '身弱');
    const o = pickByStrength(other, dm, w10);
    alt = { strength: other, primary: o.primary, secondary: o.secondary };
    reasons.push(`幫身的比例在分界附近（差不到 2%）：也有人會看成「${other}」，那樣喜用會是「${o.primary}」。兩種都可以參考。`);
  }
  const special = specialPattern(bazi, dm, w10, ratio);
  if (special) {
    reasons.push(`這個盤可能是「${special.name}」：${special.desc}。有些派別認為要順著這股勢走，喜用會變成「${special.alt.primary}、${special.alt.secondary}」，和上面相反；兩種看法都列出來，參考就好。`);
  }
  let tiaohou = null;
  const c = bazi.wuxing.withHidden;
  if (['亥', '子', '丑'].includes(monthZhi) && c.火 <= 1) tiaohou = '冬天出生、八字偏寒：民間也重視用「火」調候（暖色、向陽、多運動），可以和喜用一起參考。';
  if (['巳', '午', '未'].includes(monthZhi) && c.水 <= 1) tiaohou = '夏天出生、八字偏燥：民間也重視用「水」調候（冷色、親水、多喝水），可以和喜用一起參考。';
  return {
    strength,
    ratio: Math.round(ratio * 100) / 100,
    weight: Object.fromEntries(WUXING.map((w) => [w, w10[w] / 10])),
    primary: pick.primary,
    secondary: pick.secondary,
    avoid: pick.avoid,
    roles: { primary: ROLE_NAME(dm, pick.primary), secondary: ROLE_NAME(dm, pick.secondary) },
    reasons,
    tiaohou,
    borderline: !!alt,
    alt,
    special,
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
  // 兩個地支只能算「半合」（含中間的旺支子午卯酉，例如申子）或「拱合」（外側兩支，例如申辰，力量較弱）；三支到齊才是三合局
  const sanHe = SAN_HE.find((g) => g.includes(a) && g.includes(b));
  if (sanHe) out.push(a === sanHe[1] || b === sanHe[1] ? '半合' : '拱合');
  if (has(LIU_CHONG, a, b)) out.push('六沖');
  if (has(XIANG_XING, a, b)) out.push('相刑');
  if (has(XIANG_HAI, a, b)) out.push('相害');
  if (has(XIANG_PO, a, b)) out.push('相破');
  return out;
}

const RELATION_TEXT = {
  六合: '和合，人際與合作的助力',
  半合: '同氣相助，容易得到支持',
  拱合: '暗中相助（拱合，力量比半合弱）',
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

// ── 神煞（子平通行查法；派別差異在註解裡說明）
// 天乙貴人：日干、年干都查（甲戊庚丑未、乙己子申、丙丁亥酉、壬癸卯巳、辛午寅；庚另有「午寅」一說，不採）
const TIANYI = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 壬: '卯巳', 癸: '卯巳', 辛: '午寅' };
const WENCHANG = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
// 羊刃只取陽干（祿前一位）；陰干有沒有羊刃各派不同，不論
const YANGREN = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
// 桃花、驛馬、華蓋：依年支或日支所在的三合局查
const SAN_HE_GROUP = (zhi) => SAN_HE.find((g) => g.includes(zhi));
const BY_GROUP = (g) => ({ 申子辰: { 桃花: '酉', 驛馬: '寅', 華蓋: '辰' }, 寅午戌: { 桃花: '卯', 驛馬: '申', 華蓋: '戌' }, 巳酉丑: { 桃花: '午', 驛馬: '亥', 華蓋: '丑' }, 亥卯未: { 桃花: '子', 驛馬: '巳', 華蓋: '未' } }[g.join('')]);
const KUIGANG = new Set(['庚辰', '庚戌', '壬辰', '戊戌']);
const SHENSHA_TEXT = {
  天乙貴人: '最吉的貴人星：遇到困難容易有人伸手幫忙，常能逢凶化吉。',
  文昌: '聰明好學、考運與文筆好，適合讀書、寫作、考證照。',
  祿神: '衣食有著落，靠自己的本事賺錢，工作運穩。',
  羊刃: '個性剛強、有魄力，做事果斷；也容易衝動，留意意外與口角。',
  桃花: '人緣好、有魅力，異性緣佳；感情上要分清楚欣賞和越界。',
  驛馬: '好動，適合跑業務、出差、外派；一生搬家或出國的機會多。',
  華蓋: '有藝術、宗教或哲學的天分，思想獨立，有時會覺得孤單。',
  魁罡: '日柱魁罡：個性剛直、聰明有決斷，愛恨分明；人生起伏較大，宜修身養性。',
};

/**
 * 命盤上的神煞：每一項列出落在哪幾柱。只列子平通行、各派爭議小的八種；
 * 神煞是輔助，判斷吉凶仍以日主強弱與喜用為主（畫面會講明）。
 */
export function shensha(bazi) {
  const [year, , day] = bazi.pillars;
  const pillars = bazi.pillars.filter(Boolean);
  const out = [];
  const where = (zhis, skip = null) => pillars.filter((p) => p !== skip && zhis.includes(p.zhi)).map((p) => p.label);
  const push = (name, at) => {
    const list = [...new Set(at)];
    if (list.length) out.push({ name, at: list, text: SHENSHA_TEXT[name] });
  };
  push('天乙貴人', [...where(TIANYI[day.gan]), ...where(TIANYI[year.gan])]);
  push('文昌', where(WENCHANG[day.gan]));
  push('祿神', where(LU[day.gan]));
  if (YANGREN[day.gan]) push('羊刃', where(YANGREN[day.gan]));
  for (const base of [year, day]) {
    const g = BY_GROUP(SAN_HE_GROUP(base.zhi));
    for (const name of ['桃花', '驛馬', '華蓋']) push(name, where(g[name], base));
  }
  // 同一個神煞從年支、日支各查到一次時合併
  const merged = [];
  for (const x of out) {
    const old = merged.find((m) => m.name === x.name);
    if (old) old.at = [...new Set([...old.at, ...x.at])];
    else merged.push(x);
  }
  if (KUIGANG.has(day.gan + day.zhi)) merged.push({ name: '魁罡', at: ['日柱'], text: SHENSHA_TEXT.魁罡 });
  return merged;
}

/** 某個五行對這張盤是喜、忌還是閒（流年、大運用） */
function toneOfWx(ys, wx) {
  if (!ys) return '';
  if (wx === ys.primary || wx === ys.secondary) return '喜';
  if (ys.avoid.includes(wx)) return '忌';
  return '平';
}
const GZ_TONE_TEXT = {
  喜喜: '天干、地支都是喜用：整體順，適合積極爭取。',
  喜平: '天干是喜用、地支平穩：前段較順，後段持平。',
  平喜: '天干平穩、地支是喜用：慢熱，越往後越順。',
  喜忌: '天干是喜用、地支是忌神：傳統說天干管上半段、地支管下半段，前順後難，好時機要把握。',
  忌喜: '天干是忌神、地支是喜用：先難後易，撐過前段就好轉。',
  平平: '天干、地支都不偏不倚：平穩，照自己的節奏走。',
  平忌: '地支是忌神：後段壓力較大，凡事預留餘地。',
  忌平: '天干是忌神：前段阻力較多，先穩住。',
  忌忌: '天干、地支都是忌神：壓力大的一段，守成為主，重大決定多想一步。',
};
/** 干支各自對照喜用：回傳 {gan, zhi, text} */
export function ganzhiTone(bazi, gz) {
  const ys = yongShen(bazi);
  if (!ys) return null;
  const gan = toneOfWx(ys, GAN_WX[gz[0]]);
  const zhi = toneOfWx(ys, ZHI_WX[gz[1]]);
  return { gan, zhi, ganWx: GAN_WX[gz[0]], zhiWx: ZHI_WX[gz[1]], text: GZ_TONE_TEXT[gan + zhi] };
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
    // 台灣命理最常提醒的四種：伏吟、天剋地沖（反吟）、歲運並臨、流年沖大運
    const triggers = [];
    for (const p of bazi.pillars.filter(Boolean)) {
      if (p.gan === gz[0] && p.zhi === zhi) triggers.push({ type: '伏吟', text: `流年${gz}和${p.label}一模一樣（伏吟）：${RELATION_SCOPE[p.label]}方面的事容易重複、反覆，宜靜不宜動。` });
      else if (has(GAN_CHONG, p.gan, gz[0]) && has(LIU_CHONG, p.zhi, zhi)) triggers.push({ type: '天剋地沖', text: `流年${gz}和${p.label}${p.gan}${p.zhi}天剋地沖（反吟）：${RELATION_SCOPE[p.label]}方面變動大，重大決定多想一步。` });
    }
    if (dayun && dayun.ganzhi === gz) triggers.push({ type: '歲運並臨', text: `流年和大運都是${gz}（歲運並臨）：這一年大運的影響加倍，好的更好、壞的更明顯。` });
    else if (dayun && has(LIU_CHONG, dayun.ganzhi[1], zhi)) triggers.push({ type: '沖大運', text: `流年${zhi}沖大運${dayun.ganzhi}的${dayun.ganzhi[1]}：這十年的運勢在這一年有轉折或變動。` });
    return {
      year,
      ganzhi: gz,
      animal: SHENGXIAO[ZHI.indexOf(zhi)],
      shishen: ss,
      shishenText: SHISHEN_TEXT[ss],
      tone: ganzhiTone(bazi, gz),
      relations,
      taisui: taiSui(personZhi, zhi),
      dayun,
      triggers,
    };
  });
}
