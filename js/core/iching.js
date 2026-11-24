// 梅花易數起卦與解卦（解惑用）。
//
// ・時間起卦（《梅花易數》的通行作法）：農曆年支數＋月＋日 → 除 8 取上卦；再加時支數 → 除 8 取下卦；
//   總數除 6 取動爻（餘 0 當 8、當 6）。年支、時支：子 1、丑 2……亥 12。
// ・數字起卦：第一個數取上卦、第二個數取下卦、第三個數取動爻（三數起卦法，台灣常見）。
// ・本卦看現況、互卦看過程、變卦看結果；動爻所在的卦是「用」（事情），另一卦是「體」（你自己），
//   用兩個卦的五行生剋判斷吉凶，這是梅花易數最核心、規則最明確的部分。
// 驗算：書中「觀梅占」辰年十二月十七日申時得澤火革初爻動、互天風姤、變澤山咸，用離火剋體兌金為凶，和本程式一致（見測試）。

import { Solar } from '../../vendor/lunar.js';
import { HEXAGRAMS, LINE_POSITION, RELATION, OUTCOME } from './iching-texts.js';

// 先天八卦數：乾 1 兌 2 離 3 震 4 巽 5 坎 6 艮 7 坤 8；爻由下往上，1＝陽爻、0＝陰爻
export const TRIGRAMS = [
  { num: 1, name: '乾', image: '天', lines: [1, 1, 1], wx: '金', nature: '剛健' },
  { num: 2, name: '兌', image: '澤', lines: [1, 1, 0], wx: '金', nature: '喜悅' },
  { num: 3, name: '離', image: '火', lines: [1, 0, 1], wx: '火', nature: '光明' },
  { num: 4, name: '震', image: '雷', lines: [1, 0, 0], wx: '木', nature: '行動' },
  { num: 5, name: '巽', image: '風', lines: [0, 1, 1], wx: '木', nature: '順入' },
  { num: 6, name: '坎', image: '水', lines: [0, 1, 0], wx: '水', nature: '險難' },
  { num: 7, name: '艮', image: '山', lines: [0, 0, 1], wx: '土', nature: '停止' },
  { num: 8, name: '坤', image: '地', lines: [0, 0, 0], wx: '土', nature: '包容' },
];
const BY_IMAGE = Object.fromEntries(TRIGRAMS.map((t) => [t.image, t]));
const BY_LINES = Object.fromEntries(TRIGRAMS.map((t) => [t.lines.join(''), t]));
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };

/** 卦名拆成上下卦：「水雷屯」→ 坎上震下；「乾為天」→ 乾上乾下 */
export function trigramsOf(name) {
  if (name[1] === '為') {
    const t = BY_IMAGE[name[2]];
    return { upper: t, lower: t };
  }
  return { upper: BY_IMAGE[name[0]], lower: BY_IMAGE[name[1]] };
}

const TABLE = new Map(HEXAGRAMS.map(([num, name, tone, now, advice]) => {
  const { upper, lower } = trigramsOf(name);
  return [`${upper.num}-${lower.num}`, { num, name, tone, now, advice, upper, lower }];
}));

export function hexagram(upperNum, lowerNum) {
  return TABLE.get(`${upperNum}-${lowerNum}`);
}

const mod = (n, m) => ((n % m) + m) % m || m;

/** 五行生剋：a 對 b 的關係，從「用」看「體」 */
function relation(yong, ti) {
  if (yong === ti) return '比和';
  if (SHENG[yong] === ti) return '用生體';
  if (SHENG[ti] === yong) return '體生用';
  // 剩下的是剋：木剋土、土剋水、水剋火、火剋金、金剋木
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  return KE[ti] === yong ? '體剋用' : '用剋體';
}

/**
 * 由上卦數、下卦數、動爻排出本卦、互卦、變卦與體用。
 * @param {number} upperNum 1～8（先天數）
 * @param {number} lowerNum 1～8
 * @param {number} moving 1～6（由下往上）
 */
export function castHexagram(upperNum, lowerNum, moving) {
  const base = hexagram(upperNum, lowerNum);
  const lines = [...base.lower.lines, ...base.upper.lines];
  const huLower = BY_LINES[lines.slice(1, 4).join('')];
  const huUpper = BY_LINES[lines.slice(2, 5).join('')];
  const changed = lines.map((v, i) => (i === moving - 1 ? 1 - v : v));
  const bianLower = BY_LINES[changed.slice(0, 3).join('')];
  const bianUpper = BY_LINES[changed.slice(3, 6).join('')];
  const movingInLower = moving <= 3;
  const ti = movingInLower ? base.upper : base.lower;
  const yong = movingInLower ? base.lower : base.upper;
  const bianYong = movingInLower ? bianLower : bianUpper;
  const rel = relation(yong.wx, ti.wx);
  const outcomeRel = relation(bianYong.wx, ti.wx);
  return {
    base,
    hu: hexagram(huUpper.num, huLower.num),
    bian: hexagram(bianUpper.num, bianLower.num),
    lines,
    moving,
    ti,
    yong,
    relation: rel,
    verdict: RELATION[rel],
    outcome: OUTCOME[outcomeRel],
    position: LINE_POSITION[moving - 1],
  };
}

/** 時間起卦：用起卦當下的農曆年支、月、日、時支 */
export function castByTime({ y, m, d, h, mi = 0 }) {
  const lunar = Solar.fromYmdHms(y, m, d, h, mi, 0).getLunar();
  const yearNum = ZHI.indexOf(lunar.getYearZhi()) + 1;
  const monthNum = Math.abs(lunar.getMonth());
  const dayNum = lunar.getDay();
  const hourNum = ZHI.indexOf(lunar.getTimeZhi()) + 1;
  const upper = yearNum + monthNum + dayNum;
  const lower = upper + hourNum;
  return {
    ok: true,
    method: 'time',
    basis: `農曆${lunar.getYearZhi()}年（${yearNum}）${monthNum}月${dayNum}日${lunar.getTimeZhi()}時（${hourNum}）`,
    ...castHexagram(mod(upper, 8), mod(lower, 8), mod(lower, 6)),
  };
}

/** 數字起卦：三個正整數，第一個取上卦、第二個取下卦、第三個取動爻 */
export function castByNumbers(a, b, c) {
  const nums = [a, b, c].map((n) => Math.trunc(Number(n)));
  if (nums.some((n) => !Number.isFinite(n) || n < 1 || n > 9999)) return { ok: false, error: '請輸入三個 1～9999 的整數。' };
  return { ok: true, method: 'numbers', basis: `數字 ${nums.join('、')}`, ...castHexagram(mod(nums[0], 8), mod(nums[1], 8), mod(nums[2], 6)) };
}
