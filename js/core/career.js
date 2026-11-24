// 工作與未來方向：把各系統對「適合什麼工作」的看法放在一起投票，再排出未來三年與十年的方向。
//
// 1. 工作性質：八字（十神最多的一組）、紫微（官祿宮主星）、占星（天頂與太陽星座）、生命靈數、血型
//    各投兩種「工作性質」，兩個以上系統都投的才列為最適合；每一票都標出依據。
// 2. 適合的行業：依喜用五行（bazi.js 的 yongShen）對照傳統的五行行業分類。
// 3. 未來方向：每一年看八字流年十神（並對照喜用忌神）、生命靈數流年數、木星與土星走到的宮位；
//    十年看八字大運與紫微大限。
// 全部在手機上計算；文字為本 App 撰寫，命理是參考，不是保證。

import { SIGNS } from './zodiac.js';
import { positionsAt } from './astro.js';
import { liunian, yongShen } from './bazi.js';
import { dominantShishen, personalYearNumber, PERSONAL_YEAR } from './reading.js';
import { SHISHEN_GROUPS, ZIWEI_STARS, LIFEPATH_DETAIL, SIGN_DETAIL } from './reading-texts.js';
import { BLOOD } from './blood.js';

export const NATURES = {
  manage: { label: '管理決策型', desc: '帶團隊、做決定、對結果負責。', jobs: ['主管', '經營者', '專案經理', '店長'], edge: '能扛責任、看全局', trap: '一個人扛太多，忘了授權' },
  expert: { label: '專業技術型', desc: '把一門技術做深，靠專業吃飯。', jobs: ['工程師', '技師', '醫事人員', '會計師', '設計師'], edge: '專精、可靠、越做越值錢', trap: '只顧技術，忽略溝通與包裝' },
  create: { label: '創意表達型', desc: '用作品、內容、表演說話。', jobs: ['設計', '內容創作', '行銷企劃', '表演', '教學'], edge: '點子多、有感染力', trap: '靈感來去不定，要靠紀律收尾' },
  sales: { label: '業務開拓型', desc: '接觸人、談判、開發市場。', jobs: ['業務', '通路開發', '房仲', '保險', '貿易'], edge: '敢開口、反應快、會看人', trap: '業績起伏大，要有存糧' },
  stable: { label: '穩定制度型', desc: '有規則、有保障，能長期累積。', jobs: ['公職', '行政', '銀行', '大企業內勤', '品管'], edge: '穩定、細心、值得信任', trap: '太求安穩，錯過轉換的時機' },
  care: { label: '助人服務型', desc: '照顧、教育、陪伴別人。', jobs: ['醫護', '社工', '老師', '諮商', '客服', '長照'], edge: '有同理心、讓人安心', trap: '把別人的情緒都扛在身上' },
  research: { label: '研究分析型', desc: '找答案、做判斷、寫報告。', jobs: ['研究員', '分析師', '工程師', '顧問', '法務'], edge: '邏輯清楚、判斷準', trap: '想太久才動，或不擅長推銷自己' },
  free: { label: '自由獨立型', desc: '自己安排時間與節奏。', jobs: ['自由接案', '創業', '網路經營', '個人工作室'], edge: '自主、有彈性、能開創', trap: '收入不穩，要自己建立紀律與保障' },
  finance: { label: '理財經營型', desc: '跟錢、資源與數字打交道。', jobs: ['財務', '金融', '投資', '會計', '經營管理'], edge: '對數字敏感、懂得配置資源', trap: '太看重短期報酬' },
  mobile: { label: '變動移動型', desc: '常出差、換環境、跑外勤。', jobs: ['外勤業務', '旅遊業', '物流', '記者', '外派'], edge: '適應快、見識廣', trap: '定不下來，累積不夠' },
  public: { label: '公眾溝通型', desc: '面對群眾、建立形象。', jobs: ['公關', '媒體', '主持', '講師', '品牌經營'], edge: '表達力強、有舞台魅力', trap: '太在意別人的評價' },
};

// 各系統投給哪兩種工作性質（依本 App 的文字整理，避免同一系統投太多票）
const BY_SHISHEN = { 比劫: ['free', 'sales'], 食傷: ['create', 'expert'], 財: ['finance', 'sales'], 官殺: ['manage', 'stable'], 印: ['research', 'care'] };
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
const DECADE_FOCUS = {
  命宮: '自我定位與個人發展：適合確立方向、建立個人品牌。',
  兄弟: '合作夥伴與同儕：團隊、合夥、手足的事影響最大。',
  夫妻: '感情與重要合作：伴侶與關鍵合約是重點。',
  子女: '作品、部屬與投資：帶人、創作、投資的成果。',
  財帛: '賺錢與理財：收入方式與現金流是主題。',
  疾厄: '身體與壓力管理：工作節奏要配合健康，打好底子。',
  遷移: '外出與環境變動：出差、外派、搬家、換跑道的機會多。',
  僕役: '人脈與團隊：朋友、客戶、下屬的品質決定成果。',
  官祿: '事業衝刺：升遷、創業、專業成就是主軸。',
  田宅: '家庭與資產：買房置產、家庭責任、累積財庫。',
  福德: '心靈與生活品質：興趣、精神生活與情緒平衡。',
  父母: '長輩、上司與文書：考試證照、和主管與制度打交道。',
};

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
    const dom = dominantShishen(bazi);
    vote(BY_SHISHEN[dom.group], `八字：${dom.group}較多`);
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

  return { natures, ranked, consensus: consensus.length > 0, points, industries, future: buildFuture({ natal, bazi, ziwei, birth, today, ys }) };
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
      if (ys) tone = toneOf(y, ys);
      headline = `${sc.focus}的一年`;
      doList.push(sc.do);
      watchList.push(sc.watch);
      if (y.taisui.length) watchList.push(`${y.taisui.join('、')}：重大變動前多規劃`);
      for (const t of y.triggers) watchList.push(`${t.type}：${t.text.split('：')[1].replace(/。$/, '')}`);
      const toneText = tone === 'good' ? '，是你的喜用，整體順' : tone === 'hard' ? '，是你不需要再加的五行，凡事多花一分力' : '';
      pts.push({ system: '八字', text: `${y.ganzhi}年是你的「${y.shishen}」年（天干屬${wx}${toneText}）：${y.shishenText}` });
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
    const describe = (d) => d && { ganzhi: d.ganzhi, startYear: d.startYear, endYear: d.endYear, shishen: d.shishen, ...SHISHEN_CAREER[d.shishen], good: ys ? [ys.primary, ys.secondary].includes(GAN_WX[d.ganzhi[0]]) : null };
    dayun = { current: describe(list[idx]), next: describe(list[idx + 1]) };
  }

  let decade = null;
  if (ziwei && ziwei.ok && ziwei.horoscope) {
    const cur = ziwei.palaces.find((p) => p.index === ziwei.horoscope.decadalIndex);
    const next = cur ? ziwei.palaces.find((p) => p.decadal && p.decadal[0] === cur.decadal[1] + 1) : null;
    const describe = (p) => p && { palace: p.name, ages: `${p.decadal[0]}–${p.decadal[1]} 歲`, focus: DECADE_FOCUS[p.name] || '' };
    decade = { current: describe(cur), next: describe(next) };
  }
  return { years: out, dayun, decade };
}

function toneOf(y, ys) {
  const wx = GAN_WX[y.ganzhi[0]];
  if ([ys.primary, ys.secondary].includes(wx)) return 'good';
  if (ys.avoid.includes(wx)) return 'hard';
  return 'mid';
}
