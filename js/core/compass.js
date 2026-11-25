// 手機指南針的計算：從感測器事件取出「手機頭朝的方位角」，換成八方位與二十四山，算要往哪邊轉幾度，並把抖動平滑掉。
// 角度一律「北＝0°、順時針」，和羅盤圖、九宮格一致。用的是磁北，和傳統羅盤一樣（台灣的磁偏角約 4～5°，看八方位時可以忽略）。
// 純函式，可在 Node 測試；聽事件、要權限在 js/ui/compass-live.js。

export const DIR_DEG = { 北: 0, 東北: 45, 東: 90, 東南: 135, 南: 180, 西南: 225, 西: 270, 西北: 315 };
// 二十四山，從正北（子）開始順時針，每 15°
export const MOUNTAINS = '子癸丑艮寅甲卯乙辰巽巳丙午丁未坤申庚酉辛戌乾亥壬';
const DIRS = Object.keys(DIR_DEG);

export const norm = (deg) => ((deg % 360) + 360) % 360;

/** 從 from 轉到 to 的有號角度（-180～180）：正的往右（順時針）轉 */
export function turn(from, to) {
  const d = norm(to - from);
  return d > 180 ? d - 360 : d;
}

/** 八方位（每個方位左右各 22.5°） */
export const dirOf = (deg) => DIRS[Math.round(norm(deg) / 45) % 8];
/** 二十四山（每山 15°，子山正北） */
export const mountainOf = (deg) => MOUNTAINS[Math.round(norm(deg) / 15) % 24];

/**
 * 感測器事件 → 手機頭朝的方位角（0～360）。
 * ・iPhone：webkitCompassHeading，系統已經換算好（0＝北、順時針）。
 * ・Android Chrome：deviceorientationabsolute 的 alpha 是逆時針角度，方位角＝360－alpha。
 * ・只有相對角度的事件（absolute 不是 true，例如電腦或部分 Android 的 deviceorientation）不能當指南針，回傳 null。
 * @param {number} screenAngle 螢幕轉成橫向時的角度（screen.orientation.angle），畫面上方才會對準手機轉過的方向
 * @returns {{heading:number, accuracy:number|null}|null} accuracy 是 iPhone 給的誤差度數（負數＝無效）
 */
export function headingFromEvent(e, screenAngle = 0) {
  if (!e) return null;
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading) && e.webkitCompassHeading >= 0) {
    return { heading: norm(e.webkitCompassHeading + screenAngle), accuracy: typeof e.webkitCompassAccuracy === 'number' ? e.webkitCompassAccuracy : null };
  }
  if ((e.absolute === true || e.type === 'deviceorientationabsolute') && typeof e.alpha === 'number' && Number.isFinite(e.alpha)) {
    return { heading: norm(360 - e.alpha + screenAngle), accuracy: null };
  }
  return null;
}

/**
 * 平滑：感測器每秒幾十筆、會抖，往新值靠一部分；跨過 0°／360° 時走短的那一邊。
 * 一下子轉很多（超過 60°，例如轉身）就直接跳過去，不要慢慢追。
 */
export function smooth(prev, next, k = 0.25) {
  if (prev == null) return norm(next);
  const d = turn(prev, next);
  return Math.abs(d) > 60 ? norm(next) : norm(prev + d * k);
}

/** 連續角度：畫面轉動用，不要在 359°→0° 時整圈倒轉回去 */
export const unwrap = (prevCont, next) => (prevCont == null ? next : prevCont + turn(norm(prevCont), next));

/**
 * 要往哪邊轉：差 15° 以內就算對準（八方位一格 45°，手持會晃）。
 * @returns {{delta:number, onTarget:boolean, side:'left'|'right'|null, text:string}}
 */
export function turnHint(heading, target, tolerance = 15) {
  const delta = turn(heading, target);
  if (Math.abs(delta) <= tolerance) return { delta, onTarget: true, side: null, text: '就是這個方向' };
  const deg = Math.max(5, Math.round(Math.abs(delta) / 5) * 5);
  return delta > 0
    ? { delta, onTarget: false, side: 'right', text: `往右轉 ${deg}°` }
    : { delta, onTarget: false, side: 'left', text: `往左轉 ${deg}°` };
}

/** 手機有沒有放平：前後、左右傾斜超過 50° 時，Android 的方位角會不準 */
export const isFlat = (beta, gamma) => beta == null || gamma == null || (Math.abs(beta) <= 50 && Math.abs(gamma) <= 50);
