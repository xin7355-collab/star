// 紫微斗數：雙主星組合、三方四正、命宮常見格局。輸入是 ziwei.js 的 buildZiwei 結果（不需要 iztro）。
//
// 三方四正：本宮、對宮（+6）與兩個三合宮（±4）。看一宮不能只看本宮，四個宮的星曜、四化、吉煞要合起來看。
// 空宮（沒有主星）借對宮主星來看；四化與輔星只算它真正所在的宮，不跟著借（避免同一顆化忌被算兩次）。
// 格局條件取各派共通、最常見的定義；文字為本 App 撰寫的白話說明，僅供參考。

// 14 主星兩兩同宮只有 24 種組合（紫微、天機、太陽、武曲、天同、廉貞各自固定和哪些星同宮）
export const PAIR_TEXT = {
  紫微天府: '「紫府同宮」：帝星加庫星，主導力和守成力兼具，穩重大方、重面子也重實利；兩顆尊星都要人尊重，容易固執、放不下身段。',
  紫微貪狼: '「紫貪同宮」：有領導魅力又多才多藝、交際手腕好，企圖心與慾望都強；要節制享樂，感情上的誘惑也要有分寸。',
  紫微天相: '「紫相同宮」：有威嚴又講公平，擅長協調、重形象與規矩，適合在組織裡管制度；容易太在意別人的評價。',
  紫微七殺: '「紫殺同宮」：帝星駕馭將星（化殺為權），魄力十足、能獨當一面，是開創型的領導者；個性急、不服輸，人生起落較大。',
  紫微破軍: '「紫破同宮」：敢破舊立新、想做大事，有改革者的氣勢；喜新厭舊、變動多，需要明確的方向才不會反覆。',
  天機太陰: '「機陰同宮」：聰明細膩、心思敏感，擅長企劃與理財，適合幕僚、文職、規劃型工作；想太多時容易多愁善感、搖擺不定。',
  天機巨門: '「機巨同宮」：思考快、口才好、分析力強，適合研究、教學、法律、顧問；容易多疑，說話太直會招惹口舌。',
  天機天梁: '「機梁同宮」：善謀略、愛講道理，有軍師與顧問的特質，適合策劃、教育、宗教哲學；要避免紙上談兵、管太多閒事。',
  太陽太陰: '「日月同宮」：陰陽並見，熱情與細膩兼具、能文能武；內心常在外向與內向之間拉扯，情緒起伏較大。',
  太陽巨門: '「陽巨同宮」：表達力與說服力出色，適合以口為業（教學、業務、法律、媒體）；巨門的是非由太陽照亮，坦白比辯解有效。',
  太陽天梁: '「陽梁同宮」：正直熱心、有長者風範，重名聲，適合公職、醫療、教育；容易熱心過頭、愛說教。',
  武曲天府: '「武府同宮」：財星加庫星，賺錢與守財能力都強，務實穩健，適合金融、財務、經營；保守，對錢與安全感很在意。',
  武曲貪狼: '「武貪同宮」：財星遇上慾望之星，企圖心強、敢賺錢，多半先苦後甘（傳統說「武貪不發少年人」），中年以後才發；年輕時先累積實力。',
  武曲天相: '「武相同宮」：執行力加協調力，有原則、肯負責，適合財務管理、行政、專業技術；有時太硬，要學柔軟。',
  武曲七殺: '「武殺同宮」：果決剛毅、行動力極強，適合需要魄力與技術的工作；錢財起伏大，凡事留退路，也要留意意外受傷。',
  武曲破軍: '「武破同宮」：衝勁十足、敢冒險，適合變化大的行業或技術；財運起伏、常先破後成，理財宜保守。',
  天同太陰: '「同陰同宮」：溫柔體貼、重感情與生活品味，人緣好，適合服務、藝術、照顧人的工作；依賴心與惰性要靠目標克服。',
  天同巨門: '「同巨同宮」：外表隨和、內心多慮，敏感容易擔心，適合需要細心與口才的工作；擔心要說出來，不要悶在心裡。',
  天同天梁: '「同梁同宮」：福星加蔭星，心地善良、有長輩緣，喜歡照顧人，適合公益、醫療、教育；容易安逸、缺少衝勁。',
  廉貞天府: '「廉府同宮」：精明能幹又穩重，擅長經營與管理資源，社交手腕好；重實際利益，有時給人城府深的感覺。',
  廉貞貪狼: '「廉貪同宮」：兩顆桃花星同宮，魅力十足、多才多藝、交際廣，適合公關、娛樂、業務；感情與慾望要有分寸。',
  廉貞天相: '「廉相同宮」：有原則又懂變通，適合法務、行政、管理；天相約束了廉貞的情緒，做事有分寸、重信用。',
  廉貞七殺: '「廉殺同宮」：意志堅定、肯拚肯吃苦，常白手起家；個性剛強、容易積勞，要顧健康，也別和人硬碰硬。',
  廉貞破軍: '「廉破同宮」：勇於突破、不按牌理出牌，適合開創、技術或競爭激烈的領域；變動大、情緒強，凡事三思而後行。',
};

const LUCKY = ['左輔', '右弼', '文昌', '文曲', '天魁', '天鉞', '祿存'];
const SHA = ['擎羊', '陀羅', '火星', '鈴星', '地空', '地劫'];
const MUTAGEN_SCORE = { 化祿: 2, 化權: 1, 化科: 1, 化忌: -2 };

/** 兩顆主星同宮的組合說明；不是雙星就回傳 null */
export function pairText(major) {
  if (!major || major.length !== 2) return null;
  const [a, b] = major.map((s) => s.name || s);
  return PAIR_TEXT[a + b] || PAIR_TEXT[b + a] || null;
}

const atIndex = (z, i) => z.palaces.find((p) => p.index === ((i % 12) + 12) % 12);
/** 這一宮看的主星：空宮借對宮 */
function majorOf(z, p) {
  if (p.major.length) return { stars: p.major, borrowed: false };
  return { stars: atIndex(z, p.index + 6).major, borrowed: true };
}

/**
 * 三方四正：本宮、對宮、兩個三合宮。
 * @returns {{list, mutagens, lucky, sha, score, tone, text}}
 */
export function sanFang(z, pal) {
  const list = [
    { role: '本宮', p: pal },
    { role: '對宮', p: atIndex(z, pal.index + 6) },
    { role: '三合', p: atIndex(z, pal.index + 4) },
    { role: '三合', p: atIndex(z, pal.index + 8) },
  ].map(({ role, p }) => ({ role, palace: p, ...majorOf(z, p) }));
  const pick = (names) => list.flatMap(({ role, palace }) => palace.minor.filter((s) => names.includes(s.name)).map((s) => ({ star: s.name, palace: palace.name, role })));
  const mutagens = list.flatMap(({ role, palace }) => [...palace.major, ...palace.minor].filter((s) => s.mutagen).map((s) => ({ star: s.name, mutagen: s.mutagen, palace: palace.name, role })));
  const lucky = pick(LUCKY);
  const sha = pick(SHA);
  const score = lucky.length - sha.length + mutagens.reduce((a, m) => a + (MUTAGEN_SCORE[m.mutagen] || 0), 0);
  const tone = score >= 3 ? 'good' : score <= -2 ? 'bad' : 'mid';
  const text = {
    good: '三方四正吉多於凶：這一宮管的事容易得到助力，可以積極經營。',
    mid: '三方四正吉凶參半：有助力也有阻力，看自己怎麼取捨。',
    bad: '三方四正凶多於吉：這一宮管的事波折較多，宜保守、預留退路。',
  }[tone];
  return { list, mutagens, lucky, sha, score, tone, text };
}

/**
 * 命宮常見格局（各派共通、條件明確的二十多種）。
 * @returns {{name, tone:'good'|'bad'|'mixed', text}[]}
 */
export function mingPatterns(z) {
  const ming = z.palaces.find((p) => p.name === '命宮');
  if (!ming) return [];
  const sf = sanFang(z, ming);
  const majors = new Set(sf.list.flatMap((x) => x.stars.map((s) => s.name)));
  const minors = new Set(sf.list.flatMap((x) => x.palace.minor.map((s) => s.name)));
  const mingMajor = majorOf(z, ming).stars.map((s) => s.name);
  const has = (p, name) => p.major.some((s) => s.name === name) || p.minor.some((s) => s.name === name);
  const sides = [atIndex(z, ming.index - 1), atIndex(z, ming.index + 1)];
  const flank = (a, b) => (has(sides[0], a) && has(sides[1], b)) || (has(sides[0], b) && has(sides[1], a));
  const mut = (m) => sf.mutagens.some((x) => x.mutagen === m);
  const out = [];
  const add = (name, tone, text) => out.push({ name, tone, text });

  if (!ming.major.length) add('命無正曜', 'mixed', `命宮沒有主星，借遷移宮的${mingMajor.join('、') || '星曜'}來看：適應力強、受環境影響大，也容易搖擺，選對環境和身邊的人特別重要。`);
  if (mingMajor.some((n) => ['七殺', '破軍', '貪狼'].includes(n))) add('殺破狼', 'mixed', '命宮坐七殺、破軍或貪狼（三顆星永遠在三方四正互相照會）：一生變動多、開創性強，適合挑戰與改變，不適合一成不變；起伏大，要有長期目標穩住。');
  else if (['天機', '太陰', '天同', '天梁'].every((n) => majors.has(n))) add('機月同梁', 'good', '命宮三方四正由天機、太陰、天同、天梁組成：適合在制度裡穩定發展（公職、企業內勤、專業幕僚），按部就班比冒險創業更有利。');
  const others = sf.list.slice(1).flatMap((x) => x.palace.major.map((s) => s.name));
  if (!mingMajor.includes('天府') && !mingMajor.includes('天相') && others.includes('天府') && others.includes('天相')) add('府相朝垣', 'good', '天府、天相從三方照入命宮：衣食穩定、有資源與貴人，適合在穩定的組織裡發揮。');
  if (mingMajor.includes('紫微') && ming.major.length && minors.has('左輔') && minors.has('右弼')) add('君臣慶會', 'good', '紫微坐命又會左輔、右弼：帝星有臣子輔佐，領導力能真正發揮，做事有人跟、有人幫。');
  if (mut('化祿') && mut('化權') && mut('化科')) add('三奇嘉會', 'good', '生年化祿、化權、化科都在命宮的三方四正：名、利、權都有機會兼得，是相當好的組合。');
  if (minors.has('祿存') && mut('化祿')) add('雙祿朝垣', 'good', '祿存和化祿都在三方四正：財源不只一條，越經營越有。');
  const luMa = sf.list.find((x) => has(x.palace, '天馬') && (has(x.palace, '祿存') || [...x.palace.major, ...x.palace.minor].some((s) => s.mutagen === '化祿')));
  if (luMa) add('祿馬交馳', 'good', `祿星和天馬同在${luMa.palace.name}：財和「動」結合，越跑越有，適合業務、外勤、貿易、常出差或到外地發展。`);
  if (minors.has('天魁') && minors.has('天鉞')) add('天乙拱命', 'good', '天魁、天鉞都在三方四正：一生常遇貴人提拔，關鍵時刻有人幫。');
  if (flank('左輔', '右弼')) add('左右夾命', 'good', '左輔、右弼在命宮兩側：人緣與助力好，做事容易有人幫忙。');
  if (flank('文昌', '文曲')) add('昌曲夾命', 'good', '文昌、文曲在命宮兩側：聰明好學、有文采，考試與文書運佳。');
  if (majors.has('太陽') && majors.has('天梁') && minors.has('文昌') && (minors.has('祿存') || mut('化祿'))) add('陽梁昌祿', 'good', '太陽、天梁、文昌與祿星會在三方四正：傳統上利於考試、升學、證照與公職。');
  const juMen = ming.major.find((s) => s.name === '巨門');
  if (['子', '午'].includes(ming.branch) && juMen && (['化祿', '化權', '化科'].includes(juMen.mutagen) || has(ming, '祿存'))) add('石中隱玉', 'good', '巨門在子午坐命又見祿權科：像石頭裡藏著玉，年輕時不顯，越磨越亮；宜低調累積實力。');
  if (ming.branch === '卯' && ming.major.some((s) => s.name === '太陽')) add('日照雷門', 'good', '太陽在卯宮坐命（旭日東昇）：光明積極、名聲容易打開。');
  if (ming.branch === '亥' && ming.major.some((s) => s.name === '太陰')) add('月朗天門', 'good', '太陰在亥宮坐命（月亮最亮的位置）：細膩聰慧，財運與人緣都好。');
  const sunAt = z.palaces.find((p) => p.major.some((s) => s.name === '太陽'));
  const moonAt = z.palaces.find((p) => p.major.some((s) => s.name === '太陰'));
  if (ming.branch === '未' && !ming.major.length && sunAt?.branch === '卯' && moonAt?.branch === '亥') add('明珠出海', 'good', '命宮在未沒有主星，太陽在卯、太陰在亥從三方照入：日月並明，前程光明。');
  for (const [fire, label] of [['火星', '火貪格'], ['鈴星', '鈴貪格']]) {
    const hit = sf.list.find((x) => x.palace.major.some((s) => s.name === '貪狼') && has(x.palace, fire));
    if (hit) add(label, 'mixed', `貪狼和${fire}同在${hit.palace.name}：容易有突然的好機會或爆發性的收穫；來得快也去得快，賺到要守得住。`);
  }
  if (has(ming, '祿存') && [...ming.major, ...ming.minor].some((s) => s.mutagen === '化忌')) add('羊陀夾忌', 'bad', '命宮有化忌又被擎羊、陀羅夾住：容易進退兩難、壓力大，凡事多一份耐心，重大決定不要急。');
  if (flank('地空', '地劫')) add('空劫夾命', 'bad', '地空、地劫在命宮兩側：想法天馬行空、人生容易起落，理財要保守、不宜投機。');
  if (has(ming, '廉貞') && has(ming, '天相') && has(ming, '擎羊')) add('刑囚夾印', 'bad', '廉貞、天相同在命宮又遇擎羊：容易捲入是非或法律糾紛，簽約、作保要特別小心。');
  const luKong = sf.list.find((x) => (has(x.palace, '祿存') || [...x.palace.major, ...x.palace.minor].some((s) => s.mutagen === '化祿')) && (has(x.palace, '地空') || has(x.palace, '地劫')));
  if (luKong) add('祿逢空劫', 'bad', `${luKong.palace.name}的祿星遇到地空、地劫：錢容易來了又去，存錢要靠紀律與自動扣款。`);
  return out;
}
