// 運勢分數：以「當天行星所在星座」與「你的太陽星座」的整宮相位推算。
// 完全離線、可重現、可解釋（每一分都能列出來源），不使用亂數、不需要 API。
// 這是占星娛樂的推算規則，不是科學預測。

import { addDays, isoWeekday, daysInMonth, isoDate } from './date.js';
import { localToUtcLenient, DEFAULT_TZ } from './tz.js';
import { positionsAt, BODY_NAME } from './astro.js';
import { SIGNS, SIGN_ASPECTS, signDistance } from './zodiac.js';

export const PERIODS = [
  { id: 'today', label: '今日' },
  { id: 'tomorrow', label: '明日' },
  { id: 'week', label: '本週' },
  { id: 'month', label: '本月' },
  { id: 'year', label: '今年' },
];

// 「今年」每月取 1、8、15、22 日四天（48 天）估算：逐日算 365 天在舊手機上要 1 秒以上
const YEAR_SAMPLE_DAYS = [1, 8, 15, 22];

export const AREAS = [
  { id: 'love', label: '愛情' },
  { id: 'career', label: '事業' },
  { id: 'money', label: '財運' },
  { id: 'health', label: '健康' },
];

const TRANSIT_KEYS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

// 各領域參考哪些行星與權重
const WEIGHTS = {
  overall: { Sun: 1.0, Moon: 1.2, Mercury: 0.5, Venus: 0.5, Mars: 0.5, Jupiter: 0.9, Saturn: 0.8 },
  love: { Venus: 1.6, Moon: 1.0, Mars: 0.6 },
  career: { Sun: 1.0, Mercury: 0.6, Mars: 0.8, Jupiter: 1.0, Saturn: 1.2 },
  money: { Venus: 1.0, Moon: 0.4, Jupiter: 1.4, Saturn: 0.6 },
  health: { Sun: 0.8, Moon: 1.0, Mars: 1.2, Saturn: 0.5 },
};

const PLANET_CLASS = {
  Sun: 'neutral', Moon: 'neutral', Mercury: 'neutral',
  Venus: 'benefic', Jupiter: 'benefic',
  Mars: 'malefic', Saturn: 'malefic',
};

// 相位值：索引 = 相差格數 0~6（合、半六分、六分、四分、三分、梅花、對分）
const ASPECT_VALUE = {
  benefic: [0.9, 0.1, 0.6, -0.3, 1.0, -0.1, -0.2],
  neutral: [0.5, 0.1, 0.5, -0.5, 0.8, -0.2, -0.4],
  malefic: [-0.6, 0.0, 0.4, -0.9, 0.6, -0.3, -0.7],
};

function toScore(sum, weightSum) {
  const s = weightSum ? sum / weightSum : 0;
  return Math.round(50 + 45 * Math.tanh(1.8 * s));
}

/** 單日分數（取當地正午的行星位置） */
export function dayScores(signIndex, civilDate, tz = DEFAULT_TZ) {
  const utc = localToUtcLenient({ ...civilDate, h: 12, mi: 0 }, tz);
  const pos = positionsAt(utc, TRANSIT_KEYS);
  const transits = TRANSIT_KEYS.map((key) => {
    const steps = signDistance(signIndex, pos[key].sign);
    const value = ASPECT_VALUE[PLANET_CLASS[key]][steps];
    return { key, name: BODY_NAME[key], sign: pos[key].sign, steps, aspect: SIGN_ASPECTS[steps].name, value, retrograde: pos[key].retrograde };
  });
  const byKey = Object.fromEntries(transits.map((t) => [t.key, t]));
  const scores = {};
  for (const [area, weights] of Object.entries(WEIGHTS)) {
    let sum = 0;
    let wsum = 0;
    for (const [key, w] of Object.entries(weights)) {
      let v = byKey[key].value;
      if (key === 'Mercury' && byKey.Mercury.retrograde) v -= 0.3; // 水星逆行：溝通、文書多一分保守
      sum += w * v;
      wsum += w;
    }
    scores[area] = toScore(sum, wsum);
  }
  return { date: civilDate, scores, transits };
}

/** 期間包含的日期 */
export function periodDates(period, today) {
  if (period === 'today') return [today];
  if (period === 'tomorrow') return [addDays(today, 1)];
  if (period === 'week') {
    const monday = addDays(today, 1 - isoWeekday(today));
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }
  if (period === 'month') {
    const n = daysInMonth(today.y, today.m);
    return Array.from({ length: n }, (_, i) => ({ y: today.y, m: today.m, d: i + 1 }));
  }
  if (period === 'year') {
    return Array.from({ length: 12 }, (_, i) => YEAR_SAMPLE_DAYS.map((d) => ({ y: today.y, m: i + 1, d }))).flat();
  }
  throw new Error(`未知的期間：${period}`);
}

/**
 * 計算某星座在某期間的運勢。
 * @returns {{signIndex, period, dates, scores, days, highlights, notes, summary}}
 */
export function computeFortune(signIndex, period, today, tz = DEFAULT_TZ) {
  const dates = periodDates(period, today);
  const days = dates.map((d) => dayScores(signIndex, d, tz));
  const scores = {};
  for (const area of ['overall', ...AREAS.map((a) => a.id)]) {
    scores[area] = Math.round(days.reduce((acc, day) => acc + day.scores[area], 0) / days.length);
  }

  const first = days[0];
  const highlights = explainTransits(signIndex, first.transits, days.length > 1);
  const notes = [];
  if (days.some((d) => d.transits.find((t) => t.key === 'Mercury').retrograde)) {
    notes.push('期間內水星逆行：簽約、溝通、交通安排多確認一次。');
  }

  let best = null;
  let worst = null;
  let months = null;
  if (period === 'year') {
    months = Array.from({ length: 12 }, (_, i) => {
      const inMonth = days.filter((d) => d.date.m === i + 1);
      const avg = (area) => Math.round(inMonth.reduce((acc, d) => acc + d.scores[area], 0) / inMonth.length);
      return { m: i + 1, scores: Object.fromEntries(['overall', ...AREAS.map((a) => a.id)].map((a) => [a, avg(a)])) };
    });
    best = months.reduce((a, b) => (b.scores.overall > a.scores.overall ? b : a));
    worst = months.reduce((a, b) => (b.scores.overall < a.scores.overall ? b : a));
  } else if (days.length > 1) {
    best = days.reduce((a, b) => (b.scores.overall > a.scores.overall ? b : a));
    worst = days.reduce((a, b) => (b.scores.overall < a.scores.overall ? b : a));
  }

  return {
    signIndex,
    period,
    dates,
    scores,
    days,
    months,
    highlights,
    notes,
    best,
    worst,
    summary: summarize(signIndex, scores, best, worst, period),
  };
}

function explainTransits(signIndex, transits, isRange) {
  const sign = SIGNS[signIndex].name;
  return transits
    .filter((t) => !(isRange && t.key === 'Moon')) // 多日期間：月亮每 2~3 天換座，不列單日位置
    .map((t) => {
      const tone = t.value >= 0.45 ? 'good' : t.value <= -0.45 ? 'bad' : 'neutral';
      const where = `${t.name}${t.retrograde ? '（逆行）' : ''}在${SIGNS[t.sign].name}`;
      const rel = t.steps === 0 ? `與你的${sign}同座（合相）` : `與你的${sign}呈${t.aspect}`;
      return { key: t.key, tone, text: `${where}，${rel}`, value: t.value };
    })
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function summarize(signIndex, scores, best, worst, period) {
  const ranked = AREAS.map((a) => ({ ...a, score: scores[a.id] })).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const low = ranked[ranked.length - 1];
  const overall = scores.overall;
  const mood = overall >= 75 ? '整體順風' : overall >= 58 ? '整體平穩' : overall >= 42 ? '起伏較多' : '宜放慢步調';
  let text = `${SIGNS[signIndex].name}${mood}（${overall} 分）。最順的是${top.label}（${top.score}），${low.label}（${low.score}）需要多留意。`;
  if (period === 'year' && best && worst && best !== worst) {
    text += ` 最順的月份是 ${best.m} 月，最需保守的是 ${worst.m} 月。`;
  } else if (best && worst && best !== worst) {
    text += ` 最佳日 ${best.date.m}/${best.date.d}，最需保守 ${worst.date.m}/${worst.date.d}。`;
  }
  return text;
}

export function scoreLevel(score) {
  if (score >= 75) return 'high';
  if (score >= 55) return 'mid';
  if (score >= 40) return 'low';
  return 'poor';
}

export function periodLabel(period, dates) {
  const p = PERIODS.find((x) => x.id === period)?.label ?? period;
  if (period === 'year') return `${dates[0].y} 年`;
  if (dates.length === 1) return `${p} ${dates[0].m}/${dates[0].d}`;
  const a = dates[0];
  const b = dates[dates.length - 1];
  return `${p} ${a.m}/${a.d}–${b.m}/${b.d}`;
}

export { isoDate };
