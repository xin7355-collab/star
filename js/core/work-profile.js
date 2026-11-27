// 你的工作背景：工作型態、軍警公職身分與年資、學歷科系、會的技能、證照、每週能學多久、想什麼時候換。
// 為什麼要有：上一版只看命盤和職業類別，不知道你實際會什麼（使用者回饋：「沒有問我會的技能、證照」）。
// 會無線電、修過電腦的人轉電信或資訊維運，比一般人近很多；軍職差幾年滿 20 年，換不換差的是月退。
// - 「適合度」看天賦（命盤＋測驗）；「準備度」看你已經會的（技能、證照、學歷、相關經驗），兩個分開算、分開講。
// - 技能和證照都是選單代碼，不收自由輸入的文字；只存在這支手機。
// - 純資料＋純函式，不 import jobs.js（jobs.js 會 import 這裡；records.js 經由 jobs.js 在啟動時就載入）。
// 文字不寫宿命、恐嚇、打包票的字（tests/wording.test.js）。

/** 搜尋比對用：全形半形（NFKC）、大小寫、空白和連字號不計（「no code」對得上「no-code」；jobs.js 的工作搜尋也用這個） */
export const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s\u3000\-_]+/g, '');

/** 現在的工作型態（和想去的工作作息差很多時會提醒） */
export const MODES = [
  { value: '', label: '（不填）' },
  { value: 'office', label: '固定上下班（機關、辦公室）' },
  { value: 'shift', label: '輪班、輪值' },
  { value: 'field', label: '外勤、跑現場' },
  { value: 'station', label: '駐地、艦艇、常不在家' },
  { value: 'remote', label: '遠端、在家工作' },
  { value: 'flex', label: '時間自己安排（接案、自己做）' },
];

/** 身分：軍職看月退門檻（服現役滿 20 年）；警職、文職看公務人員退休規定 */
export const SERVICES = [
  { value: '', label: '（不填）' },
  { value: 'mil', label: '軍職（志願役、士官、軍官）' },
  { value: 'police', label: '警職（警察、海巡警察、消防）' },
  { value: 'civil', label: '文職（公務員）' },
  { value: 'contract', label: '約聘僱、臨時人員' },
];
export const MIL_ORGS = [
  { value: '', label: '（不填）' },
  { value: 'army', label: '陸軍' },
  { value: 'navy', label: '海軍' },
  { value: 'airforce', label: '空軍' },
  { value: 'marine', label: '海軍陸戰隊' },
  { value: 'mp', label: '憲兵' },
  { value: 'mnd', label: '國防部與直屬單位' },
  { value: 'cga', label: '海巡署' },
  { value: 'reserve', label: '後備指揮部' },
  { value: 'other', label: '其他' },
];
/** 階級：轉換難度看「學歷證照門檻」，軍官本來就在主管、專業人員那一層 */
export const RANKS = [
  { value: '', label: '（不填）', tier: null },
  { value: 'enlisted', label: '士兵', tier: 2 },
  { value: 'nco', label: '士官', tier: 3 },
  { value: 'officer', label: '軍官', tier: 4 },
];
/** 服役／任職年資（總共幾年）：0～40 */
export const YEARS = [{ value: '', label: '（不填）' }, ...Array.from({ length: 41 }, (_, i) => ({ value: String(i), label: i === 0 ? '未滿 1 年' : `${i} 年` }))];

export const EDUS = [
  { value: '', label: '（不填）', rank: 0 },
  { value: 'jh', label: '國中以下', rank: 1 },
  { value: 'hs', label: '高中、高職', rank: 2 },
  { value: 'jc', label: '專科（五專、二專）', rank: 3 },
  { value: 'ba', label: '大學（含二技、四技、軍校）', rank: 4 },
  { value: 'ma', label: '碩士', rank: 5 },
  { value: 'phd', label: '博士', rank: 6 },
];
// 科系 → 對得上的工作（代碼規則同 matchesJob：官方 1～4 碼、常見工作代碼、g:類別）
const MAJOR_FOR = {
  it: ['25', '35', 'g:tech', 'ai_builder', 'mil_comm', 'mil_intel'],
  ee: ['215', '311', '313', '352', '74', 'g:semi', 'mil_comm', 'hw_rd', 'process'],
  me: ['2144', '2141', '3115', '72', 'g:semi', 'mil_mech', 'mil_avia', 'machinist', 'mechanic'],
  civil: ['2142', '216', '3112', '3123', '1323', 'civil_eng', 'interior'],
  sci: ['21', '31', 'g:science', 'researcher', 'data'],
  med: ['22', '32', 'g:health', 'mil_med'],
  biz: ['g:biz', 'g:finance', 'g:sales', '12', '24', '33', '41', '43'],
  lang: ['2643', '2641', '2391', '5113', 'translator', 'editor', 'writer', 'hotel', 'trade'],
  law: ['261', '3411', '335', '2633', 'civil', 'lawyer', 'pol_crime', 'cga_police'],
  edu: ['23', 'g:edu', 'trainer'],
  social: ['263', '3412', 'psych', 'social', 'hr'],
  art: ['217', '264', '265', '343', 'g:creative', 'g:arts'],
  hosp: ['14', '51', 'g:service', 'hotel'],
  agri: ['g:nature', '131', '2132', '3142', '6'],
  mil: ['g:military', 'manager', 'project'],
  police: ['pol_patrol', 'pol_crime', 'pol_office', 'cga_police', '5402', '3355'],
  sport: ['342', '2393', 'fitness', 'mil_train'],
  other: [],
};
export const MAJORS = [
  { value: '', label: '（不填）' },
  { value: 'it', label: '資訊、資工' },
  { value: 'ee', label: '電機、電子、通訊' },
  { value: 'me', label: '機械、工業工程' },
  { value: 'civil', label: '土木、建築' },
  { value: 'sci', label: '理學（數理化生）' },
  { value: 'med', label: '醫藥、護理' },
  { value: 'biz', label: '商管、財會' },
  { value: 'lang', label: '語文' },
  { value: 'law', label: '法律、政治、公共行政' },
  { value: 'edu', label: '教育' },
  { value: 'social', label: '社會、心理、社工' },
  { value: 'art', label: '藝術、設計、傳播' },
  { value: 'hosp', label: '餐旅、觀光' },
  { value: 'agri', label: '農林漁牧' },
  { value: 'mil', label: '軍事（軍校）' },
  { value: 'police', label: '警察（警專、警大）' },
  { value: 'sport', label: '體育' },
  { value: 'other', label: '其他' },
];
export const STUDY_TIMES = [
  { value: '', label: '（不填）' },
  { value: 'lt3', label: '每週 3 小時以內' },
  { value: '3-7', label: '每週 3～7 小時' },
  { value: '7-15', label: '每週 7～15 小時' },
  { value: 'gt15', label: '每週 15 小時以上' },
];
export const WHENS = [
  { value: '', label: '（不填）' },
  { value: 'soon', label: '半年內' },
  { value: 'year', label: '一年內' },
  { value: 'later', label: '三年內' },
  { value: 'explore', label: '只是先看看' },
];

const sk = (id, name, forTokens, alias = '') => ({ id, name, for: forTokens, alias });

/** 會的技能（分類）。for：這個技能用得上的工作 */
export const SKILL_GROUPS = [
  { id: 'it', name: '電腦與資訊', items: [
    sk('pc_repair', '電腦組裝與維修', ['3511', '3512', '3513', '7421', '2522', 'it_admin', 'mil_comm'], '修電腦、換零件、灌系統'),
    sk('network', '網路架設與管理', ['2522', '2523', '2529', '3513', '7421', '1330', 'it_admin', 'security', 'mil_comm'], '網管、交換器、路由器、佈線'),
    sk('server', '伺服器與系統管理（Windows、Linux）', ['2521', '2522', '2523', '2529', '3513', 'it_admin', 'security'], 'MIS、系統管理'),
    sk('cloud', '雲端服務（AWS、Azure 等）', ['2512', '2522', '2523', '2529', 'swe', 'ai_eng', 'it_admin', 'security'], '雲端'),
    sk('infosec', '資訊安全', ['2522', '2523', '2529', 'security', 'mil_intel'], '資安、防毒、弱點'),
    sk('programming', '寫程式（Python、JavaScript 等）', ['251', '2120', '3514', 'swe', 'ai_eng', 'data', 'tester', 'game', 'ai_builder'], '程式設計、coding'),
    sk('web', '做網頁', ['2513', '3514', 'uiux', 'swe', 'ai_builder', 'ecom'], '網站、前端'),
    sk('app_ai', '用 AI 做 App 或小工具（用說的就能寫程式）', ['251', '3514', 'swe', 'product', 'data', 'ai_builder'], 'AI 寫程式、vibe coding、生成式 AI、自動化'),
    sk('data_analysis', '資料分析（Excel 進階、SQL）', ['2120', '2412', '2431', '2631', '3314', '4312', 'data', 'analyst', 'marketing', 'pmc'], '數據、樞紐分析、報表'),
    sk('database', '資料庫', ['2521', '2522', 'data', 'swe'], 'SQL、資料庫'),
    sk('office', 'Office 文書（Word、Excel、簡報）', ['g:biz', '334', '4110', '4120', '4311', '4910', 'admin', 'cs', 'mil_admin', 'pol_office'], '文書處理、PPT'),
    sk('ai_tools', '會用 AI 工具（整理資料、寫文件）', ['g:biz', 'g:finance', 'g:sales', 'g:creative', '334', '2421', '2431', '2641', '4110', '4120', 'admin', 'ai_builder'], 'ChatGPT、生成式 AI'),
    sk('helpdesk', '電腦問題排除、教別人用電腦', ['2394', '3512', '4224', 'cs', 'it_admin', 'mil_comm'], '資訊支援、叫修'),
  ] },
  { id: 'comm', name: '通訊與電子', items: [
    sk('radio_op', '無線電通訊操作（值機、通聯）', ['3152', '3154', '3155', '3522', '5401', 'mil_comm', 'cga_ship', 'cga_patrol', 'pol_office'], '無線電、對講機、通聯、值機'),
    sk('radio_maint', '無線電與通信設備維修', ['2153', '3155', '3522', '7421', '7429', 'mil_comm'], '無線電維修、通信裝備'),
    sk('telecom', '電信線路、基地台', ['2153', '3522', '7413', '7421', 'mil_comm'], '電信、基地台、光纖'),
    sk('electronics', '電子電路與維修', ['2152', '3114', '3155', '7421', '7429', '8202', 'hw_rd', 'mil_comm', 'mil_avia'], '電子、電路板'),
    sk('soldering', '電子零件焊接', ['3114', '7421', '7429', '8202', 'hw_rd'], '烙鐵、焊錫'),
    sk('satcom', '衛星與海事通訊', ['3151', '3152', '3522', 'mil_comm', 'mil_ship', 'cga_ship'], 'GMDSS、衛星電話'),
    sk('weak_current', '監視器、弱電、門禁系統', ['3513', '5404', '7411', '7421', '7429'], '監視器、弱電'),
  ] },
  { id: 'mech', name: '機械與水電', items: [
    sk('electrical', '室內配線、水電', ['741', '3113', '7126', '7411', 'electrician'], '水電、配電'),
    sk('hvac', '冷氣空調', ['7127', 'electrician'], '冷氣、空調'),
    sk('mech_repair', '機械維修保養', ['723', '3115', '7233', '8201', 'machinist', 'mil_mech'], '設備保養'),
    sk('vehicle', '汽機車維修', ['7231', '7234', 'mechanic', 'mil_mech'], '修車'),
    sk('welding', '金屬焊接、切割', ['721', '7212', 'mil_eng'], '電焊、氬焊'),
    sk('cnc', '車床、銑床、CNC', ['722', '7223', 'machinist'], '車床、CNC'),
    sk('plc', '自動化控制（PLC）', ['2141', '2151', '3113', '3115', '3139'], 'PLC、自動化'),
    sk('carpentry', '木工、裝潢', ['792', '7114', '7922', 'interior'], '木作、裝潢'),
    sk('construction', '營建施工、工地', ['711', '712', '1323', '3123', '9312', 'civil_eng', 'mil_eng'], '工地、施工'),
  ] },
  { id: 'drive', name: '駕駛與操作', items: [
    sk('drive_car', '汽機車駕駛（載客、送貨）', ['5194', '8321', '8322', 'driver'], '開車、外送'),
    sk('drive_heavy', '大貨車、大客車駕駛', ['833', '8331', '8332'], '大車、貨車、公車'),
    sk('forklift', '堆高機', ['4321', '8349', '9330', 'logistics'], '堆高機'),
    sk('heavy_machine', '吊車、挖土機等重機械', ['834', '8342', '8343', 'mil_eng'], '重機械、怪手'),
    sk('boat', '船舶駕駛、航海', ['605', '3152', '8350', 'mil_ship', 'cga_ship'], '開船、航海'),
    sk('marine_engine', '船舶輪機', ['3151', '7233', 'mil_ship', 'cga_ship'], '輪機'),
    sk('drone', '無人機操作', ['2163', '3142', '3521', 'photographer'], '空拍、無人機'),
  ] },
  { id: 'lang', name: '語言', items: [
    sk('english', '英文（工作上會用）', ['2433', '2643', '3331', '4221', '5111', '5113', 'translator', 'trade', 'aviation', 'hotel', 'product'], '英語'),
    sk('japanese', '日文', ['2643', '4221', '5113', 'translator', 'trade', 'hotel'], '日語'),
    sk('other_lang', '其他外語', ['2643', '4221', '5113', 'translator', 'trade', 'hotel'], '韓文、越南文、外語'),
    sk('taiwanese', '台語（和長輩、客戶溝通）', ['3412', '5220', '5320', 'caregiver', 'sales', 'insurance', 'realestate', 'retail', 'social'], '台語'),
  ] },
  { id: 'admin', name: '行政與管理', items: [
    sk('docs', '公文與文書處理', ['334', '335', '3411', '4110', '4120', 'admin', 'civil', 'mil_admin', 'pol_office'], '公文'),
    sk('leadership', '帶人與團隊管理', ['1', '312', 'manager', 'owner', 'project', 'restaurant', 'mil_combat'], '帶人、管理、主管'),
    sk('project_mgmt', '專案規劃與控管', ['1223', '1323', '2421', 'project', 'product', 'event'], '專案管理'),
    sk('planning', '企劃與簡報', ['2421', '2431', 'marketing', 'event', 'pr', 'product', 'trainer'], '企劃、提案'),
    sk('hr_skill', '人事、排班、考核', ['1212', '2422', '4910', 'hr', 'mil_admin'], '人事、排班'),
    sk('supply', '後勤補給、庫存管理', ['1324', '3323', '4321', '9330', 'logistics', 'purchase', 'mil_logi'], '補給、庫存、倉管'),
    sk('procurement', '採購、發包、議價', ['1219', '3323', 'purchase', 'mil_logi'], '採購'),
    sk('quality', '品質管理、稽核', ['2141', '2291', '3117', '3295', '7993', 'qa'], '品管、稽核'),
    sk('safety', '工安與職業安全', ['1323', '2291', '3123', '3295', '5404'], '工安、職安'),
  ] },
  { id: 'biz', name: '銷售與服務', items: [
    sk('sales_skill', '銷售與開發客戶', ['g:sales', '332', '522', '529', '2433', '2434', 'insurance', 'realestate', 'advisor'], '業務、銷售'),
    sk('customer', '客戶服務、處理抱怨', ['422', '4211', '4222', '4224', '5220', 'cs', 'retail', 'hotel', 'banker'], '客服'),
    sk('negotiation', '談判議價', ['1120', '3322', '3323', '3334', 'purchase', 'sales', 'realestate', 'trade', 'lawyer'], '談判'),
    sk('ecom_skill', '網路開店、電商營運', ['2431', '5294', 'ecom', 'shop', 'marketing'], '電商、網拍'),
    sk('marketing_skill', '行銷與社群經營', ['1221', '2431', '2432', 'marketing', 'creator', 'ecom', 'pr'], '社群、行銷、小編'),
    sk('speaking', '上台說話、主持', ['2422', '2656', 'trainer', 'teacher', 'pr', 'performer', 'sales', 'mil_train'], '主持、簡報、演講'),
  ] },
  { id: 'creative', name: '創意與內容', items: [
    sk('design', '平面設計（海報、排版）', ['2172', '3439', '7316', 'graphic', 'uiux', 'marketing'], '設計、美編'),
    sk('video_edit', '拍影片、剪輯', ['2654', '3521', 'video', 'creator', 'photographer'], '剪輯、影片'),
    sk('photo', '攝影', ['3431', 'photographer', 'video', 'creator'], '攝影、拍照'),
    sk('writing', '寫作、文案', ['2641', '2642', 'writer', 'editor', 'creator', 'marketing', 'pr'], '寫作、文案'),
    sk('drawing', '繪畫、插畫', ['2651', '7316', 'illustrator', 'graphic', 'game'], '繪畫、插畫'),
    sk('music_skill', '樂器、唱歌', ['2392', '2652', 'musician'], '音樂'),
    sk('crafts', '手作、工藝', ['731', '7314', '7317', '7318', '7319'], '手作'),
  ] },
  { id: 'finance', name: '財會與法律', items: [
    sk('accounting', '會計帳務', ['1211', '2411', '3313', '4311', 'accountant', 'tax', 'finance_mgr', 'mil_fin'], '會計、記帳'),
    sk('tax_skill', '稅務', ['2411', '3313', '3352', 'tax'], '報稅'),
    sk('investing', '投資理財', ['2412', '3311', 'advisor', 'analyst', 'finance_mgr'], '股票、理財'),
    sk('law_skill', '法律與法規', ['261', '2619', '335', '3411', 'lawyer', 'civil', 'pol_crime', 'cga_police'], '法律、法規'),
    sk('insurance_skill', '保險規劃', ['3321', 'insurance', 'advisor'], '保險'),
  ] },
  { id: 'care', name: '醫護與照顧', items: [
    sk('first_aid', '急救（CPR、AED、止血包紮）', ['3296', '3422', '5111', '5320', '5401', 'caregiver', 'nurse', 'fitness', 'aviation', 'mil_med'], '急救、CPR'),
    sk('nursing', '護理照護', ['222', '322', '5320', 'nurse', 'caregiver', 'mil_med'], '護理'),
    sk('elder_care', '照顧長輩', ['1342', '3412', '5320', 'caregiver', 'social'], '長照、照顧'),
    sk('child_care', '照顧小孩', ['2332', '5310', 'preschool', 'tutor'], '帶小孩'),
    sk('counseling', '傾聽與輔導', ['2634', '2635', '3412', 'psych', 'social', 'teacher', 'mil_pol'], '輔導、心輔'),
    sk('fitness_skill', '運動與體能訓練', ['3421', '3422', 'fitness', 'mil_train'], '健身、體能'),
    sk('nutrition_skill', '營養與飲食規劃', ['2293', 'nutritionist', 'chef'], '營養'),
  ] },
  { id: 'edu', name: '教學與訓練', items: [
    sk('teaching', '教學、帶課', ['g:edu', '2391', '2392', '2393', '2394', '2395', 'trainer', 'tutor', 'mil_train'], '教書、上課'),
    sk('coaching', '帶訓練、帶操（教官、教練）', ['2422', '3422', 'trainer', 'fitness', 'mil_train'], '教官、教練'),
    sk('curriculum', '課程與教材設計', ['2394', '2399', '2422', 'trainer', 'teacher'], '教材'),
  ] },
  { id: 'food', name: '餐飲與生活', items: [
    sk('cooking', '烹飪', ['3433', '5120', '5212', '9901', 'chef', 'restaurant'], '煮飯、廚藝'),
    sk('baking', '烘焙、甜點', ['5120', '7912', 'chef'], '烘焙、蛋糕'),
    sk('beverage', '咖啡、飲料調製', ['5131', 'barista'], '咖啡、調酒、手搖飲'),
    sk('cleaning', '清潔、整理收納', ['911', '919', '5152', '7132', '9112'], '打掃、收納'),
    sk('beauty_skill', '美髮、美容、美甲', ['5140', 'beauty'], '美髮、美甲'),
    sk('pet_skill', '寵物照顧、美容', ['3240', '5193', 'pet'], '寵物'),
  ] },
  { id: 'duty', name: '勤務與安全', items: [
    sk('patrol', '巡邏、勤務與門禁', ['5151', '5402', '5404', '5409', 'pol_patrol', 'cga_patrol'], '巡邏、警衛、門禁'),
    sk('ops_center', '勤務指揮、值班調度', ['1324', '3154', '4323', '5401', 'pol_office', 'mil_comm'], '勤指中心、調度、值班'),
    sk('rescue', '搜救、救生', ['3296', '5401', 'cga_ship', 'fire_staff'], '搜救、救難'),
    sk('diving', '潛水', ['7991', 'cga_ship', 'mil_ship'], '潛水'),
    sk('firefighting', '消防、滅火', ['2291', '5401', 'fire_staff'], '消防'),
    sk('investigation', '查緝、偵查、蒐證', ['3119', '3355', 'pol_crime', 'cga_police'], '偵查、查緝'),
    sk('farming', '種植、農事', ['601', '603', '2132', '3142', 'farmer'], '種田、農業'),
    sk('fishing_skill', '漁撈、養殖', ['605', 'cga_ship'], '捕魚、養殖'),
  ] },
  { id: 'mil', name: '軍中歷練（轉換時常被忽略的本事）', items: [
    sk('command', '指揮與帶隊', ['1', '312', 'manager', 'project', 'mil_combat', 'pol_patrol'], '帶隊、領導'),
    sk('equipment', '裝備管理與保養制度', ['3117', '4321', '7233', 'qa', 'mil_logi', 'mil_mech'], '裝備、保養'),
    sk('drill_plan', '演訓與勤務規劃', ['1324', '2421', 'project', 'event', 'mil_train'], '演習、勤務規劃'),
    sk('intel', '情資分析、報告撰寫', ['2631', '2632', '3355', 'analyst', 'data', 'mil_intel', 'pol_crime'], '情報、分析'),
  ] },
];

const ce = (id, name, forTokens, alias = '') => ({ id, name, for: forTokens, alias });

/** 證照（分類）。名稱用一般人看得懂的說法；等級寫在括號裡 */
export const CERT_GROUPS = [
  { id: 'tech', name: '技術士（勞動部技能檢定）', items: [
    ce('tc_pc', '電腦硬體裝修（乙／丙級）', ['2522', '3512', '3513', '7421', 'it_admin', 'mil_comm'], '技術士'),
    ce('tc_net', '網路架設（乙／丙級）', ['2522', '2523', '3513', '7421', 'it_admin', 'mil_comm'], '技術士'),
    ce('tc_soft_app', '電腦軟體應用（乙／丙級）', ['g:biz', '2172', '4110', '4120', 'admin', 'graphic'], '技術士'),
    ce('tc_soft_dev', '電腦軟體設計（乙／丙級）', ['251', 'swe', 'tester', 'ai_builder'], '技術士'),
    ce('tc_ie', '工業電子（乙／丙級）', ['2152', '3114', '7421', '7429', '8202', 'hw_rd'], '技術士'),
    ce('tc_de', '數位電子（乙／丙級）', ['2152', '3114', '7429', 'hw_rd'], '技術士'),
    ce('tc_telecom', '通信技術（電信線路）', ['2153', '3522', '7413', '7421', 'mil_comm'], '技術士'),
    ce('tc_wiring', '室內配線（屋內線路裝修）', ['3113', '7411', 'electrician'], '技術士、水電'),
    ce('tc_ind_wiring', '工業配線', ['3113', '3139', '7411', '7412'], '技術士'),
    ce('tc_hvac', '冷凍空調裝修', ['7127', 'electrician'], '技術士'),
    ce('tc_plumbing', '自來水管配管', ['7126', 'electrician'], '技術士'),
    ce('tc_car', '汽車修護', ['7231', 'mechanic', 'mil_mech'], '技術士'),
    ce('tc_moto', '機器腳踏車修護', ['7231', '7234', 'mechanic'], '技術士'),
    ce('tc_weld', '銲接（電銲、氬銲等）', ['721', '7212'], '技術士'),
    ce('tc_cnc', '車床、銑床、CNC', ['722', '7223', 'machinist'], '技術士'),
    ce('tc_cad', '電腦輔助製圖（機械、建築）', ['2144', '2161', '2163', '3118', 'civil_eng'], '技術士、CAD'),
    ce('tc_forklift', '堆高機操作', ['4321', '8349', '9330', 'logistics'], '技術士'),
    ce('tc_crane', '移動式起重機操作', ['834', '8343'], '技術士'),
    ce('tc_excavator', '挖掘機（重機械操作）', ['834', '8342'], '技術士'),
    ce('tc_cook', '中餐、西餐烹調', ['3433', '5120', 'chef', 'restaurant'], '技術士、廚師'),
    ce('tc_baking', '烘焙食品', ['7912', 'chef'], '技術士'),
    ce('tc_beverage', '飲料調製', ['5131', 'barista'], '技術士'),
    ce('tc_beauty', '美容、美髮', ['5140', 'beauty'], '技術士'),
    ce('tc_babysit', '保母人員', ['5310', 'preschool'], '技術士'),
    ce('tc_caregiver', '照顧服務員', ['5320', 'caregiver'], '技術士、長照'),
    ce('tc_account', '會計事務', ['3313', '4311', 'accountant', 'tax'], '技術士'),
    ce('tc_store', '門市服務', ['523', '5220', 'retail'], '技術士'),
    ce('tc_employment', '就業服務（乙級）', ['2422', '3333', 'hr'], '技術士'),
    ce('tc_funeral', '喪禮服務', ['5192'], '技術士'),
    ce('tc_safety_mgr', '職業安全管理、職業衛生管理（甲級）', ['1323', '2291', '3123', '3295'], '技術士、職安'),
    ce('tc_safety', '職業安全衛生管理（乙級）', ['2291', '3123', '3295'], '技術士、職安'),
  ] },
  { id: 'it', name: '資訊證照', items: [
    ce('comptia_a', 'CompTIA A+', ['2522', '3512', '3513', 'it_admin'], '電腦維修'),
    ce('comptia_net', 'CompTIA Network+', ['2523', '3513', 'it_admin'], '網路'),
    ce('comptia_sec', 'CompTIA Security+', ['2529', 'security', 'mil_intel'], '資安'),
    ce('ccna', 'Cisco CCNA', ['2522', '2523', '3513', 'it_admin', 'security'], '網路'),
    ce('cloud_cert', '雲端證照（AWS、Azure、GCP）', ['2522', '2523', '2529', 'swe', 'ai_eng', 'it_admin'], '雲端'),
    ce('linux_cert', 'Linux 證照（LPIC、RHCSA）', ['2522', '3513', 'it_admin'], 'Linux'),
    ce('sec_pro', '資安進階證照（CISSP、CEH、ISO 27001 主導稽核員）', ['2522', '2529', 'security', 'mil_intel'], '資安'),
    ce('ipas', 'iPAS 產業人才能力鑑定（AI 應用規劃師、資訊安全工程師等）', ['2529', 'security', 'data', 'ai_eng', 'product', 'ai_builder'], 'iPAS、AI'),
    ce('mos', '微軟 Office 專家（MOS）', ['g:biz', '4110', '4120', 'admin'], 'Office'),
    ce('pmp', '專案管理（PMP、PMA）', ['1223', '1323', '2421', 'project', 'product'], '專案管理'),
  ] },
  { id: 'comm', name: '通訊、海事與無人機', items: [
    ce('ham', '業餘無線電人員執照（NCC）', ['3522', '7421', 'mil_comm'], '無線電、火腿'),
    ce('gmdss_goc', 'GMDSS 通用級值機員', ['3151', '3152', '3522', 'mil_comm', 'mil_ship', 'cga_ship'], 'GMDSS、海事通訊'),
    ce('gmdss_roc', 'GMDSS 限用級值機員', ['3152', '3522', 'mil_comm', 'mil_ship', 'cga_ship'], 'GMDSS、海事通訊'),
    ce('boat_license', '動力小船駕駛執照', ['605', '3152', '8350', 'cga_ship'], '小船、開船'),
    ce('seafarer', '船員證書（航行員、輪機員）', ['3151', '3152', '8350', 'mil_ship', 'cga_ship'], '船員'),
    ce('drone_license', '遙控無人機操作證（民航局）', ['2163', '3521', 'photographer'], '無人機'),
  ] },
  { id: 'drive', name: '駕照', items: [
    ce('dl_moto', '普通重型機車駕照', ['4992', '8321', 'driver'], '機車'),
    ce('dl_car_pro', '職業小型車駕照', ['5194', '8322', 'driver'], '職業駕照'),
    ce('dl_truck', '職業大貨車駕照', ['833', '8332'], '職業駕照'),
    ce('dl_bus', '職業大客車駕照', ['833', '8331'], '職業駕照'),
    ce('dl_trailer', '職業聯結車駕照', ['833', '8332'], '職業駕照'),
  ] },
  { id: 'lang', name: '語言檢定', items: [
    ce('toeic', '多益（TOEIC）', ['2433', '2643', '3331', '4221', '5111', '5113', 'translator', 'trade', 'aviation', 'hotel'], '英文'),
    ce('gept', '全民英檢（GEPT）', ['2433', '2643', '3331', '4221', '5111', '5113', 'translator', 'trade', 'aviation', 'hotel'], '英文'),
    ce('ielts', '雅思、托福', ['2433', '2643', '3331', '5111', 'translator', 'trade', 'aviation'], '英文'),
    ce('jlpt', '日檢（JLPT）', ['2643', '4221', '5113', 'translator', 'trade', 'hotel'], '日文'),
    ce('other_lang_cert', '其他語言檢定', ['2643', '4221', '5113', 'translator', 'trade', 'hotel'], '外語'),
  ] },
  { id: 'safety', name: '急救與安全', items: [
    ce('emt', '緊急救護技術員（EMT-1、EMT-2）', ['3296', '5401', 'mil_med', 'fire_staff'], 'EMT、救護'),
    ce('first_aid_cert', '急救員（CPR＋AED）', ['3296', '3422', '5111', '5310', '5320', 'caregiver', 'fitness', 'preschool'], '急救'),
    ce('lifeguard', '救生員', ['3422', '5401', 'fitness', 'cga_ship'], '救生'),
    ce('diving_cert', '潛水證照', ['7991', 'cga_ship'], '潛水'),
    ce('safety_supervisor', '職業安全衛生業務主管（甲／乙／丙種）', ['1322', '1323', '2291', '3122', '3123'], '職安'),
    ce('fire_manager', '防火管理人', ['1420', '2291', '5151', 'fire_staff'], '消防'),
  ] },
  { id: 'finance', name: '金融保險與不動產', items: [
    ce('securities', '證券商業務員、高級業務員', ['2412', '3311', 'advisor', 'analyst'], '證券'),
    ce('sitca', '投信投顧業務員', ['2412', 'advisor', 'analyst'], '投信投顧'),
    ce('insurance_life', '人身保險業務員', ['3321', 'insurance', 'advisor'], '壽險'),
    ce('insurance_prop', '產物保險業務員', ['3321', 'insurance'], '產險'),
    ce('trust', '信託業務人員', ['2412', '4211', 'advisor', 'banker'], '信託'),
    ce('financial_planner', '理財規劃人員', ['2412', 'advisor'], '理財'),
    ce('credit', '授信人員', ['3312', 'banker'], '授信'),
    ce('re_agent', '不動產營業員', ['3334', 'realestate'], '房仲'),
    ce('re_broker', '不動產經紀人', ['3334', 'realestate'], '房仲'),
    ce('land_agent', '地政士', ['2619', '3334', 'realestate'], '代書'),
  ] },
  { id: 'pro', name: '專門職業與公職', items: [
    ce('bookkeeper', '記帳士', ['2411', '3313', 'tax', 'accountant'], '記帳'),
    ce('cpa', '會計師', ['1211', '2411', 'accountant', 'finance_mgr'], '會計'),
    ce('lawyer_lic', '律師', ['2611', 'lawyer'], '法律'),
    ce('engineer_lic', '技師（電機、土木、機械等）', ['214', '215', '2142', '2151', 'civil_eng', 'hw_rd'], '技師'),
    ce('architect_lic', '建築師', ['2161'], '建築'),
    ce('med_lic', '醫事人員證書（醫師、護理師、藥師等）', ['22', '32', 'doctor', 'nurse', 'pharmacist', 'therapist', 'medtech', 'nutritionist'], '醫療'),
    ce('social_worker_lic', '社工師', ['1343', '2635', 'social'], '社工'),
    ce('psych_lic', '心理師', ['2634', 'psych'], '心理'),
    ce('teacher_lic', '教師證', ['232', '233', '234', 'teacher', 'preschool'], '老師'),
    ce('chinese_teach', '華語教學能力認證', ['2391', 'tutor', 'teacher'], '華語'),
    ce('guide_lic', '導遊、領隊執照', ['4221', '5113', 'hotel'], '導遊'),
    ce('civil_exam', '公務人員考試及格（高普考、初考、特考）', ['g:public', '1112', '335', '3359', 'civil'], '公職、國考'),
  ] },
  { id: 'design', name: '設計與媒體', items: [
    ce('adobe', 'Adobe 認證（Photoshop、Illustrator、Premiere）', ['2172', '3521', 'graphic', 'video', 'uiux'], '設計'),
  ] },
];

export const SKILLS = SKILL_GROUPS.flatMap((g) => g.items.map((x) => ({ ...x, group: g.id, groupName: g.name })));
export const CERTS = CERT_GROUPS.flatMap((g) => g.items.map((x) => ({ ...x, group: g.id, groupName: g.name })));
const SKILL_BY = new Map(SKILLS.map((x) => [x.id, x]));
const CERT_BY = new Map(CERTS.map((x) => [x.id, x]));
export const skillOf = (id) => SKILL_BY.get(id) || null;
export const certOf = (id) => CERT_BY.get(id) || null;
export const MAX_SKILLS = 40;
export const MAX_CERTS = 30;

/** 技能、證照搜尋（名稱和常見說法都比對） */
export function searchItems(list, q, limit = 30) {
  const t = norm(q);
  if (!t) return [];
  return list.map((x) => {
    const name = norm(x.name);
    const alias = norm(x.alias);
    const score = name.startsWith(t) ? 3 : name.includes(t) ? 2 : alias.includes(t) ? 1 : 0;
    return { x, score };
  }).filter((r) => r.score).sort((a, b) => b.score - a.score).slice(0, limit).map((r) => r.x);
}

// 一個工作可以被哪些代碼對到：自己的代碼、官方細類的 1～4 碼、沿用的常見工作、類別
function keysOf(job) {
  const k = new Set([job.id, `g:${job.group}`]);
  if (job.soc) for (let n = 1; n <= 4; n += 1) k.add(job.soc.slice(0, n));
  if (job.like) k.add(job.like);
  return k;
}
/** 這個工作是不是在這些代碼裡（技能、證照、科系的 for） */
export function matchesJob(job, tokens) {
  if (!job || !tokens || !tokens.length) return false;
  const k = keysOf(job);
  return tokens.some((t) => k.has(t));
}

// AI 讓入門變容易的工作：build＝寫程式、做 App（用說的就能做出能用的東西）；content＝設計、影音、文字、行銷（做作品變容易，但同行也都在用）
const AI_BUILD = ['251', '2513', '3514', 'swe', 'ai_eng', 'data', 'uiux', 'tester', 'product', 'game', 'ai_builder'];
const AI_CONTENT = ['2172', '2431', '2641', '2651', '2656', '3431', '3521', 'graphic', 'video', 'creator', 'writer', 'editor', 'marketing', 'ecom', 'illustrator', 'photographer'];
/** 'build'｜'content'｜null */
export const aiEaseOf = (job) => (matchesJob(job, AI_BUILD) ? 'build' : matchesJob(job, AI_CONTENT) ? 'content' : null);

const EDU_RANK = Object.fromEntries(EDUS.map((x) => [x.value, x.rank]));
const READY_LEVELS = [[70, '準備得差不多'], [40, '還要補一些'], [-Infinity, '要從頭準備']];

/**
 * 準備度（0～100）：你已經會的技能、證照、科系、相關經驗，對上這個工作多少。
 * 沒填技能、證照、學歷、科系任何一項時回傳 null：只靠「現在做什麼」算出來的數字會誤導。
 * @param job jobOf 的結果；prof：{ skills, certs, edu, major, from（現在的工作）, related（現在的工作對得上的民間工作代碼） }
 */
export function readinessOf(job, { skills = [], certs = [], edu = '', major = '', from = null, related = [] } = {}) {
  if (!job || job.status) return null;
  if (!skills.length && !certs.length && !edu && !major) return null;
  const haveSkills = skills.map(skillOf).filter((s) => s && matchesJob(job, s.for));
  const haveCerts = certs.map(certOf).filter((c) => c && matchesJob(job, c.for));
  const majorFit = !!major && matchesJob(job, MAJOR_FOR[major] || []);
  const sameField = !!from && !from.status && from.id !== job.id
    && (from.group === job.group || related.includes(job.id) || (!!from.soc && !!job.soc && from.soc.slice(0, 3) === job.soc.slice(0, 3)));
  // 相關的實務經驗（同一類工作、軍警專長對應的民間工作）和一項技能差不多重：做了十幾年的人，不該因為沒證照就被算成「還要補很多」
  let pct = 10 + Math.min(3, haveSkills.length) * 20 + Math.min(2, haveCerts.length) * 20 + (majorFit ? 15 : 0) + (sameField ? 20 : 0);
  const gaps = [];
  // 學歷門檻：專業人員、主管多半要大學；養成期長的（國考、研究所）要相關科系。用 AI 做 App 這類不看學歷
  const er = EDU_RANK[edu] || 0;
  const build = aiEaseOf(job) === 'build';
  if (edu && job.long === 'grad' && er < 5) {
    pct = Math.min(pct, 35);
    gaps.push('通常要研究所以上學歷。');
  } else if (edu && job.long && !majorFit) {
    pct = Math.min(pct, 40);
    gaps.push('要相關科系的學歷才能考照（可以讀學士後、在職專班）。');
  } else if (edu && job.tier === 4 && er < 4) {
    // 寫程式、做 App 這一行看作品和實力，不設上限，但照實講徵才條件
    if (build) gaps.push('徵才常寫大學以上，但這一行看作品和實力：先做出能用的作品，學歷可以邊做邊補。');
    else {
      pct = Math.min(pct, 50);
      gaps.push('多半要大學以上學歷：可以讀二技、在職專班或空中大學補上。');
    }
  }
  pct = Math.max(5, Math.min(95, Math.round(pct)));
  // 可以考的證照：對得上這個工作、你還沒有的，列兩張
  const suggestCerts = CERTS.filter((c) => !certs.includes(c.id) && matchesJob(job, c.for)).slice(0, 2);
  return {
    pct,
    level: READY_LEVELS.find(([min]) => pct >= min)[1],
    haveSkills: haveSkills.map((s) => s.name),
    haveCerts: haveCerts.map((c) => c.name),
    majorFit,
    sameField,
    gaps,
    suggestCerts: suggestCerts.map((c) => c.name),
  };
}

// ── 軍職、警職：專長在民間對應什麼工作、怎麼轉、年資和退休金
/** 軍警專長 → 民間對得上的工作（本 App 依工作內容整理；退輔會也在建置官方的「軍民專長轉銜對照」） */
export const MIL_CIVIL = {
  mil_comm: ['3522', '3512', '3513', '7421', '2523', '2153', 'it_admin', 'security'],
  mil_admin: ['admin', '4110', '3341', 'civil', 'hr', '2422'],
  mil_logi: ['logistics', '4321', '1324', 'purchase', '3323', '8332'],
  mil_fin: ['accountant', '4311', '3313', 'finance_mgr', 'tax'],
  mil_pol: ['social', '3412', 'hr', 'pr', 'trainer', '2635'],
  mil_med: ['3296', 'nurse', 'caregiver', '5320', 'medtech'],
  mil_eng: ['3123', 'civil_eng', '8342', '8343', '9312', '7212'],
  mil_mech: ['7231', '7233', 'machinist', 'mechanic', '8201', '3115'],
  mil_avia: ['7232', '3115', '3155', 'machinist', 'qa'],
  mil_ship: ['3151', '3152', '8350', '7233', 'cga_ship'],
  mil_intel: ['security', '2529', 'analyst', 'data', '3355'],
  mil_combat: ['5404', 'pol_patrol', 'fitness', '3422', 'logistics', 'manager'],
  mil_pilot: ['3153', '3154', 'aviation'],
  mil_train: ['trainer', '2422', 'fitness', '3422', 'teacher'],
  cga_patrol: ['5404', '3351', 'pol_patrol', 'logistics', '3295'],
  cga_ship: ['3152', '3151', '8350', '7991', '6052'],
  cga_police: ['pol_crime', '3355', '3351', 'lawyer', '3411'],
  pol_patrol: ['5404', '3351', 'driver', 'civil'],
  pol_crime: ['3355', '3411', 'lawyer', 'security', 'analyst'],
  pol_office: ['admin', 'it_admin', 'civil', '4323'],
  fire_staff: ['2291', '3295', '3296', '5404'],
};
/** 軍警專長預設的身分（可以在表單改） */
export const SERVICE_OF = (job) => {
  if (!job) return '';
  if (job.id.startsWith('mil_') || job.id === 'cga_patrol' || job.id === 'cga_ship' || job.id === '0100') return 'mil';
  if (job.id.startsWith('pol_') || ['cga_police', 'fire_staff', 'police', '5401', '5402', '5403'].includes(job.id)) return 'police';
  if (['civil', '3359', '1112'].includes(job.id) || (job.soc && job.soc.startsWith('335'))) return 'civil';
  return '';
};
/** 要不要問身分、年資：軍警消、公務員這幾類 */
export const asksService = (job) => !!job && (job.group === 'military' || SERVICE_OF(job) !== '');

/**
 * 年資和退休金：軍職服現役滿 20 年才能請領月退俸（2018 年修正的《陸海空軍軍官士官服役條例》）；
 * 警職、文職的月退看年資和起支年齡，條件複雜，只提醒先請人事單位試算，不自己算。
 * @returns {{id:'ok'|'wait'|'early'|'civil', tone:string, text:string, toGo?:number, year?:number}|null}
 */
export function pensionOf({ service = '', years = '', thisYear = null }) {
  if (years === '' || years === null || years === undefined) return null;
  const y = Number(years);
  if (!Number.isFinite(y)) return null;
  if (service === 'mil') {
    if (y >= 20) return { id: 'ok', tone: 'good', text: '服現役已滿 20 年，可以請領月退俸（金額依官階、年資計算）：轉換的財務壓力小很多。' };
    const toGo = 20 - y;
    const year = thisYear !== null ? thisYear + toGo : null;
    if (y >= 10) {
      return { id: 'wait', tone: 'bad', toGo, year,
        text: `再 ${toGo} 年${year ? `（${year} 年）` : ''}服滿 20 年才能請領月退俸；現在離開只能依規定領一次退伍金。兩種差距可能很大，先請人事單位試算再決定。` };
    }
    return { id: 'early', tone: 'info', toGo, year, text: '離月退的門檻（服現役滿 20 年）還遠：確定要轉的話，越早轉越容易；未滿 20 年離開不能領月退俸。' };
  }
  if (service === 'police' || service === 'civil') {
    return { id: 'civil', tone: 'info', text: '公務人員的月退要看年資和起支年齡（警察、消防等危勞職務另有規定）：離職前先請人事單位試算，再決定什麼時候轉。' };
  }
  return null;
}

/** 軍職轉換的管道（以當年規定、簡章為準） */
export const MIL_CHANNELS = [
  { title: '退除役特考', text: '分三等、四等，類科每年依需求開（例如一般行政、資訊處理）。及格後分發到國防部、退輔會、海洋委員會（含海巡署）等機關，有一段期間不能轉調。' },
  { title: '國營事業招考', text: '台電、中油、中華電信等，電機、電子、資訊類的職缺多，軍中的通信、機電專長用得上。' },
  { title: '退輔會', text: '職業訓練補助、就業媒合（各縣市榮民服務處），也有報考國家考試或公營事業的補習、購書補助。' },
  { title: '換成民間認得的證照', text: '軍中的專長要換成民間看得懂的證明，例如電腦硬體裝修、網路架設、通信技術等技術士。' },
];

/** 存進名單前的白名單：只收清單裡有的代碼，去重複、限數量 */
export const pickCodes = (raw, has, max) => {
  const out = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    if (typeof v === 'string' && has(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
};
export const hasSkill = (id) => SKILL_BY.has(id);
export const hasCert = (id) => CERT_BY.has(id);
