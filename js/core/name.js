// 姓名學：台灣最常見的「熊崎式」五格剖象＋三才＋81 數理，再加上唸法（音律）與八字五行的搭配。
//
// 計算規則（各派大同小異，這裡用最通行的版本，並在畫面上說明）：
// ・筆畫用康熙筆畫（js/core/kangxi-data.js，由 Unicode Unihan 換算）；國字數字一～十以數值計（「四」算 4 畫）。
// ・天格＝單姓＋1（複姓＝兩字相加）；人格＝姓的最後一字＋名的第一字；
//   地格＝單名＋1（複名＝名字相加）；總格＝全部相加；外格＝天格＋地格－人格
//   （這條通式在單姓單名得 2、單姓複名得「名末字＋1」、複姓複名得「姓首字＋名末字」，與傳統定義一致）。
// ・超過 81 的數減 80 再看吉凶；五行看個位數：1、2 木，3、4 火，5、6 土，7、8 金，9、0 水。
// ・三才看天格、地格對人格的五行生剋（規則寫在 sancai()）。和一份傳統 125 組固定表比對約七成相符，
//   不同處多是各派特例（例如把「木剋土」當成「樹植於土」的吉配）；畫面上會註明這是依生剋推算。

import { NUMBERS_81, GRADE_TEXT, WEALTH_NUMBERS, GRID_TEXT, SANCAI_RELATION } from './name-texts.js';
import { toZhuyin, initialOf } from './zhuyin.js';
import { yongShen, avoidReason } from './bazi.js';

export const COMPOUND_SURNAMES = [
  '歐陽', '司馬', '上官', '諸葛', '東方', '皇甫', '尉遲', '公孫', '慕容', '長孫', '夏侯', '軒轅', '令狐', '端木',
  '司徒', '南宮', '西門', '獨孤', '宇文', '鍾離', '呼延', '澹臺', '申屠', '濮陽', '淳于', '赫連', '百里', '東郭',
  '聞人', '司空', '萬俟', '范姜', '張簡', '張廖',
];

const NUMBER_VALUE = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const WX_BY_DIGIT = ['水', '木', '木', '火', '火', '土', '土', '金', '金', '水'];
const WUXING = ['木', '火', '土', '金', '水'];
const HAN = /^\p{Script=Han}$/u;

export const elementOfNumber = (n) => WX_BY_DIGIT[n % 10];

/** 超過 81 的數理減 80（82 → 2） */
export function reduce81(n) {
  let x = n;
  while (x > 81) x -= 80;
  return x;
}

/** 由產生好的資料建立查詢表（拆成函式是為了在 Node 測試裡直接餵資料） */
export function buildData({ STROKES, READ }) {
  const strokes = new Map();
  STROKES.forEach((chars, n) => {
    for (const ch of chars) strokes.set(ch, n);
  });
  const reads = new Map();
  for (const m of READ.matchAll(/([^\x00-\x7f])([a-z]+)([1-5])/gu)) reads.set(m[1], { pinyin: m[2], tone: Number(m[3]) });
  return { strokes, reads };
}

let dataPromise = null;
/** 康熙筆畫資料約 85KB（壓縮後），只有打開姓名分析才載入；載入失敗下次可再試 */
export function loadNameData() {
  if (!dataPromise) {
    dataPromise = import('./kangxi-data.js').then(buildData).catch((err) => {
      dataPromise = null;
      throw err;
    });
  }
  return dataPromise;
}

// 常見破音字姓氏：資料庫給的是最常用的讀音，當姓時要改讀
const SURNAME_READ = { 曾: ['zeng', 1], 單: ['shan', 4], 解: ['xie', 4], 仇: ['qiu', 2], 區: ['ou', 1], 查: ['zha', 1], 繆: ['miao', 4], 覃: ['qin', 2], 樂: ['yue', 4], 召: ['shao', 4], 蓋: ['ge', 3], 華: ['hua', 4], 任: ['ren', 2], 燕: ['yan', 1], 紀: ['ji', 3], 種: ['chong', 2], 尉: ['yu', 4], 万: ['mo', 4] };

export function charInfo(ch, data, { asSurname = false, override = null } = {}) {
  let read = data.reads.get(ch) || null;
  if (asSurname && SURNAME_READ[ch]) read = { pinyin: SURNAME_READ[ch][0], tone: SURNAME_READ[ch][1] };
  const zhuyin = read ? toZhuyin(read.pinyin, read.tone) : null;
  if (Number.isInteger(override) && override > 0) return { char: ch, strokes: override, source: '手動輸入', read, zhuyin };
  if (NUMBER_VALUE[ch]) return { char: ch, strokes: NUMBER_VALUE[ch], source: '數字以數值計', read, zhuyin };
  const s = data.strokes.get(ch);
  return { char: ch, strokes: s || null, source: s ? '康熙筆畫' : null, read, zhuyin };
}

/**
 * 拆姓與名。surnameLength 0＝自動（常見複姓自動判斷），1 或 2＝使用者指定（冠夫姓、雙姓請選 2）。
 */
export function splitName(full, surnameLength = 0) {
  const chars = Array.from(String(full || '').replace(/\s+/g, ''));
  if (chars.length < 2 || chars.length > 6) return { ok: false, error: '請輸入 2～6 個中文字的姓名（含姓氏）。' };
  if (!chars.every((c) => HAN.test(c))) return { ok: false, error: '姓名學只能分析中文字，請不要包含英文、數字、空白或符號。' };
  let n = surnameLength === 1 || surnameLength === 2 ? surnameLength : 0;
  if (!n) n = chars.length >= 3 && COMPOUND_SURNAMES.includes(chars[0] + chars[1]) ? 2 : 1;
  if (n >= chars.length) return { ok: false, error: '名字至少要有一個字。若是複姓，請確認姓氏字數。' };
  return { ok: true, surname: chars.slice(0, n), given: chars.slice(n) };
}

function numberCard(value) {
  const n81 = reduce81(value);
  const info = NUMBERS_81[n81];
  return { value, n81, element: elementOfNumber(value), grade: info.grade, gradeText: GRADE_TEXT[info.grade], title: info.title, text: info.text, disputed: info.disputed, wealth: WEALTH_NUMBERS.has(n81) };
}

/** 五格（輸入是每個字的康熙筆畫） */
export function wuge(surnameStrokes, givenStrokes) {
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const tian = surnameStrokes.length === 1 ? surnameStrokes[0] + 1 : sum(surnameStrokes);
  const ren = surnameStrokes[surnameStrokes.length - 1] + givenStrokes[0];
  const di = givenStrokes.length === 1 ? givenStrokes[0] + 1 : sum(givenStrokes);
  const zong = sum(surnameStrokes) + sum(givenStrokes);
  const wai = tian + di - ren;
  const grids = { 天格: tian, 人格: ren, 地格: di, 外格: wai, 總格: zong };
  return Object.fromEntries(Object.entries(grids).map(([k, v]) => [k, { ...numberCard(v), ...GRID_TEXT[k] }]));
}

const gen = (a) => WUXING[(WUXING.indexOf(a) + 1) % 5];
const ovc = (a) => WUXING[(WUXING.indexOf(a) + 2) % 5];

/** x 對人格 r 的關係：生（x 生 r）、同、洩（r 生 x）、耗（r 剋 x）、剋（x 剋 r） */
export function relationTo(x, r) {
  if (x === r) return '同';
  if (gen(x) === r) return '生';
  if (gen(r) === x) return '洩';
  if (ovc(r) === x) return '耗';
  return '剋';
}

// 相生不分方向都算順（傳統三才的看法）；被地格剋最傷，因為地格是根基
const TR_SCORE = { 生: 2, 同: 1, 洩: 1, 耗: -0.5, 剋: -1 };
const DR_SCORE = { 生: 2, 同: 1, 洩: 1, 耗: -0.5, 剋: -2.5 };

export function sancai(tianEl, renEl, diEl) {
  const tr = relationTo(tianEl, renEl);
  const dr = relationTo(diEl, renEl);
  const score = TR_SCORE[tr] + DR_SCORE[dr];
  const grade = score >= 1.5 ? 'good' : score <= 0 ? 'bad' : 'mixed';
  const summary = {
    good: '三才順：上有助力、下有根基，做事比較不卡。',
    mixed: '三才普通：有幫助也有拉扯，靠自己調整就能順。',
    bad: '三才有剋：容易覺得上下夾擊或根基不穩，名字以外更要靠穩健的習慣補強。',
  }[grade];
  return { elements: `${tianEl}${renEl}${diEl}`, tian: tianEl, ren: renEl, di: diEl, tr, dr, grade, gradeText: GRADE_TEXT[grade], summary, lines: [SANCAI_RELATION.tr[tr], SANCAI_RELATION.dr[dr]] };
}

const PING = new Set([1, 2]);

/** 唸法：注音、聲調起伏、連續三聲、相鄰聲母相同 */
export function phonetics(infos) {
  const known = infos.filter((c) => c.read);
  if (known.length !== infos.length) return { ok: false, text: '有字查不到讀音，無法分析唸法。', chars: infos.map((c) => ({ char: c.char, zhuyin: c.zhuyin })) };
  const tones = known.map((c) => c.read.tone);
  const pattern = tones.map((t) => (PING.has(t) ? '平' : '仄')).join('');
  const notes = [];
  if (new Set(tones).size === 1) notes.push(`每個字都是第 ${tones[0]} 聲，唸起來比較平板，聲調有高低起伏會更好聽。`);
  else if (/^平+$/.test(pattern)) notes.push('全部是平聲（一、二聲），聽起來柔和，但比較沒有力道。');
  else if (/^仄+$/.test(pattern)) notes.push('全部是仄聲（三、四聲），聽起來有力，但連唸稍嫌硬。');
  else notes.push(`平仄是「${pattern}」，聲調有起伏，唸起來有節奏、好記。`);
  for (let i = 0; i + 1 < known.length; i += 1) {
    if (tones[i] === 3 && tones[i + 1] === 3) notes.push(`「${known[i].char}${known[i + 1].char}」連續兩個三聲，唸的時候前一字會變成二聲，屬正常變調。`);
    const a = initialOf(known[i].read.pinyin);
    if (a && a === initialOf(known[i + 1].read.pinyin)) notes.push(`「${known[i].char}${known[i + 1].char}」聲母相同（${known[i].zhuyin[0]}），連著唸比較容易咬到舌頭。`);
  }
  if (known.some((c, i) => i > 0 && c.char === known[i - 1].char)) notes.push('有疊字，親切好記。');
  return { ok: true, pattern, tones, chars: known.map((c) => ({ char: c.char, zhuyin: c.zhuyin, tone: c.read.tone })), notes };
}

/**
 * 名字的五行（人格、地格、總格）和八字喜用神（bazi.js 的 yongShen，依日主強弱判斷）的搭配。
 */
export function nameVsBazi(grids, bazi) {
  const ys = yongShen(bazi);
  if (!ys) return null;
  const nameEls = [['人格', grids.人格.element], ['地格', grids.地格.element], ['總格', grids.總格.element]];
  const helps = nameEls.filter(([, el]) => el === ys.primary || el === ys.secondary);
  const extra = nameEls.filter(([, el]) => ys.avoid.includes(el));
  const lines = [`你的八字${ys.strength}，喜用五行是「${ys.primary}」，其次是「${ys.secondary}」；忌神是「${ys.avoid.join('、')}」（${avoidReason(ys)}）。`];
  if (helps.length) lines.push(`名字的${helps.map(([g, el]) => `${g}屬${el}`).join('、')}，剛好是你的喜用五行，這是加分的搭配。`);
  else lines.push(`名字的人格、地格、總格是「${nameEls.map(([, el]) => el).join('、')}」，沒有直接補到喜用的「${ys.primary}」，可以從穿搭顏色、居家擺設補強（見「開運佈置」）。`);
  if (extra.length) lines.push(`${extra.map(([g, el]) => `${g}屬${el}`).join('、')}，是你的忌神（${avoidReason(ys)}）。名字只是小影響，不必為此改名；日常別再刻意補這個五行就好。`);
  return { primary: ys.primary, secondary: ys.secondary, strength: ys.strength, helps: helps.map(([g]) => g), extra: extra.map(([g]) => g), lines };
}

const GRADE_POINT = { good: 100, mixed: 65, bad: 35 };

/**
 * 完整分析。
 * @param {string} fullName
 * @param {{strokes:Map, reads:Map}} data loadNameData() 的結果
 * @param {{surnameLength?:0|1|2, bazi?:object, overrides?:Object<string,number>}} options
 */
export function analyzeName(fullName, data, { surnameLength = 0, bazi = null, overrides = {} } = {}) {
  const split = splitName(fullName, surnameLength);
  if (!split.ok) return split;
  const surname = split.surname.map((ch) => charInfo(ch, data, { asSurname: true, override: overrides[ch] }));
  const given = split.given.map((ch) => charInfo(ch, data, { override: overrides[ch] }));
  const all = [...surname, ...given];
  const missing = all.filter((c) => !c.strokes).map((c) => c.char);
  if (missing.length) {
    return { ok: false, needStrokes: missing, chars: all, error: `查不到「${missing.join('、')}」的康熙筆畫（罕用字），請手動輸入筆畫數再分析。` };
  }
  const grids = wuge(surname.map((c) => c.strokes), given.map((c) => c.strokes));
  const sc = sancai(grids.天格.element, grids.人格.element, grids.地格.element);
  const sound = phonetics(all);
  const withBazi = nameVsBazi(grids, bazi);
  // 綜合分：人格 30、總格 25、地格 20、三才 15、外格 10（天格由姓氏決定、改不了，不計分）
  const score = Math.round(
    0.3 * GRADE_POINT[grids.人格.grade] + 0.25 * GRADE_POINT[grids.總格.grade] + 0.2 * GRADE_POINT[grids.地格.grade]
    + 0.15 * GRADE_POINT[sc.grade] + 0.1 * GRADE_POINT[grids.外格.grade],
  );
  const wealthGrids = Object.entries(grids).filter(([k, g]) => k !== '天格' && g.wealth).map(([k]) => k);
  const summary = [
    `人格 ${grids.人格.value}（${grids.人格.title}，${grids.人格.gradeText}）：${grids.人格.text}`,
    `地格 ${grids.地格.value}（${grids.地格.title}，${grids.地格.gradeText}）看年輕時的基礎；總格 ${grids.總格.value}（${grids.總格.title}，${grids.總格.gradeText}）看中年以後。`,
    `三才「${sc.elements}」${sc.gradeText}：${sc.summary}`,
  ];
  if (wealthGrids.length) summary.push(`${wealthGrids.join('、')}是姓名學常說的「財源數」，對理財與累積有加分。`);
  if (sound.ok) summary.push(sound.notes[0]);
  return {
    ok: true,
    fullName: all.map((c) => c.char).join(''),
    surname,
    given,
    grids,
    sancai: sc,
    phonetics: sound,
    bazi: withBazi,
    score,
    wealthGrids,
    summary,
  };
}
