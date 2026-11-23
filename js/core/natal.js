// 本命資料：
// ・知道出生時間 → 精確星盤（有出生地才算上升、天頂、宮位）
// ・不知道出生時間 → 不假設午夜，改算「出生當天」的可能範圍，並找出換座的確切時刻
//   （做法參考 lilith-diviner astrology.py date_ranges() 的 97 點抽樣，MIT，以 JS 重寫並加上換座時刻搜尋）

import { addDays, formatDate } from './date.js';
import { localToUtc, localToUtcLenient, formatZoneTime, offsetMinutes, formatOffset } from './tz.js';
import { BODIES, positionsAt, anglesAt, findAspects, searchSunLongitude, findIngress, bodyLongitude } from './astro.js';
import { SIGNS, signOfLongitude } from './zodiac.js';

const SAMPLES = 96;

/**
 * @param {{date:{y,m,d}, time?:{h,mi}|null, tz:string, place?:{lat:number, lon:number, name?:string}|null, fold?:0|1}} input
 */
export function buildNatal(input) {
  const { date, time, tz, place, fold } = input;
  if (time) return buildTimed(date, time, tz, place, fold);
  return buildDateOnly(date, tz);
}

function buildTimed(date, time, tz, place, fold) {
  const conv = localToUtc({ ...date, h: time.h, mi: time.mi }, tz, fold);
  if (conv.status === 'nonexistent') {
    return {
      ok: false,
      error: '這個時刻因日光節約時間被跳過，在當地不存在。請核對出生證明上的時間。',
    };
  }
  if (conv.status === 'ambiguous') {
    return {
      ok: false,
      needFold: true,
      error: '這個時刻因日光節約時間結束出現兩次，請選擇是第一次還是第二次。',
      options: conv.candidates.map((utc, i) => ({ fold: i, label: `${i === 0 ? '第一次' : '第二次'}（${formatOffset(offsetMinutes(utc, tz))}）` })),
    };
  }
  const utcMs = conv.utcMs;
  const positions = positionsAt(utcMs);
  const result = {
    ok: true,
    mode: 'timed',
    date,
    time,
    tz,
    utcMs,
    offsetLabel: formatOffset(offsetMinutes(utcMs, tz)),
    sun: { sign: positions.Sun.sign, lon: positions.Sun.lon, certain: true },
    moon: { sign: positions.Moon.sign, lon: positions.Moon.lon, certain: true },
    positions,
    aspects: findAspects(positions),
    angles: null,
    houses: null,
    warnings: [],
  };
  result.cusp = sunCuspNote(positions.Sun.lon);
  if (place) {
    try {
      const angles = anglesAt(utcMs, place.lat, place.lon);
      const first = Math.floor(angles.ASC / 30) * 30; // 整宮制
      result.angles = angles;
      result.rising = signOfLongitude(angles.ASC);
      result.houses = { system: '整宮制', firstSignLon: first };
      for (const body of Object.values(positions)) {
        body.house = Math.floor((((body.lon - first) % 360) + 360) % 360 / 30) + 1;
      }
    } catch (err) {
      result.warnings.push(err.message);
    }
  } else {
    result.warnings.push('沒有出生地，未計算上升星座與宮位。');
  }
  return result;
}

function sunCuspNote(lon) {
  const deg = lon % 30;
  if (deg < 1) return `太陽剛進入${SIGNS[signOfLongitude(lon)].name}（${deg.toFixed(1)}°），接近星座交界。`;
  if (deg > 29) return `太陽在${SIGNS[signOfLongitude(lon)].name}末端（${deg.toFixed(1)}°），接近星座交界。`;
  return null;
}

function buildDateOnly(date, tz) {
  const start = localToUtcLenient({ ...date, h: 0, mi: 0 }, tz);
  const end = localToUtcLenient({ ...addDays(date, 1), h: 0, mi: 0 }, tz);
  const samples = [];
  for (let i = 0; i <= SAMPLES; i += 1) samples.push(start + ((end - start) * i) / SAMPLES);

  const ranges = {};
  for (const { key, name } of BODIES) {
    const signs = [];
    for (const t of samples) {
      const s = signOfLongitude(bodyLongitude(key, t));
      if (!signs.includes(s)) signs.push(s);
    }
    ranges[key] = { key, name, signs };
  }

  const result = {
    ok: true,
    mode: 'date-only',
    date,
    time: null,
    tz,
    dayStartUtc: start,
    dayEndUtc: end,
    ranges,
    sun: rangeSummary('Sun', ranges.Sun.signs, start, end, tz),
    moon: rangeSummary('Moon', ranges.Moon.signs, start, end, tz),
    warnings: ['沒有出生時間：只列出生當天的可能範圍，不計算上升星座、宮位與精確相位。'],
  };
  return result;
}

function rangeSummary(key, signs, start, end, tz) {
  if (signs.length === 1) {
    return { sign: signs[0], certain: true };
  }
  // 太陽、月亮一天內最多換座一次
  const [before, after] = signs;
  let switchUtc;
  if (key === 'Sun') {
    switchUtc = searchSunLongitude(after * 30, start, 2) ?? findIngress(key, start, end);
  } else {
    switchUtc = findIngress(key, start, end);
  }
  return {
    sign: before,
    certain: false,
    options: [before, after],
    switchUtc,
    switchLocal: formatZoneTime(switchUtc, tz),
  };
}

/** 一句話描述（給結果卡與分享圖用） */
export function describePlacement(label, placement) {
  if (!placement) return `${label}：—`;
  if (placement.certain) return `${label}：${SIGNS[placement.sign].name}`;
  const [a, b] = placement.options;
  return `${label}：${placement.switchLocal} 前是${SIGNS[a].name}，之後是${SIGNS[b].name}`;
}

export function describeBirth(natal, era) {
  const d = formatDate(natal.date, era);
  if (natal.time) {
    const hh = String(natal.time.h).padStart(2, '0');
    const mm = String(natal.time.mi).padStart(2, '0');
    return `${d} ${hh}:${mm}（${natal.offsetLabel}）`;
  }
  return `${d}（未填時間）`;
}

/** 配對與運勢用：取出各行星的「可能星座」清單 */
export function signOptions(natal, key) {
  if (!natal) return null;
  if (natal.mode === 'timed') return [natal.positions[key].sign];
  return natal.ranges[key].signs;
}
