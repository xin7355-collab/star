// 生命靈數（台灣常見算法）：西元生日的每一位數字相加，再一直相加到個位數。
// 例：1990-08-15 → 1+9+9+0+0+8+1+5 = 33 → 3+3 = 6，寫成「33／6」；33 是天賦數（拆成 3、3 看）。
// 九宮格：生日出現的數字 1～9（0 不算），排成 3 6 9／2 5 8／1 4 7；連線名稱為台灣常見說法，各派略有不同。
// 有些老師會把天賦數、生命數也圈進九宮格，連線和空缺會不一樣：App 不替使用者選邊，兩種都算、並列。
// 解說文字為本 App 撰寫，僅供參考。

export const MEANINGS = {
  1: { title: '開創者', text: '獨立、有主見、行動快，適合帶頭開路；學習聽別人的意見會更順。' },
  2: { title: '協調者', text: '細膩體貼、重合作，是很好的夥伴；記得也照顧自己的需要。' },
  3: { title: '表達者', text: '樂觀、有創意、喜歡交流，靠說話與作品發光；專注力是功課。' },
  4: { title: '建構者', text: '踏實可靠、重規劃與紀律，擅長把事情做穩；保留一點彈性。' },
  5: { title: '自由者', text: '好奇、愛變化與冒險，學習力強；穩定下來會更有成果。' },
  6: { title: '照顧者', text: '有責任感、重家庭與美感，願意付出；別把所有責任都扛在身上。' },
  7: { title: '探索者', text: '愛思考、追求真理，獨處時最有洞見；試著把信任交給別人。' },
  8: { title: '實踐者', text: '目標導向、有管理與理財能力，重成就；權力與關係要平衡。' },
  9: { title: '理想者', text: '心胸寬廣、有同理心，願意為更大的目標努力；學會好好收尾。' },
};

export const LINES = [
  { nums: [1, 2, 3], name: '藝術線', text: '有創意與美感，想法豐富，適合設計、藝術、表達相關的事。' },
  { nums: [4, 5, 6], name: '組織線', text: '有規劃與組織能力，做事有條理，適合管理、企劃、行政。' },
  { nums: [7, 8, 9], name: '權力線', text: '企圖心與領導力強，想掌握主導權，適合帶團隊、經營事業。' },
  { nums: [1, 4, 7], name: '物質線', text: '務實、重視物質與安全感，執行力強，懂得把想法落地、把錢存下來。' },
  { nums: [2, 5, 8], name: '感情線', text: '重感情、同理心強，對人很敏感，也容易為感情所困。' },
  { nums: [3, 6, 9], name: '智慧線', text: '頭腦清楚，思考與學習能力強，擅長分析與規劃。' },
  { nums: [1, 5, 9], name: '事業線', text: '有毅力與事業心，目標明確，能堅持到底。' },
  { nums: [3, 5, 7], name: '人緣線', text: '人緣好、懂得和人相處，容易得到別人的幫忙。' },
];

// 空缺數：九宮格裡沒出現的數字，是這輩子要練習的功課（不是缺點）
export const MISSING_TEXT = {
  1: '不習慣主動出頭，做決定容易猶豫；練習相信自己、把想法說出來。',
  2: '不太擅長察言觀色與配合，容易我行我素；練習多聽、多體諒。',
  3: '心裡有想法卻不容易說出口；練習表達，寫下來也算。',
  4: '比較缺規劃與耐心，容易虎頭蛇尾；練習訂計畫、建立紀律。',
  5: '怕改變、不愛冒險，彈性較小；練習嘗試新事物、接受變化。',
  6: '比較少把心力放在家庭與責任上；練習承擔與關懷身邊的人。',
  7: '比較少深入思考，容易跟著別人走；練習培養自己的判斷與信念。',
  8: '對金錢與權力比較不敏感；練習理財、建立企圖心與界線。',
  9: '比較少從大局著想，或不擅長收尾；練習同理別人、把事情做完整。',
};
// 同一個數字出現三次以上：特質強到容易過頭
export const MANY_TEXT = {
  1: '主見非常強，容易固執、聽不進別人的話。',
  2: '非常敏感、在意別人，容易猶豫、被情緒牽著走。',
  3: '想法和話都很多，容易想太多、說太多，三分鐘熱度。',
  4: '非常重規矩，容易僵化、不知變通。',
  5: '非常愛自由與變化，容易定不下來。',
  6: '責任感過重，容易操心、管太多。',
  7: '想得很深也想太多，容易懷疑、把自己關起來。',
  8: '企圖心與控制欲都強，容易太看重金錢與權力。',
  9: '理想與同理心很強，容易犧牲自己、過度付出。',
};

const digitsOf = ({ y, m, d }) => `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`.split('').map(Number);
const sumDigits = (n) => String(n).split('').reduce((a, c) => a + Number(c), 0);

export function lifePath(date) {
  const digits = digitsOf(date);
  const chain = [digits.reduce((a, b) => a + b, 0)];
  while (chain[chain.length - 1] > 9) chain.push(sumDigits(chain[chain.length - 1]));
  const number = chain[chain.length - 1];
  // 天賦數：第一次加總的兩位數，拆成兩個數字看（加總只有一位數時沒有天賦數）
  const talent = chain[0] > 9 ? String(chain[0]).split('').map(Number) : [];
  return { total: chain[0], number, chain, label: chain.join('／'), talent, ...MEANINGS[number] };
}

function gridOf(nums) {
  const counts = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, 0]));
  for (const n of nums) if (n >= 1) counts[n] += 1;
  const lines = LINES.filter((l) => l.nums.every((n) => counts[n] > 0));
  const missing = Object.keys(counts).map(Number).filter((n) => counts[n] === 0);
  const many = Object.keys(counts).map(Number).filter((n) => counts[n] >= 3);
  return { counts, lines, missing, many };
}

/** 九宮格：只圈生日數字 */
export function grid(date) {
  return gridOf(digitsOf(date));
}

/** 另一派：生日數字之外，天賦數與生命數也圈進九宮格 */
export function gridWithTalent(date) {
  const lp = lifePath(date);
  return gridOf([...digitsOf(date), ...lp.talent, lp.number]);
}
