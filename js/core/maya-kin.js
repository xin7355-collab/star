// 13 月亮曆（José Argüelles 1987 年設計的 Dreamspell，台灣常稱「星際瑪雅曆」）的銀河印記 KIN：
// 20 個圖騰 × 13 個調性＝260 天循環，每一天、每個人的生日都對到一個 KIN（1～260）。純函式，可在 Node 測試。
//
// 起算：2013-07-26＝KIN 164（黃色銀河種子年的第一天）。2 月 29 日不算日子（0.0 Hunab Ku），和 2 月 28 日同一個 KIN。
// 查證（都吻合這套算法）：2014-07-26 紅色太陽月亮年、2017-06-26＝KIN 34（白巫師、銀河、藍手波符）、
// 2024-07-26 藍色韻律風暴年、2025-07-26 共振黃種子年；2012-12-21＝KIN 207（藍色水晶手）。
// 注意：這是現代曆法，不是古馬雅人實際用的日曆（古典卓爾金曆 2012-12-21 是 4 Ajaw，算法不同）。
//
// 五大神諭（中間主印記，上引導、右支持、左挑戰、下隱藏推動）：
// - 引導：同調性、同顏色，圖騰＝主印記＋（調性的點數－1）×12（1、6、11 是自己；2、7、12 加 12……）
// - 支持（類比）：同調性，圖騰號碼相加＝19（滿 20 取餘數）
// - 挑戰（反向）：同調性，圖騰差 10（KIN 差 130）
// - 隱藏推動：圖騰＝21－主圖騰、調性＝14－主調性，兩個 KIN 相加＝261

export const SEALS = [
  { n: 1, name: '紅龍', color: 'red', en: 'Red Dragon', maya: 'Imix' },
  { n: 2, name: '白風', color: 'white', en: 'White Wind', maya: "Ik'" },
  { n: 3, name: '藍夜', color: 'blue', en: 'Blue Night', maya: "Ak'bal" },
  { n: 4, name: '黃種子', color: 'yellow', en: 'Yellow Seed', maya: "K'an" },
  { n: 5, name: '紅蛇', color: 'red', en: 'Red Serpent', maya: 'Chikchan' },
  { n: 6, name: '白世界橋', color: 'white', en: 'White World-Bridger', maya: 'Kimi' },
  { n: 7, name: '藍手', color: 'blue', en: 'Blue Hand', maya: "Manik'" },
  { n: 8, name: '黃星星', color: 'yellow', en: 'Yellow Star', maya: 'Lamat' },
  { n: 9, name: '紅月', color: 'red', en: 'Red Moon', maya: 'Muluk' },
  { n: 10, name: '白狗', color: 'white', en: 'White Dog', maya: 'Ok' },
  { n: 11, name: '藍猴', color: 'blue', en: 'Blue Monkey', maya: 'Chuwen' },
  { n: 12, name: '黃人', color: 'yellow', en: 'Yellow Human', maya: 'Eb' },
  { n: 13, name: '紅天行者', color: 'red', en: 'Red Skywalker', maya: 'Ben' },
  { n: 14, name: '白巫師', color: 'white', en: 'White Wizard', maya: 'Ix' },
  { n: 15, name: '藍鷹', color: 'blue', en: 'Blue Eagle', maya: 'Men' },
  { n: 16, name: '黃戰士', color: 'yellow', en: 'Yellow Warrior', maya: 'Kib' },
  { n: 17, name: '紅地球', color: 'red', en: 'Red Earth', maya: 'Kaban' },
  { n: 18, name: '白鏡', color: 'white', en: 'White Mirror', maya: "Etz'nab" },
  { n: 19, name: '藍風暴', color: 'blue', en: 'Blue Storm', maya: 'Kawak' },
  { n: 20, name: '黃太陽', color: 'yellow', en: 'Yellow Sun', maya: 'Ajaw' },
];

export const TONES = [
  { n: 1, name: '磁性', en: 'Magnetic' },
  { n: 2, name: '月亮', en: 'Lunar' },
  { n: 3, name: '電力', en: 'Electric' },
  { n: 4, name: '自我存在', en: 'Self-Existing' },
  { n: 5, name: '超頻', en: 'Overtone' },
  { n: 6, name: '韻律', en: 'Rhythmic' },
  { n: 7, name: '共振', en: 'Resonant' },
  { n: 8, name: '銀河', en: 'Galactic' },
  { n: 9, name: '太陽', en: 'Solar' },
  { n: 10, name: '行星', en: 'Planetary' },
  { n: 11, name: '光譜', en: 'Spectral' },
  { n: 12, name: '水晶', en: 'Crystal' },
  { n: 13, name: '宇宙', en: 'Cosmic' },
];

const ANCHOR = { y: 2013, m: 7, d: 26, kin: 164 };
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const mod = (a, n) => ((a % n) + n) % n;
const wrapSeal = (s) => mod(s - 1, 20) + 1;

/** 不算 2 月 29 日的天數（每年固定 365 天）；2/29 當成 2/28 */
function noLeapDays(y, m, d) {
  let day = m === 2 && d === 29 ? 28 : d;
  for (let i = 0; i < m - 1; i += 1) day += MONTH_DAYS[i];
  return y * 365 + day;
}

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** 日期合不合法（含閏年的 2/29） */
export function validDate({ y, m, d }) {
  if (![y, m, d].every(Number.isInteger) || y < 1800 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  return d <= (m === 2 && isLeap(y) ? 29 : MONTH_DAYS[m - 1]);
}

/** 西曆日期 → KIN（1～260）；日期不合法回傳 null */
export function kinOf(date) {
  if (!validDate(date)) return null;
  const days = noLeapDays(date.y, date.m, date.d) - noLeapDays(ANCHOR.y, ANCHOR.m, ANCHOR.d);
  return mod(ANCHOR.kin - 1 + days, 260) + 1;
}

export const sealOf = (kin) => mod(kin - 1, 20) + 1;
export const toneOf = (kin) => mod(kin - 1, 13) + 1;

/** 圖騰＋調性 → KIN（中國餘數定理：260 天裡剛好一天） */
export function kinFrom(seal, tone) {
  for (let k = seal; k <= 260; k += 20) if (toneOf(k) === tone) return k;
  return null;
}

/** 瑪雅數字：一條橫線＝5、一個點＝1（調性用這個畫） */
export const toneBarsDots = (tone) => ({ bars: Math.floor(tone / 5), dots: tone % 5 });

/** 五大神諭 */
export function oracleOf(kin) {
  const seal = sealOf(kin);
  const tone = toneOf(kin);
  const at = (s, t = tone) => ({ kin: kinFrom(s, t), seal: s, tone: t });
  return {
    destiny: at(seal),
    guide: at(wrapSeal(seal + ((tone - 1) % 5) * 12)),
    analog: at(wrapSeal(19 - seal)),
    antipode: at(wrapSeal(seal + 10)),
    occult: at(21 - seal, 14 - tone),
  };
}

/**
 * 一個 KIN 的完整資料：圖騰、調性、名稱、波符（13 天一組，從調性 1 那天開始；那天的圖騰就是波符的名字）、
 * 在波符裡第幾天、五大神諭。
 */
export function kinInfo(kin) {
  const seal = sealOf(kin);
  const tone = toneOf(kin);
  const start = mod(kin - 1 - (tone - 1), 260) + 1;
  return {
    kin,
    seal: SEALS[seal - 1],
    tone: TONES[tone - 1],
    title: `${TONES[tone - 1].name}${SEALS[seal - 1].name}`,
    wavespell: { kin: start, seal: SEALS[sealOf(start) - 1], day: tone, index: Math.ceil(start / 13) },
    oracle: oracleOf(kin),
  };
}

/** 生日 → 完整資料；2/29 生的人另外註明（沿用 2/28 的 KIN，也有人用 3/1） */
export function mayaKin(date) {
  const kin = kinOf(date);
  if (kin === null) return null;
  const info = kinInfo(kin);
  const leapDay = date.m === 2 && date.d === 29;
  return { ...info, leapDay, altKin: leapDay ? kinOf({ y: date.y, m: 3, d: 1 }) : null };
}

/**
 * 流年印記：13 月亮曆的看法，每年從生日那天開始，那天的 KIN 就是這一年的主題（還沒過今年生日就看去年生日那天）。
 * 2/29 生的人平年用 2/28（13 月亮曆本來就把 2/29 和 2/28 算成同一個 KIN）。
 * @returns 這個 KIN 的完整資料，加上 from（這一輪流年從哪天開始）
 */
export function yearKin(birth, today) {
  if (!validDate(birth) || !validDate(today)) return null;
  const dayIn = (y) => (birth.m === 2 && birth.d === 29 && !isLeap(y) ? 28 : birth.d);
  const passed = today.m > birth.m || (today.m === birth.m && today.d >= dayIn(today.y));
  const y = passed ? today.y : today.y - 1;
  const from = { y, m: birth.m, d: dayIn(y) };
  const kin = kinOf(from);
  return kin === null ? null : { ...kinInfo(kin), from };
}

/**
 * 今天和你的關係：今天的圖騰落在你五大神諭的哪個位置。
 * return＝銀河生日（同一個 KIN，260 天一次）、seal＝同圖騰、analog＝支持、antipode＝挑戰、occult＝隱藏推動、
 * guide＝引導（調性 1、6、11 的引導就是自己，會先算成 seal）、color＝同顏色家族、none＝沒有特別連結。
 */
export function dayRelation(dayKin, myKin) {
  if (dayKin === myKin) return 'return';
  const o = oracleOf(myKin);
  const s = sealOf(dayKin);
  if (s === o.destiny.seal) return 'seal';
  if (s === o.analog.seal) return 'analog';
  if (s === o.antipode.seal) return 'antipode';
  if (s === o.occult.seal) return 'occult';
  if (s === o.guide.seal) return 'guide';
  if (SEALS[s - 1].color === SEALS[o.destiny.seal - 1].color) return 'color';
  return 'none';
}

/** 下一次（含今天）KIN 等於 kin 的日子：銀河生日 260 天一次，中間遇到 2/29 會晚一天 */
export function nextKinDate(from, kin) {
  if (!validDate(from)) return null;
  let t = Date.UTC(from.y, from.m - 1, from.d);
  for (let days = 0; days <= 262; days += 1, t += 86400000) {
    const dt = new Date(t);
    const date = { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    if (kinOf(date) === kin) return { date, days };
  }
  return null;
}
