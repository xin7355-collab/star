// 偏財運與樂透幸運號碼。
//
// 偏財＝薪水以外的錢：獎金、中獎、投資收益、副業、意外之財。指數把幾個系統的看法加起來，每一項都列依據：
// ・八字：流日／流月天干對你日主是不是「偏財」「正財」，或「食神、傷官」（食傷生財）；比肩劫財則容易破財。
//   本命盤看天生的偏財緣（偏財星多寡）與「身能不能擔財」（日主力量和財星力量的比較，簡化版）。
// ・紫微：財帛宮主星、祿存、化祿、化忌、火貪／鈴貪格，以及流年化祿化忌落在哪裡（有命盤才看）。
// ・星座：當天的財運分數（金星、木星等行運，fortune.js）。
// ・生命靈數：流日數（8 跟財務與機會最有關）。
//
// 樂透號碼：每天固定一組（同一個人、同一天、同一種彩券不會變），依你的喜用五行（河圖數）、生日、靈數加權抽出。
// 一定要講清楚：任何一組號碼中獎機率都一樣，幸運號碼只是好玩，不會提高中獎機率。

import { Solar } from '../../vendor/lunar.js';
import { tw } from './zh.js';
import { shiShen, yongShen } from './bazi.js';
import { dayScores } from './fortune.js';
import { isoDate, addDays } from './date.js';
import { DEFAULT_TZ } from './tz.js';

const WUXING = ['木', '火', '土', '金', '水'];
const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const ovc = (wx) => WUXING[(WUXING.indexOf(wx) + 2) % 5]; // 我剋＝財
const mother = (wx) => WUXING[(WUXING.indexOf(wx) + 4) % 5]; // 生我＝印

const SHISHEN_WEALTH = { 偏財: 14, 正財: 8, 食神: 5, 傷官: 4, 比肩: -4, 劫財: -8, 七殺: -2 };
// 身弱的人：財星日看得到機會卻接不住（財多身弱），比劫、印幫身反而能任財——和身強的人相反（扶抑法）
const SHISHEN_WEALTH_WEAK = { 偏財: -4, 正財: -2, 食神: -1, 傷官: -2, 比肩: 6, 劫財: 4, 七殺: -6, 正官: -3, 正印: 4, 偏印: 2 };
const WEAK_LINE = {
  偏財: '是你的「偏財」，但你身弱：機會看得到、不一定接得住，量力而為',
  正財: '是你的「正財」，但你身弱：先顧好本業，別一次扛太多',
  比肩: '是你的「比肩」，你身弱，同類幫身反而接得住錢；合作的帳要算清楚',
  劫財: '是你的「劫財」，你身弱，朋友的助力能幫你接住機會；借錢、合夥仍要小心',
};
const wealthDelta = (ss, weak) => ((weak ? SHISHEN_WEALTH_WEAK[ss] : SHISHEN_WEALTH[ss]) || 0);
const SHISHEN_LINE = {
  偏財: '是你的「偏財」，意外之財、投資與副業的機會變多',
  正財: '是你的「正財」，正規收入與穩健理財有利',
  食神: '是你的「食神」，食傷生財：靠才華、人緣與口碑帶來收入',
  傷官: '是你的「傷官」，食傷生財：點子多、敢衝，但要控制風險',
  比肩: '是你的「比肩」，朋友多、分享多，錢容易被分走',
  劫財: '是你的「劫財」，容易衝動花錢、借錢或合夥出問題',
  七殺: '是你的「七殺」，壓力大時別用投機解決問題',
};

/** 天生偏財緣與「身能不能擔財」（簡化版，畫面上會註明） */
export function natalWealth(bazi) {
  if (!bazi || !bazi.ok) return null;
  const dm = bazi.dayMaster.gan;
  const dmWx = GAN_WX[dm];
  let pian = 0;
  let zheng = 0;
  for (const p of bazi.pillars.filter(Boolean)) {
    if (p.label !== '日柱') {
      if (p.shishen === '偏財') pian += 1;
      if (p.shishen === '正財') zheng += 1;
    }
    for (const h of p.hidden) {
      if (h.shishen === '偏財') pian += 0.5;
      if (h.shishen === '正財') zheng += 0.5;
    }
  }
  const counts = bazi.wuxing.withHidden;
  const self = counts[dmWx] + counts[mother(dmWx)];
  const wealth = counts[ovc(dmWx)];
  const lines = [];
  if (pian >= 1.5) lines.push(`命盤裡偏財星有 ${pian} 個（含藏干算半個），天生和意外之財、投資、副業比較有緣。`);
  else if (pian > 0) lines.push('命盤裡有偏財星，但不算多：偏財偶爾有，主要還是靠正職與累積。');
  else lines.push('命盤裡沒有明顯的偏財星：你的錢比較適合靠專業與穩定累積，投機的勝率不高。');
  // 身強身弱一律用 yongShen（月令加權）的判斷：原本另外用字數比較，同一張盤會一邊寫「身弱」、一邊寫「身能擔財」
  const strength = yongShen(bazi).strength;
  if (wealth === 0) lines.push(`八字裡「${ovc(dmWx)}」（你的財星五行）幾乎沒有，賺錢要靠刻意規劃，而不是等機會。`);
  else if (strength !== '身弱') lines.push(`日主「${dm}${dmWx}」${strength}，撐得起財星，屬於「身能擔財」：機會來時接得住。`);
  else if (wealth >= self) lines.push(`日主「${dm}${dmWx}」偏弱、財星又旺，屬於「財多身弱」：機會多但容易累，量力而為、別貪多。`);
  else lines.push(`日主「${dm}${dmWx}」偏弱：求財前先把自己顧好（體力、專業、人脈），機會來了才接得住。`);
  return { pian, zheng, self, wealth, lines };
}

/** 紫微：財帛宮的偏財看法（有命盤才算） */
export function ziweiWealth(ziwei) {
  if (!ziwei || !ziwei.ok) return null;
  const cai = ziwei.palaces.find((p) => p.name === '財帛');
  const ming = ziwei.palaces.find((p) => p.name === '命宮');
  const names = (p) => [...p.major, ...p.minor].map((s) => s.name);
  const lines = [];
  let delta = 0;
  const major = cai.major.map((s) => s.name);
  if (major.some((n) => ['貪狼', '破軍', '七殺', '廉貞'].includes(n))) { delta += 4; lines.push(`財帛宮有${major.join('、')}：偏財型，賺錢方式多變、敢冒險，起伏也較大。`); }
  else if (major.some((n) => ['武曲', '天府', '太陰'].includes(n))) { delta += 2; lines.push(`財帛宮有${major.join('、')}：正財型，適合穩定累積與長期理財。`); }
  else if (major.length) lines.push(`財帛宮主星是${major.join('、')}，錢財看個人經營。`);
  else lines.push('財帛宮沒有主星（借對宮看），收入方式較受環境影響。');
  const all = [...cai.major, ...cai.minor];
  if (all.some((s) => s.mutagen === '化祿')) { delta += 5; lines.push('財帛宮有「化祿」：錢財來源順，賺錢機會多。'); }
  if (all.some((s) => s.mutagen === '化忌')) { delta -= 4; lines.push('財帛宮有「化忌」：錢財容易波動或放不下，投機要特別節制。'); }
  if (names(cai).includes('祿存')) { delta += 2; lines.push('財帛宮有祿存：守財能力好，存得住錢。'); }
  if (names(cai).some((n) => n === '地空' || n === '地劫')) { delta -= 3; lines.push('財帛宮有地空／地劫：錢來得快去得也快，先存再花。'); }
  for (const p of [cai, ming]) {
    const n = names(p);
    if (n.includes('貪狼') && (n.includes('火星') || n.includes('鈴星'))) { delta += 5; lines.push(`${p.name}有貪狼加${n.includes('火星') ? '火星' : '鈴星'}：民間說的「${n.includes('火星') ? '火貪' : '鈴貪'}格」，偏財有突發的機會。`); }
  }
  if (ziwei.horoscope) {
    const [lu, , , ji] = ziwei.horoscope.yearlyMutagen || [];
    const where = (star) => ziwei.palaces.find((p) => [...p.major, ...p.minor].some((s) => s.name === star));
    const luP = lu ? where(lu) : null;
    const jiP = ji ? where(ji) : null;
    if (luP && ['財帛', '命宮', '田宅', '福德'].includes(luP.name)) { delta += 4; lines.push(`今年流年化祿（${lu}）落在${luP.name}：今年財運有加分。`); }
    if (jiP && jiP.name === '財帛') { delta -= 4; lines.push(`今年流年化忌（${ji}）落在財帛宮：今年錢財多保守。`); }
  }
  return { delta, lines };
}

/** 生命靈數的流日數：生日月日＋當天年月日，加到個位數 */
export function personalDayNumber(birth, date) {
  let n = [birth.m, birth.d, date.y, date.m, date.d].join('').split('').reduce((a, c) => a + Number(c), 0);
  while (n > 9) n = String(n).split('').reduce((a, c) => a + Number(c), 0);
  return n;
}

const DAY_NUMBER_WEALTH = { 8: 8, 1: 3, 3: 3, 5: 3, 4: -3, 7: -3 };
const DAY_NUMBER_TEXT = {
  1: '新的開始，適合主動爭取', 2: '適合合作，不適合單打獨鬥', 3: '人緣好、運氣輕快', 4: '宜保守、按部就班', 5: '變化與機會多，但別衝動',
  6: '照顧家人與人情的日子', 7: '適合研究、思考，不宜冒險', 8: '財務與機會之日，適合處理錢的事', 9: '收尾與付出，不宜開新局',
};

const LEVELS = [
  [75, '偏財旺', '機會比較多的一天：可以留意獎金、副業、投資機會，但仍要量力而為。'],
  [60, '小有偏財', '有小確幸的機會，適合小額嘗試，見好就收。'],
  [45, '平穩', '偏財普通，把力氣放在本業與正財上比較划算。'],
  [0, '保守為宜', '不適合賭運氣：大額投資、借貸、博弈都先緩一緩，錢放在穩的地方。'],
];

/**
 * 某一天的偏財指數。
 * @param {{y,m,d}} date
 * @param {{bazi?:object, ziwei?:object, signIndex?:number|null, birth?:{y,m,d}|null, tz?:string}} options
 */
export function windfallDay(date, { bazi = null, ziwei = null, signIndex = null, birth = null, tz = DEFAULT_TZ } = {}) {
  const parts = [];
  let score = 50;
  const lunar = Solar.fromYmd(date.y, date.m, date.d).getLunar();
  if (bazi && bazi.ok) {
    const dm = bazi.dayMaster.gan;
    const dayGan = lunar.getDayGan();
    const monthGan = lunar.getMonthInGanZhiExact()[0];
    const ssDay = shiShen(dm, dayGan);
    const ssMonth = shiShen(dm, monthGan);
    const weak = yongShen(bazi)?.strength === '身弱';
    const dDay = wealthDelta(ssDay, weak);
    const dMonth = Math.round(wealthDelta(ssMonth, weak) / 2);
    score += dDay + dMonth;
    const line = (weak && WEAK_LINE[ssDay]) || SHISHEN_LINE[ssDay] || `是你的「${ssDay}」，和錢財關係不大`;
    parts.push({ system: '八字', delta: dDay + dMonth, text: `今天的日干「${dayGan}」${line}；這個月的月干「${monthGan}」是「${ssMonth}」。` });
    const nat = natalWealth(bazi);
    const base = nat.pian >= 1.5 ? 4 : nat.pian > 0 ? 1 : -3;
    score += base;
    parts.push({ system: '八字本命', delta: base, text: nat.lines[0] });
  }
  const zw = ziweiWealth(ziwei);
  if (zw) {
    const d = Math.max(-8, Math.min(8, zw.delta));
    score += d;
    parts.push({ system: '紫微', delta: d, text: zw.lines.join('') });
  }
  if (signIndex !== null && signIndex !== undefined) {
    const s = dayScores(signIndex, date, tz).scores.money;
    const d = Math.round((s - 50) * 0.3);
    score += d;
    parts.push({ system: '星座', delta: d, text: `今天的星座財運 ${s} 分（看金星、木星等行星和你太陽星座的角度）。` });
  }
  if (birth) {
    const n = personalDayNumber(birth, date);
    const d = DAY_NUMBER_WEALTH[n] || 0;
    score += d;
    parts.push({ system: '生命靈數', delta: d, text: `今天的流日數是 ${n}：${DAY_NUMBER_TEXT[n]}。` });
  }
  score = Math.max(5, Math.min(95, Math.round(score)));
  const [, level, advice] = LEVELS.find(([min]) => score >= min);
  return {
    date,
    score,
    level,
    advice,
    parts,
    caiPosition: tw(lunar.getDayPositionCaiDesc()),
  };
}

/** 未來幾天的偏財走勢與最好的一天 */
export function windfallOutlook(from, days, options) {
  const list = Array.from({ length: days }, (_, i) => windfallDay(addDays(from, i), options));
  const best = [...list].sort((a, b) => b.score - a.score || isoDate(a.date).localeCompare(isoDate(b.date)))[0];
  return { list, best };
}

// ── 樂透

export const GAMES = {
  lotto649: { id: 'lotto649', name: '大樂透', pick: 6, max: 49, odds: 13983816, rule: '從 01–49 選 6 個號碼' },
  superlotto638: { id: 'superlotto638', name: '威力彩', pick: 6, max: 38, second: 8, odds: 22085448, rule: '第一區 01–38 選 6 個，第二區 01–08 選 1 個' },
  dailycash: { id: 'dailycash', name: '今彩539', pick: 5, max: 39, odds: 575757, rule: '從 01–39 選 5 個號碼' },
};

// 河圖數：天一生水、地二生火、天三生木、地四生金、天五生土，加五成之
const HETU = { 水: [1, 6], 火: [2, 7], 木: [3, 8], 金: [4, 9], 土: [5, 0] };

/** FNV-1a 32 位元雜湊（字串 → 種子） */
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32：同一個種子一定得到同一串亂數（讓「今日號碼」重新整理也不會變） */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cryptoRandom() {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

/** 依權重不放回地抽 k 個 */
function weightedPick(weights, k, rand) {
  const pool = weights.map((w, i) => ({ n: i + 1, w }));
  const out = [];
  for (let j = 0; j < k; j += 1) {
    const total = pool.reduce((a, x) => a + x.w, 0);
    let r = rand() * total;
    let idx = 0;
    while (idx < pool.length - 1 && r >= pool[idx].w) {
      r -= pool[idx].w;
      idx += 1;
    }
    out.push(pool[idx].n);
    pool.splice(idx, 1);
  }
  return out.sort((a, b) => a - b);
}

/** 個人的幸運元素：喜用五行（bazi.js 的 yongShen，扶抑法）、生日、生命靈數 */
export function luckyProfile({ bazi = null, birth = null, lifePathNumber = null } = {}) {
  const element = yongShen(bazi)?.primary ?? null;
  return {
    element,
    digits: element ? HETU[element] : [],
    birthDay: birth ? birth.d : null,
    lifePath: lifePathNumber,
  };
}

/**
 * 幸運號碼。
 * @param {string} gameId GAMES 的 key
 * @param {{seedKey?:string, date?:{y,m,d}, profile?:object, random?:boolean}} options
 *   seedKey＋date 固定時結果固定（今日號碼）；random:true 用手機的加密亂數另外抽一組。
 */
export function luckyNumbers(gameId, { seedKey = '', date = null, profile = {}, random = false } = {}) {
  const game = GAMES[gameId];
  if (!game) throw new Error(`不認得的彩券：${gameId}`);
  const rand = random ? cryptoRandom : seeded(hash32(`${seedKey}|${date ? isoDate(date) : ''}|${gameId}`));
  const reasons = [];
  const weights = Array.from({ length: game.max }, (_, i) => {
    const n = i + 1;
    let w = 1;
    if (profile.digits && profile.digits.includes(n % 10)) w *= 2;
    if (profile.birthDay && n === profile.birthDay) w *= 2.5;
    if (profile.lifePath && (n === profile.lifePath || n % 10 === profile.lifePath)) w *= 1.5;
    return w;
  });
  if (profile.element) reasons.push(`尾數 ${profile.digits.join('、')} 加重：你的喜用五行是「${profile.element}」，河圖數是 ${profile.digits.join('、')}。`);
  if (profile.birthDay && profile.birthDay <= game.max) reasons.push(`你的生日 ${profile.birthDay} 號加重。`);
  if (profile.lifePath) reasons.push(`生命靈數 ${profile.lifePath} 加重。`);
  const main = weightedPick(weights, game.pick, rand);
  const second = game.second ? Math.floor(rand() * game.second) + 1 : null;
  return {
    game,
    main,
    second,
    reasons,
    odds: `頭獎機率 1/${game.odds.toLocaleString('en-US')}`,
    disclaimer: '任何一組號碼中獎的機率都一樣，幸運號碼只是好玩，不會提高中獎機率。未滿 18 歲不得購買彩券，請量力而為。',
  };
}
