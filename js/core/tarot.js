// 塔羅抽牌：均勻、不放回；正式抽牌使用裝置的加密亂數（crypto.getRandomValues）。
// 演算法參考 lilith-diviner scripts/draw.py（MIT）：uniform-without-replacement、逆位機率 0.5、
// 可指定種子（只用於測試重現）。牌義關鍵字為本專案自行撰寫。

const MAJORS = [
  ['愚者', '新開始、冒險、自由', '衝動、魯莽、裹足不前'],
  ['魔術師', '創造力、行動、資源到位', '能力未發揮、操弄、分心'],
  ['女祭司', '直覺、內在智慧、靜觀', '忽略直覺、秘密、資訊不明'],
  ['皇后', '豐盛、滋養、享受美好', '過度依賴、停滯、忽略自己'],
  ['皇帝', '秩序、責任、領導', '控制欲、僵化、權威衝突'],
  ['教皇', '傳統、學習、指引', '打破常規、教條、價值觀衝突'],
  ['戀人', '關係、選擇、價值一致', '猶豫、失衡、價值分歧'],
  ['戰車', '意志、前進、克服阻礙', '方向不明、失控、急躁'],
  ['力量', '溫柔的勇氣、耐心、自制', '自我懷疑、情緒失控、軟弱'],
  ['隱者', '沉澱、獨處、尋找答案', '孤立、逃避、過度封閉'],
  ['命運之輪', '轉機、循環、時機到來', '時機未到、反覆、抗拒改變'],
  ['正義', '公平、因果、理性判斷', '不公、偏頗、逃避責任'],
  ['吊人', '換個角度、暫停、等待', '拖延、無謂犧牲、卡住'],
  ['死神', '結束與轉化、放下、新階段', '抗拒結束、停滯、害怕改變'],
  ['節制', '平衡、調和、循序漸進', '失衡、過度、缺乏耐心'],
  ['惡魔', '慾望、束縛、執著', '掙脫、覺醒、戒除'],
  ['高塔', '突變、打破舊結構、真相揭露', '延遲的崩解、勉強維持、恐懼改變'],
  ['星星', '希望、療癒、信心', '失去信心、失望、能量不足'],
  ['月亮', '不安、迷惘、潛意識', '迷霧散去、釐清、恐懼減輕'],
  ['太陽', '成功、快樂、活力', '短暫低潮、過度樂觀、延遲'],
  ['審判', '覺醒、重新評估、召喚', '自我批判、猶豫不決、錯失機會'],
  ['世界', '完成、整合、圓滿', '未完成、差臨門一腳、延遲'],
];

const RANKS = ['王牌', '二', '三', '四', '五', '六', '七', '八', '九', '十', '侍者', '騎士', '皇后', '國王'];

const MINORS = {
  權杖: [
    ['新的熱情、靈感、開創', '延遲、熱情消退、起步困難'],
    ['規劃、選擇方向、展望', '猶豫、計畫不周、怕跨出去'],
    ['拓展、等待成果、遠見', '進度延遲、視野受限、受挫'],
    ['慶祝、穩定、歸屬', '不安定、過渡期、家庭摩擦'],
    ['競爭、意見衝突、切磋', '避免衝突、內耗、需要協調'],
    ['勝利、被肯定、進展', '自負、失去認可、延遲'],
    ['堅守立場、挑戰、防衛', '疲於應付、想放棄、壓力大'],
    ['快速進展、消息、行動', '延遲、混亂、操之過急'],
    ['堅持、警戒、最後一哩', '疲憊、防衛過度、想放棄'],
    ['重擔、責任過多、壓力', '卸下重擔、分工、過勞'],
    ['好奇、新點子、好消息', '三分鐘熱度、消息延遲、不成熟'],
    ['衝勁、冒險、行動派', '急躁、衝動、半途而廢'],
    ['自信、熱情、魅力', '嫉妒、情緒化、自我懷疑'],
    ['領導、遠見、開創精神', '專斷、衝動、期望過高'],
  ],
  聖杯: [
    ['新感情、情感流動、直覺', '情感壓抑、空虛、錯過'],
    ['互相吸引、夥伴、和解', '失衡、誤會、關係疏離'],
    ['慶祝、友誼、團聚', '過度玩樂、小圈圈、三角關係'],
    ['冷淡、沉思、錯過機會', '重新投入、接受新機會、走出低潮'],
    ['失落、遺憾、只看見失去', '釋懷、接受、重新振作'],
    ['懷舊、童心、舊人舊事', '活在過去、走出回憶、成長'],
    ['幻想、選擇太多、白日夢', '回歸現實、做出選擇、看清'],
    ['離開、尋找更深意義、放下', '猶豫去留、逃避、重新嘗試'],
    ['心願達成、滿足、享受', '不知足、表面滿足、放縱'],
    ['家庭和樂、情感圓滿、幸福', '家庭不和、期待落差、疏離'],
    ['感性、好消息、創意', '情緒化、不成熟、逃避'],
    ['浪漫、邀約、追隨心意', '不切實際、情緒起伏、失約'],
    ['同理、溫柔、直覺', '情緒依賴、過度敏感、自我犧牲'],
    ['情緒成熟、包容、穩定', '情緒壓抑、操控、冷漠'],
  ],
  寶劍: [
    ['清晰、突破、真相', '混亂、誤判、言語傷人'],
    ['僵局、難以抉擇、逃避', '資訊揭露、做出決定、壓力解除'],
    ['心痛、悲傷、分離', '療傷、釋放痛苦、慢慢復原'],
    ['休息、復原、暫停', '重新出發、休息不足、焦躁'],
    ['衝突、輸贏心、不擇手段', '和解、放下爭執、記取教訓'],
    ['過渡、離開困境、前進', '卡在原地、未解的問題、抗拒'],
    ['策略、隱瞞、單獨行動', '坦白、被揭穿、良心不安'],
    ['受限、自我設限、無力感', '掙脫束縛、看見出路、自由'],
    ['焦慮、失眠、過度擔心', '走出焦慮、求助、看見希望'],
    ['谷底、結束、痛苦到頭', '復原、最壞已過、重生'],
    ['好奇、觀察、求知', '八卦、言語衝動、欺瞞'],
    ['果斷、直接、快速行動', '魯莽、言語尖銳、急躁'],
    ['理性、獨立、直言', '冷漠、苛刻、尖酸'],
    ['理智、權威、公正判斷', '濫用權力、冷酷、操控'],
  ],
  錢幣: [
    ['新財源、實質機會、穩定開始', '錯失機會、規劃不足、延遲'],
    ['平衡、彈性、兼顧多事', '失衡、分身乏術、財務混亂'],
    ['合作、專業、技能被看見', '缺乏協作、品質不佳、各做各的'],
    ['守財、穩定、掌控', '過度保守、吝嗇、學習放手'],
    ['匱乏、困境、被排除', '復原、獲得幫助、困境好轉'],
    ['給予與接受、分享、資源流動', '不對等、債務、施捨心態'],
    ['耐心等待、評估成果、長期投資', '缺乏耐心、成果不如預期、重新評估'],
    ['精進技能、專注、勤奮', '敷衍、缺乏動力、完美主義'],
    ['自給自足、享受成果、獨立', '過度工作、財務依賴、空虛'],
    ['家族財富、長久穩定、傳承', '家庭財務糾紛、不穩定、短視'],
    ['學習、新計畫、務實', '拖延、缺乏規劃、不切實際'],
    ['踏實、穩定、按部就班', '停滯、無聊、過度保守'],
    ['照顧、務實、富足', '失衡、過度操心、忽略自己'],
    ['財務穩健、成功、可靠', '物質主義、固執、過度控制'],
  ],
};

export const DECK = [
  ...MAJORS.map(([name, up, rev], i) => ({ id: `major-${i}`, name, upright: up, reversed: rev, major: true })),
  ...Object.entries(MINORS).flatMap(([suit, list]) =>
    list.map(([up, rev], i) => ({ id: `${suit}-${i}`, name: `${suit}${RANKS[i]}`, upright: up, reversed: rev, major: false })),
  ),
];

// label 給下拉選單、short 給標題；牌位名稱決定讀法（tarot-reading.js 的 POSITION_TYPE）
export const SPREADS = [
  { id: 'single', label: '單張：一個提醒', short: '單張', positions: ['今日指引'] },
  { id: 'three', label: '三張：過去、現在、可能走向', short: '三張', positions: ['過去', '現在', '可能走向'] },
  { id: 'pob', label: '三張：現況、阻礙、建議', short: '現況阻礙建議', positions: ['現況', '阻礙', '建議'] },
  { id: 'choice', label: '二選一（四張）', short: '二選一', positions: ['現況', '選擇 A', '選擇 B', '建議'] },
  { id: 'five', label: '五張：核心、根源、阻力、潛力、建議', short: '五張', positions: ['核心', '根源', '阻力', '潛力', '建議'] },
  { id: 'relation', label: '關係五張', short: '關係五張', positions: ['你的狀態', '對方的狀態', '關係現況', '阻礙', '未來發展'] },
  { id: 'celtic', label: '凱爾特十字（十張）', short: '凱爾特十字', positions: ['現況', '挑戰', '根源', '過去', '目標', '近未來', '自己', '環境', '希望與擔心', '結果'] },
];
// 依主題推薦的牌陣
export const TOPIC_SPREAD = { general: 'three', love: 'relation', work: 'pob', money: 'choice' };

/** 加密亂數：回傳 [0, n) 的整數，以拒絕取樣避免取餘數偏差 */
export function secureRandomInt(n) {
  if (!(n > 0 && n <= 0x100000000)) throw new Error('範圍錯誤');
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** 可重現的種子亂數（mulberry32），只用於測試 */
export function seededRandom(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (n) => Math.floor(next() * n), float: next };
}

const secureRng = {
  int: secureRandomInt,
  float: () => secureRandomInt(0x100000000) / 0x100000000,
};

const cardOf = (deckIndex, reversed, position) => {
  const card = DECK[deckIndex];
  return {
    position,
    card: card.name,
    id: card.id,
    major: card.major,
    orientation: reversed ? '逆位' : '正位',
    keywords: reversed ? card.reversed : card.upright,
  };
};

/**
 * 洗整副牌（抽牌儀式用）：加密亂數做完整的 Fisher–Yates，每個位置也先配好正逆位（各半）。
 * 整副先洗勻，之後使用者從攤開的牌挑哪個位置都一樣公平，挑牌只是儀式感，不會改變機率。
 */
export function shuffleDeck({ rng = secureRng, reversedProbability = 0.5 } = {}) {
  const order = DECK.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = rng.int(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { order, flips: order.map(() => rng.float() < reversedProbability) };
}

/** 使用者挑的位置（攤開的第幾張，0–77、不重複）→ 牌陣結果 */
export function fromPicks(spreadId, deck, picks) {
  const spread = SPREADS.find((x) => x.id === spreadId);
  if (!spread) throw new Error(`未知的牌陣：${spreadId}`);
  if (!Array.isArray(picks) || picks.length !== spread.positions.length) throw new Error('挑的張數和牌陣不符');
  if (new Set(picks).size !== picks.length || picks.some((i) => !Number.isInteger(i) || i < 0 || i >= deck.order.length)) throw new Error('挑的位置不正確');
  return {
    spread: spread.id,
    label: spread.short,
    algorithm: '整副洗勻後挑選（Fisher–Yates）',
    cards: spread.positions.map((position, i) => cardOf(deck.order[picks[i]], deck.flips[picks[i]], position)),
  };
}

/** FNV-1a 雜湊：把「日期＋人」變成種子 */
function hash32(str) {
  let x = 0x811c9dc5;
  for (const ch of str) {
    x ^= ch.codePointAt(0);
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  return x >>> 0;
}

/**
 * 今日一張：同一個人同一天固定同一張（日期＋人的代號當種子），重新整理也不會變。
 * 這是「每天配一張牌當提醒」，不是隨機抽牌，畫面上要講清楚。
 * @param {string} dateKey 例如 2026-11-25
 * @param {string} personKey 名單裡的人的代號（沒有就空字串）
 */
export function dailyCard(dateKey, personKey = '') {
  const rng = seededRandom(hash32(`${dateKey}|${personKey}|daily`));
  return cardOf(rng.int(DECK.length), rng.float() < 0.5, '今日指引');
}

/**
 * 抽牌：Fisher–Yates 部分洗牌（不放回、每張機率相同）
 * @param {string} spreadId
 * @param {{rng?:{int:Function,float:Function}, reversedProbability?:number}} options
 */
export function drawSpread(spreadId, { rng = secureRng, reversedProbability = 0.5 } = {}) {
  const spread = SPREADS.find((s) => s.id === spreadId);
  if (!spread) throw new Error(`未知的牌陣：${spreadId}`);
  if (!(reversedProbability >= 0 && reversedProbability <= 1)) throw new Error('逆位機率要在 0 到 1 之間');
  const idx = DECK.map((_, i) => i);
  const count = spread.positions.length;
  for (let i = 0; i < count; i += 1) {
    const j = i + rng.int(idx.length - i);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return {
    spread: spread.id,
    label: spread.short,
    algorithm: '均勻不放回（Fisher–Yates）',
    cards: spread.positions.map((position, i) => cardOf(idx[i], rng.float() < reversedProbability, position)),
  };
}
