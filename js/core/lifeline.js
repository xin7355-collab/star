// 人生時間軸：把八字流年（十神、喜忌、沖合、伏吟、太歲）、交大運、生命靈數流年、瑪雅流年印記、
// 占星的土星回歸、木星回歸、天王星對分合在一起，列出未來 10 年每年的重點、可能遇到的事和建議，
// 挑出最需要注意與最順的年份；再加上接下來 12 個月的流月提醒（流月十神與沖合、水星逆行、日月食）。
// 分數只是把各系統的提醒加總（見 LIFELINE_NOTE），不是預言。純函式，可在 Node 測試。

import { liunian, shiShen, branchRelations, ganzhiTone, ZHI } from './bazi.js';
import { bodyLongitude } from './astro.js';
import { monthChangesBetween, retrogradePeriods, eclipsesBetween } from './timing.js';
import { addDays, isoDate } from './date.js';
import { personalYearNumber, PERSONAL_YEAR } from './reading.js';
import { yearKin } from './maya-kin.js';
import { SEAL_TEXT } from './maya-texts.js';
import { SHISHEN_YEAR, SPOUSE_NOTE, TAISUI_TEXT, RETURN_TEXT } from './lifeline-texts.js';

const TONE_SCORE = { 喜: 1, 平: 0, 忌: -1 };
const TAISUI_SCORE = { 值太歲: -1, 沖太歲: -1.5, 刑太歲: -0.5, 害太歲: -0.5, 破太歲: -0.5 };
const TRIGGER_SCORE = { 伏吟: -1, 天剋地沖: -1.5, 沖大運: -1 };
// 流年地支沖到日柱（自己與伴侶）影響最大；年柱的沖就是沖太歲，已經算過，不重複扣
const CHONG_SCORE = { 日柱: -1, 月柱: -0.5, 時柱: -0.5 };
const DAY_MS = 86400000;
/** 標籤分兩類：說「為什麼要注意」只挑壓力類，說「為什麼順」只挑助力類（不然會出現「比較順：天王星對分」） */
export const WARN_TAGS = ['伏吟', '天剋地沖', '沖太歲', '歲運並臨', '值太歲', '沖大運', '土星回歸', '干支都忌', '沖日支', '天干是忌神', '地支是忌神', '沖月支', '沖時支', '刑太歲', '害太歲', '破太歲', '天王星對分'];
export const GOOD_TAGS = ['干支都喜', '木星回歸', '天干是喜用', '地支是喜用', '合日支', '交大運', '新循環'];
const CHONG_TAG = { 日柱: '沖日支', 月柱: '沖月支', 時柱: '沖時支' };
const SLOW = ['Jupiter', 'Saturn', 'Uranus'];

/**
 * 加總分數 → 等級。「小心」只留給好幾個壓力疊在一起的時候（例如干支都忌又沖太歲）：
 * 單純干支都忌是「注意」，不要讓一般的年份看起來很嚇人。
 */
export function levelOf(score) {
  if (score >= 1.5) return '順';
  if (score >= 0.5) return '小順';
  if (score > -1) return '平';
  if (score > -2.5) return '注意';
  return '小心';
}

const sep = (a, b) => {
  const d = (((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

/** 出生時的木星、土星、天王星位置（慢行星一天只走零點幾度，沒有出生時間用當天中午也夠準） */
function natalSlow(natal) {
  if (!natal) return null;
  const ms = natal.mode === 'timed' ? natal.utcMs : natal.dayStartUtc + DAY_MS / 2;
  return Object.fromEntries(SLOW.map((k) => [k, bodyLongitude(k, ms)]));
}

/**
 * 某一年有沒有土星回歸、木星回歸、天王星對分。每 10 天取樣一次、容許 3°：
 * 木星一天最多走 0.24°，10 天不到 2.5°，不會從縫隙溜過去。
 */
export function returnsIn(year, natalPos) {
  const hit = { saturn: false, jupiter: false, uranus: false };
  for (let t = Date.UTC(year, 0, 1, 4); t < Date.UTC(year + 1, 0, 1); t += 10 * DAY_MS) {
    if (!hit.saturn && sep(bodyLongitude('Saturn', t), natalPos.Saturn) <= 3) hit.saturn = true;
    if (!hit.jupiter && sep(bodyLongitude('Jupiter', t), natalPos.Jupiter) <= 3) hit.jupiter = true;
    if (!hit.uranus && Math.abs(sep(bodyLongitude('Uranus', t), natalPos.Uranus) - 180) <= 3) hit.uranus = true;
  }
  return hit;
}

/**
 * 未來幾年的時間軸。
 * @param {{bazi?:object, natal?:object, birth:{y,m,d}, today:{y,m,d}, gender?:string, years?:number}} input
 * @returns {{years:Array<{year,age,ganzhi,shishen,score,level,tags:string[],events:Array<{system,tone,text}>}>, watch:Array, good:Array}}
 */
export function buildLifeline({ bazi = null, natal = null, birth, today, gender = '', years = 10, mayaCount = 'dreamspell' }) {
  const list = Array.from({ length: years }, (_, i) => today.y + i);
  const lns = bazi ? liunian(bazi, list) : [];
  const slow = natalSlow(natal);
  const out = list.map((year, i) => {
    const ln = lns[i] || null;
    let score = 0;
    const tags = [];
    const events = [];
    const add = (system, tone, text) => events.push({ system, tone, text });
    if (ln) {
      const sy = SHISHEN_YEAR[ln.shishen];
      const toneSum = ln.tone ? TONE_SCORE[ln.tone.gan] + TONE_SCORE[ln.tone.zhi] : 0;
      score += toneSum;
      tags.push(`${ln.shishen}年`);
      if (toneSum >= 2) tags.push('干支都喜');
      else if (toneSum <= -2) tags.push('干支都忌');
      else if (ln.tone) {
        if (ln.tone.gan === '喜') tags.push('天干是喜用');
        if (ln.tone.zhi === '喜') tags.push('地支是喜用');
        if (ln.tone.gan === '忌') tags.push('天干是忌神');
        if (ln.tone.zhi === '忌') tags.push('地支是忌神');
      }
      add('八字', 'info', `${ln.ganzhi}年是你的「${ln.shishen}」年：${sy.theme}。`);
      if (ln.tone) add('八字', toneSum > 0 ? 'good' : toneSum < 0 ? 'bad' : 'info', `喜忌：${ln.tone.text}`);
      add('八字', 'info', `工作：${sy.work}`);
      add('八字', 'info', `財務：${sy.money}`);
      add('八字', 'info', `感情：${sy.love}`);
      const sn = SPOUSE_NOTE[gender];
      if (sn && sn.stars.includes(ln.shishen)) add('八字', 'info', sn.text);
      for (const t of ln.triggers) {
        // 歲運並臨是「好的更好、壞的更明顯」：跟著這一年的喜忌放大
        score += t.type === '歲運並臨' ? (toneSum > 0 ? 0.5 : -1) : TRIGGER_SCORE[t.type];
        tags.push(t.type);
        add('八字', 'bad', t.text);
      }
      for (const ts of ln.taisui) {
        score += TAISUI_SCORE[ts];
        tags.push(ts);
        add('八字', 'bad', TAISUI_TEXT[ts]);
      }
      for (const r of ln.relations) {
        if (r.pillar === '年柱') continue;
        if (r.type === '六沖') {
          score += CHONG_SCORE[r.pillar];
          tags.push(CHONG_TAG[r.pillar]);
          add('八字', 'bad', r.text);
        } else if (r.type === '六合' && r.pillar === '日柱') {
          score += 0.5;
          tags.push('合日支');
          add('八字', 'good', r.text);
        }
      }
      const yun = bazi.yun ? bazi.yun.list.find((d) => d.startYear === year) : null;
      if (yun) {
        tags.push('交大運');
        add('八字', 'info', `交大運：這一年起換成 ${yun.ganzhi}（${yun.shishen}）大運，接下來十年的重心是「${SHISHEN_YEAR[yun.shishen].core}」，生活重心會轉換。`);
      }
      add('八字', 'bad', `要注意：${sy.watch}`);
    }
    if (slow) {
      const r = returnsIn(year, slow);
      if (r.saturn) {
        score -= 1;
        tags.push('土星回歸');
        add('占星', 'bad', RETURN_TEXT.saturn);
      }
      if (r.jupiter) {
        score += 1;
        tags.push('木星回歸');
        add('占星', 'good', RETURN_TEXT.jupiter);
      }
      if (r.uranus) {
        score -= 0.5;
        tags.push('天王星對分');
        add('占星', 'bad', RETURN_TEXT.uranus);
      }
    }
    const py = personalYearNumber(birth, year);
    if (py === 1) tags.push('新循環');
    add('生命靈數', 'info', `流年數 ${py}：${PERSONAL_YEAR[py]}`);
    // 生日那天的 KIN 是這一年的流年印記（12/31 一定過了生日，取到的就是這一年生日那天）
    const yk = yearKin(birth, { y: year, m: 12, d: 31 }, mayaCount);
    if (yk) add('瑪雅', 'info', `流年印記 KIN ${yk.kin}「${yk.title}」（生日起的一年）：${SEAL_TEXT[yk.seal.n].keys.join('、')}。`);
    score = Math.round(score * 10) / 10;
    return { year, age: year - birth.y, ganzhi: ln ? ln.ganzhi : null, shishen: ln ? ln.shishen : null, score, level: levelOf(score), tags, events };
  });
  const watch = out.filter((y) => y.level === '注意' || y.level === '小心').sort((a, b) => a.score - b.score || a.year - b.year).slice(0, 3);
  const good = out.filter((y) => y.level === '順' || y.level === '小順').sort((a, b) => b.score - a.score || a.year - b.year).slice(0, 3);
  return { years: out, watch, good };
}

const md = (d) => `${d.m}/${d.d}`;

/**
 * 接下來幾個月（以節氣換月）：流月十神、干支喜忌、沖合日支與生肖、水星逆行、日月食。
 * @returns {Array<{start,end,ganzhi,shishen,score,level,notes:Array<{tone,text}>}>}
 */
export function monthsAhead({ bazi = null, today, months = 12 }) {
  const span = months * 31 + 40;
  const changes = monthChangesBetween(addDays(today, -40), span + 40);
  const todayIso = isoDate(today);
  const mercury = retrogradePeriods('Mercury', today, span);
  const eclipses = eclipsesBetween(today, span);
  const dayZhi = bazi ? bazi.pillars[2].zhi : null;
  const personZhi = bazi ? ZHI[bazi.zodiac.index] : null;
  const out = [];
  for (let i = 0; i < changes.length - 1 && out.length < months; i += 1) {
    const start = changes[i].date;
    const end = addDays(changes[i + 1].date, -1);
    if (isoDate(end) < todayIso) continue;
    const gz = changes[i].monthGanZhi;
    const notes = [];
    let score = 0;
    let shishen = null;
    if (bazi) {
      shishen = shiShen(bazi.dayMaster.gan, gz[0]);
      notes.push({ tone: 'info', text: `${shishen}月：${SHISHEN_YEAR[shishen].core}` });
      const tone = ganzhiTone(bazi, gz);
      if (tone) {
        const t = TONE_SCORE[tone.gan] + TONE_SCORE[tone.zhi];
        score += t;
        if (t !== 0) notes.push({ tone: t > 0 ? 'good' : 'bad', text: t > 0 ? `干支對你是助力（干${tone.gan}・支${tone.zhi}）。` : `干支對你是壓力（干${tone.gan}・支${tone.zhi}）。` });
      }
      const dayRel = branchRelations(dayZhi, gz[1]);
      if (dayRel.includes('六沖')) {
        score -= 1;
        notes.push({ tone: 'bad', text: '沖日支：自己與伴侶方面的事有變動，情緒容易起伏，重要的事先溝通。' });
      } else if (dayRel.includes('六合')) {
        score += 0.5;
        notes.push({ tone: 'good', text: '合日支：人緣、感情、合作比較順。' });
      }
      if (branchRelations(personZhi, gz[1]).includes('六沖')) {
        score -= 0.5;
        notes.push({ tone: 'bad', text: '沖生肖：家庭、長輩、居住方面容易有變化。' });
      }
    }
    const sIso = isoDate(start);
    const eIso = isoDate(end);
    for (const p of mercury) {
      if (isoDate(p.start) <= eIso && isoDate(p.end) >= sIso) {
        score -= 0.5;
        notes.push({ tone: 'bad', text: `水星逆行 ${md(p.start)}～${md(p.end)}：溝通、合約、交通、3C 容易出包，重要文件多檢查。` });
      }
    }
    for (const e of eclipses) {
      const iso = isoDate(e.date);
      if (iso >= sIso && iso <= eIso) notes.push({ tone: 'info', text: `${e.type}${e.kind === 'lunar' ? '月食' : '日食'}（${md(e.date)}）：傳統上的轉折點，重大決定避開前後幾天。` });
    }
    score = Math.round(score * 10) / 10;
    out.push({ start, end, ganzhi: gz, shishen, score, level: levelOf(score), notes });
  }
  return out;
}
