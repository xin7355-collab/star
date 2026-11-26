// 工作與未來方向：把各系統對「適合什麼工作」的看法放在一起投票，再排出未來三年與十年的方向。
//
// 1. 工作性質：八字（月令格局；十神最多的一組只當補充說明、不投票）、紫微（官祿宮主星）、占星（天頂與太陽星座）、生命靈數、血型
//    各投兩種「工作性質」，兩個以上系統都投的才列為最適合；每一票都標出依據。
// 2. 適合的行業：依喜用五行（bazi.js 的 yongShen）對照傳統的五行行業分類。
// 3. 未來方向：每一年看八字流年十神（並對照喜用忌神）、生命靈數流年數、木星與土星走到的宮位；
//    十年看八字大運與紫微大限。
// 全部在手機上計算；文字為本 App 撰寫，命理是參考，不是保證。

import { SIGNS } from './zodiac.js';
import { NATURES, GO_TAGS } from './jobs.js';
import { emergingFit, AI_ADVICE } from './emerging.js';
import { positionsAt } from './astro.js';
import { liunian, yongShen, ganzhiTone } from './bazi.js';
import { geju } from './geju.js';
import { dominantShishen, personalYearNumber, PERSONAL_YEAR } from './reading.js';
import { SHISHEN_GROUPS, ZIWEI_STARS, LIFEPATH_DETAIL, SIGN_DETAIL, DECADE_FOCUS } from './reading-texts.js';
import { BLOOD } from './blood.js';

// 工作性質的定義搬到 jobs.js（工作選單也要用；jobs.js 不能依賴這個比較重的模組，名單存檔會用到它）
export { NATURES };

// 各系統投給哪兩種工作性質（依本 App 的文字整理，避免同一系統投太多票）
// 八字用月令格局投票：格局是子平法看「一生主軸、靠什麼成事」的地方，比單純數十神多寡更貼近傳統論事業的方式
const BY_GEJU = {
  zhengguan: ['stable', 'manage'], qisha: ['manage', 'expert'], zhengcai: ['finance', 'stable'], piancai: ['sales', 'finance'],
  zhengyin: ['research', 'care'], pianyin: ['expert', 'research'], shishen: ['create', 'care'], shangguan: ['create', 'free'],
  jianlu: ['free', 'expert'], yuejie: ['sales', 'free'], yangren: ['manage', 'expert'],
};
const BY_STAR = {
  紫微: ['manage', 'public'], 天機: ['research', 'expert'], 太陽: ['public', 'care'], 武曲: ['finance', 'expert'], 天同: ['care', 'stable'],
  廉貞: ['public', 'manage'], 天府: ['finance', 'stable'], 太陰: ['finance', 'create'], 貪狼: ['sales', 'create'], 巨門: ['public', 'research'],
  天相: ['stable', 'care'], 天梁: ['care', 'research'], 七殺: ['manage', 'mobile'], 破軍: ['free', 'mobile'],
};
const BY_SIGN = [
  ['manage', 'free'], ['finance', 'stable'], ['sales', 'public'], ['care', 'stable'], ['public', 'manage'], ['expert', 'research'],
  ['public', 'create'], ['research', 'finance'], ['mobile', 'free'], ['manage', 'stable'], ['research', 'free'], ['create', 'care'],
];
const BY_LIFEPATH = { 1: ['manage', 'free'], 2: ['care', 'stable'], 3: ['create', 'public'], 4: ['stable', 'expert'], 5: ['mobile', 'sales'], 6: ['care', 'create'], 7: ['research', 'expert'], 8: ['finance', 'manage'], 9: ['care', 'public'] };
const BY_BLOOD = { A: ['stable', 'expert'], B: ['create', 'free'], O: ['manage', 'sales'], AB: ['research', 'expert'] };

// 傳統的五行行業分類（各家大同小異，取常見的說法）
export const INDUSTRY = {
  木: ['教育', '出版文創', '服飾紡織', '醫藥保健', '園藝農林', '家具木作', '社會福利'],
  火: ['餐飲', '能源電力', '電子科技', '傳媒廣告', '演藝娛樂', '美容美髮', '照明'],
  土: ['不動產', '建築營造', '農業', '仲介', '倉儲', '保險', '顧問'],
  金: ['金融銀行', '機械五金', '汽車', '科技硬體', '法律', '珠寶', '軍警'],
  水: ['貿易', '物流運輸', '旅遊', '航運', '資訊網路', '行銷傳播', '飲料水產'],
};

// 流年／大運的十神，對工作的意義
const SHISHEN_CAREER = {
  正官: { focus: '升遷、責任與名聲', do: '爭取升遷、考公職或證照、進制度完整的公司', watch: '責任變重，別一口氣答應太多' },
  七殺: { focus: '挑戰與突破', do: '接下有挑戰的任務、開創新局', watch: '壓力大、容易和人起衝突，健康要顧' },
  正印: { focus: '學習與貴人', do: '進修、考證照、找導師與長輩幫忙', watch: '太安逸會錯過機會' },
  偏印: { focus: '專精與轉型', do: '鑽研專門技術、做研究、轉向小眾專業', watch: '容易想太多、孤軍奮戰' },
  正財: { focus: '穩定收入', do: '把本業做穩、加薪、存錢與理財', watch: '別為了穩定放棄成長' },
  偏財: { focus: '機會與副業', do: '跑業務、開發客戶、經營副業', watch: '投機與花費要設上限' },
  食神: { focus: '才華被看見', do: '做作品、經營個人品牌、享受工作', watch: '太舒服時會鬆懈' },
  傷官: { focus: '改變與表現', do: '轉職、創業、提出新做法', watch: '說話直容易得罪主管，合約看清楚' },
  比肩: { focus: '合作與獨立', do: '找夥伴、組團隊、獨立接案', watch: '花費變多，利益分配先講好' },
  劫財: { focus: '競爭', do: '強化自己的不可取代性', watch: '合夥、借貸、作保要特別謹慎' },
};

// 木星（擴張）與土星（考驗）走到的宮位，對應的生活領域
const HOUSE_AREA = ['自我與形象', '收入與價值觀', '學習與溝通', '家庭與居住', '創作與戀愛', '日常工作與健康', '合作與伴侶', '共同資源與投資', '進修與遠行', '事業與名聲', '朋友與團體', '沉澱與幕後'];

// 紫微大限走到的宮位，十年的重點

const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };

function mainStars(ziwei, name) {
  const p = ziwei.palaces.find((x) => x.name === name);
  if (!p) return { stars: [], borrowed: false };
  if (p.major.length) return { stars: p.major, borrowed: false };
  const opposite = ziwei.palaces.find((q) => q.index === (p.index + 6) % 12);
  return { stars: opposite ? opposite.major : [], borrowed: true };
}

/** 木星、土星在某年年中走到的宮位（有上升用整宮制，沒有就以太陽星座當第一宮） */
function transitHouses(natal, year) {
  if (!natal) return null;
  const base = natal.rising !== undefined && natal.rising !== null ? natal.rising : natal.sun && natal.sun.certain !== false ? natal.sun.sign : null;
  if (base === null || base === undefined) return null;
  const pos = positionsAt(Date.UTC(year, 6, 1, 4));
  const house = (sign) => ((sign - base + 12) % 12) + 1;
  return { jupiter: { sign: pos.Jupiter.sign, house: house(pos.Jupiter.sign) }, saturn: { sign: pos.Saturn.sign, house: house(pos.Saturn.sign) }, solar: natal.rising === undefined || natal.rising === null };
}

/**
 * @param {{natal?:object, bazi?:object, ziwei?:object, birth:{y,m,d}, bloodType?:string, today:{y,m,d}, lifePathNumber:number}} input
 *   ziwei 由呼叫端先處理好多胞胎借宮（和綜合解讀用同一張盤）
 */
export function buildCareer({ natal = null, bazi = null, ziwei = null, birth, bloodType = '', today, lifePathNumber }) {
  const votes = {};
  const points = [];
  const vote = (keys, source) => {
    for (const k of keys) (votes[k] ||= []).push(source);
  };

  if (bazi && bazi.ok) {
    const g = geju(bazi);
    vote(BY_GEJU[g.kind], `八字：${g.name}`);
    points.push({ system: '八字', text: `格局是${g.name}${g.use ? `（${g.use}）` : ''}、${g.status}：適合${g.info.work}` });
    const dom = dominantShishen(bazi);
    points.push({ system: '八字', text: `${dom.group}較多（${SHISHEN_GROUPS[dom.group].members.join('、')}）：${SHISHEN_GROUPS[dom.group].career}` });
  }
  if (ziwei && ziwei.ok) {
    const { stars, borrowed } = mainStars(ziwei, '官祿');
    for (const s of stars) {
      if (!BY_STAR[s.name]) continue;
      vote(BY_STAR[s.name], `紫微：官祿宮${s.name}`);
      points.push({ system: '紫微', text: `官祿宮${borrowed ? '（無主星，借對宮）' : ''}${s.name}${s.mutagen ? `${s.mutagen}` : ''}：${ZIWEI_STARS[s.name].career}` });
    }
  }
  const mc = natal && natal.angles ? Math.floor(natal.angles.MC / 30) : null;
  if (mc !== null) {
    vote(BY_SIGN[mc], `占星：天頂${SIGNS[mc].name}`);
    points.push({ system: '占星', text: `天頂（社會角色）在${SIGNS[mc].name}：${SIGN_DETAIL[mc].career}。` });
  }
  const sun = natal && natal.sun && natal.sun.certain !== false ? natal.sun.sign : null;
  if (sun !== null) {
    vote(BY_SIGN[sun], `占星：太陽${SIGNS[sun].name}`);
    points.push({ system: '占星', text: `太陽${SIGNS[sun].name}：${SIGN_DETAIL[sun].career}。` });
  }
  if (BY_LIFEPATH[lifePathNumber]) {
    vote(BY_LIFEPATH[lifePathNumber], `生命靈數 ${lifePathNumber}`);
    points.push({ system: '生命靈數', text: LIFEPATH_DETAIL[lifePathNumber].career });
  }
  const blood = BLOOD[bloodType] || null;
  if (blood) {
    vote(BY_BLOOD[bloodType], `血型 ${bloodType} 型（流行文化）`);
    points.push({ system: '血型', text: `${blood.work}常見適合：${blood.jobs.join('、')}。` });
  }

  const ranked = Object.entries(votes)
    .map(([key, sources]) => ({ key, ...NATURES[key], count: sources.length, sources }))
    .sort((a, b) => b.count - a.count);
  const consensus = ranked.filter((n) => n.count >= 2).slice(0, 3);
  const natures = consensus.length ? consensus : ranked.slice(0, 2);

  const ys = yongShen(bazi);
  const industries = ys
    ? { primary: ys.primary, secondary: ys.secondary, list: [...INDUSTRY[ys.primary], ...INDUSTRY[ys.secondary].slice(0, 3)], reason: `喜用五行是「${ys.primary}」，其次「${ys.secondary}」（${ys.strength}）：這兩類行業比較順，「${ys.avoid.join('、')}」類行業不是不能做，是要花比較多力氣。` }
    : null;

  // 新興產業（AI、半導體、資安、綠能、長照……）：工作性質票數＋喜用五行；AI 時代的建議看票數最多的工作性質
  const emerging = emergingFit({ ranked, ys });
  const aiAdvice = ranked[0] ? { nature: ranked[0].label, text: AI_ADVICE[ranked[0].key] } : null;
  return { natures, ranked, consensus: consensus.length > 0, points, industries, emerging, aiAdvice, future: buildFuture({ natal, bazi, ziwei, birth, today, ys }) };
}

function buildFuture({ natal, bazi, ziwei, birth, today, ys }) {
  const years = [today.y, today.y + 1, today.y + 2];
  const ln = bazi && bazi.ok ? liunian(bazi, years) : null;
  const out = years.map((year, i) => {
    const pts = [];
    let headline = '';
    let tone = 'mid';
    const doList = [];
    const watchList = [];
    if (ln) {
      const y = ln[i];
      const sc = SHISHEN_CAREER[y.shishen];
      const wx = GAN_WX[y.ganzhi[0]];
      if (ys) tone = toneOf(y);
      headline = `${sc.focus}的一年`;
      doList.push(sc.do);
      watchList.push(sc.watch);
      if (y.taisui.length) watchList.push(`${y.taisui.join('、')}：重大變動前多規劃`);
      for (const t of y.triggers) watchList.push(`${t.type}：${t.text.split('：')[1].replace(/。$/, '')}`);
      const toneText = y.tone ? `天干${y.tone.ganWx}（${y.tone.gan}）、地支${y.tone.zhiWx}（${y.tone.zhi}）：${y.tone.text}` : `天干屬${wx}`;
      pts.push({ system: '八字', text: `${y.ganzhi}年是你的「${y.shishen}」年。${toneText}${y.shishenText}` });
    }
    const py = personalYearNumber(birth, year);
    pts.push({ system: '生命靈數', text: `流年數 ${py}：${PERSONAL_YEAR[py]}` });
    if (!headline) headline = PERSONAL_YEAR[py].split('：')[0];
    const tr = transitHouses(natal, year);
    if (tr) {
      pts.push({ system: '占星', text: `木星（機會）走到第 ${tr.jupiter.house} 宮${SIGNS[tr.jupiter.sign].name}：${HOUSE_AREA[tr.jupiter.house - 1]}方面容易有好機會；土星（考驗）在第 ${tr.saturn.house} 宮${SIGNS[tr.saturn.sign].name}：${HOUSE_AREA[tr.saturn.house - 1]}需要負責與打基礎${tr.solar ? '（沒有出生時間，以太陽星座推算宮位）' : ''}。` });
      if (tr.jupiter.house === 10) doList.push('木星進事業宮：適合爭取升遷或曝光');
      if (tr.saturn.house === 10) watchList.push('土星在事業宮：責任重、成果慢，但打下的基礎很穩');
    }
    return { year, headline, tone, doList, watchList, points: pts };
  });

  let dayun = null;
  if (bazi && bazi.ok && bazi.yun) {
    const list = bazi.yun.list;
    const idx = list.findIndex((d) => d.current);
    const describe = (d) => d && { ganzhi: d.ganzhi, startYear: d.startYear, endYear: d.endYear, shishen: d.shishen, ...SHISHEN_CAREER[d.shishen], good: ys ? toneFromGz(ganzhiTone(bazi, d.ganzhi)) === 'good' : null };
    dayun = { current: describe(list[idx]), next: describe(list[idx + 1]) };
  }

  let decade = null;
  if (ziwei && ziwei.ok && ziwei.horoscope) {
    const cur = ziwei.palaces.find((p) => p.index === ziwei.horoscope.decadalIndex);
    const next = cur ? ziwei.palaces.find((p) => p.decadal && p.decadal[0] === cur.decadal[1] + 1) : null;
    const describe = (p) => p && { palace: p.name, ages: `虛歲 ${p.decadal[0]}–${p.decadal[1]} 歲`, focus: DECADE_FOCUS[p.name] || '' };
    decade = { current: describe(cur), next: describe(next) };
  }
  return { years: out, dayun, decade };
}

/**
 * 一年（或一步大運）順不順：天干、地支各自對照喜用（以前只看天干，地支是忌神也照樣寫「整體順」）。
 * 有喜、沒有忌＝順；兩個都忌，或一忌一平＝辛苦；其他（一喜一忌）＝有起有落。
 */
function toneFromGz(t) {
  if (!t) return 'mid';
  const has = (x) => t.gan === x || t.zhi === x;
  if (has('喜') && !has('忌')) return 'good';
  if (has('忌') && !has('喜')) return 'hard';
  return 'mid';
}
function toneOf(y) {
  return toneFromGz(y.tone);
}

/**
 * 工作運時間軸（10 年）：把「未來三年」「十年大方向」「換跑道時機」三個地方合成一條。
 * 每一年標「衝」（順或小順，而且有升遷、轉換的訊號）、「守」（注意、小心：先準備，不要裸辭）、其他是「穩」；
 * 重點照那一年的流年十神（正官＝升遷與責任、傷官＝改變與表現……）。前三年接上 buildFuture 的做什麼、小心什麼與依據。
 * @param lifeYears lifeline.buildLifeline(...).years；future：buildCareer(...).future
 */
export function careerTimeline(lifeYears = [], future = null) {
  const detail = new Map(((future && future.years) || []).map((y) => [y.year, y]));
  return lifeYears.map((y) => {
    const ssTag = y.tags.find((t) => t.endsWith('年') && SHISHEN_CAREER[t.slice(0, -1)]);
    const sc = ssTag ? SHISHEN_CAREER[ssTag.slice(0, -1)] : null;
    const go = (y.level === '順' || y.level === '小順') && y.tags.some((t) => GO_TAGS.includes(t));
    const hold = y.level === '注意' || y.level === '小心';
    return {
      year: y.year,
      age: y.age,
      level: y.level,
      mode: go ? 'go' : hold ? 'hold' : 'steady',
      focus: sc ? sc.focus : '',
      do: sc ? sc.do : '',
      watch: sc ? sc.watch : '',
      detail: detail.get(y.year) || null,
    };
  });
}
export const TIMELINE_MODE = {
  go: { label: '衝', text: '適合升遷、加薪、轉換、開新局' },
  steady: { label: '穩', text: '照計畫走，累積實力' },
  hold: { label: '守', text: '先準備、進修、存錢，不要裸辭' },
};
