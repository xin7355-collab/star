// AR 星空的計算：此刻在某個地點，太陽、月亮、行星在天上的哪裡（方位角、高度角）、黃道十二宮落在天上哪一條線，
// 以及手機鏡頭朝某個方向時，它們會出現在螢幕的哪裡（透視投影）。純函式，可在 Node 測試；畫面在 js/ui/ar-sky.js。
//
// 座標：地平座標 x＝東、y＝北、z＝天頂；方位角北＝0°、順時針；手機座標照 W3C DeviceOrientation：
// x＝螢幕右、y＝螢幕上、z＝從螢幕指向自己，旋轉矩陣 R＝Rz(alpha)·Rx(beta)·Ry(gamma) 把手機座標轉到地平座標，
// 鏡頭（手機背面）朝 −z。行星位置用 astronomy-engine（地心視位置＋站心修正、大氣折射），和星盤用同一套函式庫。

import * as Astronomy from '../../vendor/astronomy.min.js';
import { BODIES } from './astro.js';
import { SIGNS, signOfLongitude, degreeInSign } from './zodiac.js';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const norm = (d) => ((d % 360) + 360) % 360;

/** 沒有定位時用台北：台灣南北差約 3°，看行星在哪個方向、多高，誤差肉眼看不出來 */
export const DEFAULT_PLACE = { lat: 25.04, lon: 121.56, label: '台北' };

// 冥王星太暗、肉眼看不到，AR 不畫
const SKY_BODIES = BODIES.filter((b) => b.key !== 'Pluto');

/**
 * 此刻天上的東西。
 * @param {Date|number} date
 * @param {{lat:number, lon:number}} place
 * @returns {{bodies:{key,name,az,alt,lon,sign,deg,phase?:number}[], ecliptic:{lon,az,alt}[], signs:{index,name,az,alt}[]}}
 */
export function skyNow(date, place = DEFAULT_PLACE) {
  const time = Astronomy.MakeTime(date instanceof Date ? date : new Date(date));
  const obs = new Astronomy.Observer(place.lat, place.lon, 0);
  const bodies = SKY_BODIES.map((b) => {
    const body = Astronomy.Body[b.key];
    const eq = Astronomy.Equator(body, time, obs, true, true);
    const hor = Astronomy.Horizon(time, obs, eq.ra, eq.dec, 'normal');
    const lon = norm(Astronomy.Ecliptic(Astronomy.GeoVector(body, time, true)).elon);
    const out = { key: b.key, name: b.name, az: hor.azimuth, alt: hor.altitude, lon, sign: signOfLongitude(lon), deg: degreeInSign(lon) };
    // 月相（0＝新月、90＝上弦、180＝滿月、270＝下弦），畫月亮的亮面用
    if (b.key === 'Moon') out.phase = Astronomy.MoonPhase(time);
    return out;
  });
  // 黃道：真黃道（of date）上每 5° 一點，轉成地平座標；十二宮的名字放在每宮正中間（15°、45°…）
  const rot = Astronomy.CombineRotation(Astronomy.Rotation_ECT_EQD(time), Astronomy.Rotation_EQD_HOR(time, obs));
  const toHor = (lon) => {
    const v = Astronomy.RotateVector(rot, Astronomy.VectorFromSphere(new Astronomy.Spherical(0, lon, 1), time));
    const s = Astronomy.HorizonFromVector(v, 'normal');
    return { lon, az: s.lon, alt: s.lat };
  };
  const ecliptic = [];
  for (let lon = 0; lon < 360; lon += 5) ecliptic.push(toHor(lon));
  const signs = SIGNS.map((sg, i) => ({ index: i, name: sg.name, ...toHor(i * 30 + 15) }));
  return { bodies, ecliptic, signs };
}

/** 方位角、高度角 → 地平座標的單位向量 */
export function enu(az, alt) {
  const ca = Math.cos(alt * RAD);
  return [ca * Math.sin(az * RAD), ca * Math.cos(az * RAD), Math.sin(alt * RAD)];
}

/** W3C DeviceOrientation 的旋轉矩陣（列優先 3×3）：手機座標 → 地平座標 */
export function rotationMatrix(alpha, beta, gamma) {
  const a = alpha * RAD;
  const b = beta * RAD;
  const g = gamma * RAD;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
  return [
    [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
    [sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg],
    [-cb * sg, sb, cb * cg],
  ];
}

/** 沒有感測器時用拖曳：鏡頭朝方位角 az、仰角 alt（手機直立、不歪）的旋轉矩陣 */
export const lookMatrix = (az, alt) => rotationMatrix(-az, 90 + alt, 0);

/** 鏡頭（手機背面）朝的方位角、高度角 */
export function cameraDirection(R) {
  const c = [-R[0][2], -R[1][2], -R[2][2]];
  return { az: norm(Math.atan2(c[0], c[1]) * DEG), alt: Math.asin(Math.max(-1, Math.min(1, c[2]))) * DEG };
}

/**
 * iPhone 的 alpha 是相對角度（起點任意），要用指南針 webkitCompassHeading 換成以北為準。
 * 手機平放時指南針是手機頭的方位、直立時是鏡頭的方位，兩種姿勢都滿足「絕對 alpha＝360－指南針」，
 * 所以偏移量＝相對 alpha＋指南針（取 0～360）。之後用「相對 alpha－偏移量」：陀螺儀反應快，指南針只用來慢慢校正。
 */
export const iosOffset = (alphaRel, compassHeading) => norm(alphaRel + compassHeading);

/**
 * 透視投影：天體（地平座標單位向量 v）在螢幕上的位置；在鏡頭後面（或剛好 90° 旁邊）回傳 null。
 * @param {number[][]} R rotationMatrix 的結果
 * @param {{f:number, cx:number, cy:number, screenAngle?:number}} view f＝焦距（像素）；螢幕轉橫向時 screenAngle＝90／270
 */
export function project(R, v, { f, cx, cy, screenAngle = 0 }) {
  const dx = R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2];
  const dy = R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2];
  const dz = R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2];
  if (dz > -0.08) return null; // 和鏡頭方向夾角超過約 85°：投影會跑到無限遠，不畫
  let x = dx / -dz;
  let y = dy / -dz;
  if (screenAngle) {
    const t = screenAngle * RAD;
    [x, y] = [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
  }
  return { x: cx + f * x, y: cy - f * y };
}

/** 兩個方向的夾角（度） */
export function separation(az1, alt1, az2, alt2) {
  const a = enu(az1, alt1);
  const b = enu(az2, alt2);
  return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * DEG;
}

/** 鏡頭中心附近（maxDeg 以內）最近的天體；沒有回傳 null */
export function nearest(cam, bodies, maxDeg = 7) {
  let best = null;
  for (const b of bodies) {
    const d = separation(cam.az, cam.alt, b.az, b.alt);
    if (d <= maxDeg && (!best || d < best.d)) best = { body: b, d };
  }
  return best ? best.body : null;
}

const DIR8 = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
/** 「東南方、高 35°」這種講法（文字版清單、螢幕閱讀器用） */
export function describe(b) {
  const dir = DIR8[Math.round(norm(b.az) / 45) % 8];
  return b.alt >= 0 ? `${dir}方、高 ${Math.round(b.alt)}°` : `${dir}方、在地平線下 ${Math.round(-b.alt)}°`;
}

// 行星的意義（AR 對準時顯示一句）：和星盤、配對的用語一致
export const SKY_MEANING = {
  Sun: '自我、活力與目標',
  Moon: '情緒、安全感與家',
  Mercury: '思考、溝通、交通',
  Venus: '感情、美感與錢',
  Mars: '行動力、衝勁與慾望',
  Jupiter: '幸運、擴張與成長',
  Saturn: '責任、紀律與考驗',
  Uranus: '突破、意外與改變',
  Neptune: '直覺、夢想與迷惘',
};

/** 月相的名稱 */
export function phaseName(deg) {
  const p = norm(deg);
  if (p < 22.5 || p >= 337.5) return '新月';
  if (p < 67.5) return '眉月';
  if (p < 112.5) return '上弦月';
  if (p < 157.5) return '盈凸月';
  if (p < 202.5) return '滿月';
  if (p < 247.5) return '虧凸月';
  if (p < 292.5) return '下弦月';
  return '殘月';
}
