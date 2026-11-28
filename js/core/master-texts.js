// 各工具的「老師怎麼看」：算出來不好時怎麼化解、好的地方怎麼用、下一步搭配哪個工具。
// 畫面用 js/ui/master.js 的 masterCard 畫；這裡是純函式，可在 Node 測試（tests/master-texts.test.js）。
//
// 寫法（以後改文案照這個）：
// - 先下一句斷語，再講白話的原因，最後給「今天就做得到」的步驟。
// - 民俗做法（安太歲、六合生肖、喜用色與方位）標明是民俗，排在實際做法後面，當作提醒自己的儀式，不打包票。
// - 不寫宿命、恐嚇或打包票的字（tests/wording.test.js 會檢查）。

import { SHENGXIAO, ZHI } from './calendar.js';

/** 地支六合：民俗化解「沖」常用和自己六合的生肖 */
export const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
/** 和這個地支六合的生肖（例如屬馬＝午，六合是未＝羊） */
export const liuheAnimal = (zhi) => SHENGXIAO[ZHI.indexOf(LIUHE[zhi])];

/** 喜用五行怎麼補（傳統的補運做法：顏色、方位、數字、擺設、活動、作息） */
export const WX_BOOST = {
  木: { color: '綠色、青色', dir: '東方', nums: '3、8', items: '綠色植物、木頭家具', act: '早起散步、爬山、親近大自然', habit: '早睡早起、多伸展' },
  火: { color: '紅色、紫色、橘色', dir: '南方', nums: '2、7', items: '溫暖明亮的燈、紅色小物', act: '曬太陽、運動流汗、參加熱鬧的聚會', habit: '保持溫暖、少吃冰' },
  土: { color: '黃色、咖啡色、米色', dir: '中央、東北、西南', nums: '5、0', items: '陶瓷、石頭擺件、黃色系布置', act: '下廚、種花種菜、規律作息', habit: '三餐定時、顧好腸胃' },
  金: { color: '白色、金色、銀色', dir: '西方', nums: '4、9', items: '金屬擺件、白色系布置', act: '整理收納、做計畫、練深呼吸', habit: '常保環境乾淨、注意呼吸道' },
  水: { color: '藍色、黑色', dir: '北方', nums: '1、6', items: '魚缸、水耕植物、藍黑色系布置', act: '游泳、到海邊河邊走走、閱讀', habit: '多喝水、晚上好好休息' },
};

const who = (name) => (name && name !== '你' ? name : '你');

// ── 今日（daily.dailyIndex 的 factors）
const DAY_VERDICT = {
  大吉: '順風日。想做的事今天推，想見的人今天約；好運要用，才會變成成果。',
  小吉: '今天不錯，照計畫走就順。小事放手去做，大事穩穩推，別貪快。',
  平: '今天平平，把例行的事做好就是贏。重要的決定先放一晚，明天再看一次。',
  宜守: '今天宜守不宜攻：不是壞事會發生，是力氣容易用錯地方。少衝、少吵、多休息，守住就是贏。',
};
const SHISHEN_GOOD = {
  正印: '有貴人：今天適合請教、求助、上課學習。',
  食神: '心情好、人緣好：適合聚餐、創作、表達自己。',
  正財: '適合處理錢和工作：對帳、談價格、把正事做完。',
  偏財: '有意外的機會：多和人聊聊，可能有好消息。',
  正官: '適合照規矩辦正事：送件、開會、見長官。',
};
const SHISHEN_FIX = {
  七殺: { title: '化解：壓力日（七殺）', steps: ['主管、客戶的要求可能比較多：先答應做得到的，做不到的明確說什麼時候能好。', '下班後運動半小時，把壓力排掉，不要帶回家。'] },
  劫財: { title: '化解：破財、爭執日（劫財）', steps: ['今天不借錢、不作保；想買的東西先放購物車，明天再結帳。', '和朋友合夥、分帳的事，先講清楚再開始。'] },
  傷官: { title: '化解：口舌日（傷官）', steps: ['話說七分就好，批評的話留到明天再說。', '重要的訊息先存草稿，十分鐘後再看一次才送出。'] },
};

/** 好的時辰（醒著的時段、黃道吉時、不沖生肖），最多兩個，例如「09:00–10:59、13:00–14:59」 */
function goodHours(hours) {
  if (!hours) return '';
  return hours.filter((x) => x.good && x.start >= '07:00' && x.start <= '21:00').slice(0, 2).map((x) => `${x.start}–${x.end}`).join('、');
}

/**
 * @param daily dailyIndex 的結果（要有 factors）
 * @param {{name?:string, lucky?:object|null, hours?:object[]|null}} o lucky：luckyItems；hours：hourGuide
 */
export function dailyMaster(daily, { name = '你', lucky = null, hours = null } = {}) {
  const f = daily.factors || {};
  const W = who(name);
  const why = [];
  const remedies = [];
  const boosts = [];
  const hrs = goodHours(hours);
  const zhi = Number.isInteger(f.zodiacIndex) ? ZHI[f.zodiacIndex] : null;
  if (f.clash && f.clash.includes('生肖')) {
    why.push({ tone: 'bad', text: `今天沖${W}的生肖（屬${f.animal}）：大事容易卡，出門容易有小狀況。` });
    remedies.push({
      title: `化解：沖生肖（屬${f.animal}）`,
      steps: [
        hrs ? `簽約、提案、告白這類大事能改期就改期；改不了就挑今天的吉時辦：${hrs}。` : '簽約、提案、告白這類大事能改期就改期；改不了就挑今天的吉時辦（吉時表標「吉」的時段）。',
        '出門前多確認一次行程，開車騎車慢一點。',
        zhi ? `民俗做法：身上帶一個屬${liuheAnimal(zhi)}的小物（和屬${f.animal}六合），取「合」來緩和「沖」。` : null,
      ].filter(Boolean),
    });
  }
  if (f.avoid) {
    why.push({ tone: 'bad', text: `今天的五行（${f.avoid}）是${W}的忌神：做事比較費力，容易累。` });
    const b = f.primary ? WX_BOOST[f.primary] : null;
    remedies.push({
      title: `化解：忌神日（${f.avoid}）`,
      steps: [
        b ? `穿戴${W}的喜用色（${b.color}），提醒自己今天放慢一點。` : '今天放慢一點，重要的事多檢查一次。',
        lucky ? `重要的事往今天的喜神方（${lucky.xi}）或財神方（${lucky.cai}）去辦。` : null,
        b ? `今天${b.habit}，身體是運的本錢。` : null,
      ].filter(Boolean),
      note: '喜用色和方位是傳統的補運做法，當作一個讓自己定下心的儀式。',
    });
  } else if (f.favor) {
    why.push({ tone: 'good', text: `今天的五行（${f.favor}）是${W}的喜用：做事比較順。` });
    boosts.push(`今天的${f.favor}是${W}的喜用：想推的事今天推，想談的事今天談。`);
  }
  if (SHISHEN_FIX[f.shishen]) {
    why.push({ tone: 'bad', text: `今天對${W}是「${f.shishen}」日。` });
    remedies.push(SHISHEN_FIX[f.shishen]);
  } else if (SHISHEN_GOOD[f.shishen]) {
    why.push({ tone: 'good', text: `今天對${W}是「${f.shishen}」日：${SHISHEN_GOOD[f.shishen]}` });
    boosts.push(SHISHEN_GOOD[f.shishen]);
  }
  if (f.clash && f.clash.includes('日支')) {
    why.push({ tone: 'bad', text: `今天沖${W}的日支（自己和另一半的位置）：情緒容易起伏，和親近的人容易拌嘴。` });
    remedies.push({ title: '化解：沖日支（感情、情緒）', steps: ['和另一半、家人說話放軟，今天不談分手、不翻舊帳。', '心情浮躁時先停十秒再回話。'] });
  }
  if (f.harmony && f.harmony.length) {
    why.push({ tone: 'good', text: `今天和${W}的${f.harmony.join('、')}相合：談事情、找人幫忙比較順。` });
    boosts.push('今天和你相合：適合約人、談合作、請人幫忙。');
  }
  if (f.black) {
    why.push({ tone: 'info', text: `今天是${f.tianShen}黑道日：傳統上重要的事宜低調。` });
    if (daily.level === '平' || daily.level === '宜守') {
      remedies.push({ title: '化解：黑道日', steps: [hrs ? `重要的事挑今天的黃道吉時：${hrs}。` : '重要的事挑今天的黃道吉時（吉時表標「吉」的時段）。', '開始做事前先寫下步驟，照順序做，減少出錯。'] });
    }
  } else if (f.tianShen) {
    why.push({ tone: 'good', text: `今天是${f.tianShen}黃道吉日：傳統上適合辦事。` });
  }
  return {
    badge: daily.level,
    verdict: `老師看${W}今天：${DAY_VERDICT[daily.level] || DAY_VERDICT.平}`,
    why: why.slice(0, 5),
    remedies: remedies.slice(0, 3),
    boosts: boosts.slice(0, 3),
    combos: [
      { label: '擇日', why: '重要的事挑哪一天辦（兩個人的事到「占卜→配對」看兩人都順的日子）', go: ['fortune', {}] },
      { label: '解惑', why: '卡在一件事時起一卦，看趨勢和做法', go: ['oracle', { panel: 'jiehuo' }] },
    ],
  };
}

// ── 時運（fortune.computeFortune 的結果）
const AREA_NAME = { love: '愛情', career: '事業', money: '財運', health: '健康' };
const AREA_FIX = {
  love: { title: '化解：感情運低', steps: ['少用訊息吵架，重要的話見面說。', '單身的人先把自己照顧好（運動、打扮、作息），好緣分才看得到你。', '有伴的人安排一次只有你們兩個的約會，聊聊最近的心情。'] },
  career: { title: '化解：事業運低', steps: ['重要的提案、面試、談判，排在這段期間比較順的日子（看走勢）。', '把手上的事列清單、照優先順序做完；低潮期不開新戰場。', '多問一句「你期待的是什麼」，減少和主管、同事的誤會。'] },
  money: { title: '化解：財運低', steps: ['大額消費、投資、借貸、作保都先緩一緩。', '這段期間記帳，把用不到的訂閱、月費砍掉。', '想投資先做功課，至少隔一週再決定。'] },
  health: { title: '化解：健康運低', steps: ['睡眠排第一：固定時間睡，睡前一小時不滑手機。', '運動、開車、騎車慢一點，避免受傷。', '小毛病早點看醫生，不要硬撐。'] },
};
const AREA_USE = {
  love: '感情運旺：想告白、想約會、想求婚，這段期間是好時機。',
  career: '事業運旺：提案、爭取升遷、談合作，就趁現在。',
  money: '財運旺：適合談加薪、整理理財計畫；投資還是要做功課。',
  health: '精神好：適合開始一個運動習慣，或去做健康檢查。',
};
// 不順的行星相位：每顆星一句做法
const PLANET_FIX = {
  Saturn: '土星帶來壓力：把責任拆小、一次做一件；這是打基礎的時候，不是放棄的時候。',
  Mars: '火星帶來火氣：脾氣上來先停十秒，運動把多的精力用掉。',
  Mercury: '水星卡關：訊息、合約多確認一次，重要的事留文字紀錄。',
  Moon: '月亮讓情緒起伏：先照顧好心情，再做決定。',
  Venus: '金星不順：感情和花錢容易不如意，購物車先放一晚。',
  Sun: '太陽受壓：自信心容易受挫，別和人比較，專心做自己的事。',
  Jupiter: '木星過頭：容易太樂觀、答應太多，答應前先算算時間和預算。',
};
const PERIOD_VERDICT = [
  [75, '運勢旺。該衝的就衝，好運是用出來的，不是存起來的。'],
  [60, '穩中有進：照計畫走就好，順的地方多出力，弱的地方守住。'],
  [45, '平平：不求大突破，把基本功做好，等下一波順的時候再衝。'],
  [0, '宜守：不是不能做事，是要做對的事。少冒險、多準備，低潮期打好的底，就是下次翻身的本錢。'],
];

/** @param f computeFortune 的結果；label 例如「本週」「今年」；name 稱呼 */
export function periodMaster(f, { label = '這段時間', name = '你' } = {}) {
  const s = f.scores;
  const why = [];
  const remedies = [];
  const boosts = [];
  const areas = Object.keys(AREA_NAME).sort((a, b) => s[a] - s[b]);
  for (const a of areas.filter((x) => s[x] < 45).slice(0, 2)) {
    why.push({ tone: 'bad', text: `${AREA_NAME[a]} ${s[a]} 分，是${label}最弱的一環。` });
    remedies.push(AREA_FIX[a]);
  }
  for (const a of [...areas].reverse().filter((x) => s[x] >= 70).slice(0, 2)) {
    why.push({ tone: 'good', text: `${AREA_NAME[a]} ${s[a]} 分，是${label}的強項。` });
    boosts.push(AREA_USE[a]);
  }
  const hard = (f.highlights || []).filter((x) => x.tone === 'bad' && PLANET_FIX[x.key]).slice(0, 2);
  if (hard.length) remedies.push({ title: '化解：不順的行星角度', steps: hard.map((x) => PLANET_FIX[x.key]) });
  if (f.period === 'year' && f.worst && f.best && f.worst !== f.best) {
    boosts.push(`今年最順的是 ${f.best.m} 月：大事（換工作、搬家、投資自己）可以排在那個月；${f.worst.m} 月保守一點。`);
  }
  const [, v] = PERIOD_VERDICT.find(([min]) => s.overall >= min);
  return {
    badge: s.overall >= 60 ? '順' : s.overall >= 45 ? '平' : '宜守',
    verdict: `老師看${who(name)}${label}：${v}`,
    why,
    remedies: remedies.slice(0, 3),
    boosts: boosts.slice(0, 3),
    combos: [
      { label: '人生時間軸', why: '看未來 10 年、12 個月的起伏', go: ['destiny', { tool: 'liunian' }] },
      { label: '開運佈置', why: '用喜用五行布置家裡和辦公桌', go: ['destiny', { tool: 'fengshui' }] },
    ],
  };
}

// ── 犯太歲：每一種的白話與化解（以前只有一句「可依習俗安太歲」）
export const TAISUI_FIX = {
  值太歲: { plain: '本命年：變動多、心情起伏大', steps: ['大事（換工作、買房、結婚）不是不能做，多準備、多問人，不要衝動決定。', '每個月留一個晚上給自己，把心情整理好。'] },
  沖太歲: { plain: '和太歲相沖：環境變動大（搬家、換工作、人事調動）', steps: ['與其被動地變，不如主動規劃：今年適合整理、準備，主動選擇要怎麼變。', '開車、運動、出遠門注意安全。'] },
  刑太歲: { plain: '刑太歲：容易有口舌、合約糾紛或小傷', steps: ['合約看清楚，不幫人作保、不簽看不懂的東西。', '說話留餘地，不在網路上和人吵；注意小傷，定期健檢。'] },
  害太歲: { plain: '害太歲：容易被誤會、遇到扯後腿的人', steps: ['重要的事留紀錄（Email、訊息），口頭答應的事再用文字確認。', '少說別人閒話，人際上多付出一點。'] },
  破太歲: { plain: '破太歲：計畫容易被打亂、容易破財', steps: ['時間和預算各多留兩成緩衝。', '不借錢給人，大額消費緩一緩。'] },
};

/**
 * 一整年的化解（人生時間軸）。
 * @param {{name?:string, year:number, animal:string, zodiacZhi:string, taisui:string[], level:string, watchYears?:number[], goodYears?:number[], hardMonths?:string[]}} o
 */
export function yearMaster({ name = '你', year, animal, zodiacZhi, taisui = [], level, watchYears = [], goodYears = [], hardMonths = [] }) {
  const W = who(name);
  const remedies = [];
  const why = [];
  for (const t of taisui) {
    const fx = TAISUI_FIX[t];
    if (!fx) continue;
    why.push({ tone: 'bad', text: `${year} 年${W}${t}：${fx.plain}。` });
    remedies.push({ title: `化解：${t}`, steps: fx.steps });
  }
  if (taisui.length) {
    remedies.push({
      title: '民俗做法：安太歲',
      steps: [`農曆正月到廟裡安太歲，或在家裡擺屬${liuheAnimal(zodiacZhi)}的小擺件（和屬${animal}六合），取「合」來緩和。`, '紅色的貼身衣物、手鍊是常見的習俗，圖個安心。'],
      note: '民俗做法是讓自己「今年要穩」的提醒；真正的化解是上面那些實際的做法。',
    });
  }
  if (level === '注意' || level === '小心') {
    why.push({ tone: 'bad', text: `${year} 年整體是「${level}」：變動或壓力比較多。` });
    remedies.push({ title: `化解：${level}的年份`, steps: ['守成為主：借貸、作保、衝動投資都避開。', '健康檢查、保險先做好，把緩衝準備好。', '大決定前找一個信任的人聽聽意見，別一個人扛。'] });
  }
  if (hardMonths.length) remedies.push({ title: '這幾個月特別小心', steps: [`${hardMonths.join('、')}：重要的決定和簽約可以避開，或多準備一點。`] });
  const boosts = [];
  if (goodYears.length) boosts.push(`${goodYears.join('、')} 年比較順：換跑道、買房、創業這類大事，可以排在那幾年。`);
  if (level === '順' || level === '小順') boosts.push(`${year} 年是好運年：適合主動爭取，換跑道、談加薪、投資自己都比較順。`);
  const verdict = level === '順' || level === '小順'
    ? `老師看${W}${year} 年：順風年。好運不會自己來敲門，主動去爭取，今年的努力會有回報。`
    : level === '平'
      ? `老師看${W}${year} 年：平穩年。照自己的節奏走，適合打基礎，為後面的好年份做準備。`
      : `老師看${W}${year} 年：要多用心的一年。不是壞事會找上門，是要提早準備：穩住、不冒進，就能平安過。`;
  return {
    badge: level,
    verdict,
    why,
    remedies: remedies.slice(0, 4),
    boosts,
    combos: [
      { label: '開運佈置', why: '今年的太歲方、五黃方怎麼避、怎麼擺', go: ['destiny', { tool: 'fengshui' }] },
      { label: '擇日', why: '大事挑順的日子辦', go: ['fortune', {}] },
    ],
    watchYears,
  };
}

// ── 八字：先讀盤（日主、強弱、喜用是哪一種十神、十神最多的是什麼、格局、大運），再講怎麼補
// 使用者回饋「看不懂、只是各別加起來」：以前斷語只講「最需要木」，沒有說木對你來說是什麼。
// 喜用五行換成它和日主的關係（印、比劫、食傷、財、官殺），就能講成白話：需要貴人、需要夥伴、需要舞台……
const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 相生：木生火……
const CTRL = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }; // 相剋：木剋土……
/** 某個五行對日主是哪一類十神 */
export function roleOf(dmWx, wx) {
  if (wx === dmWx) return '比劫';
  if (GEN[wx] === dmWx) return '印';
  if (GEN[dmWx] === wx) return '食傷';
  if (CTRL[dmWx] === wx) return '財';
  return '官殺';
}
/** 反過來：這一類十神對日主是哪個五行 */
const WX_OF_ROLE = (dmWx, role) => ['木', '火', '土', '金', '水'].find((wx) => roleOf(dmWx, wx) === role);
/** 喜用是這一類十神時：需要的是什麼、怎麼走、做得到的事 */
export const ROLE_NEED = {
  印: { what: '貴人、學習和長輩的支持', how: '先充實自己、找到靠山，路會越走越順', act: ['定期請教前輩或老師，遇到難題先問人。', '進修、考證照：學歷和專業是你最好的護身符。'] },
  比劫: { what: '朋友、夥伴和自信', how: '找夥伴一起做，比一個人硬撐好', act: ['找志同道合的夥伴合作，或加入社群、同業公會。', '多運動、練體力：身體是你的本錢。'] },
  食傷: { what: '表達、才華和作品', how: '把會的東西展現出來，靠作品說話', act: ['經營一個展現才華的出口：寫作、做影片、教課、作品集。', '工作上主動提案、上台，讓別人看見你的能力。'] },
  財: { what: '資源、金錢和實際成果', how: '把能力變現、務實累積', act: ['把專長變成收入：接案、副業或爭取績效獎金。', '訂好理財計畫，每月固定存、固定投資。'] },
  官殺: { what: '目標、規範和責任', how: '給自己明確的目標和制度，反而發揮得最好', act: ['替自己訂期限和目標，寫下來、找人監督。', '進制度清楚的組織，或爭取需要扛責任的位置。'] },
};
/** 十神最多的偏偏是忌神時，太多會變成什麼負擔 */
export const ROLE_TOO_MUCH = {
  印: '想太多、依賴別人、光學不做', 比劫: '朋友借錢、合夥糾紛、和人硬碰硬', 食傷: '話太多、太衝、容易得罪人',
  財: '為錢操勞、投資貪多', 官殺: '壓力太大、被管太多、責任扛不完',
};
const YUN_WORD = { good: '順風運', bad: '逆風運', mixed: '好壞參半的運', neutral: '平穩的運' };
/** 干支喜忌 → 好壞（同 reading.js）：有喜有忌是好壞參半，喜加平算順、忌加平算逆 */
function gzWord(t) {
  if (!t) return 'neutral';
  const p = [t.gan, t.zhi];
  const g = p.includes('喜');
  const b = p.includes('忌');
  return g && b ? 'mixed' : g ? 'good' : b ? 'bad' : 'neutral';
}

/**
 * @param {{name?:string, ys:object, gejuStatus?:string|null, dayun?:{ganzhi:string, tone:object|null}|null,
 *   dm?:{gan:string, wx:string}|null, image?:string, dom?:{group:string}|null, geju?:object|null,
 *   nextYun?:{ganzhi:string, startYear:number, tone:object|null}|null, year?:number|null}} o
 *   ys：yongShen；gejuStatus：geju 的狀態（成格、破格…）；dayun：目前大運和它對你的喜忌（ganzhiTone）；
 *   dm、image、dom、geju、nextYun：有給就把斷語改成讀盤（日主像什麼、喜用是哪一種十神、十神最多的是幫手還是負擔、格局主軸、換運）
 */
export function baziMaster({ name = '你', ys, gejuStatus = null, dayun = null, dm = null, image = '', dom = null, geju = null, nextYun = null, year = null }) {
  const W = who(name);
  const b = WX_BOOST[ys.primary];
  const b2 = WX_BOOST[ys.secondary];
  // yongShen 的第一個理由是取用的主要原因（身強身弱、取什麼）；沒有就不列，不能印出 undefined
  const why = [ys.reasons && ys.reasons[0], ys.reason].filter(Boolean).slice(0, 1).map((text) => ({ tone: 'info', text }));
  const remedies = [{
    title: `補運：多接觸「${ys.primary}」，其次是「${ys.secondary}」`,
    steps: [
      `顏色：衣服、手機殼、錢包用${b.color}${b2 && ys.secondary !== ys.primary ? `，其次${b2.color}` : ''}。`,
      `方位：書桌、床頭朝${b.dir}；出差、找工作可以優先考慮往${b.dir}。`,
      `家裡和辦公桌：多放${b.items}。`,
      `生活：${b.act}；${b.habit}。`,
    ],
    note: '這是傳統「補喜用」的做法：讓命盤的五行平衡一點。效果是提醒自己往順的方向走，不是換了顏色運就會變。',
  }];
  const avoid = ys.avoid.map((x) => WX_BOOST[x] ? `${x}（${WX_BOOST[x].color}）` : x).join('、');
  if (avoid) remedies.push({ title: `少碰：${ys.avoid.join('、')}`, steps: [`忌神的顏色、環境少用：${avoid}。`, '不用刻意避開到很極端，大面積、天天用的東西（衣服、房間主色）避開就好。'] });
  if (gejuStatus === '破格' || gejuStatus === '成中帶忌') {
    why.push({ tone: 'bad', text: `格局：${gejuStatus}，先天的優勢有缺口。` });
    remedies.push({ title: '化解：格局有缺口', steps: ['後天補：選和喜用五行相關的工作、環境（到「工作與未來方向」看適合的行業）。', '大運走到喜用的十年是發揮期，提早準備；走到忌神的十年以守成、學習為主。', '專心經營一兩個強項，比到處補洞有效。'] });
  } else if (gejuStatus === '成格') {
    why.push({ tone: 'good', text: '格局成格：先天的條件不錯，順著它走就好。' });
  }
  const boosts = [];
  if (dayun && dayun.tone) {
    const t = dayun.tone;
    if (t.gan === '忌' && t.zhi === '忌') {
      why.push({ tone: 'bad', text: `目前大運 ${dayun.ganzhi}：干支都是你的忌神，這十年是逆風運。` });
      remedies.push({ title: '化解：逆風的大運', steps: ['守成、學習、存錢：這十年打的底，是下一步大運的本錢。', '不做超出能力的擔保和投資，重大決定多問人。', '用上面的補運做法把能量補回來。'] });
    } else if (t.gan === '喜' && t.zhi === '喜') {
      why.push({ tone: 'good', text: `目前大運 ${dayun.ganzhi}：干支都是你的喜用，這十年是順風運。` });
      boosts.push(`目前大運 ${dayun.ganzhi} 是順風運：想做的大事（創業、換跑道、置產）這十年做。`);
    } else {
      why.push({ tone: 'info', text: `目前大運 ${dayun.ganzhi}：${t.text}` });
    }
  }
  let verdict = `老師看${W}的八字：${ys.primary === ys.secondary ? `最需要的是「${ys.primary}」` : `最需要的是「${ys.primary}」，其次是「${ys.secondary}」`}。命是先天的底，運是後天的路：缺的不用怕，補得到；走順的方向，事半功倍。`;
  if (dm) {
    // 讀盤版：日主 → 強弱 → 喜用是哪一種十神（白話）→ 十神最多的是幫手還是負擔 → 格局主軸 → 大運
    const need = roleOf(dm.wx, ys.primary);
    const N = ROLE_NEED[need];
    const strength = { 身強: '而且力量很足', 身弱: '但力量偏弱', 中和: '力量不強不弱' }[ys.strength] || '';
    const parts = [`老師看${W}的八字：日主${dm.gan}${dm.wx}${image ? `（${image}）` : ''}，${strength}，所以最需要的是「${ys.primary}」——對${W}來說是「${need}」，也就是${N.what}。`];
    why.unshift({ tone: 'info', text: `喜用「${ys.primary}」對日主${dm.wx}是${need}：${W}的路是${N.how}。` });
    if (dom && dom.group) {
      const domWx = WX_OF_ROLE(dm.wx, dom.group);
      if (dom.group === need || domWx === ys.secondary) {
        parts.push(`命盤裡最多的正好是${dom.group}，天生的資源站在${W}這邊。`);
        boosts.push(`十神最多的${dom.group}正好是你需要的：把它當成主要的武器。`);
      } else if (ys.avoid.includes(domWx)) {
        parts.push(`命盤裡最多的是${dom.group}，偏偏太多反而是負擔：要小心${ROLE_TOO_MUCH[dom.group]}。`);
        why.push({ tone: 'bad', text: `十神最多的是${dom.group}（五行${domWx}），是忌神：太多時容易${ROLE_TOO_MUCH[dom.group]}。` });
      }
    }
    if (geju) parts.push(`格局是${geju.name}（${geju.status}），一生的主軸在「${geju.info.core}」${geju.status === '成格' ? '，先天條件不錯' : geju.status === '破格' || geju.status === '成中帶忌' ? '，但有缺口，要靠後天補' : ''}。`);
    if (dayun && dayun.tone) {
      const w = gzWord(dayun.tone);
      let t = `目前大運${dayun.ganzhi}是${YUN_WORD[w]}`;
      if (nextYun && year && nextYun.startYear > year && nextYun.startYear - year <= 5) {
        const nw = gzWord(nextYun.tone);
        if (nw !== w) {
          t += `，${nextYun.startYear} 年換${nextYun.ganzhi}（${YUN_WORD[nw]}）`;
          why.push({ tone: nw === 'good' ? 'good' : nw === 'bad' ? 'bad' : 'info', text: `${nextYun.startYear} 年起換大運${nextYun.ganzhi}：從${YUN_WORD[w]}轉為${YUN_WORD[nw]}，${nw === 'bad' ? '這幾年先存糧、打底' : '想做的事可以開始準備'}。` });
        }
      }
      parts.push(`${t}。`);
    }
    verdict = parts.join('');
    remedies.unshift({ title: `補「${ys.primary}」（${need}）：${N.how}`, steps: N.act, note: '這是把喜用神換成生活上做得到的事；下面的顏色、方位是傳統的補法。' });
  }
  return {
    badge: `喜${ys.primary}`,
    verdict,
    why,
    remedies: remedies.slice(0, dm ? 5 : 4),
    boosts,
    combos: [
      { label: '工作與未來方向', why: '用喜用五行挑行業和工作環境', go: ['destiny', { tool: 'career' }] },
      { label: '開運佈置', why: '家裡、辦公桌照喜用五行擺', go: ['destiny', { tool: 'fengshui' }] },
      { label: '人生時間軸', why: '哪幾年順、哪幾年要守', go: ['destiny', { tool: 'liunian' }] },
    ],
  };
}

// ── 紫微：化忌落在哪一宮，就是這一生最要用心的地方（流年化忌是今年要用心的地方）
export const JI_FIX = {
  命宮: '對自己別太苛求：把標準寫下來，做到八成就給自己鼓勵；多運動、多和人聊，別悶著。',
  兄弟: '兄弟姊妹、合作夥伴之間，錢和責任分清楚，口頭的約定寫下來。',
  夫妻: '感情上容易牽掛、計較：把期待說出口，不要讓對方猜；吵架不過夜。',
  子女: '對孩子（或下屬、學生）別操心太多：給方向、放手讓他試。',
  財帛: '錢容易進來也容易出去：自動扣款存錢、記帳，不借錢、不作保。',
  疾厄: '身體是最該照顧的地方：定期健檢、規律作息，小毛病早點看。',
  遷移: '出外、搬家、出差多準備：行程確認兩次，交通注意安全。',
  僕役: '朋友、同事的事別一肩扛：慎選合作對象，不做擔保。',
  交友: '朋友、同事的事別一肩扛：慎選合作對象，不做擔保。',
  官祿: '工作上容易卡關、壓力大：按部就班、留紀錄；換工作前先找好下一步。',
  田宅: '房子、家裡的事多謹慎：買房、裝修多比較、多看合約。',
  福德: '想太多、睡不好：給自己固定的放鬆時間，培養一個讓你專心的興趣。',
  父母: '和長輩、主管的溝通多一點耐心：先聽完再回應，重要的事當面談。',
};

const PALACE_DOMAIN_SHORT = { 命宮: '自己的狀態', 兄弟: '兄弟和夥伴', 夫妻: '感情', 子女: '子女和晚輩', 財帛: '錢', 疾厄: '身體', 遷移: '出外發展', 僕役: '朋友和人脈', 交友: '朋友和人脈', 官祿: '事業', 田宅: '家和不動產', 福德: '心情和興趣', 父母: '長輩和上司' };
const dom = (p) => PALACE_DOMAIN_SHORT[p] || p;
const bare = (p) => (p && p !== '命宮' ? p.replace(/宮$/, '') : p);
const pal = (p) => (bare(p) === '命宮' ? '命宮' : `${bare(p)}宮`);

/**
 * @param {{name?:string, natalJi?:{star:string, palace:string}|null, yearJi?:{star:string, palace:string}|null, year?:number,
 *   summary?:object|null, mingTone?:'good'|'mid'|'bad'|null, pattern?:{name:string, tone:string}|null}} o
 *   summary：ziweiSummary 的結果；有給就把斷語改成讀盤（命宮主星、三方四正、身宮、生年祿忌、強弱宮、現在的大限）
 */
export function ziweiMaster({ name = '你', natalJi = null, yearJi = null, year = null, summary = null, mingTone = null, pattern = null }) {
  const W = who(name);
  const why = [];
  const remedies = [];
  const boosts = [];
  if (natalJi && natalJi.palace) {
    why.push({ tone: 'bad', text: `本命化忌（${natalJi.star}）在${natalJi.palace}：這一宮管的事，是${W}這一生最容易牽掛、最要用心的地方。` });
    if (JI_FIX[natalJi.palace]) remedies.push({ title: `化解：化忌在${natalJi.palace}`, steps: [JI_FIX[natalJi.palace], '化忌不是壞，是「執著」：在這件事上多花心思，往往也是你最有成就的地方。'] });
  }
  if (yearJi && yearJi.palace) {
    why.push({ tone: 'bad', text: `${year ? `${year} 年` : '今年'}流年化忌（${yearJi.star}）在${yearJi.palace}：這方面今年要多花心力。` });
    if (JI_FIX[yearJi.palace] && (!natalJi || yearJi.palace !== natalJi.palace)) remedies.push({ title: `今年的化解：流年化忌在${yearJi.palace}`, steps: [JI_FIX[yearJi.palace]] });
  }
  let verdict = `老師看${W}的紫微盤：${natalJi && natalJi.palace ? `化忌在${natalJi.palace}，那是你的功課，也是你的修練場。功課做好了，這一宮反而最穩。` : '四化分布平均，沒有特別卡的地方；照命宮主星的個性去發揮就好。'}`;
  let badge = null;
  if (summary) {
    // 讀盤版：命宮（是誰）→ 三方四正（先天條件）→ 生年祿忌（福氣與功課）→ 強弱宮 → 身宮 → 現在的大限
    const S = summary;
    const parts = [`老師看${W}的紫微盤：命宮${S.ming.borrowed ? '沒有主星、借對宮的' : ''}${S.ming.stars.join('、')}，${S.ming.text.split('。')[0]}。`];
    // 命宮格局和三方四正一起講：吉格配上煞星多，是「底子好、過程要磨」，不是單純的好或壞
    const pg = pattern && pattern.tone === 'good';
    const pb = pattern && pattern.tone === 'bad';
    if (mingTone === 'bad' && pg) parts.push(`命宮有${pattern.name}（吉格），但三方四正煞星也多：底子好，過程要多磨練。`);
    else if (mingTone === 'good' && pb) parts.push(`命宮的三方四正偏吉，但有${pattern.name}要小心：條件好，別在老地方跌倒。`);
    else if (mingTone === 'good') parts.push(`命宮的三方四正偏吉${pg ? `，還有${pattern.name}（吉格）` : ''}，先天條件不錯。`);
    else if (mingTone === 'bad') parts.push(`命宮的三方四正煞星較多${pb ? `，又有${pattern.name}` : ''}，先天比較辛苦，靠後天努力會越來越好。`);
    else if (pattern) parts.push(`命宮格局是${pattern.name}${pg ? '（吉格）' : pb ? '（要小心的格局）' : ''}。`);
    const lu = S.mutagens.find((m) => m.mutagen === '化祿');
    const ji = S.mutagens.find((m) => m.mutagen === '化忌');
    if (lu && ji) {
      parts.push(bare(lu.palace) === bare(ji.palace)
        ? `生年化祿和化忌都在${pal(lu.palace)}：${dom(bare(lu.palace))}是你最大的福氣，也是最放不下的地方。`
        : `生年化祿在${pal(lu.palace)}、化忌在${pal(ji.palace)}：${dom(bare(lu.palace))}是你的福氣，${dom(bare(ji.palace))}是你的功課。`);
      // 交叉看：福氣所在的宮整體偏弱、功課所在的宮整體偏強，講法不一樣
      if (S.weak.includes(lu.palace)) why.push({ tone: 'info', text: `化祿在${pal(lu.palace)}，但這一宮的三方四正偏弱：機會會來，要把握、別揮霍。` });
      if (S.strong.includes(ji.palace)) why.push({ tone: 'info', text: `化忌在${pal(ji.palace)}，但這一宮的三方四正還算強：壓力大，也做得出成績。` });
      boosts.push(`化祿在${pal(lu.palace)}：${dom(bare(lu.palace))}是你的福氣來源，多投入在這裡。`);
    }
    if (S.strong.length) parts.push(`強項是${S.strong.slice(0, 3).map(dom).join('、')}${S.weak.length ? `；要多花心力的是${S.weak.slice(0, 3).map(dom).join('、')}` : ''}。`);
    const now = S.decades.find((d) => d.current);
    if (now) parts.push(`現在走${pal(now.palace)}大限（${now.from}–${now.to} 歲），${{ good: '是順的十年', bad: '是辛苦的十年', mid: '是平穩的十年' }[now.tone]}：重心在${now.focus.replace(/。$/, '')}。`);
    verdict = parts.join('');
    if (S.body) why.unshift({ tone: 'info', text: S.body.text });
    if (pattern && pattern.text) why.push({ tone: pattern.tone === 'good' ? 'good' : pattern.tone === 'bad' ? 'bad' : 'info', text: `命宮格局${pattern.name}：${pattern.text}` });
    badge = S.ming.stars.length ? `命宮${S.ming.stars.join('')}` : null;
  }
  return {
    badge,
    verdict,
    why,
    remedies,
    boosts,
    combos: [
      { label: '綜合解讀', why: '八字、紫微、星盤一起看，哪些說法一致', go: ['destiny', { tool: 'reading' }] },
      { label: '人生時間軸', why: '大限、流年哪幾年要注意', go: ['destiny', { tool: 'liunian' }] },
    ],
  };
}

// ── 生命靈數：主命數、天賦數、九宮格的連線與空缺、太多的數字、流年數合起來講
// 交叉看的重點（台灣常見的看法，本 App 整理）：主命數在九宮格裡是空缺數 → 課題要從零練起；
// 天賦數在九宮格裡也空缺 → 天賦要刻意練才會出來；主命數在九宮格出現三次以上 → 特質強到容易過頭。
/**
 * @param {{name?:string, lp:object, grid:object, py:number, meanings:object, missingText:object, manyText:object, pyText:object, detail:object}} o
 *   lp：lifePath；grid：grid；py：流年數；其他是 numerology.js、reading.js、reading-texts.js 的文字表（由畫面傳進來，這裡不載入）
 */
export function numerologyMaster({ name = '你', lp, grid, py, meanings, missingText, manyText, pyText, detail }) {
  const W = who(name);
  const n = lp.number;
  const why = [];
  const remedies = [];
  const boosts = [];
  const head = meanings[n].text.split('；');
  const parts = [`老師看${W}的生命靈數：主命數 ${n}「${meanings[n].title}」——${head[0]}。`];
  const talent = [...new Set(lp.talent)].filter((t) => t >= 1);
  if (talent.length) {
    parts.push(`天賦數 ${lp.total} 帶著${talent.map((t) => `「${meanings[t].title}」`).join('和')}的能力，是天生比較不費力的地方。`);
  }
  const lpMissing = grid.missing.includes(n);
  const lpMany = grid.many.includes(n);
  if (lpMissing) {
    parts.push(`主命數 ${n} 在九宮格裡是空缺：這輩子的課題要從零練起，常要花比別人多的力氣，但練成了就是${W}的招牌。`);
    why.push({ tone: 'bad', text: `主命數 ${n} 沒有出現在生日數字裡（九宮格空缺）：${missingText[n]}` });
    remedies.push({ title: `主命數 ${n} 從零練起`, steps: [missingText[n].split('；').slice(-1)[0].replace(/。$/, '') + '。', `每天做一件和「${meanings[n].title}」有關的小事，累積一個月再回頭看。`] });
  } else if (lpMany) {
    parts.push(`主命數 ${n} 在九宮格出現 ${grid.counts[n]} 次：特質非常鮮明，要小心過頭。`);
    why.push({ tone: 'bad', text: `${n} 出現 ${grid.counts[n]} 次：${manyText[n]}` });
  }
  const gaps = talent.filter((t) => grid.missing.includes(t) && t !== n);
  if (gaps.length) why.push({ tone: 'info', text: `天賦數裡有 ${gaps.join('、')}，九宮格卻空缺：天賦要靠刻意練習才會出來，不練就只是潛力。` });
  if (grid.lines.length) {
    const L = grid.lines;
    parts.push(`九宮格有${L.map((l) => l.name).join('、')}，${L[0].text.split('，')[0]}。`);
    for (const l of L) boosts.push(`${l.name}（${l.nums.join('-')}）：${l.text}`);
  } else {
    why.push({ tone: 'info', text: '九宮格沒有完整的連線：特質分散、不偏向某一種，彈性大，也比較需要自己找方向。' });
  }
  for (const m of grid.missing.filter((x) => x !== n).slice(0, 3)) why.push({ tone: 'info', text: `缺 ${m}：${missingText[m]}` });
  for (const m of grid.many.filter((x) => x !== n)) {
    why.push({ tone: 'bad', text: `${m} 出現 ${grid.counts[m]} 次：${manyText[m].split('平衡：')[0]}` });
    remedies.push({ title: `${m} 太多：怎麼平衡`, steps: [manyText[m].split('平衡：')[1] || manyText[m]] });
  }
  why.unshift({ tone: 'info', text: `事業：${detail[n].career}感情：${detail[n].love}` });
  // 主命數在九宮格空缺時，功課是「從零練起」（上面已列）；一般主命數的功課（例如 6「別把責任都扛在身上」）講的是特質太強，兩個說法相反，不能一起給
  if (head[1] && !lpMissing) remedies.unshift({ title: `主命數 ${n} 的功課`, steps: [`${head[1].replace(/。$/, '')}。`] });
  parts.push(`今年流年數 ${py}：${pyText[py]}`);
  return {
    badge: `主命數 ${n}`,
    verdict: parts.join(''),
    why,
    remedies: remedies.slice(0, 3),
    boosts,
    combos: [
      { label: '綜合解讀', why: '生命靈數和八字、紫微、星盤一起看，哪些說法一致', go: ['destiny', { tool: 'reading' }] },
      { label: '工作與未來方向', why: '適合的工作、薪水和準備度', go: ['destiny', { tool: 'career' }] },
    ],
  };
}

/** 擇日時想要的日子不好、又改不了：怎麼把風險降到最低 */
export const FIXED_DATE_FIX = {
  title: '日子改不了怎麼辦？',
  steps: [
    '挑當天的吉時辦最關鍵的那一步（簽名、出發、開幕、遞件）：到「今日」的吉時表看，避開沖你生肖的時段。',
    '能拆就拆：先做準備的部分，正式的那一步放到吉時。',
    '把能控制的事先做好：文件再看一次、行程多留時間、身體睡飽。',
    '民俗做法：出門前拜拜、穿喜用色，給自己一個「我準備好了」的儀式。',
  ],
};
