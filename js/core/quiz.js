// 興趣與性格測驗（使用者回饋：「自己個性評估，用測驗的方式，也加上去」）。
// 1. 職業興趣：何倫（Holland）六型——實作 R、研究 I、藝術 A、社會 S、企業 E、事務 C。
//    題目是本 App 依何倫理論自己寫的 36 題（每型 6 題，台灣的工作情境）。最常用的 O*NET 興趣量表是 CC BY-ND 授權，
//    不允許改作，翻成中文就違反授權，所以不用；自編題目沒有經過常模驗證，結果是「自我了解的參考」，畫面上照實標示。
// 2. 性格：五大性格的 Mini-IPIP 20 題（Donnellan 等人 2006；IPIP 題庫為公開領域，可以自由翻譯使用），中文是本 App 自譯。
// 結果只存在這支手機（名單的 quiz 欄位，只存分數）。
// 怎麼用：不混進命理的「天賦」投票（上一版那樣做，使用者看不出測驗有沒有算進去），
// 而是變成兩個獨立的指標，和每一個工作直接比：興趣相符（何倫六型）、性格相符（五大性格），一起進「綜合推薦」。
// 文字不寫宿命、恐嚇、打包票的字（tests/wording.test.js）。

export const QUIZ_VERSION = 1;

/** 何倫六型 */
export const RIASEC = {
  R: { name: '實作型', short: '動手做、操作工具和機器', desc: '喜歡動手、看得到成果的工作，習慣用工具、機器、身體解決問題，不愛空談。', env: '維修現場、工廠、工地、戶外、船艦、設備機房', jobs: '技術員、維修、工程、駕駛、農漁、通信設備', natures: ['expert', 'mobile'] },
  I: { name: '研究型', short: '分析問題、找出答案', desc: '喜歡思考、研究、分析，遇到問題想知道「為什麼」，習慣用資料和邏輯判斷。', env: '實驗室、研究單位、資訊部門、分析團隊', jobs: '工程師、研究員、分析師、資安、醫檢', natures: ['research', 'expert'] },
  A: { name: '藝術型', short: '創作、表達、不受拘束', desc: '喜歡創作和表達，重視美感與獨特性，在規定太多的環境容易悶。', env: '設計、媒體、表演、內容創作、自由接案', jobs: '設計師、影音、寫作、插畫、表演', natures: ['create', 'free'] },
  S: { name: '社會型', short: '幫助、教導、照顧人', desc: '喜歡和人相處、幫別人解決問題，在乎人的感受，從別人的進步得到成就感。', env: '學校、醫院、社福、客服、訓練單位', jobs: '老師、護理、社工、心輔、教官、客服', natures: ['care', 'public'] },
  E: { name: '企業型', short: '影響別人、帶領、爭取機會', desc: '喜歡說服、帶領、做決定，願意承擔風險去爭取目標與資源。', env: '業務、管理、創業、公關、政治', jobs: '主管、業務、經營者、經紀、公關', natures: ['manage', 'sales'] },
  C: { name: '事務型', short: '照規則、有條理地處理資料', desc: '喜歡清楚的規則和流程，細心、可靠，擅長把資料、數字、文件整理得井井有條。', env: '辦公室、機關、金融、會計、倉儲', jobs: '行政、會計、稽核、倉管、公務員', natures: ['stable', 'finance'] },
};
export const RIASEC_ORDER = ['R', 'I', 'A', 'S', 'E', 'C'];

// 職業興趣題目（本 App 自編，依何倫理論；每型 6 題，交錯排列避免同一型連續出現）
const INTEREST_BY_TYPE = {
  R: ['組裝或修理電腦、家電', '操作機器或工具做出東西', '修理汽車、機車或腳踏車', '在戶外工作（工地、農場、海上）', '照著圖面施工、裝修房子', '架設或維修線路、設備（例如網路、無線電）'],
  I: ['研究一個問題為什麼會發生', '做實驗、分析數據找答案', '看科學或科技的新知', '解數學題或邏輯謎題', '弄懂電腦系統或程式是怎麼運作的', '查資料、比對證據，寫成報告'],
  A: ['畫畫、設計海報或圖案', '寫文章、故事或劇本', '拍照、拍影片並剪輯', '演奏樂器、唱歌或表演', '布置空間、搭配穿著', '想新點子，做出跟別人不一樣的東西'],
  S: ['教別人一項技能', '聽別人說心事、幫忙想辦法', '照顧小孩、長輩或病人', '帶活動、帶團體', '當志工幫助需要的人', '協調大家的意見、處理人際問題'],
  E: ['說服別人接受你的想法或買你的東西', '帶領一個團隊完成目標', '談判、爭取更好的條件', '自己做生意、開一家店', '上台報告、在大家面前發言', '規劃怎麼把一件事做大、賺更多'],
  C: ['整理資料、建檔、做表格', '照著規定和流程把事情做好', '核對數字、帳目有沒有錯', '管理庫存、物品清單', '處理公文、表單和行政事務', '安排行程和時間表，讓事情準時完成'],
};
export const INTEREST_ITEMS = Array.from({ length: 6 }, (_, i) => RIASEC_ORDER.map((t) => ({ type: t, text: INTEREST_BY_TYPE[t][i] }))).flat();
export const INTEREST_SCALE = ['很不喜歡', '不太喜歡', '普通', '喜歡', '很喜歡'];

/** 五大性格（Mini-IPIP 的五個面向；神經質改用正向的「情緒穩定」呈現：分數越高越穩） */
export const BIG5 = {
  E: { name: '外向性', high: '喜歡和人互動，人多的場合讓你有活力。', low: '喜歡專注、獨立作業，人多的場合會累。', workHigh: '業務、公關、帶團隊、教學這類常和人接觸的工作比較順。', workLow: '研究、技術、分析這類能專心的工作比較順；要上台時先準備好就好。', nature: { high: 'public', low: 'research' } },
  A: { name: '親和性', high: '體貼、願意合作，在乎別人的感受。', low: '直接、重視事實，不怕講不中聽的話。', workHigh: '照護、服務、團隊合作的角色發揮得好；小心太好說話、把別人的事都攬下來。', workLow: '談判、稽核、要做困難決定的角色反而適合；和人合作時多說明原因。', nature: { high: 'care', low: null } },
  C: { name: '盡責性', high: '有條理、守時、守紀律，交代的事會做完。', low: '彈性、隨興，不喜歡被規則綁住。', workHigh: '制度清楚、要求精準的工作（行政、財務、品管、勤務）是你的強項。', workLow: '需要變化、創意的工作比較適合；用行事曆和提醒工具管住時程。', nature: { high: 'stable', low: 'free' } },
  S: { name: '情緒穩定', high: '冷靜、抗壓，遇到突發狀況不容易慌。', low: '感受敏銳，情緒起伏比較明顯。', workHigh: '高壓、要臨場應變的工作（指揮、急救、業務、管理）扛得住。', workLow: '選節奏穩定、支持多的環境；把運動、睡眠當成工作的一部分來顧。', nature: { high: 'manage', low: null } },
  O: { name: '開放性', high: '好奇、想像力豐富，喜歡新點子和抽象的東西。', low: '務實、喜歡熟悉可靠的做法。', workHigh: '創意、研究、新科技（包括用 AI 做東西）都很對味。', workLow: '流程清楚、重視實務經驗的工作比較順；新工具一次學一樣就好。', nature: { high: 'create', low: 'stable' } },
};
export const BIG5_ORDER = ['E', 'A', 'C', 'S', 'O'];

// Mini-IPIP 20 題（Donnellan, Oswald, Baird & Lucas, 2006），中文自譯；r＝反向計分。S（情緒穩定）是原本的神經質反過來算
export const PERSONALITY_ITEMS = [
  { trait: 'E', r: false, text: '在聚會裡，我常是炒熱氣氛的人' },
  { trait: 'A', r: false, text: '我能體會別人的感受' },
  { trait: 'C', r: false, text: '該做的事我會馬上做完' },
  { trait: 'S', r: true, text: '我的情緒起伏很大' },
  { trait: 'O', r: false, text: '我的想像力很豐富' },
  { trait: 'E', r: true, text: '我話不多' },
  { trait: 'A', r: true, text: '我對別人的問題沒什麼興趣' },
  { trait: 'C', r: true, text: '我常忘了把東西放回原位' },
  { trait: 'S', r: false, text: '我大部分時候都很放鬆' },
  { trait: 'O', r: true, text: '我對抽象的想法沒興趣' },
  { trait: 'E', r: false, text: '在聚會上，我會和很多不同的人聊天' },
  { trait: 'A', r: false, text: '我感受得到別人的情緒' },
  { trait: 'C', r: false, text: '我喜歡井然有序' },
  { trait: 'S', r: true, text: '我很容易心煩' },
  { trait: 'O', r: true, text: '抽象的想法對我來說很難懂' },
  { trait: 'E', r: true, text: '我習慣待在不顯眼的地方' },
  { trait: 'A', r: true, text: '我其實對別人不太感興趣' },
  { trait: 'C', r: true, text: '我常把事情弄得一團亂' },
  { trait: 'S', r: false, text: '我很少心情低落' },
  { trait: 'O', r: true, text: '我的想像力不太好' },
];
export const PERSONALITY_SCALE = ['完全不像我', '不太像我', '一半一半', '有點像我', '非常像我'];

/** 全部題目（先興趣、後性格） */
export const QUESTIONS = [
  ...INTEREST_ITEMS.map((x) => ({ part: 'interest', ...x })),
  ...PERSONALITY_ITEMS.map((x) => ({ part: 'personality', ...x })),
];

const pct = (sum, n) => Math.round(((sum - n) / (n * 4)) * 100); // 每題 1～5 分 → 0～100

/**
 * 計分。answers：和 QUESTIONS 同順序的 1～5（必須全部作答）
 * @returns {{v:number, at:string, riasec:Record<string,number>, big5:Record<string,number>}|null}
 */
export function scoreQuiz(answers, at = '') {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length || !answers.every((a) => Number.isInteger(a) && a >= 1 && a <= 5)) return null;
  const riasec = Object.fromEntries(RIASEC_ORDER.map((t) => [t, 0]));
  const big5 = Object.fromEntries(BIG5_ORDER.map((t) => [t, 0]));
  QUESTIONS.forEach((q, i) => {
    if (q.part === 'interest') riasec[q.type] += answers[i];
    else big5[q.trait] += q.r ? 6 - answers[i] : answers[i];
  });
  for (const t of RIASEC_ORDER) riasec[t] = pct(riasec[t], 6);
  for (const t of BIG5_ORDER) big5[t] = pct(big5[t], 4);
  return { v: QUIZ_VERSION, at, riasec, big5 };
}

/**
 * 興趣代碼：分數最高的最多三型（同分依 RIASEC 順序），只收 40 分以上的：
 * 硬湊三個字會把「每一題都答不太喜歡」的類型也列進來。全部低於 40 分表示沒有特別喜歡的，回傳空字串
 */
export function hollandCode(result) {
  if (!result) return '';
  return RIASEC_ORDER.map((t) => [t, result.riasec[t]]).sort((a, b) => b[1] - a[1])
    .filter(([, n]) => n >= 40).slice(0, 3).map(([t]) => t).join('');
}

/** 五大性格的高低（60 以上偏高、40 以下偏低） */
export const big5Level = (n) => (n >= 60 ? 'high' : n <= 40 ? 'low' : 'mid');

// ── 和工作比：工作性質（jobs.js 的 NATURES）對到何倫六型、五大性格的哪幾項
// 這是本 App 依工作內容的大致對照（例如「研究分析型」＝研究型 I），不是逐一職業的正式代碼
const NATURE_RIASEC = { manage: 'E', expert: 'RI', create: 'A', sales: 'E', stable: 'C', care: 'S', research: 'I', free: 'AE', finance: 'CE', mobile: 'R', public: 'SE' };
const NATURE_TRAITS = { manage: 'ES', expert: 'C', create: 'O', sales: 'E', stable: 'C', care: 'A', research: 'O', free: 'O', finance: 'C', mobile: 'S', public: 'E' };
// 工作的第一個性質是主要的，權重 2、其他 1：業務的核心是說服人（企業型），「常在外面跑」只是附帶；
// 平均算的話，討厭說服人但喜歡實作的人會拿到 50 分的「普通」，看不出來其實不合
function weightsOf(natures, table) {
  const w = new Map();
  natures.forEach((k, i) => {
    for (const t of (table[k] || '').split('')) w.set(t, Math.max(w.get(t) || 0, i === 0 ? 2 : 1));
  });
  return w;
}
const weightedMean = (w, scores) => {
  let sum = 0;
  let n = 0;
  for (const [t, k] of w) { sum += scores[t] * k; n += k; }
  return Math.round(sum / n);
};

/** 興趣相符（0～100）：這個工作偏哪幾型，你在那幾型的分數（主要性質加倍） */
export function interestFit(natures, result) {
  const w = result ? weightsOf(natures, NATURE_RIASEC) : new Map();
  if (!w.size) return null;
  const letters = [...w.keys()];
  return { score: weightedMean(w, result.riasec), letters, names: letters.map((t) => RIASEC[t].name) };
}

/** 性格相符（0～100）：這個工作最吃重的性格面向（例如業務吃外向、行政吃盡責），你在那幾項的分數（主要性質加倍） */
export function personalityFit(natures, result) {
  const w = result ? weightsOf(natures, NATURE_TRAITS) : new Map();
  if (!w.size) return null;
  const traits = [...w.keys()];
  return { score: weightedMean(w, result.big5), traits, names: traits.map((t) => BIG5[t].name) };
}

/**
 * E 人／I 人：就是五大性格的外向性（研究上最穩定的一個面向）。60 以上偏 E、40 以下偏 I，中間是兩邊都行的中間型
 * （硬分兩類會把 51 分和 49 分的人說成相反的人）
 */
export function eiOf(result) {
  if (!result) return null;
  const n = result.big5.E;
  return n >= 60 ? { code: 'E', label: '偏 E 人（外向）', n } : n <= 40 ? { code: 'I', label: '偏 I 人（內向）', n } : { code: 'X', label: '中間型（E、I 都行）', n };
}

/**
 * 類 MBTI 四個字母（參考）：用五大性格換算——E/I＝外向性、N/S＝開放性、F/T＝親和性、J/P＝盡責性
 * （McCrae & Costa 1989 發現 MBTI 四個向度和這四項有對應）。中間的分數寫 X，不硬分；不是正式的 MBTI 測驗
 */
export function mbtiOf(result) {
  if (!result) return '';
  const pick = (n, hi, lo) => (n >= 60 ? hi : n <= 40 ? lo : 'X');
  return pick(result.big5.E, 'E', 'I') + pick(result.big5.O, 'N', 'S') + pick(result.big5.A, 'F', 'T') + pick(result.big5.C, 'J', 'P');
}

/** 存進名單前的白名單：只收分數（0～100 的整數）和日期 */
export function sanitizeQuiz(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== QUIZ_VERSION) return null;
  const nums = (obj, keys) => {
    if (!obj || typeof obj !== 'object') return null;
    const out = {};
    for (const k of keys) {
      const n = obj[k];
      if (!Number.isInteger(n) || n < 0 || n > 100) return null;
      out[k] = n;
    }
    return out;
  };
  const riasec = nums(raw.riasec, RIASEC_ORDER);
  const big5 = nums(raw.big5, BIG5_ORDER);
  if (!riasec || !big5) return null;
  const at = typeof raw.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.at) ? raw.at : '';
  return { v: QUIZ_VERSION, at, riasec, big5 };
}
