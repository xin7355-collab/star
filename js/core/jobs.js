// 工作選單與換跑道：目前的工作、想做的工作（最多 3 個），依命盤算每個工作的適合程度，
// 給換跑道的難度、橋接工作、要補的能力、怎麼入行、AI 的影響、最適合轉換的年份，並直接指出想法裡可以修正的地方。
// 純函式，可在 Node 測試（tests/jobs.test.js）；畫面在 js/views/tool-career.js。
//
// 判斷依據：
// - 適合程度和「新興產業」同一套（emerging.js）：工作性質（八字格局、紫微官祿、星座、生命靈數、血型投票排出的前 4 名）
//   有沒有對上這個工作，加上這個工作的行業五行是不是你的喜用。
// - 選單有兩種：常見工作（82 個，寫得最細）和官方職業分類的全部 380 個細類（occupations.js，使用者回饋「選單沒有包含全部」）。
//   兩種都能選、能比；官方職業的性質、五行、AI 影響是本 App 依小類歸類的，同一種工作沿用常見工作的寫法（like）。
// - 工作的性質、五行、AI 影響是本 App 依工作內容歸類的（2026 年台灣的情況），不是官方內容。
// - 換跑道的時機看人生時間軸（lifeline.js）：變動的訊號（傷官、七殺、偏印、食神、偏財年，沖月支，交大運，
//   生命靈數 1 的新循環）落在順的年份最好；注意、小心的年份不建議裸辭。
// 文字不寫宿命、恐嚇、打包票的字（tests/wording.test.js）。

import { SOC_NAMES, SOC_TREE, SOC_EDITION, MINOR, UNIT, SOC_OF, ALIASES, COMMON_ALIASES } from './occupations.js';
import {
  norm, readinessOf, aiEaseOf, MIL_CIVIL, pensionOf, SERVICE_OF, asksService, pickCodes, hasSkill, hasCert, MAX_SKILLS, MAX_CERTS,
  MODES, SERVICES, MIL_ORGS, RANKS, YEARS, EDUS, MAJORS, STUDY_TIMES, WHENS,
} from './work-profile.js';

export { SOC_TREE, SOC_EDITION };

/** 十一種工作性質（career.js 各系統投票、新興產業、工作選單共用） */
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

/** AI 影響：0＝低（靠人際、體力、現場判斷），1＝中（工作方式會被改變），2＝高（例行的部分容易被自動化） */
export const AI_LEVEL = ['低', '中', '高'];
const AI_NOTE = [
  'AI 取代不了這份工作的核心（現場判斷、人際信任、手藝，或是打造 AI 本身）；用 AI 處理文書和查資料，把時間留給專業。',
  '工作方式會被 AI 改變：會用 AI 的人效率高很多，越早把 AI 用進日常工作越吃香。',
  '例行的部分容易被 AI 自動化：要在這行長久，往需要判斷、溝通、客製的那一端走，或成為設計自動化流程的人。',
];

/** 這份工作和 AI 的關係（給畫面用） */
export const aiNoteOf = (job) => AI_NOTE[job.ai];

const j = (id, name, natures, wx, skills, entry, ai, status = false) => ({ id, name, natures, wx, skills, entry, ai, status, long: LONG_TRAINING[id] || null });
// 要相關科系加國考（或師資培育加教甄）、養成期好幾年的工作：30 歲以上不放進「你可能沒想到的」推薦；自己選了就提醒養成期
const LONG_TRAINING = { doctor: 'exam', nurse: 'exam', pharmacist: 'exam', therapist: 'exam', nutritionist: 'exam', psych: 'exam', lawyer: 'exam', medtech: 'exam', teacher: 'teach', mil_pilot: 'flight' };
// 養成期的說法：官方職業裡還有研究所、飛行訓練、司法官考試這幾種，全講成「國考」會講錯（機師、物理學家不考國考）
const LONG_TEXT = { exam: '要相關科系和國考', teach: '要修師資培育、考教師資格和教甄', grad: '通常要研究所以上學歷', flight: '要飛行訓練和檢定', judge: '要法律系、司法官考試和受訓' };

export const JOB_GROUPS = [
  { id: 'tech', name: '科技資訊', jobs: [
    j('swe', '軟體工程師', ['expert', 'research'], ['水', '火'], '程式設計、系統思考、持續學新技術', '線上課程加上自己做 2～3 個作品放上 GitHub；職訓局、資策會的轉職班也是常見管道。', 1),
    j('data', '資料分析師', ['research', 'expert'], ['水', '金'], 'Excel 與 SQL、統計、把數字講成故事', '先用 Excel、SQL 分析現在工作的資料，做出一份報告當作品。', 1),
    j('ai_eng', 'AI 工程師', ['expert', 'research'], ['火', '水'], 'Python、機器學習、資料處理', '先會寫 Python、做一個 AI 應用的小專案；「會把 AI 用進產品」的人比「從頭訓練模型」的人更多公司要。', 0),
    j('security', '資安工程師', ['research', 'expert'], ['金', '水'], '網路與系統、細心、攻防思維', '從網路與系統基礎、入門證照開始，參加資安社群與競賽累積實作。', 0),
    j('it_admin', 'IT 系統管理', ['expert', 'stable'], ['水', '金'], '電腦網路維護、排除問題、耐心', '考網路或雲端的入門證照，從公司內部 IT 支援做起。', 1),
    j('product', '產品經理', ['manage', 'research'], ['水', '火'], '需求分析、溝通協調、排優先順序', '在現職主動接需求整理和專案協調，累積「把東西做出來」的案例。', 1),
    j('tester', '軟體測試', ['stable', 'research'], ['水', '金'], '細心、找問題、寫測試案例', '從手動測試做起，學自動化測試工具，就能往測試工程師走。', 2),
    j('uiux', 'UI／UX 設計師', ['create', 'research'], ['火', '水'], '使用者研究、介面設計、Figma', '做 3 個重新設計的作品案例（問題 → 研究 → 設計），放上作品集。', 1),
    // 用自然語言叫 AI 寫程式（使用者回饋：現在做 App 的門檻很低）。門檻低的是「做出能用的東西」，被錄用仍要基本功
    j('ai_builder', 'AI 應用開發（用說的做 App、自動化）', ['create', 'expert'], ['火', '水'], '把需求講清楚、用 AI 工具做出原型、測試修正、資安概念', '用 AI 工具（用自然語言描述需求）做出 2～3 個解決真實問題的小工具當作品，再接小案或在現職推動數位化。', 0),
  ] },
  { id: 'semi', name: '半導體與製造', jobs: [
    j('process', '製程／設備工程師', ['expert', 'research'], ['火', '金'], '理工基礎、問題分析、能輪班', '理工科系直接應徵；非本科可以從技術員做起、在職進修。', 1),
    j('qa', '品保／品管', ['stable', 'research'], ['金', '土'], '細心、標準流程、看懂數據', '考品管相關證照，從檢驗員做起。', 1),
    j('pmc', '生產管理', ['manage', 'stable'], ['土', '金'], '排程、跨部門協調、抓交期', '從生管助理或物管做起，熟悉 ERP 系統。', 1),
    j('operator', '技術員／作業員', ['stable', 'expert'], ['金', '火'], '穩定、守規則、能輪班', '直接應徵，工廠多有在職訓練；想往上走就進修、考證照。', 2),
    j('hw_rd', '硬體研發工程師', ['expert', 'research'], ['火', '金'], '電子電路、實驗、除錯', '電子電機背景直接切入；其他背景可以先從測試工程師開始。', 0),
  ] },
  { id: 'biz', name: '經營管理與行政', jobs: [
    j('owner', '經營者／老闆', ['manage', 'free'], ['土', '火'], '決策、找人、管錢、承擔風險', '先在現職學會帶團隊和看損益；小規模試營運，確定有人買單再放大。', 0),
    j('manager', '主管／經理', ['manage', 'stable'], ['土', '金'], '帶人、目標管理、向上溝通', '在現職主動帶新人、帶小專案，讓主管看到你能帶人。', 0),
    j('project', '專案經理', ['manage', 'research'], ['土', '水'], '規劃、時程、風險控管、溝通', '先在現職負責一個跨部門的小專案；想加分可以考專案管理證照。', 1),
    j('admin', '行政／助理', ['stable', 'care'], ['土', '木'], '細心、文書處理、協調', '熟練 Office 和 AI 工具，從行政助理做起。', 2),
    j('cs', '客服', ['care', 'stable'], ['水', '土'], '耐心、溝通、情緒穩定', '從電話或線上客服做起；會用 AI 客服工具、能處理複雜客訴的人比較不會被取代。', 2),
    j('hr', '人資', ['care', 'stable'], ['木', '土'], '招募、勞動法規、溝通、保密', '考就業服務相關證照，從招募專員做起。', 1),
    j('purchase', '採購', ['finance', 'sales'], ['金', '土'], '議價、供應商管理、成本概念', '從採購助理做起，熟悉品項和成本結構。', 1),
  ] },
  { id: 'sales', name: '業務與行銷', jobs: [
    j('sales', '業務', ['sales', 'mobile'], ['水', '土'], '敢開口、抗壓、經營關係', '選一個你懂的產品領域，從業務助理或內勤業務開始。', 0),
    j('marketing', '行銷企劃', ['create', 'sales'], ['水', '火'], '企劃、文案、看數據', '幫小品牌或自己的帳號做一個完整的行銷案，用數字證明成果。', 1),
    j('ecom', '電商／網路營運', ['sales', 'free'], ['水', '土'], '選品、廣告投放、看數據', '先用小額資金開一個賣場，或接代營運的小案，學會看轉換率。', 1),
    j('pr', '公關', ['public', 'create'], ['水', '火'], '人脈、危機處理、寫新聞稿', '從公關公司助理或企業品牌部做起。', 1),
    j('retail', '門市人員', ['sales', 'care'], ['土'], '服務、銷售、排班彈性', '直接應徵，連鎖品牌多有完整訓練；做得好可以往店長、區經理走。', 1),
    j('realestate', '房仲', ['sales', 'mobile'], ['土'], '開發客源、熟悉區域、耐心', '考不動產營業員證照，進有新人訓練的房仲公司。', 0),
    j('insurance', '保險業務', ['sales', 'care'], ['土', '金'], '經營人脈、說明商品、長期服務', '考保險業務員證照，選培訓完整的公司。', 0),
  ] },
  { id: 'finance', name: '金融與財會', jobs: [
    j('accountant', '會計', ['finance', 'stable'], ['金', '土'], '細心、帳務、稅法', '考記帳士或會計相關證照，從會計助理做起。', 2),
    j('finance_mgr', '財務', ['finance', 'manage'], ['金'], '資金規劃、財報分析、風險', '先熟悉財報分析，從會計或財務助理往上走。', 1),
    j('tax', '記帳士／稅務', ['finance', 'expert'], ['金', '土'], '稅法、帳務、細心', '考記帳士，先在記帳士事務所累積實務。', 2),
    j('banker', '銀行行員', ['stable', 'finance'], ['金'], '服務、細心、法規', '考金融基礎證照，應徵銀行的儲備人員。', 2),
    j('advisor', '理財顧問', ['finance', 'sales'], ['金', '水'], '金融商品知識、建立信任', '考證券、投信投顧、理財規劃相關證照。', 1),
    j('analyst', '投資分析', ['research', 'finance'], ['金', '水'], '產業研究、財報、判斷力', '從研究助理做起，寫產業分析報告累積作品。', 1),
  ] },
  { id: 'creative', name: '設計與創意', jobs: [
    j('graphic', '平面設計', ['create', 'expert'], ['火', '木'], '美感、排版、軟體操作', '作品集最重要：做 10 件作品（品牌、海報、社群圖）。', 2),
    j('interior', '室內設計', ['create', 'expert'], ['木', '土'], '空間規劃、繪圖、溝通預算', '學 CAD 和 3D 繪圖，從設計助理做起，考室內裝修相關證照。', 1),
    j('video', '影音剪輯', ['create', 'expert'], ['火', '水'], '剪輯、節奏感、說故事', '幫自己或朋友剪 10 支影片當作品，接小案累積。', 2),
    j('illustrator', '插畫家', ['create', 'free'], ['火', '木'], '繪畫、風格、經營作品集', '先在社群固定發表作品累積風格和粉絲，再接案或做周邊商品。', 2),
    j('game', '遊戲企劃／美術', ['create', 'expert'], ['火'], '遊戲設計、美術或企劃能力、作品集', '做一個小遊戲或一組美術作品放上作品集，參加 Game Jam 認識同好。', 1),
    j('photographer', '攝影師', ['create', 'free'], ['火'], '構圖、光線、經營客源', '先拍一個主題（人像、商品、婚禮）做出風格，再接案。', 1),
    j('creator', '內容創作者／自媒體', ['create', 'public'], ['火', '水'], '選題、持續產出、經營粉絲', '選一個能長期講的主題，固定頻率發 3 個月看數據；先兼職。', 1),
    j('editor', '文字編輯／文案', ['create', 'research'], ['木', '水'], '文字能力、邏輯、校對', '把文章放在網路上累積作品，接文案小案。', 2),
  ] },
  { id: 'edu', name: '教育', jobs: [
    j('teacher', '學校老師', ['care', 'public'], ['木'], '教學、班級經營、耐心', '修教育學程、考教師資格和教甄；也可以先做代理代課。', 0),
    j('tutor', '補教／家教', ['care', 'free'], ['木'], '把觀念講清楚、帶出成績', '先從家教或補習班助教做起，累積口碑。', 1),
    j('trainer', '企業講師', ['public', 'care'], ['木', '火'], '專業、表達、課程設計', '把你的專業做成一門小課，先在公司內部或社群試教。', 1),
    j('researcher', '研究人員', ['research', 'expert'], ['木', '水'], '研究方法、寫報告、耐得住', '研究所學歷常是門檻；也可以從研究助理做起。', 1),
    j('preschool', '幼教／保母', ['care', 'stable'], ['木', '土'], '耐心、照顧技能、安全意識', '考保母或幼教相關證照。', 0),
  ] },
  { id: 'health', name: '醫療與照護', jobs: [
    j('doctor', '醫師', ['expert', 'care'], ['木'], '醫學專業、判斷、抗壓', '醫學系和國考，養成期長。', 0),
    j('nurse', '護理師', ['care', 'expert'], ['木', '土'], '照護技能、細心、抗壓', '護理科系和護理師國考。', 0),
    j('pharmacist', '藥師', ['expert', 'care'], ['木'], '藥學專業、細心', '藥學系和藥師國考。', 1),
    j('therapist', '物理／職能治療師', ['care', 'expert'], ['木', '土'], '專業評估、耐心、體力', '物理治療或職能治療科系，再考國考。', 0),
    j('medtech', '醫檢師', ['expert', 'research'], ['木', '金'], '檢驗技術、細心、品質管理', '醫學檢驗科系和國考。', 1),
    j('caregiver', '照顧服務員', ['care', 'stable'], ['土', '木'], '耐心、體力、同理心', '上照顧服務員訓練課程、考證照最快。', 0),
    j('nutritionist', '營養師', ['care', 'research'], ['木', '土'], '營養專業、衛教溝通', '營養相關科系和國考。', 1),
  ] },
  { id: 'mind', name: '心理與社會服務', jobs: [
    j('psych', '心理師／諮商', ['care', 'research'], ['木', '水'], '傾聽、專業訓練、自我照顧', '心理相關研究所和國考；可以先在社福機構、志工累積助人經驗。', 0),
    j('social', '社工', ['care', 'public'], ['木', '土'], '個案管理、連結資源、韌性', '社工系或學分班，考社工師。', 0),
  ] },
  { id: 'public', name: '公職與法律', jobs: [
    j('civil', '公務員', ['stable', 'care'], ['金', '土'], '守法規、穩定、文書', '考高普考或特考，選一個類科長期準備。', 1),
    j('translator', '翻譯／口譯', ['expert', 'research'], ['水', '木'], '外語、專業領域知識、細心', '選一個專業領域（法律、醫學、科技）做深；機器翻譯越來越強，專業和口譯比一般筆譯有競爭力。', 2),
    j('lawyer', '律師／法務', ['research', 'expert'], ['金'], '法律專業、邏輯、文字', '法律系和律師考試；企業法務可以從法務助理做起。', 1),
    j('police', '警消／軍職', ['stable', 'mobile'], ['金', '火'], '體能、紀律、團隊', '考警專、消防特考，或報考軍職。', 0),
  ] },
  { id: 'service', name: '餐飲旅宿與生活服務', jobs: [
    j('chef', '廚師／烘焙', ['expert', 'create'], ['火'], '手藝、體力、穩定出品', '上職訓或烘焙課、考技術士證照，從學徒做起。', 0),
    j('barista', '咖啡師／飲料', ['expert', 'care'], ['火', '水'], '手藝、穩定出品、服務', '上咖啡課程、考咖啡師證照，從店員做起。', 0),
    j('event', '活動企劃／婚禮顧問', ['create', 'manage'], ['火', '土'], '企劃、協調廠商、臨場應變', '從活動公司助理做起，幫朋友辦活動累積作品。', 0),
    j('restaurant', '餐飲經營', ['manage', 'sales'], ['火', '土'], '成本控管、帶人、行銷', '先在餐廳做一兩年學營運，再小規模試做（市集、快閃店）。', 0),
    j('hotel', '飯店／旅遊業', ['care', 'mobile'], ['水', '土'], '服務、語言、應變', '從櫃台、領隊或導遊證照開始。', 1),
    j('beauty', '美容美髮美甲', ['create', 'care'], ['火'], '手藝、美感、經營熟客', '上專業課程考證照，從助理做起。', 0),
    j('fitness', '健身教練', ['care', 'public'], ['火', '木'], '運動專業、帶人、經營學員', '考教練證照，從健身房兼職教練做起。', 0),
  ] },
  { id: 'engineering', name: '工程與技術', jobs: [
    j('civil_eng', '土木／建築', ['expert', 'manage'], ['土'], '工程專業、現場管理', '相關科系、考技師或建築師；也可以從工地助理開始。', 1),
    j('electrician', '水電／冷氣技師', ['expert', 'free'], ['火', '水'], '技術、安全、體力', '上職訓課程、考技術士證照，跟著師傅學。', 0),
    j('mechanic', '汽機車維修', ['expert', 'stable'], ['金'], '機械技術、診斷', '考汽車修護證照；電動車維修是新的需求。', 0),
    j('machinist', '機械技師', ['expert', 'research'], ['金'], '機械原理、操作與維修', '職訓和證照，從技術員做起。', 1),
  ] },
  { id: 'logistics', name: '物流交通', jobs: [
    j('logistics', '物流倉儲', ['stable', 'mobile'], ['水', '土'], '流程、細心、體力', '從倉管或物流助理做起，熟悉系統。', 1),
    j('trade', '國際貿易／報關', ['sales', 'mobile'], ['水', '金'], '外語、貿易流程、談判', '考國貿或報關相關證照，從貿易助理做起。', 1),
    j('driver', '司機／外送', ['mobile', 'free'], ['水'], '駕駛、時間管理', '考相關駕照；外送平台門檻低但保障少，保險和存糧要自己規劃。', 1),
    j('aviation', '空服／地勤', ['care', 'mobile'], ['水', '金'], '語言、服務、體力', '加強英文、準備航空公司招考。', 0),
  ] },
  { id: 'arts', name: '藝術與表演', jobs: [
    j('performer', '演藝／表演', ['public', 'create'], ['火'], '表現力、抗壓、經營形象', '先從劇團、活動主持、素人表演累積經驗。', 0),
    j('musician', '音樂工作', ['create', 'free'], ['火', '水'], '專業技藝、創作、經營演出', '持續演出和發表作品，兼教學穩定收入。', 1),
    j('writer', '作家', ['create', 'research'], ['木', '水'], '寫作、長期累積、自己的觀點', '持續在網路發表，投稿文學獎或出版社。', 1),
  ] },
  { id: 'nature', name: '農業與寵物', jobs: [
    j('farmer', '農業', ['stable', 'free'], ['土', '木'], '耐心、體力、經營銷售', '參加青農培訓，先到農場打工學。', 0),
    j('pet', '寵物美容與照護', ['care', 'create'], ['木', '土'], '耐心、照護技能', '上寵物美容課程考證照，從助理做起。', 0),
  ] },
  { id: 'freelance', name: '自由業與創業', jobs: [
    j('freelancer', '自由接案', ['free', 'expert'], ['水', '火'], '專業、自律、開發客源', '先在下班時間接 1～2 個小案，案源穩定再轉全職。', 1),
    j('startup', '創業', ['free', 'manage'], ['火', '土'], '找市場、找錢、找人、扛風險', '先用最小成本驗證有人買單，保留一年生活費。', 0),
    j('shop', '開小店', ['free', 'sales'], ['土', '火'], '選址、成本、服務', '先到同類店家工作或擺市集測試，再租店面。', 0),
  ] },
  // 官方分類的軍人只有一個細類（0100），看不出專長；轉換時最有用的是「專長在民間對應什麼」（work-profile.js 的 MIL_CIVIL）
  { id: 'military', name: '軍職、警察與海巡', jobs: [
    j('mil_comm', '軍職：通信、電子、資訊', ['expert', 'stable'], ['火', '金'], '無線電與網路設備操作維修、資訊系統、排除故障', '志願役招募或軍校的通信、電子、資訊專長，部隊有專長訓練。', 1),
    j('mil_admin', '軍職：行政、人事、文書', ['stable', 'manage'], ['金', '土'], '公文、人事作業、法規、協調', '志願役或軍校；行政職缺多在機關、司令部。', 2),
    j('mil_logi', '軍職：後勤、補給、運輸', ['stable', 'mobile'], ['土', '水'], '補給與庫存管理、運輸調度、裝備保養', '志願役的後勤、運輸專長。', 1),
    j('mil_fin', '軍職：主計、財務', ['finance', 'stable'], ['金'], '預算、會計、核銷', '軍校財務相關科系，或志願役的財務專長。', 2),
    j('mil_pol', '軍職：政戰、心輔', ['care', 'public'], ['木', '金'], '溝通輔導、文宣、活動規劃', '政戰學院或志願役的政戰專長；心輔要受心理輔導訓練。', 1),
    j('mil_med', '軍職：醫務、衛勤', ['care', 'expert'], ['木', '金'], '急救、護理、醫療器材', '國防醫學院或衛勤專長訓練；醫師、護理師要國考。', 0),
    j('mil_eng', '軍職：工兵、營建', ['expert', 'mobile'], ['土', '金'], '營建施工、重機械、阻絕工事', '志願役的工兵專長。', 0),
    j('mil_mech', '軍職：車輛、機械、兵器維修', ['expert', 'stable'], ['金'], '機械與車輛維修、零件管理、保養制度', '志願役的保修專長，部隊有專長訓練。', 0),
    j('mil_avia', '軍職：航空機務（飛機維修）', ['expert', 'stable'], ['金', '水'], '航空器維修、技令與檢查、細心', '空軍航空技術學院，或志願役的機務專長。', 0),
    j('mil_ship', '軍職：艦艇航海、輪機', ['expert', 'mobile'], ['水', '金'], '航海、輪機、船艦操作、海上作業', '海軍官校，或志願役的海軍專長。', 0),
    j('mil_intel', '軍職：情報、監偵、資安', ['research', 'expert'], ['金', '水'], '情資分析、監偵系統、資訊安全', '志願役的情報或資通電專長；資安可以再考國際證照。', 1),
    j('mil_combat', '軍職：作戰部隊（步兵、裝甲、砲兵、陸戰）', ['manage', 'mobile'], ['金', '火'], '帶隊、體能、紀律、應變', '志願役招募或軍校。', 0),
    j('mil_pilot', '軍職：飛行員', ['expert', 'mobile'], ['金', '水'], '飛行技術、英文、抗壓', '空軍官校或飛行專業軍官班，要通過飛行體檢和訓練。', 0),
    j('mil_train', '軍職：教官、訓練', ['care', 'public'], ['木', '金'], '教學、帶操、課程規劃', '多由資深士官、軍官擔任；學校的教官也屬這一類。', 1),
    j('cga_patrol', '海巡：岸巡、港口安檢', ['stable', 'mobile'], ['水', '金'], '安檢查核、巡邏、法令、應變', '海巡署招募志願役，或考海巡人員特考。', 1),
    j('cga_ship', '海巡：艦艇勤務', ['expert', 'mobile'], ['水', '金'], '船艦操作、海上救難、查緝', '海巡人員特考，或志願役的海巡艦艇專長。', 0),
    j('cga_police', '海巡：查緝、刑事（海巡警察）', ['research', 'mobile'], ['水', '金'], '查緝偵辦、法令、蒐證', '考警察特考的水上警察類科，或海巡人員特考。', 0),
    j('pol_patrol', '警察：外勤（派出所、交通、保安）', ['stable', 'mobile'], ['金', '火'], '執勤、法令、溝通、應變', '警專、警大，或考警察特考。', 0),
    j('pol_crime', '警察：刑事偵查', ['research', 'mobile'], ['金', '水'], '偵查、蒐證、法律、抗壓', '多由外勤歷練後轉刑事，或警大的刑事相關科系。', 1),
    j('pol_office', '警察：內勤（行政、資訊、勤務指揮）', ['stable', 'research'], ['金', '土'], '行政、資訊系統、勤務調度', '警職人員依專長調任內勤。', 1),
    j('fire_staff', '消防：火災預防、危險物品管理（內勤）', ['stable', 'expert'], ['金', '火'], '消防法規、檢查、危險物品管理', '考警察特考的消防警察類科；預防科多由外勤歷練後調任。', 1),
  ] },
  { id: 'status', name: '目前狀態（還沒有工作）', jobs: [
    j('student', '學生', [], [], '', '', 0, true),
    j('jobless', '待業中', [], [], '', '', 0, true),
    j('homemaker', '全職照顧家庭', [], [], '', '', 0, true),
    j('retired', '退休', [], [], '', '', 0, true),
  ] },
];

// 每個工作的大致傾向（台灣 2026 的一般情況，實際看公司和個人）：收入、穩定、自由彈性、生活平衡（3＝高、2＝中、1＝低），
// 以及屬於哪個趨勢產業（emerging.js 的代碼）。用來對照「你最在意的事」：只看命盤適不適合，
// 會叫最在意穩定的人去自由接案、叫最在意收入的人去做起薪偏低的工作（上一版的設計缺口）
const TRAITS = {
  swe: [3, 2, 2, 2, 'ai'], data: [2, 2, 2, 2, 'ai'], ai_eng: [3, 2, 2, 2, 'ai'], security: [3, 3, 2, 2, 'security'], it_admin: [2, 3, 1, 2, null],
  product: [3, 2, 2, 1, 'ai'], tester: [2, 2, 1, 2, null], uiux: [2, 2, 2, 2, null],
  process: [3, 3, 1, 1, 'semi'], qa: [2, 3, 1, 2, 'semi'], pmc: [2, 3, 1, 2, null], operator: [1, 2, 1, 1, 'semi'], hw_rd: [3, 3, 1, 1, 'semi'],
  owner: [3, 1, 3, 1, null], manager: [3, 2, 1, 1, null], project: [2, 2, 1, 1, null], admin: [1, 3, 1, 3, null], cs: [1, 2, 1, 2, null], hr: [2, 3, 1, 2, null], purchase: [2, 3, 1, 2, null],
  sales: [3, 1, 2, 1, null], marketing: [2, 2, 2, 2, 'ecommerce'], ecom: [2, 1, 3, 2, 'ecommerce'], pr: [2, 2, 2, 1, null], retail: [1, 2, 1, 1, null], realestate: [3, 1, 2, 1, null], insurance: [2, 1, 3, 2, 'silver'],
  accountant: [2, 3, 1, 2, null], finance_mgr: [3, 3, 1, 2, 'fintech'], tax: [2, 3, 2, 2, null], banker: [2, 3, 1, 2, 'fintech'], advisor: [2, 1, 2, 2, 'fintech'], analyst: [3, 2, 2, 1, 'fintech'],
  graphic: [1, 1, 2, 2, null], interior: [2, 2, 2, 1, null], video: [1, 1, 3, 2, 'content'], illustrator: [1, 1, 3, 2, 'content'], game: [2, 2, 2, 1, 'game'],
  photographer: [1, 1, 3, 2, 'content'], creator: [1, 1, 3, 2, 'content'], editor: [1, 2, 2, 2, 'content'],
  teacher: [2, 3, 1, 2, 'edtech'], tutor: [1, 1, 3, 2, 'edtech'], trainer: [2, 2, 3, 2, 'edtech'], researcher: [2, 2, 2, 2, null], preschool: [1, 2, 1, 2, null],
  doctor: [3, 3, 1, 1, 'health'], nurse: [2, 3, 1, 1, 'silver'], pharmacist: [3, 3, 1, 2, 'health'], therapist: [2, 3, 1, 2, 'silver'], medtech: [2, 3, 1, 2, 'health'],
  caregiver: [1, 3, 1, 1, 'silver'], nutritionist: [2, 3, 1, 2, 'health'],
  psych: [2, 2, 2, 2, null], social: [1, 3, 1, 1, 'silver'],
  civil: [2, 3, 1, 3, null], translator: [2, 1, 3, 2, null], lawyer: [3, 2, 2, 1, null], police: [2, 3, 1, 1, null],
  chef: [1, 2, 1, 1, null], barista: [1, 2, 1, 2, null], event: [2, 1, 2, 1, null], restaurant: [2, 1, 3, 1, null], hotel: [1, 2, 1, 1, null], beauty: [2, 2, 3, 2, null], fitness: [2, 1, 3, 2, 'silver'],
  civil_eng: [3, 3, 1, 1, null], electrician: [2, 2, 3, 2, 'green'], mechanic: [2, 3, 2, 2, 'ev'], machinist: [2, 3, 1, 2, 'robot'],
  logistics: [1, 3, 1, 2, null], trade: [2, 2, 2, 2, 'ecommerce'], driver: [1, 1, 3, 2, null], aviation: [2, 3, 1, 1, null],
  performer: [1, 1, 3, 1, 'content'], musician: [1, 1, 3, 2, null], writer: [1, 1, 3, 3, 'content'],
  farmer: [1, 2, 3, 2, null], pet: [1, 2, 2, 2, null],
  freelancer: [2, 1, 3, 2, null], startup: [3, 1, 3, 1, null], shop: [2, 1, 3, 1, null],
  ai_builder: [2, 1, 3, 2, 'ai'],
  mil_comm: [2, 3, 1, 2, null], mil_admin: [2, 3, 1, 2, null], mil_logi: [2, 3, 1, 2, null], mil_fin: [2, 3, 1, 2, null], mil_pol: [2, 3, 1, 2, null],
  mil_med: [2, 3, 1, 1, 'health'], mil_eng: [2, 3, 1, 1, null], mil_mech: [2, 3, 1, 2, null], mil_avia: [2, 3, 1, 1, null], mil_ship: [2, 3, 1, 1, null],
  mil_intel: [2, 3, 1, 2, 'security'], mil_combat: [2, 3, 1, 1, null], mil_pilot: [3, 3, 1, 1, null], mil_train: [2, 3, 1, 2, null],
  cga_patrol: [2, 3, 1, 1, null], cga_ship: [2, 3, 1, 1, null], cga_police: [2, 3, 1, 1, null],
  pol_patrol: [2, 3, 1, 1, null], pol_crime: [2, 3, 1, 1, null], pol_office: [2, 3, 1, 2, null], fire_staff: [2, 3, 1, 2, null],
};
export const TRAIT_KEYS = [
  { key: 'pay', label: '收入' },
  { key: 'stab', label: '穩定' },
  { key: 'free', label: '自由' },
  { key: 'bal', label: '生活平衡' },
];
export const TRAIT_LEVEL = ['', '低', '中', '高'];
const traitsOf = (id) => {
  const t = TRAITS[id];
  return t ? { pay: t[0], stab: t[1], free: t[2], bal: t[3], trend: t[4] } : { pay: 0, stab: 0, free: 0, bal: 0, trend: null };
};

// 學歷、證照門檻的層級（照官方大類的技術層次）：專業人員和主管 4、技術員 3、事務／服務／技藝／操作 2、基層勞力 1。
// 轉換差多遠要看它：同一行的營建勞力工想當土木工程師，不是「內部轉調 3～6 個月」轉得過去
const TIER = { 1: 4, 2: 4, 3: 3, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 1, 0: 2 };
const tierOf = (code) => (code ? TIER[code[0]] : null);
const GROUP_NAME = { ...Object.fromEntries(JOB_GROUPS.map((g) => [g.id, g.name])), science: '科學研究' };

/** 常見工作（82 個＋4 種狀態）：寫得最細，也是「最適合你的職位」推薦的範圍 */
const CURATED = JOB_GROUPS.flatMap((g) => g.jobs.map((x) => ({ ...x, ...traitsOf(x.id), group: g.id, groupName: g.name, official: false, soc: SOC_OF[x.id] || null, tier: tierOf(SOC_OF[x.id]) })));
const CURATED_BY_ID = new Map(CURATED.map((x) => [x.id, x]));

const traitsFrom = (t) => ({ pay: Math.floor(t / 1000), stab: Math.floor(t / 100) % 10, free: Math.floor(t / 10) % 10, bal: t % 10 });
// 官方細類：小類的歸類 → 同一種工作沿用常見工作（like）→ 細類自己不一樣的地方
function officialJob(code, name) {
  const [group, natures, wx, t, ai, trend, skills, entry, long = null] = MINOR[code.slice(0, 3)];
  const u = UNIT[code] || {};
  const tpl = u.like ? CURATED_BY_ID.get(u.like) : null;
  const x = tpl
    ? { group: tpl.group, natures: tpl.natures, wx: tpl.wx, skills: tpl.skills, entry: tpl.entry, ai: tpl.ai, long: tpl.long, pay: tpl.pay, stab: tpl.stab, free: tpl.free, bal: tpl.bal, trend: tpl.trend }
    : { group, natures: natures.split(' '), wx: wx.split(' '), skills, entry, ai, long, ...traitsFrom(t), trend: trend || null };
  if (u.group) x.group = u.group;
  if (u.n) x.natures = u.n.split(' ');
  if (u.wx) x.wx = u.wx.split(' ');
  if (u.t) Object.assign(x, traitsFrom(u.t));
  if (u.ai !== undefined) x.ai = u.ai;
  if (u.trend !== undefined) x.trend = u.trend || null;
  if (u.skills) x.skills = u.skills;
  if (u.entry) x.entry = u.entry;
  if (u.long !== undefined) x.long = u.long;
  return { id: code, name, status: false, official: true, soc: code, tier: tierOf(code), like: tpl ? tpl.id : null, ...x, groupName: GROUP_NAME[x.group] };
}
/** 官方職業分類的 380 個細類（代碼就是 id，例如 2512） */
const OFFICIAL = [...SOC_NAMES].filter(([code]) => code.length === 4).map(([code, name]) => officialJob(code, name));
const BY_ID = new Map([...CURATED, ...OFFICIAL].map((x) => [x.id, x]));
export const jobOf = (id) => BY_ID.get(id) || null;
export const COMMON_COUNT = CURATED.filter((x) => !x.status).length;
export const OFFICIAL_COUNT = OFFICIAL.length;

/**
 * 一行說明：官方職業屬於哪個中類；常見工作屬於哪一類（detail＝也列出對應的官方細類，選項卡用）
 */
export function jobMeta(job, { detail = false } = {}) {
  if (!job) return '';
  if (job.status) return '目前狀態';
  if (job.official) return `官方分類 ${job.id}・${SOC_NAMES.get(job.id.slice(0, 2))}`;
  return detail && job.soc ? `常見工作・官方分類 ${job.soc} ${SOC_NAMES.get(job.soc)}` : `常見工作・${job.groupName}`;
}

// ── 搜尋：名稱、口語叫法、所屬類別都比對。全形半形（NFKC）、大小寫、空白不計（norm 在 work-profile.js，技能證照搜尋共用）
const aliasList = (s) => (s ? s.split('、').map(norm).filter(Boolean) : []);
const INDEX = [...CURATED, ...OFFICIAL].map((job, order) => ({
  job,
  order,
  name: norm(job.name),
  alias: aliasList(job.official ? ALIASES[job.id] : COMMON_ALIASES[job.id]),
  // 所屬類別只比小類：中類名稱太廣（「會計、生產、運輸及有關事務人員」），打「會計」會帶出倉管、運務
  ctx: job.official ? norm(SOC_NAMES.get(job.id.slice(0, 3))) : norm(job.groupName),
}));
function termScore(e, t) {
  if (/^\d+$/.test(t)) return e.job.official && e.job.id.startsWith(t) ? (e.job.id === t ? 100 : 80) : 0;
  // 英文詞只比開頭：打「uber」不該因為「youtuber」帶出自媒體
  const latin = /^[a-z&]+$/.test(t);
  let best = e.name === t ? 100 : e.name.startsWith(t) ? 90 : !latin && e.name.includes(t) ? 75 : 0;
  for (const a of e.alias) best = Math.max(best, a === t ? 85 : a.startsWith(t) ? 70 : !latin && a.includes(t) ? 60 : 0);
  if (!best && !latin && e.ctx.includes(t)) best = 30;
  return best;
}

/**
 * 搜尋工作（常見工作＋官方職業）。好幾個詞要全部對上；常見工作同分時排前面（名稱比較口語）。
 * 也可以直接打官方代碼（例如 2512）。exclude：不列的代碼（想做的工作不列現在的工作和已選的）
 * @returns {{hits:{job:object, score:number}[], total:number}}
 */
export function searchJobs(q, { withStatus = false, limit = 30, exclude = [] } = {}) {
  const terms = String(q || '').split(/[\s\u3000,，、]+/).map(norm).filter(Boolean);
  if (!terms.length) return { hits: [], total: 0 };
  // 整句也當一個詞比：「vibe coding」拆開後「coding」不是別名的開頭，合起來才對得上
  const whole = terms.length > 1 ? terms.join('') : null;
  const hits = [];
  for (const e of INDEX) {
    if ((e.job.status && !withStatus) || exclude.includes(e.job.id)) continue;
    let score = Infinity;
    for (const t of terms) {
      score = Math.min(score, termScore(e, t));
      if (!score) break;
    }
    if (whole) score = Math.max(score, termScore(e, whole));
    if (score) hits.push({ job: e.job, score: score + (e.job.official ? 0 : 3), order: e.order });
  }
  hits.sort((a, b) => b.score - a.score || a.order - b.order);
  return { hits: hits.slice(0, limit).map(({ job, score }) => ({ job, score })), total: hits.length };
}

/** 年資選項（換跑道的建議會看：做越久，越要帶著舊專業轉） */
export const TENURES = [
  { value: '', label: '（不填）' },
  { value: 'lt1', label: '未滿 1 年' },
  { value: '1-3', label: '1～3 年' },
  { value: '3-5', label: '3～5 年' },
  { value: '5-10', label: '5～10 年' },
  { value: 'gt10', label: '10 年以上' },
];
export const MAX_TARGETS = 3;

/** 你最在意的事：換不換、怎麼換，要和這個對照（attr：工作的哪一個傾向） */
export const PRIORITIES = [
  { value: '', label: '（不填）', attr: null },
  { value: 'fit', label: '做適合自己的事', attr: null },
  { value: 'income', label: '收入', attr: 'pay' },
  { value: 'stable', label: '穩定', attr: 'stab' },
  { value: 'freedom', label: '自由彈性', attr: 'free' },
  { value: 'balance', label: '生活平衡', attr: 'bal' },
];
/** 換工作時收入變少，能撐多久：決定要「先做副業」還是「準備好就跳」 */
export const RUNWAYS = [
  { value: '', label: '（不填）' },
  { value: 'none', label: '不能變少' },
  { value: 'half', label: '可以撐 3～6 個月' },
  { value: 'year', label: '可以撐 1 年以上' },
];

/** 存進名單前的白名單：只收選單裡有的代碼（常見工作的代碼或官方細類的 4 碼）、最多 3 個想做的，不收自由輸入的文字 */
export function sanitizeCareer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const current = typeof raw.current === 'string' && BY_ID.has(raw.current) ? raw.current : '';
  const pick = (list, v) => (list.some((t) => t.value && t.value === v) ? v : '');
  const tenure = pick(TENURES, raw.tenure);
  const priority = pick(PRIORITIES, raw.priority);
  const runway = pick(RUNWAYS, raw.runway);
  const targets = [];
  for (const t of Array.isArray(raw.targets) ? raw.targets : []) {
    if (typeof t === 'string' && BY_ID.has(t) && !BY_ID.get(t).status && t !== current && !targets.includes(t)) targets.push(t);
    if (targets.length >= MAX_TARGETS) break;
  }
  // 選填的背景：有填才存（沒填的人存檔和以前一模一樣）
  const extra = {};
  const opt = (key, list, v = raw[key]) => {
    const x = pick(list, v === undefined || v === null ? '' : String(v));
    if (x) extra[key] = x;
  };
  opt('mode', MODES);
  opt('service', SERVICES);
  opt('org', MIL_ORGS);
  opt('rank', RANKS);
  opt('svcYears', YEARS);
  opt('edu', EDUS);
  opt('major', MAJORS);
  opt('study', STUDY_TIMES);
  opt('when', WHENS);
  const skills = pickCodes(raw.skills, hasSkill, MAX_SKILLS);
  if (skills.length) extra.skills = skills;
  const certs = pickCodes(raw.certs, hasCert, MAX_CERTS);
  if (certs.length) extra.certs = certs;
  return current || targets.length || priority || runway || Object.keys(extra).length ? { current, tenure, priority, runway, targets, ...extra } : null;
}

/**
 * 適合分數（約 −1～8）換成 0～100 的適合度：上一版直接顯示「−1」「高 5.5」，看不懂。
 * 換算刻意不從 0 起：很不適合的工作顯示「5 分」會嚇到人，實際上只是「要多花力氣」。
 * 對照：要多花力氣 50 以下、可以 50～66、很適合 66 以上
 */
export const fitPct = (score) => Math.max(15, Math.min(98, Math.round(30 + score * 8.1)));

// 和新興產業同一套給分：工作性質的前 4 名依排名給分，加上行業五行和喜用的關係
const RANK_POINTS = [3, 2, 1, 0.5];
const LEVELS = [[4.5, '很適合'], [2.5, '可以'], [-Infinity, '要多花力氣']];

/**
 * 一個工作適不適合這個人。
 * @param job jobOf 的結果；ranked：buildCareer 的工作性質票數（多到少）；ys：yongShen
 */
export function jobFit(job, { ranked = [], ys = null }) {
  if (!job || job.status) return null;
  const top = ranked.slice(0, 4);
  const matched = top.filter((n) => job.natures.includes(n.key));
  const natureScore = top.reduce((a, n, i) => a + (job.natures.includes(n.key) ? RANK_POINTS[i] : 0), 0);
  let wxScore = 0;
  const why = [];
  why.push(matched.length
    ? `工作性質：這是「${job.natures.map((k) => NATURES[k].label).join('、')}」的工作，對上你命盤裡的「${matched.map((n) => n.label).join('、')}」。`
    : `工作性質：這是「${job.natures.map((k) => NATURES[k].label).join('、')}」的工作，不是你最強的類型，要花時間補能力。`);
  if (ys && job.wx.length) {
    const hit = job.wx.filter((w) => w === ys.primary || w === ys.secondary);
    const bad = job.wx.filter((w) => ys.avoid.includes(w));
    if (job.wx.includes(ys.primary)) wxScore += 2;
    else if (job.wx.includes(ys.secondary)) wxScore += 1;
    if (!hit.length && bad.length) wxScore -= 1;
    why.push(hit.length
      ? `五行：行業屬${job.wx.join('、')}，「${hit.join('、')}」是你的喜用，做起來比較順。`
      : bad.length
        ? `五行：行業屬${job.wx.join('、')}，「${bad.join('、')}」是你的忌神，不是不能做，是要多花力氣。`
        : `五行：行業屬${job.wx.join('、')}，和你的喜用沒有直接關係。`);
  }
  const score = Math.round((natureScore + wxScore) * 10) / 10;
  const level = LEVELS.find(([min]) => score >= min)[1];
  return { score, level, why, matched: matched.map((n) => n.key) };
}

/** 依適合程度排出你可能沒想到的工作（不含已經選的、不含狀態類） */
export function suggestJobs({ ranked, ys, exclude = [], n = 3, age = null }) {
  // 只從常見工作推薦：官方細類有「金屬砂模及砂心製造人員」這種名稱，推給一般人看不懂
  return CURATED.filter((x) => !x.status && !exclude.includes(x.id) && !(x.long && age !== null && age >= 30))
    .map((x) => ({ job: x, fit: jobFit(x, { ranked, ys }) }))
    // 同分時 AI 影響低的排前面（比較不怕被取代）
    .sort((a, b) => b.fit.score - a.fit.score || a.job.ai - b.job.ai)
    .slice(0, n);
}

/**
 * 兩個工作差多遠：同一類（或同一個官方小類）＝相近；工作性質有重疊＝中等；都沒有＝跨很大。
 * 學歷證照門檻往上跳兩級以上（基層 → 專業人員）再加一級難度，跳三級直接算跨很大
 */
function distanceOf(from, to) {
  if (!from || from.status) return 'start';
  // 基層工作（官方大類 9）不用學歷證照：換過去難的是收入和體力，不是能力，給「門檻低」的步驟（不是跳板、作品集那一套）
  if (to.tier === 1) return 'easy';
  let d = from.group === to.group || (from.soc && to.soc && from.soc.slice(0, 3) === to.soc.slice(0, 3)) ? 'near'
    : from.natures.some((k) => to.natures.includes(k)) ? 'mid' : 'far';
  const up = stepUp(from, to);
  if (up >= 3) d = 'far';
  else if (up >= 2) d = d === 'near' ? 'mid' : 'far';
  return d;
}
// 用 AI 做 App、寫程式：做出能用的東西不再要先讀完資工系，門檻往下算一級（被錄用仍要基本功，另外提醒）
const stepUp = (from, to) => (from && !from.status && from.tier && to.tier ? to.tier - from.tier - (aiEaseOf(to) === 'build' ? 1 : 0) : 0);
export const DISTANCE = { near: '相近', mid: '中等', far: '跨很大', start: '從頭開始', easy: '門檻低' };

// 每一類工作，轉行的人常見的「跳板」（門檻比較低、又能累積那一行的經驗）
const GROUP_BRIDGE = {
  tech: ['data', 'it_admin', 'product'], semi: ['qa', 'pmc'], biz: ['project', 'admin'], sales: ['marketing', 'ecom'],
  finance: ['accountant', 'advisor'], creative: ['marketing', 'editor', 'video'], edu: ['tutor', 'trainer'], health: ['caregiver'],
  mind: ['social'], public: ['admin'], service: ['restaurant', 'hotel'], engineering: ['machinist'], logistics: ['logistics'],
  arts: ['creator'], nature: ['pet'], freelance: ['freelancer'], science: ['researcher', 'data'], military: [],
};

/**
 * 橋接工作（跨很大時先轉到這裡）：從目標那一類常見的跳板裡挑最適合這個人的；和現在的工作有共同性質的加分。
 * 只照工作性質找會挑出不合理的路（會計想轉 AI 工程師，被建議先去當作業員），所以候選限定在跳板清單裡
 */
function bridgeOf(from, to, { ranked, ys }) {
  const cands = (GROUP_BRIDGE[to.group] || []).map(jobOf).filter((x) => x && x.id !== from.id && x.id !== to.id);
  if (!cands.length) return null;
  return cands
    .map((x) => ({ job: x, s: jobFit(x, { ranked, ys }).score + (x.natures.some((k) => from.natures.includes(k)) ? 1 : 0) }))
    .sort((a, b) => b.s - a.s || a.job.ai - b.job.ai)[0].job;
}

// 換跑道的步驟（依差多遠）
function planOf(dist, { from, to, bridge, tenure }) {
  const long = tenure === '5-10' || tenure === 'gt10';
  if (to.tier === 1) {
    return [
      '門檻低，可以直接應徵，或先用兼職、打工試做一兩個月。',
      '先確認體力、工時和收入能不能接受；簽約前看清楚有沒有保勞保、健保。',
      dist !== 'start' && long ? `你在「${from.name}」累積很久，換過去經驗用不太上、收入可能變少；如果只是想喘口氣，也可以考慮同行換一個比較輕鬆的位子。` : '做順了再學一門技術或考證照，收入和穩定度會往上走。',
    ];
  }
  if (dist === 'start') {
    if (from && from.id === 'homemaker') return ['先從兼職或時間彈性的工作開始，讓家裡和自己都有時間調整。', `補能力：${to.skills}。`, '把照顧家庭練出來的能力（排程、協調、耐心）寫進履歷，那是真的經驗。'];
    if (from && from.id === 'retired') return ['先用志工、兼職或顧問的方式接觸，不用一開始就全職。', `把你過去的經驗帶進來：${to.skills}裡，哪些你本來就會？`];
    return ['先用實習、兼職或短期課程試水溫，確定喜歡再投入。', `補能力：${to.skills}。`, '做出一兩個能拿給人看的成果（作品、證照、實習證明）。'];
  }
  if (dist === 'near') {
    return [
      `先在現職接觸「${to.name}」的工作內容：主動接相關的專案、跟做這行的同事學。`,
      '履歷把相關的經驗放最前面；內部轉調或同業跳槽，通常 3～6 個月可以轉成。',
    ];
  }
  if (dist === 'mid') {
    return [
      `下班時間做一個「${to.name}」的小專案或副業，3 個月內做出一個能拿給人看的成果。`,
      `補能力：${to.skills}。`,
      long ? `你在「${from.name}」累積很久，帶著舊專業轉最值錢：找「懂${from.name}的${to.name}」這種位置。` : '用成果去應徵，或先接兼職、小案確認做得來。',
      '確定可行再離職，先存好 3～6 個月的生活費。',
    ];
  }
  return [
    '先不要裸辭：存好 6～12 個月的生活費。',
    bridge ? `分兩段轉：先轉到「${bridge.name}」這種橋接工作（同時用到你現在和未來的能力），再到「${to.name}」。` : `從「${to.name}」最基礎的位置或課程開始，給自己一年的時間。`,
    `上課、考證照：${to.skills}。`,
    long ? `你在「${from.name}」做很久了，舊經驗別丟：找兩個領域交界的機會，起薪不會掉太多。` : '每三個月檢查一次：作品、人脈、收入來源，三樣有兩樣了再全職轉換。',
  ];
}

// 換跑道的時機：變動的訊號落在順的年份最好
const CHANGE_TAGS = ['傷官年', '七殺年', '偏印年', '食神年', '偏財年', '沖月支', '交大運', '新循環', '木星回歸'];
const LEVEL_RANK = { 順: 4, 小順: 3, 平: 2, 注意: 1, 小心: 0 };

/**
 * 未來 10 年哪幾年適合換跑道、哪幾年最要小心。
 * best：10 年裡最適合的兩年（有變動訊號、平以上）；soon：近 3 年裡可以轉的那一年（有變動訊號的優先）。
 * 為什麼要 soon：最好的年份常常在七八年後，只講那一年等於叫人等很久（試算時給了「2034 年再轉」）。
 * avoid 只列「小心」的年份：連「注意」一起列，10 年裡會列出七八年，看了只會慌
 * @param years lifeline.buildLifeline(...).years
 */
export function changeTiming(years = []) {
  const scored = years.map((y) => {
    const signals = y.tags.filter((t) => CHANGE_TAGS.includes(t));
    return { year: y.year, level: y.level, signals, score: LEVEL_RANK[y.level] * 2 + Math.min(2, signals.length) * 1.5 };
  });
  const first = scored.length ? scored[0].year : null;
  const best = scored.filter((y) => y.signals.length && LEVEL_RANK[y.level] >= 2).sort((a, b) => b.score - a.score || a.year - b.year).slice(0, 2);
  const soon = scored.filter((y) => y.year - first <= 3 && LEVEL_RANK[y.level] >= 2)
    .sort((a, b) => Number(b.signals.length > 0) - Number(a.signals.length > 0) || LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.year - b.year)[0] || null;
  const avoid = scored.filter((y) => LEVEL_RANK[y.level] === 0).map((y) => y.year);
  return { best, soon, avoid };
}

/**
 * 目前的工作 vs 想做的工作：適合程度、差多遠、橋接工作、步驟、AI 影響、時機，以及想法裡可以修正的地方。
 * @param {{current?:string, tenure?:string, targets?:string[], ranked:object[], ys?:object|null, years?:object[], name?:string}} o
 *   current、targets 是工作代碼；years 是人生時間軸的 10 年（buildLifeline）
 */
export function careerPlan({
  current = '', tenure = '', priority = '', runway = '', targets = [], ranked = [], ys = null, years = [], name = '你', age = null,
  mode = '', service = '', rank = '', svcYears = '', edu = '', major = '', skills = [], certs = [], study = '', when = '',
}) {
  const W = name && name !== '你' ? name : '你';
  const base = jobOf(current);
  // 軍職看階級：軍官本來就在主管、專業人員那一層，士兵轉專業人員才是跳兩級
  const rankTier = (RANKS.find((r) => r.value === rank) || {}).tier || null;
  const from = base && rankTier && base.group === 'military' ? { ...base, tier: rankTier } : base;
  const curFit = from && !from.status ? jobFit(from, { ranked, ys }) : null;
  const timing = changeTiming(years);
  const thisYear = years[0] || null;
  const related = from ? MIL_CIVIL[from.id] || [] : [];
  const prof = { skills, certs, edu, major, from, related };
  const filled = skills.length > 0 || certs.length > 0 || !!edu || !!major;
  const svc = service || SERVICE_OF(from);
  // 只有軍警公職才算月退（換成一般工作後殘留的年資不能拿來算）
  const pension = from && asksService(from) ? pensionOf({ service: svc, years: svcYears, thisYear: thisYear ? thisYear.year : null }) : null;
  const items = targets.map(jobOf).filter((x) => x && !x.status).map((to) => {
    const fit = jobFit(to, { ranked, ys });
    const readiness = readinessOf(to, prof);
    let dist = distanceOf(from, to);
    // 軍警專長在民間本來就對得上的工作，不會「跨很大」；技能證照已經備齊的，再近一級
    if (dist === 'far' && related.includes(to.id)) dist = 'mid';
    const ready = readiness && readiness.pct >= 70;
    if (ready && (dist === 'far' || dist === 'mid')) dist = dist === 'far' ? 'mid' : 'near';
    const bridge = dist === 'far' ? bridgeOf(from, to, { ranked, ys }) : null;
    const plan = planOf(dist, { from, to, bridge, tenure });
    if (stepUp(from, to) >= 2 && !ready) plan.unshift(`「${to.name}」的入行門檻比現在高（通常要相關學歷或證照）：先查清楚要哪些資格，用在職進修、夜間部或職訓補上。`);
    if (readiness) {
      const have = [...readiness.haveSkills, ...readiness.haveCerts.map((c) => `證照「${c}」`)];
      if (have.length) plan.unshift(`你已經有：${have.join('、')}。履歷把這些放最前面。`);
      if (readiness.suggestCerts.length) plan.push(`可以考的證照：${readiness.suggestCerts.join('、')}。`);
    }
    return {
      job: to,
      fit,
      readiness,
      ease: aiEaseOf(to),
      delta: curFit ? Math.round((fit.score - curFit.score) * 10) / 10 : null,
      distance: dist,
      bridge,
      plan,
      ai: { level: AI_LEVEL[to.ai], note: AI_NOTE[to.ai] },
    };
  }).sort((a, b) => b.fit.score - a.fit.score);

  // 想法裡可以補充或修正的地方（直說）。「方向對」只講最適合的那一個，而且它本身要至少「可以」：
  // 兩個都不適合時，比現在稍好不等於方向對（試算時「行政」比「會計」高 2 分就被說成方向對）
  const notes = [];
  items.forEach((it, k) => {
    if (k === 0 && it.delta !== null && it.delta >= 1.5 && it.fit.level !== '要多花力氣') {
      notes.push({ tone: 'good', text: `「${it.job.name}」比現在的「${from.name}」更適合你，方向是對的；重點是照步驟轉，不要一次賭上全部。` });
    } else if (it.delta !== null && it.delta <= -1.5) {
      notes.push({ tone: 'bad', text: `「${it.job.name}」沒有比你現在的「${from.name}」更適合你。如果想換是因為累、薪水或主管，先考慮換公司、換部門，不一定要換行。` });
    } else if (it.fit.level === '要多花力氣') {
      notes.push({ tone: 'info', text: `「${it.job.name}」對你要多花力氣：不是不能做，是要比別人花更多時間補能力。真的很想做，就從小規模試起。` });
    }
    if (it.job.ai === 2) notes.push({ tone: 'info', text: `「${it.job.name}」例行的部分容易被 AI 自動化：要去的話，練好「用 AI 做這份工作」的能力，或往需要判斷、溝通的那一端走。` });
    if (it.job.long) notes.push({ tone: 'info', text: `「${it.job.name}」${LONG_TEXT[it.job.long]}，養成至少好幾年${age !== null && age >= 30 ? '；可以先從相關的輔助工作開始接觸（例如助理、技術員、行政），確定真的喜歡再投入' : ''}。` });
  });
  if (items.length >= 2) {
    const groups = new Set(items.map((x) => x.job.group));
    const shared = items.every((x) => x.job.natures.some((k) => items[0].job.natures.includes(k)));
    if (groups.size === items.length && !shared) notes.push({ tone: 'info', text: '你選的幾個方向差很多：先挑最適合的那一個（排在最上面）試 3 個月，不要同時準備好幾條路。' });
  }
  if (curFit && curFit.level === '很適合' && items.some((x) => x.fit.level === '很適合')) {
    const elsewhere = from.group === 'military' || from.group === 'public' ? '換單位或申請調職' : '換公司';
    notes.push({ tone: 'info', text: `現在的工作和想去的都適合你：換的理由要想清楚，是「更想做那件事」，還是「想離開現在的地方」。後者${elsewhere}就好。` });
  }
  if (from && !from.status && from.ai === 2 && !items.length) {
    notes.push({ tone: 'info', text: `「${from.name}」例行的部分容易被 AI 自動化：留在這行沒問題，但要開始學會用 AI 做事，往需要判斷、溝通的工作內容靠。` });
  }
  // 軍職快滿 20 年時，路線是「撐到月退再轉」：不再講「明年再轉比較順」，兩句會打架
  const waitPension = pension && pension.id === 'wait' && pension.toGo <= 8;
  if (thisYear && !waitPension && LEVEL_RANK[thisYear.level] <= 1 && items.some((x) => x.distance === 'far' || x.distance === 'mid')) {
    const next = timing.soon && timing.soon.year !== thisYear.year ? timing.soon : null;
    notes.push({ tone: 'info', text: `今年（${thisYear.year}）是「${thisYear.level}」的年份，不建議裸辭；今年先準備（上課、做作品、存錢）${next ? `，${next.year} 年再轉比較順` : ''}。` });
  }

  // 準備度、AI 降低的門檻、作息、學習時間、想換的時間（有填才講）
  const best0 = items[0] || null;
  if (best0 && best0.readiness && best0.readiness.pct >= 70) {
    notes.push({ tone: 'good', text: `「${best0.job.name}」你已經準備了不少（準備度 ${best0.readiness.pct}）：不一定要等準備完美，可以先投履歷試試市場反應。` });
  }
  const officialSide = from && (from.group === 'military' || from.group === 'public' || svc === 'mil' || svc === 'police' || svc === 'civil');
  for (const it of items) {
    if (it.ease === 'build') {
      notes.push({ tone: 'info', text: `「${it.job.name}」：現在用 AI（用說的描述需求）就能做出 App 和小工具，入門門檻低很多。先做一個解決真實問題的小工具當作品；但要被錄用，還是要看得懂程式、會除錯、懂資安，AI 寫的東西要能自己修。` });
    } else if (it.ease === 'content') {
      notes.push({ tone: 'info', text: `「${it.job.name}」：AI 讓做出作品變容易，但同行也都在用；能被看見的是你自己的題材、專業和品味。` });
    }
    if (mode === 'office' && it.job.bal === 1) notes.push({ tone: 'info', text: `「${it.job.name}」常要輪班、加班或外勤，和你現在固定上下班的作息差很多，先和家人談好。` });
  }
  if (officialSide && items.some((x) => x.ease === 'build')) {
    notes.push({ tone: 'bad', text: '公務、軍事資料不要放進外部 AI 工具：練習時用自己的題目或公開資料，單位內要用 AI 先問清楚資安規定。' });
  }
  if (study === 'lt3' && items.some((x) => x.distance === 'far')) {
    notes.push({ tone: 'info', text: '你每週能學新東西的時間不到 3 小時：跨很大的轉換可能要 2～3 年，先挑相近或準備度高的方向。' });
  }
  if (when === 'soon' && best0 && best0.readiness && best0.readiness.pct < 40) {
    notes.push({ tone: 'bad', text: `你想半年內換，但「${best0.job.name}」的準備度還低（${best0.readiness.pct}）：先看下面「用你現在的本事可以去的工作」，或把時間拉長到一年以上。` });
  }

  // 和「你最在意的事」對照：想去的工作在這一項偏低，直接講；現在的工作在這一項明顯比較好，也講
  const pr = PRIORITIES.find((x) => x.value === priority) || null;
  if (pr && pr.attr) {
    const label = pr.label;
    for (const it of items) {
      if (it.job[pr.attr] === 1) notes.push({ tone: 'bad', text: `你最在意「${label}」，但「${it.job.name}」的${label}偏低：${LOW_TRAIT[pr.attr]}` });
      else if (from && !from.status && from[pr.attr] - it.job[pr.attr] >= 1) notes.push({ tone: 'info', text: `論「${label}」，現在的「${from.name}」比「${it.job.name}」好，換過去這一項會變差。` });
      else if (it.job[pr.attr] === 3) notes.push({ tone: 'good', text: `「${it.job.name}」正好符合你最在意的「${label}」。` });
    }
  }

  // 年資和月退最影響換不換（軍職差幾年滿 20 年），放第一條
  if (pension) notes.unshift({ tone: pension.tone, text: pension.text });

  const suggest = suggestJobs({ ranked, ys, exclude: [current, ...targets], n: 6, age });
  const path = choosePath({ from, curFit, items, priority: pr, runway, timing, years, pension, when });
  // 軍警專長在民間對應的工作；用你現在的本事（技能、證照、科系）就搆得到的工作
  const score = (x) => ({ job: x, fit: jobFit(x, { ranked, ys }), readiness: readinessOf(x, prof) });
  const byReady = (a, b) => (b.readiness ? b.readiness.pct : 0) - (a.readiness ? a.readiness.pct : 0) || b.fit.score - a.fit.score;
  const civil = related.map(jobOf).filter(Boolean).map(score).sort(byReady);
  const ready = filled
    // 官方細類沿用常見工作的（like）不重複列
    // 軍警專長對應的工作上面已經列了，不重複
    ? [...CURATED, ...OFFICIAL].filter((x) => !x.status && !x.like && x.id !== current && !targets.includes(x.id) && !related.includes(x.id)).map(score)
      .filter((r) => r.readiness && r.readiness.pct >= 60).sort(byReady).slice(0, 6)
    : [];
  return { from, curFit, tenure, priority: pr && pr.value ? pr : null, runway, items, notes, timing, suggest, path, name: W, pension, civil, ready, filled, service: svc };
}

const LOW_TRAIT = {
  pay: '起薪偏低，靠經驗和口碑慢慢往上，前兩三年收入要有心理準備。',
  stab: '收入起伏大，至少準備 6 個月生活費，或先兼職試水溫。',
  free: '制度和上班時間比較固定，自由度不高。',
  bal: '常加班或要輪班，先和家人談好作息。',
};

/** 衝的年份（升遷、加薪、轉換）：順或小順，而且有變動或升遷的訊號 */
export const GO_TAGS = [...CHANGE_TAGS, '正官年', '正財年'];
const goYearOf = (years) => {
  const y = years.find((x) => LEVEL_RANK[x.level] >= 3 && x.tags.some((t) => GO_TAGS.includes(t)));
  return y ? y.year : null;
};

/**
 * 建議路線（現實不是只有「換」和「不換」）：
 * 留下往上走／先換環境不換行／副業先行／準備好再換／全力轉換／先試做（基層工作門檻低）／撐到月退再轉（軍職快滿 20 年）／從頭開始。
 * 依適合度（加上你最在意的那一項）決定要不要換；依收入能撐多久決定怎麼換；依人生時間軸決定哪一年做。
 */
function choosePath({ from, curFit, items, priority, runway, timing, years, pension = null, when: pref = '' }) {
  const thisYear = years[0] ? years[0].year : null;
  const soon = timing.soon && timing.soon.year !== thisYear ? timing.soon.year : null;
  // 想半年內換、今年又不是「小心」的年份：就排今年
  const now = pref === 'soon' && years[0] && LEVEL_RANK[years[0].level] >= 1 ? thisYear : null;
  const when = now || soon || (thisYear !== null ? thisYear + 1 : null);
  const at = (y, text) => (y !== null && y !== undefined ? `${y} 年：${text}` : text);
  const attr = priority && priority.attr;
  // 你最在意的那一項：想去的比現在高就加分、低就扣分（沒有現職時和「中」比）
  // 選路線的目標：適合度為主，加上準備度（填了技能證照才有）：準備度 80 的和 10 的，現實上差很多
  const adj = (job, fit, readiness = null) => fit.score + (attr ? (job[attr] - (from && !from.status ? from[attr] : 2)) * 0.8 : 0)
    + (readiness ? (readiness.pct - 50) / 20 : 0);
  if (!from) {
    if (!items.length) return null;
  }
  if (!from || from.status) {
    const best = items.length ? [...items].sort((a, b) => adj(b.job, b.fit, b.readiness) - adj(a.job, a.fit, a.readiness))[0] : null;
    if (!best) return { id: 'explore', label: '先找方向', title: '先從推薦的職位挑一個試', target: null, year: null, steps: ['看下面「最適合你的職位」，挑一兩個加到想做的工作。', '每個方向用 3 個月的課程、實習或兼職試看看，再決定要不要投入。'] };
    return { id: 'start', label: '從頭開始', title: `從「${best.job.name}」開始`, target: best.job, year: when,
      steps: [at(thisYear, `用實習、兼職或短期課程試「${best.job.name}」，確定喜歡再投入。`), ...best.plan.slice(1), at(when, '正式投入，給自己一年站穩。')] };
  }
  const best = items.length ? [...items].sort((a, b) => adj(b.job, b.fit, b.readiness) - adj(a.job, a.fit, a.readiness))[0] : null;
  const goYear = goYearOf(years);
  if (!best) {
    const steps = [`把你最強的工作性質用進現在的工作：多接你擅長的那一類任務，讓主管看到。`];
    if (curFit && curFit.level === '要多花力氣') steps.push('現在的工作對你比較吃力：先在公司內找更適合的部門或專案；也可以看下面「最適合你的職位」。');
    steps.push(goYear ? at(goYear, '衝的年份，爭取升遷、加薪或更好的位子。') : '每年檢查一次：能力、收入、成就感有沒有在進步。');
    if (from.ai === 2) steps.push('你的工作例行的部分容易被 AI 自動化：今年開始學會用 AI 做事，往需要判斷、溝通的內容靠。');
    return { id: 'stay', label: '留下往上走', title: `留在「${from.name}」，往上走`, target: null, year: goYear, steps };
  }
  if (adj(best.job, best.fit, best.readiness) <= adj(from, curFit) + 0.5) {
    return { id: 'move', label: '先換環境', title: '先換環境，不急著換行', target: best.job, year: when,
      steps: ['先寫下想離開的原因：主管、薪水、工時，還是這一行本身。', at(when, `同行換公司或換部門，帶著「${from.name}」的經驗去更好的環境。`), `「${best.job.name}」可以先當興趣或副業接觸，真的更喜歡再說。`] };
  }
  // 軍職再 8 年內滿 20 年：先準備、滿 20 年再轉（月退和一次退伍金差距大；careerPlan 的 waitPension 同一個條件）
  if (pension && pension.id === 'wait' && pension.toGo <= 8) {
    return { id: 'pension', label: '撐到月退再轉', title: `留在現職到 ${pension.year} 年，先把「${best.job.name}」準備好`, target: best.job, year: pension.year,
      steps: [at(thisYear, `下班時間準備「${best.job.name}」：${best.job.skills}；能考的證照先考。`), '退輔會有職業訓練補助、報考國家考試的補習補助（以當年規定為準），能用就用。', at(pension.year, '服滿 20 年後轉換：有月退墊底，新工作從基層做起也不怕。')] };
  }
  if (best.distance === 'easy') {
    return { id: 'try', label: '先試做', title: `先兼職試做「${best.job.name}」`, target: best.job, year: when,
      steps: [at(thisYear, `用兼職、打工或假日班試做「${best.job.name}」一兩個月，確認體力、工時和收入能接受。`), at(when, '確定適合再正式轉換；同時學一門技術或考證照，讓收入和穩定度往上走。')] };
  }
  const bridge = best.bridge ? `跨很大：先到「${best.bridge.name}」累積經驗，再到「${best.job.name}」，比直接跳成功率高。` : null;
  // 你最在意的那一項，想去的工作偏低（最在意穩定卻想去自媒體）：除非存款撐得了一年，都先當副業
  const risky = attr && best.job[attr] === 1;
  if (runway === 'none' || (risky && runway !== 'year')) {
    return { id: 'side', label: '副業先行', title: `留著現職，「${best.job.name}」先當副業`, target: best.job, year: when,
      steps: [at(thisYear, `下班時間上課、做「${best.job.name}」的小專案，3 個月內做出能拿給人看的作品。`), bridge, at(when, '副業每個月有穩定收入（大約現在收入的三成）再談轉換。')].filter(Boolean) };
  }
  if (runway === 'year') {
    return { id: 'switch', label: '全力轉換', title: `全力轉到「${best.job.name}」`, target: best.job, year: when,
      steps: [at(thisYear, `存款撐得住：可以全職投入學習（${best.job.skills}）。`), bridge, at(when, `正式轉換，給自己一年在「${best.job.name}」站穩。`)].filter(Boolean) };
  }
  return { id: 'prep', label: '準備好再換', title: `準備好再換到「${best.job.name}」`, target: best.job, year: when,
    steps: [at(thisYear, `準備：補能力（${best.job.skills}）、做作品、存 6 個月生活費。`), bridge, at(when, `正式轉換到「${best.job.name}」。`)].filter(Boolean) };
}

/**
 * 老師總評（工作）：一段話講完天賦、現況、建議路線和時機；下面是修正你的想法、路線的步驟、你的優勢。
 * 細節（每個選項的比較、怎麼入行、十年工作運）在畫面上其他卡片，這裡不重複。
 * @param plan careerPlan 的結果；natures：buildCareer 的 natures（最強的工作性質，含優勢與地雷）
 */
export function careerMaster(plan, natures = []) {
  const W = plan.name;
  const top = natures[0] || null;
  const talent = top ? `天賦偏「${top.label}」，${top.desc}` : '';
  const path = plan.path;
  const why = plan.notes.slice(0, 5);
  const remedies = [];
  const boosts = [];
  let verdict;
  if (!plan.from && !plan.items.length) {
    verdict = `老師看${W}：${talent}先在上面填你的狀況（現在的工作、最在意的事、想做的工作），老師再幫你比、幫你排時間。`;
  } else {
    const now = plan.from && !plan.from.status && plan.curFit
      ? `現在的「${plan.from.name}」適合度 ${fitPct(plan.curFit.score)}（${plan.curFit.level}）。`
      : plan.from ? `現在是「${plan.from.name}」。` : '';
    const route = path ? `建議：${path.title}。` : '';
    const time = path && path.year ? (path.id === 'stay' ? `${path.year} 年是衝的年份。` : `${path.year} 年是比較好的時機。`) : '';
    verdict = `老師看${W}：${talent}${now}${route}${time}`;
  }
  if (path) remedies.push({ title: `建議路線：${path.title}`, steps: path.steps });
  if (path && ['prep', 'switch', 'side'].includes(path.id) && plan.timing.avoid.length) {
    remedies.push({ title: '這幾年先別裸辭', steps: [`${plan.timing.avoid.join('、')} 年是最要小心的年份：可以準備、上課、做副業，正式離職放到順的年份。`] });
  }
  if (top) boosts.push(`你的優勢：${top.edge}。面試、寫履歷、談升遷時，把這點講具體。`);
  const bestYear = plan.timing.best[0];
  if (bestYear) boosts.push(`${bestYear.year} 年（${bestYear.level}，${bestYear.signals.join('、')}）是十年裡轉換、升遷、開新局最好的時機。`);
  return {
    badge: path ? path.label : null,
    verdict,
    why,
    remedies,
    boosts,
    combos: [
      { label: '人生時間軸', why: '每一年的運勢和要注意的月份', go: ['destiny', { tool: 'liunian' }] },
      { label: '擇日', why: '面試、簽約、遞辭呈挑順的日子', go: ['fortune', {}] },
      { label: '開運佈置', why: '書桌、辦公桌照喜用方位擺', go: ['destiny', { tool: 'fengshui' }] },
      { label: '解惑', why: '卡在「要不要換」時起一卦，看趨勢和做法', go: ['oracle', { panel: 'jiehuo' }] },
    ],
  };
}
