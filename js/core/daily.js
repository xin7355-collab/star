// 今日綜合指數與幸運小物：把星座日運、八字流日、農民曆黃道黑道、生命靈數流日數合成一個分數，
// 每一項加減分都列出來源。幸運色／數字取八字的喜用五行（bazi.js 的 yongShen），方位取農民曆的喜神與財神。

import { Solar } from '../../vendor/lunar.js';
import { tw } from './zh.js';
import { dayScores } from './fortune.js';
import { personalDay } from './timing.js';
import { personalDayNumber } from './windfall.js';
import { DEFAULT_TZ } from './tz.js';
import { yongShen } from './bazi.js';

const SHISHEN_DAY = { 正印: 8, 偏印: 2, 正官: 5, 七殺: -6, 正財: 6, 偏財: 5, 食神: 7, 傷官: -3, 比肩: 1, 劫財: -5 };
const SHISHEN_PLAIN = {
  正印: '有貴人、適合學習與求助', 偏印: '想法多、適合研究，別鑽牛角尖', 正官: '按部就班、適合處理正事', 七殺: '壓力與挑戰多，凡事三思',
  正財: '務實、適合處理錢與工作', 偏財: '有意外機會、人脈活絡', 食神: '心情放鬆、口福與人緣好', 傷官: '表達欲強，說話留三分',
  比肩: '朋友同儕多，適合合作', 劫財: '容易衝動花錢或起爭執',
};
const NUMBER_DAY = { 1: 3, 3: 3, 5: 2, 8: 3, 4: -2, 7: -1 };

// 色票顏色放在 css/tokens.css（--lucky-*），這裡只記變數名稱
export const LUCKY_COLORS = {
  木: { name: '綠色', css: 'var(--lucky-wood)' },
  火: { name: '紅色、紫色', css: 'var(--lucky-fire)' },
  土: { name: '黃色、咖啡色', css: 'var(--lucky-earth)' },
  金: { name: '白色、金色', css: 'var(--lucky-metal)' },
  水: { name: '藍色、黑色', css: 'var(--lucky-water)' },
};
const HETU = { 水: [1, 6], 火: [2, 7], 木: [3, 8], 金: [4, 9], 土: [5, 0] };

const LEVELS = [
  [75, '大吉', '順風的一天：適合處理重要的事、主動爭取機會。'],
  [60, '小吉', '整體不錯：照計畫進行，小事順手，大事穩穩推。'],
  [45, '平', '平穩的一天：適合例行公事，重要決定可以再想想。'],
  [0, '宜守', '多一點耐心：少衝動、少爭執，把力氣留給自己。'],
];

/**
 * @param {{date:{y,m,d}, bazi?:object, signIndex?:number|null, birth?:{y,m,d}|null, tz?:string}} input
 * @returns {{score:number, level:string, advice:string, parts:Array<{system,delta,text}>}}
 */
export function dailyIndex({ date, bazi = null, signIndex = null, birth = null, tz = DEFAULT_TZ }) {
  const parts = [];
  let score = 55;
  if (signIndex !== null && signIndex !== undefined) {
    const s = dayScores(signIndex, date, tz).scores.overall;
    score = s;
    parts.push({ system: '星座', delta: null, text: `星座日運 ${s} 分（當天行星和你的太陽星座的角度）。` });
  }
  if (bazi && bazi.ok) {
    const p = personalDay(date, bazi);
    let d = SHISHEN_DAY[p.shishen] || 0;
    if (p.clash.includes('生肖')) d -= 12;
    if (p.clash.includes('日支')) d -= 8;
    if (p.harmony.length) d += 5;
    score += d;
    const extra = p.notes.length ? ` ${p.notes[0]}` : '';
    parts.push({ system: '八字', delta: d, text: `今天是${p.ganzhi}日，對你是「${p.shishen}」：${SHISHEN_PLAIN[p.shishen]}。${extra}` });
  }
  const lunar = Solar.fromYmd(date.y, date.m, date.d).getLunar();
  const luck = tw(lunar.getDayTianShenLuck());
  const tianShen = tw(lunar.getDayTianShen());
  const dl = luck === '吉' ? 4 : -4;
  score += dl;
  parts.push({ system: '農民曆', delta: dl, text: `${tianShen}${luck === '吉' ? '黃道吉日' : '黑道日'}，${luck === '吉' ? '傳統上適合辦事' : '傳統上重要的事宜低調'}。` });
  if (birth) {
    const n = personalDayNumber(birth, date);
    const dn = NUMBER_DAY[n] || 0;
    score += dn;
    parts.push({ system: '生命靈數', delta: dn, text: `流日數 ${n}。` });
  }
  score = Math.max(5, Math.min(95, Math.round(score)));
  const [, level, advice] = LEVELS.find(([min]) => score >= min);
  return { score, level, advice, parts };
}

/** 幸運色、幸運數字、喜神與財神方位 */
export function luckyItems({ date, bazi = null }) {
  const lunar = Solar.fromYmd(date.y, date.m, date.d).getLunar();
  const element = yongShen(bazi)?.primary ?? null;
  return {
    element,
    color: element ? LUCKY_COLORS[element] : null,
    numbers: element ? HETU[element] : null,
    xi: tw(lunar.getDayPositionXiDesc()),
    cai: tw(lunar.getDayPositionCaiDesc()),
    fu: tw(lunar.getDayPositionFuDesc()),
  };
}
