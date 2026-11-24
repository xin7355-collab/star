// 梅花易數起卦與解卦（解惑用）。
//
// ・時間起卦（《梅花易數》的通行作法）：農曆年支數＋月＋日 → 除 8 取上卦；再加時支數 → 除 8 取下卦；
//   總數除 6 取動爻（餘 0 當 8、當 6）。年支、時支：子 1、丑 2……亥 12。
// ・數字起卦：第一個數取上卦、第二個數取下卦、第三個數取動爻（三數起卦法，台灣常見）。
// ・本卦看現況、互卦看過程、變卦看結果；動爻所在的卦是「用」（事情），另一卦是「體」（你自己）。
// ・吉凶不只看體用：用卦、體互、用互、變卦四個階段各自對體卦的生剋，依《梅花易數》體用諸訣的先後判斷
//   （互變俱生→吉、互變俱剋→凶、剋多無生氣→凶、先吉後凶／先凶後吉、其餘看用變），體卦旺衰與體黨用黨只論輕重。
//   判斷順序參考 taibu packages/core（MIT，見 NOTICE.md）；「無生氣」改成至少兩個剋體才算——
//   古書牡丹占「剋體之卦多矣」、老人占「俱是剋體」都是多個剋，只有一個剋就判凶會把天澤履這類卦誤判。
// ・乾為天、坤為地六爻全同，互卦還是自己，古法改取變卦的互卦。
// 驗算：書中「觀梅占」辰年十二月十七日申時得澤火革初爻動、互天風姤、變澤山咸，用離火剋體兌金，
//   但變出艮土生體（「幸變艮土，兌金得生」），先凶後吉——女子傷股而不至凶危，和本程式一致（見測試）。

import { Solar } from '../../vendor/lunar.js';
import { HEXAGRAMS, LINE_POSITION, RELATION, OUTCOME, STAGE_EFFECT, JUDGEMENT, SEASON_NOTE } from './iching-texts.js';

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
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
// 月支的五行（月令）：寅卯木、巳午火、申酉金、亥子水、辰戌丑未土
const MONTH_WX = { 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 亥: '水', 子: '水', 辰: '土', 戌: '土', 丑: '土', 未: '土' };

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
  return KE[ti] === yong ? '體剋用' : '用剋體';
}

// 對體卦有利：生體、比和、體剋用（我能制事）；不利：體生用（耗）、用剋體
const FAVORABLE = new Set(['用生體', '比和', '體剋用']);

/** 月令旺相休囚死：當令者旺、令生者相、生令者休、剋令者囚、令剋者死 */
export function seasonOf(monthZhi, wx) {
  const m = MONTH_WX[monthZhi];
  if (wx === m) return '旺';
  if (SHENG[m] === wx) return '相';
  if (SHENG[wx] === m) return '休';
  return KE[wx] === m ? '囚' : '死';
}

/**
 * 總斷的先後（不計分，先成立的先算）：
 * 1. 「用不生體，互變生之而吉」：互卦有生體、變卦也生體 → 吉；「互變俱剋之而凶」：互卦有剋體、變卦也剋體 → 凶。
 * 2. 剋體的卦至少兩個、又沒有生體的卦（無生氣）→ 凶。比和、體剋用不算生氣。
 * 3. 「用吉變凶者，先吉後凶；用凶變吉者，先凶後吉」；用、變同吉或同凶就照著論。
 */
function judge(stages) {
  const [use, tiHu, yongHu, bian] = stages;
  const mutual = [tiHu, yongHu];
  const has = (list, rel) => list.some((s) => s.relation === rel);
  if (has(mutual, '用生體') && bian.relation === '用生體') return 'huBianSheng';
  if (has(mutual, '用剋體') && bian.relation === '用剋體') return 'huBianKe';
  if (stages.filter((s) => s.relation === '用剋體').length >= 2 && !has(stages, '用生體')) return 'lifeless';
  if (use.good !== bian.good) return use.good ? 'jiThenXiong' : 'xiongThenJi';
  return use.good ? 'bothGood' : 'bothBad';
}

const PHASE_WORD = (goods) => (goods.every(Boolean) ? '順' : goods.some(Boolean) ? '有起有落' : '卡');

/**
 * 由上卦數、下卦數、動爻排出本卦、互卦、變卦、體用四階段與總斷。
 * @param {number} upperNum 1～8（先天數）
 * @param {number} lowerNum 1～8
 * @param {number} moving 1～6（由下往上）
 * @param {string} [monthZhi] 起卦時的月支（節氣月）；有給才判體卦旺衰
 */
export function castHexagram(upperNum, lowerNum, moving, monthZhi = '') {
  const base = hexagram(upperNum, lowerNum);
  const lines = [...base.lower.lines, ...base.upper.lines];
  const changed = lines.map((v, i) => (i === moving - 1 ? 1 - v : v));
  const huFrom = lines.every((v) => v === lines[0]) ? changed : lines;
  const huLower = BY_LINES[huFrom.slice(1, 4).join('')];
  const huUpper = BY_LINES[huFrom.slice(2, 5).join('')];
  const bianLower = BY_LINES[changed.slice(0, 3).join('')];
  const bianUpper = BY_LINES[changed.slice(3, 6).join('')];
  const tiIsUpper = moving <= 3;
  const ti = tiIsUpper ? base.upper : base.lower;
  const yong = tiIsUpper ? base.lower : base.upper;
  const stage = (key, label, phase, trigram) => {
    const rel = relation(trigram.wx, ti.wx);
    return { key, label, phase, trigram, relation: rel, good: FAVORABLE.has(rel), effect: STAGE_EFFECT[rel] };
  };
  const stages = [
    stage('use', '用卦', '前段', yong),
    stage('tiHu', '體互', '中段', tiIsUpper ? huUpper : huLower),
    stage('yongHu', '用互', '中段', tiIsUpper ? huLower : huUpper),
    stage('bian', '變卦', '後段', tiIsUpper ? bianLower : bianUpper),
  ];
  const key = judge(stages);
  const j = JUDGEMENT[key];
  // 用卦本身就生體（或互變俱生且用卦不差）時升一級為大吉
  const level = (key === 'bothGood' && stages[0].relation === '用生體') || (key === 'huBianSheng' && stages[0].good) ? '大吉' : j.level;
  const others = stages.slice(1).map((s) => s.trigram.wx);
  const tiParty = others.filter((w) => w === ti.wx).length;
  const yongParty = ti.wx === yong.wx ? tiParty : others.filter((w) => w === yong.wx).length;
  let season = null;
  if (MONTH_WX[monthZhi]) {
    const state = seasonOf(monthZhi, ti.wx);
    const extra = state === '死'
      ? `${stages.some((s) => s.relation === '用剋體') ? '又有剋體的卦，壓力更重。' : ''}${stages.some((s) => s.relation === '用生體') ? '好在有生體的卦，會減輕一些。' : ''}`
      : '';
    season = { monthZhi, state, text: `${monthZhi}月起卦，${SEASON_NOTE[state]}${extra}` };
  }
  // 卦義衝突：總斷只看體用生剋，但本卦、變卦的卦義都偏向另一邊時（384 種結果裡約 21 種），提醒使用者打折看。
  // 《梅花易數》書中卦例遇到這種情況，常改看卦名或爻辭判斷（例如「群陰剝陽」），這裡不改總斷，只把衝突講出來。
  const bianHex = hexagram(bianUpper.num, bianLower.num);
  const hexTones = [base.tone, bianHex.tone];
  let toneConflict = null;
  if (j.tone === 'good' && hexTones.every((t) => t === 'care')) toneConflict = '提醒：體用生剋判吉，但本卦和變卦的卦義都偏向要小心。古書遇到這種情況常改看卦名、爻辭，所以這次的吉要打折看，別掉以輕心。';
  else if (j.tone === 'care' && hexTones.every((t) => t === 'good')) toneConflict = '提醒：體用生剋判凶，但本卦和變卦的卦義都偏向順利。古書遇到這種情況常改看卦名、爻辭，凶不一定成真，照下面的做法穩穩來即可。';
  return {
    toneConflict,
    base,
    hu: hexagram(huUpper.num, huLower.num),
    bian: bianHex,
    lines,
    moving,
    ti,
    yong,
    relation: stages[0].relation,
    stages,
    judgement: key,
    verdict: { ...j, level },
    start: RELATION[stages[0].relation],
    outcome: OUTCOME[stages[3].relation],
    flow: `走勢：前段${PHASE_WORD([stages[0].good])} → 中段${PHASE_WORD([stages[1].good, stages[2].good])} → 後段${PHASE_WORD([stages[3].good])}`,
    party: tiParty > yongParty ? '互卦、變卦裡跟你同五行的多（體黨多）：你的勢比較強。' : yongParty > tiParty ? '互卦、變卦裡跟事情同五行的多（用黨多）：事情那一方的勢比較強，別硬碰。' : '',
    season,
    position: LINE_POSITION[moving - 1],
  };
}

/**
 * 時間起卦：用起卦當下的農曆年支、月、日、時支。
 * 23 點起算隔天（晚子時）：和八字的預設、六爻的日辰同一套。以前梅花用當天的農曆日、六爻已換到隔天，
 * 同一個子時 23:30 和 00:30 會起出兩個不同的卦，同一次解惑裡兩種卦也各用各的「日」。
 */
export function castByTime({ y, m, d, h, mi = 0 }) {
  const lunar = Solar.fromYmdHms(y, m, d, h, mi, 0).getLunar();
  const dayLunar = h === 23 ? Solar.fromYmd(y, m, d).next(1).getLunar() : lunar;
  const yearNum = ZHI.indexOf(dayLunar.getYearZhi()) + 1;
  const monthNum = Math.abs(dayLunar.getMonth());
  const dayNum = dayLunar.getDay();
  const hourNum = ZHI.indexOf(lunar.getTimeZhi()) + 1;
  const upper = yearNum + monthNum + dayNum;
  const lower = upper + hourNum;
  return {
    ok: true,
    method: 'time',
    basis: `農曆${dayLunar.getYearZhi()}年（${yearNum}）${monthNum}月${dayNum}日${lunar.getTimeZhi()}時（${hourNum}）${h === 23 ? '，23 點後的子時算隔天' : ''}`,
    ...castHexagram(mod(upper, 8), mod(lower, 8), mod(lower, 6), lunar.getMonthZhiExact()),
  };
}

/**
 * 數字起卦：三個正整數，第一個取上卦、第二個取下卦、第三個取動爻
 * @param {{y,m,d,h,mi}} [when] 起卦的時間（台灣時間）；有給才判體卦在當月的旺衰
 */
export function castByNumbers(a, b, c, when = null) {
  const nums = [a, b, c].map((n) => Math.trunc(Number(n)));
  if (nums.some((n) => !Number.isFinite(n) || n < 1 || n > 9999)) return { ok: false, error: '請輸入三個 1～9999 的整數。' };
  const monthZhi = when ? Solar.fromYmdHms(when.y, when.m, when.d, when.h || 0, when.mi || 0, 0).getLunar().getMonthZhiExact() : '';
  return { ok: true, method: 'numbers', basis: `數字 ${nums.join('、')}`, ...castHexagram(mod(nums[0], 8), mod(nums[1], 8), mod(nums[2], 6), monthZhi) };
}
