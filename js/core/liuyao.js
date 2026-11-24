// 六爻納甲（解惑的第二種看法）：用梅花起出的同一卦（時間或數字起卦，一個動爻），
// 照京房八宮納甲排出世應、六親、六神，依困擾的類型取「用神」，再用起卦時的月建、日辰看它有沒有力、
// 有沒有旬空月破、動了之後變好變壞，最後推「應期」——接下來哪幾天比較可能有消息。
// ・梅花看體用大勢，六爻看「你問的那件事」本身。台灣常見的時間起卦六爻也是這樣用同一卦。
// ・八宮卦序不手抄 64 卦表：本宮 → 初爻到五爻逐一變（一世到五世）→ 第四爻變回（遊魂）→ 內卦回本宮（歸魂），
//   測試會和傳統表對答案。
// ・納甲、六神、世應、旺衰與用神取捨、應期的條目參考 taibu packages/core（MIT，見 NOTICE.md），
//   並對照《增刪卜易》《卜筮正宗》；文字是自己寫的白話。
// ・刻意只做各派一致的部分：日辰的長生、帝旺、墓、絕只在古書明講的情況下才論（本爻有沒有氣）。
//   化進退用《增刪卜易》的配對；戌化丑、丑化戌各書說法不同，但一爻變時不會出現（測試窮舉過），不影響。
// ・所有計算都在手機上，不送出任何資料。

import { Solar } from '../../vendor/lunar.js';
import { TRIGRAMS, seasonOf } from './iching.js';
import { addDays } from './date.js';

const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const WX_ZHI = { 木: '寅卯', 火: '巳午', 土: '辰戌丑未', 金: '申酉', 水: '亥子' };
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const CHONG = Object.fromEntries([...ZHI].map((z, i) => [z, ZHI[(i + 6) % 12]]));
const HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// 納甲：每個卦在內卦（初、二、三爻）和外卦（四、五、上爻）配的地支
const NAJIA = {
  乾: ['子寅辰', '午申戌'], 坎: ['寅辰午', '申戌子'], 艮: ['辰午申', '戌子寅'], 震: ['子寅辰', '午申戌'],
  巽: ['丑亥酉', '未巳卯'], 離: ['卯丑亥', '酉未巳'], 坤: ['未巳卯', '丑亥酉'], 兌: ['巳卯丑', '亥酉未'],
};
// 六神由初爻往上排，起點看日干：甲乙青龍、丙丁朱雀、戊勾陳、己螣蛇、庚辛白虎、壬癸玄武
const SHEN = ['青龍', '朱雀', '勾陳', '螣蛇', '白虎', '玄武'];
const SHEN_START = { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 };
// 世、應在第幾爻：本宮、一世～五世、遊魂、歸魂
const SHI_YING = [[6, 3], [1, 4], [2, 5], [3, 6], [4, 1], [5, 2], [4, 1], [3, 6]];
export const ORDER_NAME = ['本宮卦', '一世卦', '二世卦', '三世卦', '四世卦', '五世卦', '遊魂卦', '歸魂卦'];
// 化進神；反過來就是化退神（戌丑一組各書不同，一爻變碰不到，所以不列）
const JIN = { 亥: '子', 寅: '卯', 巳: '午', 申: '酉', 丑: '辰', 辰: '未', 未: '戌' };
const TUI = Object.fromEntries(Object.entries(JIN).map(([a, b]) => [b, a]));
// 十二長生只用到長生、帝旺、墓、絕；卜筮的土跟著水（長生在申、墓在辰）
const CHANG_SHENG = { 木: '亥', 火: '寅', 金: '巳', 水: '申', 土: '申' };
function stageOf(wx, zhi) {
  const k = (ZHI.indexOf(zhi) - ZHI.indexOf(CHANG_SHENG[wx]) + 12) % 12;
  return { 0: '長生', 4: '帝旺', 8: '墓', 9: '絕' }[k] || '';
}
const muOf = (wx) => ZHI[(ZHI.indexOf(CHANG_SHENG[wx]) + 8) % 12];

const BY_LINES = new Map(TRIGRAMS.map((t) => [t.lines.join(''), t]));

// 八宮：每宮八個卦，order 0～7
const PALACES = new Map();
for (const t of TRIGRAMS) {
  const pure = [...t.lines, ...t.lines];
  let cur = pure;
  const seq = [pure];
  for (let k = 0; k < 5; k += 1) {
    const at = k;
    cur = cur.map((v, i) => (i === at ? 1 - v : v));
    seq.push(cur);
  }
  const you = cur.map((v, i) => (i === 3 ? 1 - v : v));
  seq.push(you, [...t.lines, ...you.slice(3)]);
  seq.forEach((code, order) => PALACES.set(code.join(''), { name: t.name, wx: t.wx, order, pure }));
}

/** 卦的所屬宮位、第幾世（測試與畫面用） */
export function palaceOf(lines) {
  return PALACES.get(lines.join(''));
}

/** 六爻由初爻到上爻的地支 */
export function branchesOf(lines) {
  const lower = BY_LINES.get(lines.slice(0, 3).join('')).name;
  const upper = BY_LINES.get(lines.slice(3, 6).join('')).name;
  return [...NAJIA[lower][0], ...NAJIA[upper][1]];
}

/** 六親：以宮的五行為「我」 */
export function qinOf(palaceWx, wx) {
  if (wx === palaceWx) return '兄弟';
  if (SHENG[wx] === palaceWx) return '父母';
  if (SHENG[palaceWx] === wx) return '子孫';
  return KE[palaceWx] === wx ? '妻財' : '官鬼';
}

/** src 對 dst 的作用：生、扶（同五行）、剋、泄（dst 生 src）、耗（dst 剋 src） */
function rel(src, dst) {
  if (src === dst) return '扶';
  if (SHENG[src] === dst) return '生';
  if (KE[src] === dst) return '剋';
  return SHENG[dst] === src ? '泄' : '耗';
}

/** 月建對爻：臨月建、月生、月扶有力；月剋傷；月合「衰而逢合也有力」，合中帶剋還是剋。月沖（月破）另外處理 */
function monthEffect(zhi, wx, monthZhi) {
  if (zhi === monthZhi) return { v: 1, note: '臨月建' };
  const r = rel(ZHI_WX[monthZhi], wx);
  const he = HE[monthZhi] === zhi;
  if (r === '剋') return { v: -1, note: he ? '月合帶剋' : '月剋' };
  if (r === '生' || r === '扶') return { v: 1, note: `月${r}${he ? '、月合' : ''}` };
  return he ? { v: 1, note: '月合' } : { v: 0, note: '' };
}

/**
 * 日辰對爻：臨日建、日生、日扶、日合有力，日剋傷。
 * 靜爻逢日沖：月令有氣是「暗動」（被沖起來），沒氣是「日破」；動爻逢沖不散，沖中帶剋才傷。
 * 長生、帝旺要本爻月令有氣才論（金爻逢巳日：有氣論生、無氣論剋）；入墓、逢絕除非本爻有氣又得生扶，否則論傷。
 */
function dayEffect(zhi, wx, dayZhi, moving, monthHelps) {
  if (zhi === dayZhi) return { v: 1, note: '臨日建' };
  const r = rel(ZHI_WX[dayZhi], wx);
  if (CHONG[zhi] === dayZhi) {
    if (moving) return r === '剋' ? { v: -1, note: '日沖帶剋' } : { v: 0, note: '動爻逢日沖不散' };
    if (!monthHelps) return { v: -1, note: '日破（沒力的靜爻被日辰沖散）' };
    return r === '剋'
      ? { v: -1, anDong: true, note: '暗動（被日辰沖起），但沖中帶剋' }
      : { v: 1, anDong: true, note: '暗動（有力的靜爻被日辰沖起來）' };
  }
  const he = HE[dayZhi] === zhi;
  let base = { v: 0, note: he ? '日合' : '' };
  if (r === '剋') base = { v: -1, note: he ? '日合帶剋' : '日剋' };
  else if (r === '生' || r === '扶') base = { v: 1, note: `日${r}${he ? '、日合' : ''}` };
  else if (he) base = { v: 1, note: '日合' };
  const stage = stageOf(wx, dayZhi);
  if (stage === '長生' || stage === '帝旺') {
    if (base.v > 0) return { v: 1, note: `${base.note}、日辰${stage}` };
    if (monthHelps) return { v: 1, note: `日辰${stage}${base.v < 0 ? '（本爻有氣，論生不論剋）' : ''}` };
    return base;
  }
  if (stage === '墓') {
    if (base.v > 0 && monthHelps) return { v: 1, note: `${base.note}（逢墓但有氣，論生不論墓）` };
    return { v: -1, mu: true, note: `${base.v < 0 ? `${base.note}、` : ''}入日墓` };
  }
  if (stage === '絕' && !monthHelps) return { v: -1, note: `${base.v < 0 ? `${base.note}、` : ''}日絕` };
  return base;
}

const KONG_NOTE = {
  zhen: '旬空（真空：靜而無力，到底是空）',
  jia: '旬空（這一旬內還空著，出空的日子就有用）',
  dong: '旬空（動不為空，出空的日子就有用）',
  chongShi: '旬空但被日辰沖起（沖空則實，不算空）',
};

/** 旬空真假：旺不為空、動不為空、有日建或動爻生扶不為空，臨月建在旬內仍空；靜而無力才是真空 */
function kongOf(zhi, t, moving, rooted) {
  if (!t.kong.includes(zhi)) return '';
  if (CHONG[zhi] === t.dayZhi) return moving || rooted ? 'chongShi' : 'zhen';
  if (zhi === t.monthZhi) return 'jia';
  if (moving) return 'dong';
  return rooted ? 'jia' : 'zhen';
}

/**
 * 一爻的力量：先看月破，再把月建、日辰合起來看。
 * level：2 有力、1 一助一傷（相敵）、0 無力。月破的爻這個月內一律算無力。
 */
function judge(zhi, wx, t, { moving = false, support = [], harm = [], backKe = false } = {}) {
  const monthChong = CHONG[zhi] === t.monthZhi;
  const month = monthChong ? { v: 0, note: '' } : monthEffect(zhi, wx, t.monthZhi);
  const day = dayEffect(zhi, wx, t.dayZhi, moving, month.v > 0);
  // 臨日建的爻逢月沖不算破；但有動爻來剋、或自己化回頭剋，寡不敵眾，破還是破
  const po = monthChong && !(zhi === t.dayZhi && !harm.length && !backKe);
  let level = 0;
  let mix = '';
  const helped = month.v > 0 || day.v > 0;
  const hurt = month.v < 0 || day.v < 0;
  if (!po && helped && !hurt) level = 2;
  else if (!po && helped) {
    if (support.length && !harm.length) [level, mix] = [2, '日月一助一傷，得動爻相扶'];
    else if (harm.length && !support.length) [level, mix] = [0, '日月一助一傷，又被動爻剋'];
    else [level, mix] = [1, '日月一助一傷（相敵）'];
  }
  const rooted = helped || support.length > 0;
  const kong = kongOf(zhi, t, moving, rooted);
  let poNote = '';
  if (monthChong) {
    if (!po) poNote = '臨日建，逢月沖而不破';
    else if (moving) poNote = '月破（動爻不算真破，出月、逢合的日子可用）';
    else poNote = day.v > 0 || support.length ? '月破（有生扶，出月、逢合的日子可用）' : '月破（靜而無助，是真破）';
  }
  const notes = [
    `月令${seasonOf(t.monthZhi, wx)}`, month.note, poNote, day.note,
    support.length ? `動爻生扶（${support.join('、')}）` : '',
    harm.length ? `動爻剋制（${harm.join('、')}）` : '',
    mix, KONG_NOTE[kong] || '',
  ].filter(Boolean);
  return { level, po, kong, rooted, anDong: !!day.anDong, mu: !!day.mu, hurt: month.v < 0 || day.v < 0, notes };
}

/**
 * 動爻變出的爻：伏吟／反吟 → 化進／化退 → 回頭剋 → 回頭生（兼墓絕時看本爻有沒有氣）→ 化墓、化絕 → 化空。
 * 一爻變只會出現在初、二、三或四、五、上其中一個位置；伏吟、反吟在單爻變時不會發生，所以不論。
 */
function changeOf(row, t) {
  const { zhi, wx } = row;
  const to = row.change.zhi;
  const toWx = ZHI_WX[to];
  const mu = muOf(wx) === to;
  const jue = stageOf(wx, to) === '絕';
  let type = '';
  if (JIN[zhi] === to) type = '化進';
  else if (TUI[zhi] === to) type = '化退';
  else if (KE[toWx] === wx) type = '回頭剋';
  else if (SHENG[toWx] === wx) type = (mu || jue) && !row.j.rooted ? (mu ? '化墓' : '化絕') : '回頭生';
  else if (mu) type = '化墓';
  else if (jue) type = '化絕';
  else if (t.kong.includes(to)) type = '化空';
  const TEXT = {
    化進: '化進神：往前推進，越來越好',
    化退: '化退神：會退縮、後勁不足',
    回頭剋: '回頭剋：變出來的反過來剋自己，變化對這件事不利',
    回頭生: '回頭生：變出來的反過來生自己，越變越好',
    化墓: '化墓：變化之後被困住，要等沖開',
    化絕: '化絕：變化之後沒有後勁',
    化空: '化空：變化落空，要等出空填實',
  };
  const extra = [
    type !== '化空' && t.kong.includes(to) ? '變出的爻旬空，出空才應' : '',
    CHONG[to] === t.monthZhi ? '變出的爻逢月破' : '',
  ].filter(Boolean);
  return { type, text: [TEXT[type] || '變化平順', ...extra].join('；') };
}

const TARGET = {
  work: () => ({ qin: '官鬼', why: '問工作、職位看官鬼爻' }),
  money: () => ({ qin: '妻財', why: '問錢財看妻財爻' }),
  love: (g) => (g === '男' ? { qin: '妻財', why: '男生問感情，對方看妻財爻' }
    : g === '女' ? { qin: '官鬼', why: '女生問感情，對方看官鬼爻' }
      : { at: 'ying', why: '沒有填性別，用應爻代表對方' }),
  family: () => ({ qin: '父母', why: '問家裡、長輩看父母爻（問子女改看子孫、兄弟姊妹看兄弟）' }),
  people: () => ({ qin: '兄弟', why: '問同事、朋友、競爭對手看兄弟爻' }),
  health: () => ({ at: 'shi', why: '自己問健康看世爻；官鬼是病，子孫是醫藥' }),
  study: () => ({ qin: '父母', why: '問考試、讀書看父母爻（文書）' }),
  decide: () => ({ at: 'shi', why: '問自己的決定看世爻' }),
  move: () => ({ qin: '父母', why: '問房子、住處看父母爻' }),
};

const lineName = (pos) => ['初', '二', '三', '四', '五', '上'][pos - 1];
const label = (r) => `${lineName(r.pos)}爻${r.qin}${r.zhi}${r.wx}`;

/**
 * 用神多現時的取捨（《卜筮正宗》《增刪卜易·兩現章》）：持世 → 臨月日 → 旺衰 → 動靜 → 沒有空破。
 * 空破的那一個不搶主用，但它出空、填實的日子另外是應期。
 */
function pickYong(cands, t) {
  const key = (r) => [
    r.shi ? 0 : 1,
    r.zhi === t.monthZhi || r.zhi === t.dayZhi ? 0 : 1,
    2 - r.j.level,
    r.moving ? 0 : r.j.anDong ? 1 : 2,
    r.j.po || (r.j.kong && r.j.kong !== 'chongShi') ? 1 : 0,
    r.pos,
  ];
  return [...cands].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i += 1) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return 0;
  });
}

function dateText({ y, m, d }, i) {
  if (i === 0) return '今天';
  return `${m}/${d}（${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
}

/** 接下來 days 天內，每個條件最先符合的兩天 */
function datesFor(conds, start, days = 30) {
  const list = [];
  for (let i = 0; i <= days; i += 1) {
    const day = addDays(start, i);
    list.push({ ...day, i, zhi: Solar.fromYmd(day.y, day.m, day.d).getLunar().getDayZhi() });
  }
  return conds.map((c) => {
    const hit = list.filter((x) => c.zhis.includes(x.zhi) && (!c.after || x.i >= c.after)).slice(0, 2);
    return { ...c, dates: hit.map((x) => ({ y: x.y, m: x.m, d: x.d, zhi: x.zhi, label: dateText(x, x.i) })) };
  });
}

/**
 * 應期（《增刪卜易·各門類應期總注》：旬空最愛填沖、月破喜填合、入墓喜沖開、合住待沖、
 * 動而逢值逢合、靜而逢值逢沖、太旺逢墓逢沖、衰弱遇生旺）。先看用神的「病」，病在就應在去病的日子。
 */
function timingOf(y, t, nextJieAfter) {
  const x = y.zhi;
  const out = [];
  const add = (kind, zhis, why, after = 0) => out.push({ kind, zhis: [...new Set(zhis)], why, after });
  if (y.source === 'fu') {
    add('key', [x, CHONG[y.fei.zhi]], `用神伏藏：等它出現（${x}日）或沖開上面的飛神（${CHONG[y.fei.zhi]}日）`);
    return out;
  }
  const j = y.j;
  if (j.kong === 'zhen') add('key', [x, CHONG[x]], `用神真空：逢${x}日填實或${CHONG[x]}日沖空，才有轉機`);
  else if (j.kong === 'jia' || j.kong === 'dong') add('key', [x, CHONG[x]], `用神旬空：出空（${x}日）或沖空（${CHONG[x]}日）的時候應`);
  else if (j.kong === 'chongShi') add('key', [HE[x]], `用神被日辰沖起：逢${HE[x]}日合住的時候應`);
  if (j.po) add('key', [x, HE[x]], `用神月破，這個月使不上力；下個節氣以後，逢${x}日填實或${HE[x]}日相合的時候應`, nextJieAfter);
  if (j.mu || (y.change && y.change.type === '化墓')) {
    const opener = CHONG[muOf(y.wx)];
    add('key', [opener], `用神入墓：逢${opener}日沖開墓庫的時候應`);
  }
  const heMonth = HE[t.monthZhi] === x;
  const heDay = HE[t.dayZhi] === x;
  if ((heMonth || heDay) && CHONG[x] !== t.dayZhi) {
    add('key', heMonth ? [CHONG[x], CHONG[t.monthZhi]] : [CHONG[x]], `用神被${heMonth ? '月建' : '日辰'}合住：逢${heMonth ? `${CHONG[x]}或${CHONG[t.monthZhi]}` : CHONG[x]}日沖開的時候應`);
  }
  const sick = out.length > 0;
  const changed = y.change ? y.change.zhi : '';
  if (y.moving && y.change.type === '化退') {
    add('bad', [changed, CHONG[changed]], `用神化退：逢${changed}日或${CHONG[changed]}日容易退縮，重要的事避開`);
  } else if (!sick && y.moving) {
    add('key', [x, HE[x]], `用神發動：逢${x}日（值日）或${HE[x]}日（相合）的時候應`);
  } else if (!sick && j.anDong) {
    add('key', [HE[x]], `用神暗動：逢${HE[x]}日相合的時候應`);
  } else if (!sick && j.level > 0) {
    const tooStrong = j.level === 2 && (ZHI_WX[t.monthZhi] === y.wx || ZHI_WX[t.dayZhi] === y.wx);
    if (tooStrong) add('key', [muOf(y.wx), CHONG[x]], `用神太旺：逢${muOf(y.wx)}日（入墓）或${CHONG[x]}日（逢沖）的時候應`);
    else add('key', [x, CHONG[x]], `用神安靜：逢${x}日（值日）或${CHONG[x]}日（逢沖）的時候應`);
  }
  if (j.level === 0 && !j.po && j.kong !== 'zhen') {
    const yuan = Object.keys(SHENG).find((w) => SHENG[w] === y.wx);
    add('good', [...WX_ZHI[yuan], ...WX_ZHI[y.wx]], `用神偏弱：遇到${yuan}、${y.wx}的日子（${WX_ZHI[yuan]}${WX_ZHI[y.wx]}日）比較有轉機`);
  }
  for (const a of new Set(y.harmWx || [])) {
    if (j.level === 0) {
      const feed = Object.keys(SHENG).find((w) => SHENG[w] === a);
      add('bad', [...WX_ZHI[a], ...WX_ZHI[feed]], `用神沒力又被${a}剋：逢${WX_ZHI[a]}${WX_ZHI[feed]}日要多小心`);
    } else {
      const breaker = Object.keys(KE).find((w) => KE[w] === a);
      add('good', [...WX_ZHI[breaker]], `用神被${a}剋但有力：逢${WX_ZHI[breaker]}日剋去剋神就順`);
    }
  }
  return out;
}

const SHI_YING_NOTE = {
  生: '應爻生世爻：對方或環境對你有利，願意配合。',
  扶: '世應比和：雙方立場接近，好談。',
  剋: '應爻剋世爻：對方或環境對你不利，要多防一手。',
  泄: '世爻生應爻：你付出比較多，對方受益。',
  耗: '世爻剋應爻：你比較能主導。',
};

/**
 * @param {object} cast castHexagram / castByTime / castByNumbers 的結果（lines 由下往上、moving 1～6）
 * @param {{when:{y,m,d,h,mi}, topic:string, gender?:'男'|'女'|null}} opts when 是起卦的台灣時間
 */
export function analyzeLiuyao(cast, { when, topic, gender = null }) {
  const lunar = Solar.fromYmdHms(when.y, when.m, when.d, when.h ?? 12, when.mi ?? 0, 0).getLunar();
  // 日辰以子時（23 點）換日，和梅花時間起卦的時辰一致
  const t = { monthZhi: lunar.getMonthZhiExact(), dayGan: lunar.getDayGanExact(), dayZhi: lunar.getDayZhiExact(), kong: lunar.getDayXunKongExact() };
  const palace = PALACES.get(cast.lines.join(''));
  const [shiPos, yingPos] = SHI_YING[palace.order];
  const zhis = branchesOf(cast.lines);
  const changedLines = cast.lines.map((v, i) => (i === cast.moving - 1 ? 1 - v : v));
  const bianZhis = branchesOf(changedLines);
  const start = SHEN_START[t.dayGan];

  // 第一輪：每一爻自己的月日（先知道誰暗動，才知道誰能去生剋別人）
  const rows = zhis.map((zhi, i) => {
    const pos = i + 1;
    const wx = ZHI_WX[zhi];
    const moving = pos === cast.moving;
    const row = {
      pos, zhi, wx, yang: cast.lines[i] === 1, moving, qin: qinOf(palace.wx, wx), shen: SHEN[(start + i) % 6],
      shi: pos === shiPos, ying: pos === yingPos,
    };
    row.j = judge(zhi, wx, t, { moving });
    if (moving) {
      row.change = { zhi: bianZhis[i], wx: ZHI_WX[bianZhis[i]], qin: qinOf(palace.wx, ZHI_WX[bianZhis[i]]) };
      Object.assign(row.change, changeOf(row, t));
    }
    return row;
  });
  // 能生剋別人的只有明動、暗動的爻（《增刪卜易》元神忌神衰旺章）：月破、化回頭剋的沒有力；
  // 本身無力又被月日剋、或化退、化墓、化絕、變出的爻逢月破的，也生剋不了別人
  const movers = rows.filter((r) => {
    if (!(r.moving || r.j.anDong) || r.j.po) return false;
    if (r.change && r.change.type === '回頭剋') return false;
    if (r.j.level > 0) return true;
    return !(r.j.hurt || (r.change && (['化退', '化墓', '化絕'].includes(r.change.type) || CHONG[r.change.zhi] === t.monthZhi)));
  });
  for (const r of rows) {
    const others = movers.filter((o) => o !== r);
    const support = others.filter((o) => SHENG[o.wx] === r.wx || o.wx === r.wx).map(label);
    const harm = others.filter((o) => KE[o.wx] === r.wx);
    r.harmWx = harm.map((o) => o.wx);
    const harmNames = harm.map(label);
    let backKe = false;
    if (r.change) {
      if (SHENG[r.change.wx] === r.wx) support.push('變爻回頭生');
      if (KE[r.change.wx] === r.wx) {
        harmNames.push('變爻回頭剋');
        r.harmWx.push(r.change.wx);
        backKe = true;
      }
    }
    r.j = judge(r.zhi, r.wx, t, { moving: r.moving, support, harm: harmNames, backKe });
    if (r.change) Object.assign(r.change, changeOf(r, t));
  }

  // 取用神
  const target = (TARGET[topic] || TARGET.decide)(gender);
  let yong;
  let pickNote = '';
  if (target.at) {
    yong = rows[(target.at === 'shi' ? shiPos : yingPos) - 1];
  } else {
    const cands = rows.filter((r) => r.qin === target.qin);
    if (cands.length) {
      const sorted = pickYong(cands, t);
      yong = sorted[0];
      if (sorted.length > 1) pickNote = `${target.qin}出現 ${sorted.length} 次，取${lineName(yong.pos)}爻（依序看：持世、臨月日、旺衰、動靜、有沒有空破）。`;
    } else {
      const mover = rows.find((r) => r.moving && r.change.qin === target.qin);
      if (mover) {
        // 本卦沒有用神但動爻變出來（「用神不出現，查變爻有不必尋伏神」）
        const j = judge(mover.change.zhi, mover.change.wx, t, { moving: true });
        yong = { source: 'changed', pos: mover.pos, zhi: mover.change.zhi, wx: mover.change.wx, qin: target.qin, moving: false, j, harmWx: [] };
        pickNote = `本卦沒有${target.qin}，由${lineName(mover.pos)}爻變出${mover.change.zhi}${mover.change.wx}：要等事情起變化才看得到。`;
      } else {
        // 伏神：到本宮卦找同一個六親，伏在同位置的爻（飛神）下面
        const pureZhis = branchesOf(palace.pure);
        const i = pureZhis.findIndex((z) => qinOf(palace.wx, ZHI_WX[z]) === target.qin);
        const fei = rows[i];
        const zhi = pureZhis[i];
        const wx = ZHI_WX[zhi];
        const j = judge(zhi, wx, t);
        const r = rel(fei.wx, wx);
        const FEI = {
          生: '飛神生伏神：伏神得生，容易出現', 扶: '飛伏比和', 剋: '飛神剋伏神：伏神被壓住，不容易出現',
          泄: '伏神生飛神：自己洩氣', 耗: '伏神剋飛神：有力的話能自己衝出來',
        };
        const hard = j.level === 0 || r === '剋' || j.po || j.kong === 'zhen';
        yong = { source: 'fu', pos: fei.pos, zhi, wx, qin: target.qin, moving: false, j, fei, hard, harmWx: [] };
        pickNote = `本卦沒有${target.qin}，伏在${lineName(fei.pos)}爻（飛神${fei.qin}${fei.zhi}${fei.wx}）下面：${FEI[r]}。${hard ? '伏而難出，事情一時看不到。' : '伏神有力，等它出現就有消息。'}`;
      }
    }
  }

  // 原神（生用神）、忌神（剋用神）有沒有動
  const yuanWx = Object.keys(SHENG).find((w) => SHENG[w] === yong.wx);
  const jiWx = Object.keys(KE).find((w) => KE[w] === yong.wx);
  const yuanMoving = movers.filter((o) => o.wx === yuanWx && o !== yong);
  const jiMoving = movers.filter((o) => o.wx === jiWx && o !== yong);
  const godNotes = [];
  if (yuanMoving.length) godNotes.push({ tone: 'good', text: `原神發動（${yuanMoving.map(label).join('、')}）：生助用神，是助力。` });
  if (jiMoving.length) {
    godNotes.push(yuanMoving.length
      ? { tone: 'info', text: `忌神也動（${jiMoving.map(label).join('、')}），但忌神生原神、原神生用神，反而有救（貪生忘剋）。` }
      : { tone: 'bad', text: `忌神發動（${jiMoving.map(label).join('、')}）：剋用神，是阻力。` });
  }

  // 問健康另外看病（官鬼）和醫藥（子孫）有沒有動
  if (topic === 'health') {
    const ill = movers.filter((o) => o.qin === '官鬼');
    const cure = movers.filter((o) => o.qin === '子孫');
    if (ill.length) godNotes.push({ tone: 'bad', text: `官鬼（病）發動（${ill.map(label).join('、')}）：身體狀況有變化，該看醫生就去。` });
    if (cure.length) godNotes.push({ tone: 'good', text: `子孫（醫藥）發動（${cure.map(label).join('、')}）：治療、調養會有效果。` });
  }

  const bad = [
    yong.j.po ? '月破' : '',
    yong.j.kong === 'zhen' ? '真空' : '',
    yong.change && ['回頭剋', '化退', '化墓', '化絕'].includes(yong.change.type) ? yong.change.type : '',
    yong.j.mu ? '入日墓' : '',
    jiMoving.length && !yuanMoving.length ? '忌神發動' : '',
    yong.hard ? '伏藏難出' : '',
  ].filter(Boolean);
  const good = [
    yong.change && ['回頭生', '化進'].includes(yong.change.type) ? yong.change.type : '',
    yuanMoving.length ? '原神發動' : '',
  ].filter(Boolean);
  let tone = 'mid';
  if (!bad.length && (yong.j.level === 2 || (yong.j.level === 1 && good.length))) tone = 'good';
  else if (yong.j.level === 0 && bad.length) tone = 'care';
  const LEVEL = ['無力', '一助一傷', '有力'];
  let verdict = '用神一助一傷：事情可以成，但要等時機或補強弱點。';
  if (tone === 'good') verdict = '用神有力、沒有受傷：這件事有底氣，照計畫推進。';
  else if (tone === 'care') verdict = `用神沒力又受傷（${bad.join('、')}）：短期不容易如願，先保守，等應期再動。`;
  else if (bad.length) verdict = `用神${LEVEL[yong.j.level]}，又有${bad.join('、')}的問題：做得成，要先處理卡住的地方。`;
  else if (yong.j.level === 0) verdict = '用神偏弱，但沒有受傷：力道還不夠，等生旺的日子（看下面的轉機）再推進。';

  const pairs = [0, 1, 2].map((i) => [zhis[i], zhis[i + 3]]);
  let shape = '';
  if (pairs.every(([a, b]) => CHONG[a] === b)) shape = '六沖卦：事情容易散、變動快，談的事難持久（煩惱、病痛逢沖反而容易散）。';
  else if (pairs.every(([a, b]) => HE[a] === b)) shape = '六合卦：事情容易聚合、談得攏（想抽身就不容易）。';
  const shiRow = rows[shiPos - 1];
  const yingRow = rows[yingPos - 1];

  const castDate = { y: when.y, m: when.m, d: when.d };
  const nextJie = lunar.getNextJie(true).getSolar();
  const jieAfter = Math.round((Date.UTC(nextJie.getYear(), nextJie.getMonth() - 1, nextJie.getDay()) - Date.UTC(when.y, when.m - 1, when.d)) / 86400000);
  const timing = datesFor(timingOf(yong, t, jieAfter), castDate);

  return {
    palace: { name: palace.name, wx: palace.wx, order: palace.order, orderName: ORDER_NAME[palace.order] },
    monthZhi: t.monthZhi,
    day: `${t.dayGan}${t.dayZhi}`,
    kong: t.kong,
    rows,
    target: { ...target, label: target.qin || (target.at === 'shi' ? '世爻' : '應爻') },
    yong: { ...yong, level: LEVEL[yong.j.level] },
    pickNote,
    godNotes,
    shiYing: SHI_YING_NOTE[rel(yingRow.wx, shiRow.wx)],
    shape,
    tone,
    verdict,
    bad,
    good,
    timing,
  };
}
