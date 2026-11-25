// 新興產業適不適合你：AI、半導體、資安、綠能、長照、內容創作……依你的工作性質（各系統投票）和喜用五行算適配度，
// 寫出為什麼、你在這個產業可以做的角色、怎麼開始；AI 另外依你的工作類型給「AI 時代怎麼做」。
// 產業的五行是本 App 依產業性質對到傳統分類（電與光屬火、資訊流動屬水、金屬機械屬金、生長醫藥教育屬木、土地照護穩定屬土）。
// 產業描述以台灣的情況撰寫（2026 年）。純函式，可在 Node 測試。

/** 工作性質 → 在產業裡的角色類型 */
const ROLE_GROUP = {
  expert: 'tech', research: 'tech',
  manage: 'bridge', sales: 'bridge', public: 'bridge', finance: 'bridge', mobile: 'bridge',
  create: 'creative', free: 'creative',
  care: 'care', stable: 'care',
};

export const EMERGING = [
  { id: 'ai', name: 'AI 與資料應用', wx: ['火', '水'], natures: ['research', 'expert', 'create', 'manage', 'free', 'public'],
    desc: '生成式 AI、資料分析、把 AI 導入各行各業。台灣的 AI 伺服器和企業導入需求都在快速成長。',
    roles: { tech: '資料分析、AI 工程、模型應用與驗證', bridge: 'AI 導入顧問、AI 產品經理、AI 專案管理', creative: 'AI 內容與設計、提示設計、AI 工具接案', care: '企業內部的 AI 流程自動化、AI 輔助的教育與照護' },
    entry: '不一定要會寫程式：先把 AI 用進現在的工作（寫文案、整理資料、做簡報），做出一兩個實際成果，再決定往技術、應用或內容走。' },
  { id: 'semi', name: '半導體與 AI 硬體', wx: ['火', '金'], natures: ['expert', 'research', 'stable', 'manage'],
    desc: '晶片設計、製造、封測、AI 伺服器，是台灣最強、薪資也最高的產業鏈之一。',
    roles: { tech: '製程、設備、IC 設計、測試工程', bridge: '供應鏈管理、業務、專案管理', creative: '技術文件、產品行銷', care: '品保、廠務、環安衛' },
    entry: '理工背景走工程師；非理工可以從供應鏈、採購、品保、行政支援進入，在職再補專業課程。' },
  { id: 'security', name: '資訊安全', wx: ['金', '水'], natures: ['research', 'expert', 'stable'],
    desc: '保護企業與個人資料，台灣列為戰略產業，人才長期短缺。',
    roles: { tech: '資安分析、滲透測試、資安工程', bridge: '資安顧問、稽核、資安業務', creative: '資安教育訓練與內容', care: '企業資安管理、個資保護與法遵' },
    entry: '從網路與系統基礎學起，考入門證照、參加資安競賽或社群，作品和實作經驗比學歷更重要。' },
  { id: 'green', name: '綠能與永續（ESG）', wx: ['火', '木'], natures: ['expert', 'manage', 'research', 'public'],
    desc: '太陽能、離岸風電、儲能，以及企業的碳盤查和永續報告，法規推著需求一直成長。',
    roles: { tech: '電力與儲能工程、碳盤查', bridge: '永續顧問、ESG 專案管理、綠能業務', creative: '永續報告撰寫、永續品牌溝通', care: '企業內部的 ESG 資料與法遵' },
    entry: '先修碳盤查或永續相關的證照課程；原本的專業（財會、工程、行銷）加上永續知識最吃香。' },
  { id: 'health', name: '精準醫療與生技', wx: ['木', '水'], natures: ['research', 'expert', 'care'],
    desc: '基因檢測、醫材、數位醫療、健康數據，研發週期長但門檻高、穩定。',
    roles: { tech: '研發、檢驗、法規註冊', bridge: '醫材與藥品業務、產品經理', creative: '醫療內容與衛教溝通', care: '臨床、個案管理、健康諮詢' },
    entry: '生醫背景走研發與法規；其他背景可以從業務、行銷、法規文件切入，邊做邊補專業。' },
  { id: 'silver', name: '長照與高齡服務', wx: ['土', '木'], natures: ['care', 'stable', 'manage', 'sales'],
    desc: '台灣已經是超高齡社會，照護、健康管理、銀髮生活與財務規劃的需求很大。',
    roles: { tech: '輔具、智慧照護系統', bridge: '長照機構經營、銀髮產品業務', creative: '銀髮族的課程與活動設計', care: '照顧服務、個案管理、健康管理師' },
    entry: '考照顧服務員或相關證照最快；有經營或業務經驗的人，可以走機構管理與銀髮產品。' },
  { id: 'content', name: '內容創作與自媒體', wx: ['火', '水'], natures: ['create', 'public', 'free'],
    desc: '短影音、Podcast、電子報、線上課程，一個人就能經營，靠作品和信任累積收入。',
    roles: { tech: '剪輯、後製、數據分析', bridge: '品牌合作、經紀與社群經營', creative: '主題創作者、知識型內容', care: '社群管理、會員經營' },
    entry: '選一個你能長期講的主題，固定頻率發布 3 個月，看數據調整；先兼職，有穩定收入再轉全職。' },
  { id: 'ecommerce', name: '電商、跨境與數位行銷', wx: ['水', '土'], natures: ['sales', 'free', 'mobile', 'finance', 'create'],
    desc: '網路開店、跨境銷售、廣告投放、社群經營，進入門檻低、看執行力。',
    roles: { tech: '數據分析、廣告投放優化', bridge: '電商營運、跨境業務、選品', creative: '商品文案、視覺設計、直播', care: '客服、訂單與倉儲管理' },
    entry: '先用小額資金或接案練投放和選品，學會看數據（轉換率、客單價）再放大。' },
  { id: 'fintech', name: '金融科技', wx: ['金', '水'], natures: ['finance', 'research', 'expert'],
    desc: '數位支付、線上理財、風險控管、區塊鏈，金融業和科技業交界的工作。',
    roles: { tech: '風控模型、資料分析、系統開發', bridge: '數位金融產品、理財顧問', creative: '金融教育內容', care: '法遵、洗錢防制、客戶權益' },
    entry: '金融背景補資料分析，資訊背景補金融知識；法遵與洗錢防制人才需求穩定。' },
  { id: 'robot', name: '機器人與智慧製造', wx: ['金', '火'], natures: ['expert', 'research', 'manage'],
    desc: '自動化產線、服務型機器人、無人機，缺工讓自動化需求一直增加。',
    roles: { tech: '機電整合、控制、視覺辨識', bridge: '自動化專案管理、系統整合業務', creative: '工業設計、人機介面', care: '設備維護、產線品管' },
    entry: '機電、資工背景直接切入；其他背景可以從專案管理、業務、維護技術員開始。' },
  { id: 'ev', name: '電動車與智慧交通', wx: ['金', '火', '水'], natures: ['expert', 'mobile', 'sales'],
    desc: '電動車零組件、充電設備、車用電子、共享運輸，台灣廠商在供應鏈裡很活躍。',
    roles: { tech: '車用電子、電池、充電系統', bridge: '通路業務、車隊與充電站經營', creative: '產品設計與行銷', care: '售後服務、維修技術' },
    entry: '從車用電子或電池相關的工程、維修證照切入；業務背景可以走充電與車隊服務。' },
  { id: 'edtech', name: '教育科技與終身學習', wx: ['木', '火'], natures: ['care', 'public', 'create'],
    desc: '線上課程、企業培訓、AI 家教，大人轉職進修的需求越來越大。',
    roles: { tech: '學習平台與數據分析', bridge: '企業培訓業務、課程營運', creative: '課程設計、講師', care: '學習顧問、班級經營' },
    entry: '把你最熟的專業做成一門小課或工作坊，先在社群或公司內部試教。' },
  { id: 'game', name: '遊戲與 XR 互動娛樂', wx: ['火'], natures: ['create', 'expert', 'free'],
    desc: '遊戲開發、虛擬實境、互動展演，創意和技術並重。',
    roles: { tech: '遊戲程式、3D 與特效技術', bridge: '發行、營運、社群', creative: '美術、企劃、關卡設計', care: '客服與玩家社群管理' },
    entry: '先做小作品（一個小遊戲、一段互動展示）放上作品集，參加 Game Jam 認識同好。' },
];

/** AI 時代怎麼做：依你最強的工作性質 */
export const AI_ADVICE = {
  manage: 'AI 讓一個人能帶動更多事：把 AI 放進團隊流程（會議記錄、報告、分析），你的價值在判斷和帶人。',
  expert: '把 AI 當成專業的加速器：先在自己的領域用 AI 寫程式、查規範、做計算，懂專業又會用 AI 的人最搶手。',
  create: 'AI 會做初稿，做不出你的觀點和品味：用 AI 加快產出，把力氣花在選題、風格和故事。',
  sales: 'AI 能寫提案、找名單，信任還是要靠人：用 AI 做功課，見面時比別人更懂客戶。',
  stable: '例行文書最先被 AI 自動化：主動學會流程自動化（試算表、表單、AI 助理），從「做事的人」變成「設計流程的人」。',
  care: '陪伴和同理是 AI 取代不了的：用 AI 處理紀錄與文書，把時間留給人。',
  research: 'AI 很會整理資料，判斷對錯還是要靠你：學會驗證 AI 的答案、做資料分析，正是你的強項。',
  free: 'AI 讓一人公司變得可行：用 AI 處理行銷、客服、記帳，專心做你最擅長的那一塊。',
  finance: 'AI 擅長算數字，風險和人性還是要靠人判斷：用 AI 做分析，再用經驗做決策。',
  mobile: 'AI 讓移動中的工作更有效率：語音記錄、即時翻譯、行程規劃，把跑外勤的時間變成產值。',
  public: 'AI 能生成內容，人設和信任是你的：用 AI 做素材，把力氣放在真實的經驗與互動。',
};

export const EMERGING_NOTE = '適配度＝你最強的四種工作性質（八字、紫微、星座、生命靈數、血型投票排出來的第 1～4 名）有沒有落在這個產業需要的類型，再加上產業的五行是不是你的喜用。'
  + '產業五行是本 App 依性質歸類的；產業描述以台灣 2026 年的情況撰寫，實際機會請再看職缺與自己的條件。';

/**
 * @param {{ranked:Array<{key:string,label:string,count:number}>, ys?:{primary:string,secondary:string,avoid:string[]}}} input
 *   ranked：buildCareer 的工作性質票數（多到少）；ys：喜用神
 * @returns {Array<{id,name,desc,score,level:'很適合'|'可以試試'|'要多花力氣',why:string[],role:string,entry:string}>} 依適配度排序
 */
export function emergingFit({ ranked, ys = null }) {
  const top = ranked.slice(0, 4);
  const lead = top[0] ? ROLE_GROUP[top[0].key] : 'tech';
  // 依排名給分，不直接加票數：票數會隨資料完整度（有沒有出生時間、血型）變多，加總會讓每個產業都「很適合」
  const RANK_POINTS = [3, 2, 1, 0.5];
  return EMERGING.map((ind) => {
    const matched = top.filter((n) => ind.natures.includes(n.key));
    const natureScore = top.reduce((a, n, i) => a + (ind.natures.includes(n.key) ? RANK_POINTS[i] : 0), 0);
    let wxScore = 0;
    const why = [];
    if (matched.length) why.push(`工作性質：你偏「${matched.map((n) => n.label).join('、')}」，正是這個產業需要的類型。`);
    else why.push('工作性質：你最強的幾種類型不是這個產業的主力，要花時間補能力。');
    if (ys) {
      const hit = ind.wx.filter((w) => w === ys.primary || w === ys.secondary);
      const bad = ind.wx.filter((w) => ys.avoid.includes(w));
      if (ind.wx.includes(ys.primary)) wxScore += 2;
      if (ind.wx.includes(ys.secondary)) wxScore += 1;
      if (!hit.length && bad.length) wxScore -= 1;
      why.push(hit.length
        ? `五行：產業屬${ind.wx.join('、')}，「${hit.join('、')}」是你的喜用，做起來比較順。`
        : bad.length
          ? `五行：產業屬${ind.wx.join('、')}，「${bad.join('、')}」是你的忌神，不是不能做，是要多花力氣。`
          : `五行：產業屬${ind.wx.join('、')}，和你的喜用沒有直接關係。`);
    }
    const score = natureScore + wxScore;
    const level = score >= 5 ? '很適合' : score >= 2.5 ? '可以試試' : '要多花力氣';
    return { id: ind.id, name: ind.name, desc: ind.desc, score, level, why, role: ind.roles[lead], entry: ind.entry };
  }).sort((a, b) => b.score - a.score || EMERGING.findIndex((x) => x.id === a.id) - EMERGING.findIndex((x) => x.id === b.id));
}
