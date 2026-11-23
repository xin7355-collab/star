// 天文計算：包裝 astronomy-engine（MIT, Don Cross），全部在手機上離線運算。
// 行星黃經的算法與 lilith-diviner scripts/astrology.py chart()（MIT）一致：
// 地心、含光行差、真黃道（of date），熱帶黃道。

import * as Astronomy from '../../vendor/astronomy.min.js';
import { DEGREE_ASPECTS, signOfLongitude } from './zodiac.js';

export const BODIES = [
  { key: 'Sun', name: '太陽' },
  { key: 'Moon', name: '月亮' },
  { key: 'Mercury', name: '水星' },
  { key: 'Venus', name: '金星' },
  { key: 'Mars', name: '火星' },
  { key: 'Jupiter', name: '木星' },
  { key: 'Saturn', name: '土星' },
  { key: 'Uranus', name: '天王星' },
  { key: 'Neptune', name: '海王星' },
  { key: 'Pluto', name: '冥王星' },
];

export const BODY_NAME = Object.fromEntries(BODIES.map((b) => [b.key, b.name]));

const DAY_MS = 86400000;

function norm360(x) {
  return ((x % 360) + 360) % 360;
}

/** 行星的視黃經（度）。date 可為 Date 或 UTC 毫秒 */
export function bodyLongitude(key, date) {
  const time = Astronomy.MakeTime(date instanceof Date ? date : new Date(date));
  const vec = Astronomy.GeoVector(Astronomy.Body[key], time, true);
  return norm360(Astronomy.Ecliptic(vec).elon);
}

/** 黃經每日變化量（負值 = 逆行） */
export function bodySpeed(key, utcMs) {
  const before = bodyLongitude(key, utcMs - 0.05 * DAY_MS);
  const after = bodyLongitude(key, utcMs + 0.05 * DAY_MS);
  return (norm360(after - before + 180) - 180) / 0.1;
}

/** 某時刻所有行星位置 */
export function positionsAt(utcMs, keys = BODIES.map((b) => b.key)) {
  const out = {};
  for (const key of keys) {
    const lon = bodyLongitude(key, utcMs);
    const speed = key === 'Sun' || key === 'Moon' ? null : bodySpeed(key, utcMs);
    out[key] = {
      key,
      name: BODY_NAME[key],
      lon,
      sign: signOfLongitude(lon),
      retrograde: speed !== null && speed < 0,
    };
  }
  return out;
}

/**
 * 上升點（ASC）與天頂（MC）。
 * 公式：恆星時 + 真黃赤交角；與 tianji fortune_calc.py calc_ascendant()（MIT）同一組球面三角公式，
 * 並以 lilith-diviner calculate_angles() 的結果交叉驗算（見 tests/astro.test.js）。
 */
export function anglesAt(utcMs, latitude, longitude) {
  if (!(latitude > -66.5 && latitude < 66.5)) {
    throw new Error('高緯度地區（極圈內）上升點計算不穩定，暫不支援');
  }
  const time = Astronomy.MakeTime(new Date(utcMs));
  const gast = Astronomy.SiderealTime(time); // 小時
  const ramc = (norm360(gast * 15 + longitude) * Math.PI) / 180;
  const eps = (Astronomy.e_tilt(time).tobl * Math.PI) / 180;
  const phi = (latitude * Math.PI) / 180;
  const asc = norm360(
    (Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) * 180) / Math.PI,
  );
  const mc = norm360((Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) * 180) / Math.PI);
  return { ASC: asc, DSC: norm360(asc + 180), MC: mc, IC: norm360(mc + 180) };
}

/** 本命盤相位（度數容許度） */
export function findAspects(positions) {
  const keys = Object.keys(positions);
  const results = [];
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const a = positions[keys[i]];
      const b = positions[keys[j]];
      const separation = Math.abs(norm360(a.lon - b.lon + 180) - 180);
      for (const asp of DEGREE_ASPECTS) {
        const orb = Math.abs(separation - asp.angle);
        if (orb <= asp.orb) {
          results.push({ a: a.key, b: b.key, name: asp.name, angle: asp.angle, orb });
          break;
        }
      }
    }
  }
  return results.sort((x, y) => x.orb - y.orb);
}

/** 太陽到達某黃經的時刻（UTC 毫秒），找不到回傳 null */
export function searchSunLongitude(targetLon, startMs, limitDays) {
  const t = Astronomy.SearchSunLongitude(targetLon, Astronomy.MakeTime(new Date(startMs)), limitDays);
  return t ? t.date.getTime() : null;
}

/** 以二分法找出行星在 [t0, t1] 間跨入下一個星座的時刻（區間內只能有一次換座） */
export function findIngress(key, t0, t1) {
  let lo = t0;
  let hi = t1;
  const signLo = signOfLongitude(bodyLongitude(key, lo));
  for (let i = 0; i < 40 && hi - lo > 30000; i += 1) {
    const mid = (lo + hi) / 2;
    if (signOfLongitude(bodyLongitude(key, mid)) === signLo) lo = mid;
    else hi = mid;
  }
  return hi;
}
