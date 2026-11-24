// 生命靈數（台灣常見算法）：西元生日的每一位數字相加，再一直相加到個位數。
// 例：1990-08-15 → 1+9+9+0+0+8+1+5 = 33 → 3+3 = 6，寫成「33／6」。
// 九宮格：生日出現的數字 1～9（0 不算）；連線名稱為台灣常見說法，各派名稱略有不同。
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
  { nums: [1, 2, 3], name: '藝術線' },
  { nums: [4, 5, 6], name: '組織線' },
  { nums: [7, 8, 9], name: '權力線' },
  { nums: [1, 4, 7], name: '物質線' },
  { nums: [2, 5, 8], name: '感情線' },
  { nums: [3, 6, 9], name: '智慧線' },
  { nums: [1, 5, 9], name: '事業線' },
  { nums: [3, 5, 7], name: '人緣線' },
];

const digitsOf = ({ y, m, d }) => `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`.split('').map(Number);

export function lifePath(date) {
  const digits = digitsOf(date);
  const chain = [digits.reduce((a, b) => a + b, 0)];
  while (chain[chain.length - 1] > 9) {
    chain.push(String(chain[chain.length - 1]).split('').reduce((a, c) => a + Number(c), 0));
  }
  const number = chain[chain.length - 1];
  return { total: chain[0], number, chain, label: chain.join('／'), ...MEANINGS[number] };
}

export function grid(date) {
  const counts = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, 0]));
  for (const n of digitsOf(date)) if (n >= 1) counts[n] += 1;
  const lines = LINES.filter((l) => l.nums.every((n) => counts[n] > 0));
  const missing = Object.keys(counts).map(Number).filter((n) => counts[n] === 0);
  return { counts, lines, missing };
}
