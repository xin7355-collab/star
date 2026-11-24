// 時機：今天幾點適合做什麼（吉時表）、想做一件事要挑哪天（擇日）、最近要注意什麼（近期提醒）。
//
// 依據（每一條建議都會列出來源，使用者看得到為什麼）：
// ・農民曆：當天與每個時辰的宜忌、黃道／黑道、沖煞（lunar-typescript）。
// ・個人八字：那一天的干支對你日主是什麼十神、地支和你的生肖（年支）與日支有沒有沖合。
// ・星座：當天行星與你太陽星座的相位分數（fortune.js 的 dayScores）。
// ・天象：水星／金星／火星逆行、日月食、新月滿月（astronomy-engine，手機上計算）。
// 這些都是傳統與占星的推算規則，給生活安排參考，不是科學預測。

import { Solar } from '../../vendor/lunar.js';
import * as Astronomy from '../../vendor/astronomy.min.js';
import { tw, twList } from './zh.js';
import { shiShen, branchRelations, ZHI, SHISHEN_TEXT } from './bazi.js';
import { addDays, isoDate } from './date.js';
import { localToUtcLenient, wallFields, DEFAULT_TZ } from './tz.js';
import { bodySpeed } from './astro.js';
import { dayScores } from './fortune.js';

const DAY_MS = 86400000;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const dateText = (d) => `${d.m}/${d.d}（${WEEKDAYS[new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay()]}）`;

// 農民曆時辰用語 → 白話
const TIME_LABEL = {
  求財: '談錢、求財', 開市: '開張、簽約', 交易: '交易、買賣', 見貴: '見重要的人（面試、客戶、主管）', 赴任: '報到、面試',
  出行: '出門、出差', 移徙: '搬家', 入宅: '入厝', 嫁娶: '談感情、婚事', 訂婚: '約會、提親', 祈福: '拜拜祈福', 酬神: '還願',
  祭祀: '祭拜', 修造: '裝修', 蓋屋: '動工', 安床: '整理臥室', 求嗣: '求子', 進人口: '招募新人', 開倉: '進貨、盤點', 詞訟: '處理糾紛',
};
const SKIP_IN_FRIENDLY = new Set(['安葬', '入殮', '造船', '乘船', '齋醮', '開光', '上樑', '動土']);
// 白話建議的排序：一般人日常最常做的事排前面（求子、祭拜這類放後面）
const FRIENDLY_ORDER = ['求財', '開市', '交易', '見貴', '赴任', '出行', '訂婚', '嫁娶', '移徙', '入宅', '祈福', '酬神', '祭祀', '修造', '蓋屋', '安床', '進人口', '開倉', '求嗣', '詞訟'];
const friendlyOf = (yi) => FRIENDLY_ORDER.filter((x) => yi.includes(x) && !SKIP_IN_FRIENDLY.has(x)).map((x) => TIME_LABEL[x]);
// 推薦時段只挑醒著的時間（07:00–22:59）；半夜的吉時照樣列在表上，但不放進摘要
const AWAKE = (h) => h.start >= '07:00' && h.start <= '21:00';

// 想做的事 → 農民曆對應的「宜」、時辰用語、星座領域、有利的十神
export const ACTIVITIES = [
  { id: 'money', label: '求財、投資理財', dayYi: ['納財', '開市', '交易'], timeYi: ['求財', '開市', '交易'], area: 'money', shishen: ['正財', '偏財', '食神'] },
  { id: 'deal', label: '簽約、開業', dayYi: ['開市', '立券', '交易', '掛匾'], timeYi: ['開市', '交易'], area: 'career', shishen: ['正財', '正官', '食神'] },
  { id: 'interview', label: '面試、見主管或客戶', dayYi: ['赴任', '會親友'], timeYi: ['見貴', '赴任'], area: 'career', shishen: ['正官', '正印', '食神'] },
  { id: 'love', label: '約會、告白', dayYi: ['會親友', '嫁娶', '訂盟', '納采'], timeYi: ['嫁娶', '訂婚'], area: 'love', shishen: 'spouse' },
  { id: 'wedding', label: '訂婚、結婚', dayYi: ['嫁娶', '訂盟', '納采'], timeYi: ['嫁娶', '訂婚'], area: 'love', shishen: 'spouse' },
  { id: 'move', label: '搬家、入厝', dayYi: ['入宅', '移徙'], timeYi: ['移徙', '入宅'], area: 'overall', shishen: ['正印', '正財'] },
  { id: 'travel', label: '出遊、出差', dayYi: ['出行'], timeYi: ['出行'], area: 'overall', shishen: ['食神', '偏財'] },
  { id: 'study', label: '考試、進修', dayYi: ['入學', '習藝'], timeYi: ['見貴'], area: 'career', shishen: ['正印', '偏印', '正官'] },
  { id: 'health', label: '看醫生、手術', dayYi: ['求醫', '治病'], timeYi: [], area: 'health', shishen: ['正印', '食神'] },
  { id: 'renovate', label: '裝修、動工', dayYi: ['修造', '動土', '破土', '上樑', '豎柱'], timeYi: ['修造', '蓋屋'], area: 'overall', shishen: ['正財', '正官'] },
  { id: 'beauty', label: '剪髮、美容', dayYi: ['理髮', '沐浴', '整手足甲'], timeYi: [], area: 'love', shishen: ['食神', '傷官'] },
  { id: 'pray', label: '拜拜、祈福', dayYi: ['祈福', '祭祀'], timeYi: ['祈福', '祭祀'], area: 'overall', shishen: ['正印', '偏印'] },
];

function spouseStars(gender) {
  if (gender === '男') return ['正財', '偏財'];
  if (gender === '女') return ['正官', '七殺'];
  return ['正財', '正官'];
}

function lunarOf({ y, m, d }) {
  return Solar.fromYmd(y, m, d).getLunar();
}

/** 這個人用來對照的地支：生肖（年支，民俗以正月初一換年）與日支（配偶宮、自己） */
function personKeys(bazi) {
  if (!bazi || !bazi.ok) return null;
  return { dayMaster: bazi.dayMaster.gan, yearZhi: ZHI[bazi.zodiac.index], dayZhi: bazi.pillars[2].zhi, animal: bazi.zodiac.name };
}

/**
 * 某一天對這個人的影響（流日）。
 * @returns {{ganzhi:string, shishen:string|null, clash:string[], harmony:string[], minor:string[], notes:string[]}}
 */
export function personalDay(date, bazi) {
  const ganzhi = lunarOf(date).getDayInGanZhi();
  const keys = personKeys(bazi);
  const out = { ganzhi, shishen: null, clash: [], harmony: [], minor: [], notes: [] };
  if (!keys) return out;
  out.shishen = shiShen(keys.dayMaster, ganzhi[0]);
  const zhi = ganzhi[1];
  for (const [label, own] of [['生肖', keys.yearZhi], ['日支', keys.dayZhi]]) {
    const rel = branchRelations(own, zhi);
    if (rel.includes('六沖')) out.clash.push(label);
    if (rel.includes('六合') || rel.includes('三合')) out.harmony.push(label);
    if (rel.some((r) => r === '相刑' || r === '相害' || r === '相破')) out.minor.push(label);
  }
  if (out.clash.includes('生肖')) out.notes.push(`這天的${zhi}日沖你的生肖（屬${keys.animal}），重要決定與簽約能緩就緩。`);
  if (out.clash.includes('日支')) out.notes.push(`這天的${zhi}日沖你的日支（自己與伴侶的位置），情緒與感情容易起波動。`);
  if (out.harmony.length) out.notes.push(`這天的${zhi}日和你的${out.harmony.join('、')}相合，談事情、找人幫忙比較順。`);
  return out;
}

/**
 * 吉時表：某一天 13 個時段（含早子、晚子）的吉凶、適合做的事、是否沖到你的生肖。
 */
export function hourGuide(date, bazi = null) {
  const keys = personKeys(bazi);
  return lunarOf(date).getTimes().map((t) => {
    const yi = twList(t.getYi());
    const ji = twList(t.getJi());
    const luck = tw(t.getTianShenLuck());
    const zhi = t.getZhi();
    const clashAnimal = tw(t.getChongShengXiao());
    const clashMe = keys ? branchRelations(keys.yearZhi, zhi).includes('六沖') : false;
    const harmonyMe = keys ? branchRelations(keys.dayZhi, zhi).some((r) => r === '六合' || r === '三合') : false;
    const friendly = [...new Set(friendlyOf(yi))].slice(0, 3);
    const good = luck === '吉' && !clashMe;
    let advice;
    if (ji.includes('諸事不宜')) advice = '傳統上諸事不宜，重要的事避開這個時段，適合休息、處理例行事務。';
    else if (clashMe) advice = `沖你的生肖（屬${keys.animal}），重要的事避開，日常活動照常就好。`;
    else if (good && friendly.length) advice = `適合${friendly.join('、')}。`;
    else if (luck === '吉') advice = '吉時，適合處理重要的事。';
    else if (friendly.length) advice = `黑道時段，宜低調；若要做，以${friendly[0]}這類事較適合。`;
    else advice = '黑道時段，宜低調、處理例行事務。';
    return {
      start: t.getMinHm(),
      end: t.getMaxHm(),
      zhi,
      ganzhi: t.getGanZhi(),
      tianShen: tw(t.getTianShen()),
      type: tw(t.getTianShenType()),
      luck,
      good,
      clashAnimal,
      clashMe,
      harmonyMe,
      yi,
      ji,
      friendly,
      advice: harmonyMe && good ? `${advice}這個時辰和你的日支相合，談事情更順。` : advice,
    };
  });
}

/** 吉時表的白話摘要：最適合的時段、要避開的時段 */
export function hourSummary(hours) {
  const best = hours.filter((h) => AWAKE(h) && h.good && h.friendly.length).slice(0, 3);
  const avoid = hours.filter((h) => AWAKE(h) && (h.clashMe || h.ji.includes('諸事不宜')));
  const lines = [];
  if (best.length) lines.push(`好時段：${best.map((h) => `${h.start}–${h.end}（${h.friendly[0]}）`).join('、')}。`);
  if (avoid.length) lines.push(`避開：${avoid.map((h) => `${h.start}–${h.end}${h.clashMe ? '（沖你的生肖）' : '（諸事不宜）'}`).join('、')}。`);
  return lines;
}

/**
 * 擇日：未來 days 天裡，做某件事比較適合的日子（分數高到低）。
 * @param {string} activityId ACTIVITIES 的 id
 * @param {{from:{y,m,d}, days?:number, bazi?:object, signIndex?:number|null, gender?:string, tz?:string}} options
 */
export function chooseDays(activityId, { from, days = 30, bazi = null, signIndex = null, gender = null, tz = DEFAULT_TZ }) {
  const act = ACTIVITIES.find((a) => a.id === activityId);
  if (!act) throw new Error(`不認得的活動：${activityId}`);
  const helpful = act.shishen === 'spouse' ? spouseStars(gender) : act.shishen;
  const list = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(from, i);
    const lunar = lunarOf(date);
    const yi = twList(lunar.getDayYi());
    const ji = twList(lunar.getDayJi());
    const reasons = [];
    let score = 50;
    const yiHit = act.dayYi.filter((x) => yi.includes(x));
    const jiHit = act.dayYi.filter((x) => ji.includes(x));
    if (yiHit.length) { score += 20; reasons.push({ tone: 'good', text: `農民曆宜「${yiHit.join('、')}」` }); }
    if (jiHit.length) { score -= 25; reasons.push({ tone: 'bad', text: `農民曆忌「${jiHit.join('、')}」` }); }
    if (yi.includes('諸事不宜') || ji.includes('諸事不宜')) { score -= 25; reasons.push({ tone: 'bad', text: '農民曆「諸事不宜」' }); }
    const p = personalDay(date, bazi);
    if (p.clash.includes('生肖')) { score -= 20; reasons.push({ tone: 'bad', text: '這天沖你的生肖' }); }
    if (p.clash.includes('日支')) { score -= 12; reasons.push({ tone: 'bad', text: '這天沖你的日支' }); }
    if (p.harmony.length) { score += 8; reasons.push({ tone: 'good', text: `這天和你的${p.harmony.join('、')}相合` }); }
    if (p.shishen && helpful.includes(p.shishen)) { score += 10; reasons.push({ tone: 'good', text: `流日是你的「${p.shishen}」，對這件事有利` }); }
    if (signIndex !== null && signIndex !== undefined) {
      const s = dayScores(signIndex, date, tz).scores[act.area];
      score += Math.round((s - 50) * 0.3);
      reasons.push({ tone: s >= 60 ? 'good' : s < 45 ? 'bad' : 'info', text: `星座運勢 ${s} 分` });
    }
    list.push({ date, iso: isoDate(date), label: dateText(date), ganzhi: p.ganzhi, score: Math.max(0, Math.min(100, score)), reasons, yi, ji });
  }
  return { activity: act, days: list, best: [...list].sort((a, b) => b.score - a.score || a.iso.localeCompare(b.iso)).slice(0, 5) };
}

// ── 近期提醒

const RETRO_TEXT = {
  Mercury: { name: '水星逆行', text: '溝通、合約、交通、3C 容易出狀況：重要文件多看一次、資料記得備份、說話多一分耐心。不是不能做事，而是要多檢查。' },
  Venus: { name: '金星逆行', text: '感情與花錢容易反覆，舊人舊物可能回頭。大筆消費、醫美、閃婚先緩一緩。' },
  Mars: { name: '火星逆行', text: '行動力下降、容易急躁起衝突。新計畫先規劃、少衝動，運動注意受傷。' },
};

function localDateOf(utcMs, tz) {
  const w = wallFields(utcMs, tz);
  return { y: w.y, m: w.m, d: w.d };
}

function noonUtc(date, tz) {
  return localToUtcLenient({ ...date, h: 12, mi: 0 }, tz);
}

/** 逆行與順行交界的時刻（二分法找到一小時以內） */
function stationMs(key, aMs, bMs, retroAtA) {
  let lo = aMs;
  let hi = bMs;
  while (hi - lo > 3600000) {
    const mid = (lo + hi) / 2;
    if ((bodySpeed(key, mid) < 0) === retroAtA) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * 和 [from, from+days) 有重疊的逆行區段，起訖日是「停滯轉向那一刻」的當地日期，
 * 和天文年曆、占星網站公布的日期一致（只在中午取樣會差一天）。
 */
export function retrogradePeriods(key, from, days, tz = DEFAULT_TZ) {
  const PAD = 100; // 逆行最長約 80 天，往前後多看一點才找得到起訖
  const fromIso = isoDate(from);
  const endIso = isoDate(addDays(from, days));
  const periods = [];
  let prevMs = noonUtc(addDays(from, -PAD), tz);
  let prevRetro = bodySpeed(key, prevMs) < 0;
  let startMs = null;
  for (let i = -PAD + 1; i <= days + PAD; i += 1) {
    const ms = noonUtc(addDays(from, i), tz);
    const retro = bodySpeed(key, ms) < 0;
    if (retro !== prevRetro) {
      const at = stationMs(key, prevMs, ms, prevRetro);
      if (retro) startMs = at;
      else if (startMs !== null) {
        const p = { start: localDateOf(startMs, tz), end: localDateOf(at, tz) };
        if (isoDate(p.end) >= fromIso && isoDate(p.start) < endIso) periods.push(p);
        startMs = null;
      }
    }
    prevMs = ms;
    prevRetro = retro;
  }
  return periods;
}

const ECLIPSE_KIND = { penumbral: '半影', partial: '偏', annular: '環', total: '全' };

/** 期間內的日食、月食 */
export function eclipsesBetween(from, days, tz = DEFAULT_TZ) {
  const start = new Date(noonUtc(from, tz) - DAY_MS / 2);
  const endMs = start.getTime() + days * DAY_MS;
  const out = [];
  let le = Astronomy.SearchLunarEclipse(start);
  while (le && le.peak.date.getTime() < endMs) {
    out.push({ kind: 'lunar', type: ECLIPSE_KIND[le.kind] || '', date: localDateOf(le.peak.date.getTime(), tz) });
    le = Astronomy.NextLunarEclipse(le.peak);
  }
  let se = Astronomy.SearchGlobalSolarEclipse(start);
  while (se && se.peak.date.getTime() < endMs) {
    out.push({ kind: 'solar', type: ECLIPSE_KIND[se.kind] || '', date: localDateOf(se.peak.date.getTime(), tz) });
    se = Astronomy.NextGlobalSolarEclipse(se.peak);
  }
  return out;
}

/** 期間內的新月、滿月 */
export function moonPhasesBetween(from, days, tz = DEFAULT_TZ) {
  const out = [];
  for (const [lon, kind] of [[0, 'new'], [180, 'full']]) {
    let t = new Date(noonUtc(from, tz) - DAY_MS / 2);
    const endMs = t.getTime() + days * DAY_MS;
    for (;;) {
      const found = Astronomy.SearchMoonPhase(lon, t, 40);
      if (!found || found.date.getTime() >= endMs) break;
      out.push({ kind, date: localDateOf(found.date.getTime(), tz) });
      t = new Date(found.date.getTime() + DAY_MS);
    }
  }
  return out.sort((a, b) => isoDate(a.date).localeCompare(isoDate(b.date)));
}

/** 期間內的「節」（換月柱、流月改變的時間點） */
export function monthChangesBetween(from, days) {
  const out = [];
  let cursor = from;
  const endIso = isoDate(addDays(from, days));
  for (let guard = 0; guard < 6; guard += 1) {
    const jie = lunarOf(cursor).getNextJie(true);
    if (!jie) break;
    const s = jie.getSolar();
    const date = { y: s.getYear(), m: s.getMonth(), d: s.getDay() };
    if (isoDate(date) >= endIso) break;
    if (isoDate(date) >= isoDate(from)) out.push({ name: tw(jie.getName()), date, monthGanZhi: lunarOf(addDays(date, 1)).getMonthInGanZhiExact() });
    cursor = addDays(date, 1);
  }
  return out;
}

/**
 * 近期提醒（依日期排序）。
 * @param {{from:{y,m,d}, days?:number, bazi?:object, birth?:{y,m,d}, tz?:string, liunianTaiSui?:string[]}} options
 * @returns {Array<{date:{y,m,d}, end?:{y,m,d}, kind:string, level:'warn'|'good'|'info', title:string, text:string, basis:string}>}
 */
export function upcoming({ from, days = 45, bazi = null, birth = null, tz = DEFAULT_TZ }) {
  const items = [];
  for (const key of ['Mercury', 'Venus', 'Mars']) {
    for (const p of retrogradePeriods(key, from, days, tz)) {
      const started = isoDate(p.start) <= isoDate(from);
      items.push({
        date: started ? from : p.start,
        end: p.end,
        kind: 'retro',
        level: 'warn',
        title: `${RETRO_TEXT[key].name}${started ? '中' : ''}（${p.start.m}/${p.start.d}–${p.end.m}/${p.end.d}）`,
        text: RETRO_TEXT[key].text,
        basis: '天文計算：行星在天空中看起來往回走的期間（占星稱逆行）。',
      });
    }
  }
  for (const e of eclipsesBetween(from, days, tz)) {
    items.push({
      date: e.date,
      kind: 'eclipse',
      level: 'warn',
      title: `${e.kind === 'solar' ? `${e.type}日食` : `${e.type}月食`}（${dateText(e.date)}）`,
      text: e.kind === 'solar'
        ? '占星上象徵新的開始與轉折，前後幾天不急著做重大決定，先觀察再行動。（台灣不一定看得到）'
        : '占星上象徵情緒與關係浮上檯面，適合整理、放下，不宜衝動結束一段關係或一份工作。',
      basis: '天文計算：日月食的時間。',
    });
  }
  for (const mp of moonPhasesBetween(from, Math.min(days, 31), tz)) {
    items.push({
      date: mp.date,
      kind: 'moon',
      level: mp.kind === 'new' ? 'good' : 'info',
      title: `${mp.kind === 'new' ? '新月' : '滿月'}（${dateText(mp.date)}）`,
      text: mp.kind === 'new' ? '適合許願、訂新目標、開始新計畫。' : '適合收尾、檢討與感恩；情緒比較滿，溝通多一點耐心。',
      basis: '天文計算：月相。',
    });
  }
  const keys = personKeys(bazi);
  for (const mc of monthChangesBetween(from, days)) {
    const ss = keys ? shiShen(keys.dayMaster, mc.monthGanZhi[0]) : null;
    const rel = keys ? branchRelations(keys.yearZhi, mc.monthGanZhi[1]) : [];
    let text = `進入${mc.monthGanZhi}月。`;
    if (ss) text += `對你是「${ss}」月：${SHISHEN_TEXT[ss]}`;
    if (rel.includes('六沖')) text += ' 這個月的地支沖你的生肖，變動較多，凡事多留彈性。';
    items.push({ date: mc.date, kind: 'month', level: rel.includes('六沖') ? 'warn' : 'info', title: `${mc.name}・換流月（${dateText(mc.date)}）`, text, basis: '八字：每逢「節」換月柱，流月十神看月干對你的日主。' });
  }
  if (keys) {
    for (let i = 0; i < Math.min(days, 14); i += 1) {
      const date = addDays(from, i);
      const p = personalDay(date, bazi);
      if (p.clash.includes('生肖')) {
        items.push({ date, kind: 'clash', level: 'warn', title: `沖生肖日（${dateText(date)}）`, text: p.notes[0], basis: `八字：${p.ganzhi}日的地支和你的生肖相沖。` });
      }
    }
  }
  if (birth) {
    for (let i = 0; i < Math.min(days, 31); i += 1) {
      const date = addDays(from, i);
      if (date.m === birth.m && date.d === birth.d) {
        items.push({ date, kind: 'birthday', level: 'good', title: `生日（${dateText(date)}）`, text: '生日前後是太陽回到你出生位置的時候（太陽回歸），很適合回顧這一年、規劃新的一年。', basis: '占星：太陽回歸。' });
      }
    }
  }
  if (bazi && bazi.yun) {
    const next = bazi.yun.list.find((d) => d.startYear > from.y && d.startYear <= from.y + 1);
    if (next) {
      items.push({ date: { y: next.startYear, m: 1, d: 1 }, kind: 'dayun', level: 'info', title: `${next.startYear} 年起換大運：${next.ganzhi}`, text: `接下來十年的主題是「${next.shishen}」：${SHISHEN_TEXT[next.shishen]}`, basis: '八字：大運每十年換一次。' });
    }
  }
  return items.sort((a, b) => isoDate(a.date).localeCompare(isoDate(b.date)));
}

/** 「最近要注意」三到五句白話摘要 */
export function attentionSummary(items, from) {
  const soon = isoDate(addDays(from, 14));
  const warn = items.filter((x) => x.level === 'warn' && isoDate(x.date) <= soon).slice(0, 3);
  const good = items.filter((x) => x.level === 'good').slice(0, 2);
  return [...warn, ...good].map((x) => `${x.title}：${x.text}`);
}

