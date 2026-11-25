// 塔羅解讀：同一張牌放在不同牌位、問不同主題，意思不一樣。
// 1. 牌位情境：每個牌位（過去、現在、阻力、建議…）依牌的性質（順勢、中性、挑戰）用不同的讀法。
//    例如「太陽」放在阻力位，不是說太陽不好，而是「好事用過頭、太樂觀而看不到問題」。
// 2. 主題：感情、工作、財運各有一句；大牌逐張寫，小牌用「花色管的領域 × 數字代表的階段」組合。
// 3. 整副牌陣：大牌比例、主導花色、重複的數字、宮廷牌（具體的人）、逆位比例、相鄰牌的元素互動
//    （火風相助、水土相助、火水與風土相剋，黃金黎明會的元素尊貴規則，19 世紀的公有知識）。
// 4. 逆位三種讀法（受阻、過度、轉向內在）；宮廷牌可讀成一個人，也可讀成該培養的特質。
// 文字為本 App 撰寫，僅供參考。

import { DECK } from './tarot.js';

const UPRIGHT = Object.fromEntries(DECK.map((d) => [d.id, d.upright]));

export const TOPICS = [
  { id: 'general', label: '綜合' },
  { id: 'love', label: '感情' },
  { id: 'work', label: '工作' },
  { id: 'money', label: '財運' },
];

// 大牌：[正位性質, 逆位性質]（L 順勢、N 中性、S 挑戰）與元素（黃金黎明會的對應）
const MAJOR_META = [
  ['LS', '風'], ['LS', '風'], ['LS', '水'], ['LS', '土'], ['LS', '火'], ['LS', '土'], ['LS', '風'], ['LS', '水'], ['LS', '火'], ['NS', '土'], ['LS', '火'],
  ['NS', '風'], ['NS', '水'], ['NS', '水'], ['LS', '火'], ['SL', '土'], ['SS', '火'], ['LS', '風'], ['SL', '水'], ['LN', '火'], ['LS', '火'], ['LN', '土'],
];
// 小牌：每個花色 14 張（王牌～十、侍者、騎士、皇后、國王）的 [正位, 逆位] 性質，依各牌的關鍵字判斷
const MINOR_TONE = {
  權杖: ['LS', 'LS', 'LS', 'LS', 'SN', 'LS', 'NS', 'LS', 'NS', 'SN', 'LS', 'LS', 'LS', 'LS'],
  聖杯: ['LS', 'LS', 'LS', 'NL', 'SL', 'NN', 'NL', 'NS', 'LS', 'LS', 'LS', 'LS', 'LS', 'LS'],
  寶劍: ['LS', 'NL', 'SN', 'NN', 'SN', 'LS', 'SN', 'SL', 'SL', 'SL', 'NS', 'NS', 'NS', 'LS'],
  錢幣: ['LS', 'NS', 'LS', 'NS', 'SL', 'LS', 'NS', 'LS', 'LS', 'LS', 'LS', 'LS', 'LS', 'LS'],
};
const SUIT_ELEMENT = { 權杖: '火', 聖杯: '水', 寶劍: '風', 錢幣: '土' };
const TONE_OF = { L: 'light', N: 'neutral', S: 'shadow' };

// 大牌的主題解讀：[感情正, 感情逆, 工作正, 工作逆, 財運正, 財運逆]
const MAJOR_TOPIC = [
  ['新戀情或新鮮感，放開心去認識人', '感情衝動或不想負責，先看清楚再投入', '新工作、新嘗試的好時機，勇敢起步', '計畫不周就跳槽或創業，風險偏高', '新的收入機會，先小額試水溫', '衝動消費或沒做功課的投資要避免'],
  ['主動表達、展現魅力，關係有進展', '甜言蜜語或互相試探，留意真心', '能力與資源都到位，適合提案、開新專案', '能力沒發揮或被人操弄，先把基本功做好', '靠專業與點子賺錢，主動爭取', '花招多、實際收入少，小心話術'],
  ['默默喜歡或心靈上的連結，順著直覺', '有隱瞞或猜不透對方，需要坦白', '適合研究、幕後規劃，相信直覺', '資訊不完整，先別做決定', '保守理財、靜觀其變', '有沒看到的財務細節，合約要看清楚'],
  ['感情甜蜜、被照顧，適合穩定發展', '過度付出或依賴，記得照顧自己', '創意與成果豐收，團隊氣氛好', '進度停滯或太安逸，需要動起來', '財運豐盛、懂得享受', '花費過度，為了面子或享樂破財'],
  ['穩定可靠的關係，有承諾與保護', '控制欲強或變得冷淡，關係僵硬', '升遷、掌權，適合建立制度', '和主管或權威衝突，做法太硬', '財務有紀律、穩健累積', '固執或掌控過度，錯過機會'],
  ['傳統穩定的關係，可能論及婚嫁或得到長輩祝福', '價值觀不合，或受到家人干預', '向前輩學習、進修考證，走正規管道', '不認同體制或被規矩綁住，想走自己的路', '穩健的理財方式，聽專業意見', '別盲從權威或跟風投資'],
  ['兩情相悅、關係升溫，也是做選擇的時候', '猶豫不決、三角關係或價值觀分歧', '合作順利、找到志同道合的夥伴', '選擇困難，或合作理念不合', '在兩個選項之間做出取捨', '財務決定反覆，或為感情花太多錢'],
  ['主動追求，關係往前推進', '爭執、各走各的，方向不一致', '目標明確、衝刺有成果', '方向不明或衝過頭，先停下來校正', '積極爭取收入，有回報', '衝動投資或花費失控'],
  ['用溫柔與耐心經營，關係更穩', '缺乏自信或情緒失控，先安頓自己', '以柔克剛處理難題，能力被看見', '自我懷疑或壓力大，需要支持', '耐心理財，慢慢變好', '因情緒做財務決定，要先冷靜'],
  ['需要獨處、想清楚自己要什麼', '孤立或封閉自己，錯過緣分', '專注研究、往專業深處走', '孤軍奮戰或逃避問題', '保守、低調理財', '過度封閉、不願求助，錯過機會'],
  ['緣分到了，關係出現轉機', '時機未到，或反覆分合', '工作出現轉機，順勢而為', '時機不對或起伏大，先穩住', '財運轉好，有意外的機會', '收入起伏，別在低點做重大決定'],
  ['公平對等的關係，把話說清楚', '付出不對等，或有不公平的感受', '照規則辦事，合約與法律事務有利', '不公平待遇或法律糾紛', '收支平衡、帳目清楚', '財務糾紛或帳目不清'],
  ['暫停一下，換個角度看這段關係', '為感情無謂犧牲，或卡住不動', '暫時等待，換方法會有新出路', '拖延或停滯，要主動打破僵局', '先不要動，等更好的時機', '資金被套住或卡住'],
  ['一段關係或舊模式的結束，迎接新階段', '抗拒結束、拖著不放', '轉換跑道或結束舊專案的時機', '抗拒改變，在原地耗著', '舊的收入方式結束，該轉型了', '不肯停損，損失擴大'],
  ['溫和協調，關係慢慢磨合', '失衡或缺乏耐心', '兼顧多方、循序漸進', '步調失衡、過度工作', '收支平衡、穩定理財', '開銷失衡、缺乏節制'],
  ['強烈吸引或執著，分清楚愛與佔有', '掙脫不健康的關係', '被工作或利益綁住', '擺脫束縛、找回自主', '物質慾望強，小心過度消費或借貸', '戒掉壞的花錢習慣、脫離債務'],
  ['關係突然變化或真相揭露', '問題拖著沒處理，終究要面對', '突發變動、計畫被打亂', '勉強維持的局面，提早準備退路', '突然的支出或損失，要留預備金', '財務危機延後但沒有解除，要處理'],
  ['充滿希望、彼此療癒的關係', '失望，或對感情失去信心', '願景清楚，有貴人與機會', '信心不足、動力下降', '財務慢慢好轉，前景樂觀', '期待落空，調整預期'],
  ['不安、猜疑或曖昧不明', '誤會解開，看清對方', '資訊不清，先別做重大決定', '迷霧散去，方向變清楚', '財務不透明，小心被騙', '看清財務問題，及時止損'],
  ['感情明朗、快樂，適合公開', '短暫低潮，或過度樂觀', '成功、被看見、成果豐碩', '進度延遲，但終會好轉', '財運旺、收入增加', '收入延遲，或花費比想像多'],
  ['復合，或重新評估這段關係', '猶豫要不要再給機會', '重新評估方向，有好消息或新的召喚', '錯過機會，或對自己太嚴厲', '過去的投入開始有回報', '翻舊帳，或拖著不做財務決定'],
  ['關係圓滿、修成正果', '差臨門一腳，還有未完成的事', '專案完成、達成目標，可以開始下一階段', '收尾不完整，完成時間延後', '財務目標達成', '目標差一點，需要再撐一下'],
];

// 小牌：花色管的領域（依主題）與數字代表的階段
const SUIT_LENS = {
  權杖: { general: '行動與熱情', love: '感情裡的熱度與主動', work: '企圖心與開拓', money: '投入資源去開創' },
  聖杯: { general: '感情與人際', love: '情感交流與內心感受', work: '職場人際與團隊氣氛', money: '人情往來與為感受花的錢' },
  寶劍: { general: '思考、溝通與壓力', love: '溝通、誤會與想法差異', work: '決策、壓力與競爭', money: '財務判斷、合約與糾紛' },
  錢幣: { general: '金錢、工作與身體', love: '現實條件、承諾與安全感', work: '收入、技能與工作成果', money: '實際的收支與累積' },
};
const RANK_STAGE = ['新的開始', '選擇與平衡', '合作與成長', '穩定（也可能停滯）', '衝突與變動', '和解與過渡', '考驗與評估', '行動與調整', '接近完成', '一個循環的結束（或負擔太重）', '學習與消息', '行動與推進', '成熟的照顧', '成熟的掌控'];
const COURT_PERSON = { 10: '年輕人、學生或帶來消息的人', 11: '行動快、正在追求目標的人', 12: '成熟的女性或照顧者', 13: '成熟的男性、主管或權威' };
const SUIT_PERSONA = { 權杖: '熱情直爽、行動派', 聖杯: '溫柔感性、重感覺', 寶劍: '理性犀利、講話直', 錢幣: '務實穩重、重現實' };

// 牌位種類與讀法：L 順勢、N 中性、S 挑戰
const POSITION_TYPE = {
  今日指引: 'daily', 過去: 'past', 現在: 'present', 現況: 'present', 可能走向: 'future', 近未來: 'future', 未來發展: 'future',
  核心: 'core', 根源: 'root', 阻力: 'obstacle', 阻礙: 'obstacle', 挑戰: 'obstacle', 潛力: 'potential', 建議: 'advice',
  '選擇 A': 'option', '選擇 B': 'option', 你的狀態: 'self', 自己: 'self', 對方的狀態: 'other', 關係現況: 'bond',
  目標: 'aim', 環境: 'environment', 希望與擔心: 'hope', 結果: 'outcome',
};
const FRAME = {
  daily: { L: '今天的主題是「{k}」，順著這股能量去做。', N: '今天提醒你「{k}」：放慢一點、多觀察。', S: '今天要留意「{k}」：提早準備，就不會被它拖住。' },
  past: { L: '過去打下的好底子：{k}，現在可以拿來用。', N: '過去的經驗：{k}，是你現在處境的背景。', S: '過去的影響還在：{k}，這是需要放下或修補的部分。' },
  present: { L: '現在的狀態不錯：{k}。', N: '現在正處在：{k}，事情還在醞釀。', S: '現在的難處：{k}。先承認它，才能處理它。' },
  future: { L: '照目前的方向走下去，可能走向：{k}。', N: '可能走向：{k}；結果取決於你接下來的選擇。', S: '照目前的方向走下去，可能遇到：{k}。現在調整還來得及，這不是定局。' },
  core: { L: '這件事的核心是好的：{k}。', N: '這件事的核心在於：{k}。', S: '這件事的核心問題是：{k}。' },
  root: { L: '根源來自正面的動機：{k}。', N: '事情的根源：{k}。', S: '根源在於：{k}，要從源頭處理。' },
  obstacle: { L: '阻力不是壞事本身，而是「{k}」用過頭，或讓你太安逸、看不到問題。', N: '阻力在於：{k}，不處理就會一直卡著。', S: '最大的阻力很明確：{k}。' },
  potential: { L: '你有這個潛力：{k}，值得往這邊投入。', N: '潛在的發展：{k}，需要時間經營。', S: '潛在的風險：{k}，提前防範就能避開。' },
  advice: { L: '建議你主動去做：{k}。', N: '建議你用這種態度面對：{k}。', S: '建議你正視「{k}」：不是逃避，而是接受它、從中學到東西。' },
  option: { L: '走這條路的發展：{k}，看起來是順的。', N: '走這條路會遇到：{k}；好壞取決於你怎麼經營。', S: '走這條路要先面對：{k}，想清楚代價再決定。' },
  self: { L: '你現在的狀態：{k}，這是你的本錢。', N: '你現在的狀態：{k}。', S: '你現在的心結：{k}，先照顧好自己。' },
  other: { L: '對方的狀態：{k}，對你是友善的。', N: '對方的狀態：{k}，他也在觀望。', S: '對方正在面對：{k}，他的反應不一定是針對你。' },
  bond: { L: '這段關係現在：{k}，有好的基礎。', N: '這段關係現在：{k}，還在磨合。', S: '這段關係卡在：{k}，需要兩個人一起處理。' },
  aim: { L: '你在意、想追求的是：{k}，方向是對的。', N: '你心裡的目標：{k}。', S: '你給自己的壓力：{k}，目標可以調整得更實際。' },
  environment: { L: '周遭的環境：{k}，外在條件幫得上忙。', N: '周遭的環境：{k}。', S: '外在的壓力：{k}；有些事不在你掌控內，先顧好能做的部分。' },
  hope: { L: '你心裡期待的是：{k}。', N: '你心裡既期待又擔心：{k}。', S: '你心裡擔心的是：{k}；說出來，擔心就會變小。' },
  outcome: { L: '照目前的方向，比較可能的結果：{k}。', N: '可能的結果：{k}；還有調整的空間。', S: '照目前的方向，可能的結果：{k}。現在調整還來得及，這不是定局。' },
};

/** 一張牌的屬性：大牌序號或花色與數字、元素、正逆位的性質 */
export function cardMeta(id, reversed) {
  const [kind, n] = id.split('-');
  const idx = Number(n);
  if (kind === 'major') {
    const [tones, element] = MAJOR_META[idx];
    return { major: true, index: idx, element, tone: TONE_OF[tones[reversed ? 1 : 0]] };
  }
  return { major: false, suit: kind, rank: idx, element: SUIT_ELEMENT[kind], tone: TONE_OF[MINOR_TONE[kind][idx][reversed ? 1 : 0]], court: idx >= 10 };
}

/** 單張牌在某個牌位、某個主題下的解讀 */
export function readCard(c, topic = 'general') {
  const reversed = c.orientation === '逆位';
  const meta = cardMeta(c.id, reversed);
  const type = POSITION_TYPE[c.position] || 'present';
  const toneKey = { light: 'L', neutral: 'N', shadow: 'S' }[meta.tone];
  const frame = FRAME[type][toneKey].replace('{k}', c.keywords);
  const t = TOPICS.find((x) => x.id === topic) || TOPICS[0];
  let topicText = '';
  if (t.id !== 'general') {
    if (meta.major) topicText = `${t.label}：${MAJOR_TOPIC[meta.index][{ love: 0, work: 2, money: 4 }[t.id] + (reversed ? 1 : 0)]}。`;
    else topicText = `${t.label}：${SUIT_LENS[meta.suit][t.id]}正處在「${RANK_STAGE[meta.rank]}」的階段。`;
  }
  const person = meta.court ? `也可能代表一個人：${COURT_PERSON[meta.rank]}，個性${SUIT_PERSONA[meta.suit]}；或是提醒你培養「${SUIT_PERSONA[meta.suit]}」這種特質。` : '';
  // 逆位不只一種讀法：同一張牌的正位能量卡住了、用過頭了，或是要先在心裡處理
  const u = (UPRIGHT[c.id] || '').split('、')[0];
  const revWays = reversed && u ? [
    { name: '受阻', text: `「${u}」的力量卡住了、還沒發揮出來。` },
    { name: '過度', text: `「${u}」用過頭了，反而變成問題。` },
    { name: '轉向內在', text: `「${u}」這件事要先在自己心裡處理，再往外推。` },
  ] : [];
  return { ...c, ...meta, type, frame, topicText, person, revWays };
}

// 元素互動（黃金黎明會的元素尊貴規則）
const FRIENDLY = new Set(['火風', '風火', '水土', '土水']);
const CONTRARY = new Set(['火水', '水火', '風土', '土風']);
export function elementRelation(a, b) {
  if (a === b) return { kind: 'same', text: '同元素，力量延續並加強' };
  if (FRIENDLY.has(a + b)) return { kind: 'friendly', text: '互相助長，前一段的力量能順利接下去' };
  if (CONTRARY.has(a + b)) return { kind: 'contrary', text: '互相削弱，兩段之間有拉扯，轉換時要特別用心' };
  return { kind: 'neutral', text: '影響不大，各自獨立' };
}

const SUIT_THEME = {
  權杖: '行動與企圖心是主題：想做就去做，但別只靠衝勁。',
  聖杯: '感情與人際是主題：這件事和人心、感受關係很大。',
  寶劍: '思考、溝通與壓力是主題：先把話說清楚、把想法理清楚。',
  錢幣: '現實與金錢是主題：從實際的條件、預算和身體狀況著手。',
};
const RANK_NAME = ['王牌', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/**
 * 整副牌陣的分析與總結。
 * @param cards readCard 之後的牌（依牌位順序）
 * @returns {{insights:{title,text}[], summary:string}}
 */
export function readSpread(cards, spreadId) {
  const n = cards.length;
  const insights = [];
  const add = (title, text) => insights.push({ title, text });
  if (n >= 3) {
    const majors = cards.filter((c) => c.major).length;
    if (majors * 2 >= n) add('大牌偏多', `${n} 張裡有 ${majors} 張大牌：這件事牽涉人生較大的課題或轉折，不完全由你控制，與其硬推，不如順勢而為。`);
    else if (!majors) add('沒有大牌', '全部是小牌：主要是日常層面的事，靠自己的選擇與行動就能改變。');
    const suits = {};
    for (const c of cards.filter((x) => !x.major)) suits[c.suit] = (suits[c.suit] || 0) + 1;
    const top = Object.entries(suits).sort((a, b) => b[1] - a[1]);
    if (top.length && top[0][1] >= 2 && (top.length === 1 || top[0][1] > top[1][1])) add(`${top[0][0]}最多`, `${top[0][1]} 張${top[0][0]}：${SUIT_THEME[top[0][0]]}`);
    const ranks = {};
    for (const c of cards.filter((x) => !x.major && x.rank <= 9)) ranks[c.rank] = (ranks[c.rank] || 0) + 1;
    for (const [r, k] of Object.entries(ranks)) if (k >= 2) add(`${k} 張「${RANK_NAME[r]}」`, `數字重複，主題是「${RANK_STAGE[r]}」：這件事正處在這個階段。`);
    const courts = cards.filter((c) => c.court).length;
    if (courts) add('宮廷牌', `有 ${courts} 張宮廷牌：這件事和具體的人很有關係，可能是你自己，也可能是身邊某個人。`);
    const rev = cards.filter((c) => c.orientation === '逆位').length;
    if (rev * 3 >= n * 2) add('逆位偏多', `${n} 張裡 ${rev} 張逆位：能量受阻或還沒準備好，事情可能延遲；適合先向內調整，不急著推進。`);
    else if (!rev) add('全部正位', '能量順暢，事情比較直接，照牌意去做即可。');
  }
  if (spreadId === 'three' && n === 3) {
    for (let i = 0; i < 2; i += 1) {
      const a = cards[i];
      const b = cards[i + 1];
      const r = elementRelation(a.element, b.element);
      add(`${a.position}→${b.position}`, `${a.element}遇${b.element}：${r.text}。`);
    }
  }
  return { insights, summary: summaryOf(cards, spreadId) };
}

const TRAJECTORY = { light: '整體往好的方向走，照著牌的提示去做', neutral: '結果還在你手上，接下來的選擇是關鍵', shadow: '走向需要特別留意，現在調整還來得及' };
function summaryOf(cards, spreadId) {
  const name = (c) => `${c.card}（${c.orientation}）`;
  const first = (c) => c.keywords.split('、')[0];
  if (spreadId === 'three' && cards.length === 3) {
    const [past, now, next] = cards;
    return `從${name(past)}到${name(now)}，可能走向${name(next)}：${TRAJECTORY[next.tone]}。`;
  }
  if (spreadId === 'five' && cards.length === 5) {
    const [core, , block, , advice] = cards;
    return `核心是${name(core)}，卡住你的是${name(block)}，建議是${name(advice)}：先處理「${first(block)}」，再朝「${first(advice)}」去做。`;
  }
  if (spreadId === 'pob' && cards.length === 3) {
    const [now, block, advice] = cards;
    return `現況是${name(now)}，阻礙是${name(block)}，建議是${name(advice)}：先處理「${first(block)}」，再朝「${first(advice)}」去做。`;
  }
  if (spreadId === 'choice' && cards.length === 4) {
    const [, a, b, advice] = cards;
    const rank = { light: 2, neutral: 1, shadow: 0 };
    const lean = rank[a.tone] === rank[b.tone] ? '兩條路的牌差不多，各有要面對的課題' : `${rank[a.tone] > rank[b.tone] ? '選擇 A' : '選擇 B'} 的牌比較順`;
    return `選擇 A 是${name(a)}、選擇 B 是${name(b)}：${lean}。不管選哪條，建議牌${name(advice)}提醒你「${first(advice)}」。`;
  }
  if (spreadId === 'relation' && cards.length === 5) {
    const [me, other, bond, block, next] = cards;
    return `你是${name(me)}、對方是${name(other)}，關係現在是${name(bond)}；卡在「${first(block)}」，未來可能${name(next)}：${TRAJECTORY[next.tone]}。`;
  }
  if (spreadId === 'celtic' && cards.length === 10) {
    const [now, cross, , , , soon, , , hope, end] = cards;
    return `現況${name(now)}，橫在面前的挑戰是${name(cross)}；近期會遇到${name(soon)}，心裡的期待與擔心是${name(hope)}，最後的結果牌${name(end)}：${TRAJECTORY[end.tone]}。`;
  }
  const c = cards[0];
  return `${name(c)}：${c.frame}`;
}

/** 牌面上的編號：大牌用羅馬數字，小牌用 A、2～10、侍、騎、后、王 */
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
const RANK_MARK = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', '侍', '騎', '后', '王'];
export function cardMark(meta) {
  return meta.major ? ROMAN[meta.index] : RANK_MARK[meta.rank];
}
