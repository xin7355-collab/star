// 開運佈置：財庫在哪裡、家裡與辦公室的財位、該擺什麼（水晶、魚、植物、花）、要避開什麼。
//
// 資料來源都是民俗風水的通行說法，畫面上會講明「參考，不是保證」：
// ・命裡的財庫：八字看財星的「庫」（辰戌丑未）有沒有、有沒有被沖開；紫微看田宅宮（傳統稱為財庫）。
// ・個人吉方：八宅派「命卦」。男命＝11－出生年數字和、女命＝4＋出生年數字和（反覆加到個位數，年以立春為界）；
//   算出 5 時男歸坤（2）、女歸艮（8）。方位表與網路上多個來源核對一致（見 docs/DECISIONS.md）。
// ・今年的財位與煞位：九宮飛星。年中宮星＝(11－西元年 mod 9) mod 9（0 當 9），依洛書順序飛到八方。
// ・明財位：進門的斜對角，不用羅盤也找得到。
// ・擺設：依喜用五行（bazi.js 的 yongShen）挑顏色、材質、水晶、植物、花，決定適不適合養魚。

import { Solar, LunarYear } from '../../vendor/lunar.js';
import { tw } from './zh.js';
import { yearGanZhi, yongShen, avoidReason } from './bazi.js';
import { ZIWEI_STARS } from './reading-texts.js';
import { KUA_STAR_DETAIL } from './fengshui-fix.js';

const DIRS = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];

// 命卦：卦名、東西四命、八個方位（生氣、天醫、延年、伏位為吉；禍害、六煞、五鬼、絕命為凶）
const KUA = {
  1: { name: '坎', group: '東四命', 生氣: '東南', 天醫: '東', 延年: '南', 伏位: '北', 禍害: '西', 六煞: '西北', 五鬼: '東北', 絕命: '西南' },
  2: { name: '坤', group: '西四命', 生氣: '東北', 天醫: '西', 延年: '西北', 伏位: '西南', 禍害: '東', 六煞: '南', 五鬼: '東南', 絕命: '北' },
  3: { name: '震', group: '東四命', 生氣: '南', 天醫: '北', 延年: '東南', 伏位: '東', 禍害: '西南', 六煞: '東北', 五鬼: '西北', 絕命: '西' },
  4: { name: '巽', group: '東四命', 生氣: '北', 天醫: '南', 延年: '東', 伏位: '東南', 禍害: '西北', 六煞: '西', 五鬼: '西南', 絕命: '東北' },
  6: { name: '乾', group: '西四命', 生氣: '西', 天醫: '東北', 延年: '西南', 伏位: '西北', 禍害: '東南', 六煞: '北', 五鬼: '東', 絕命: '南' },
  7: { name: '兌', group: '西四命', 生氣: '西北', 天醫: '西南', 延年: '東北', 伏位: '西', 禍害: '北', 六煞: '東南', 五鬼: '南', 絕命: '東' },
  8: { name: '艮', group: '西四命', 生氣: '西南', 天醫: '西北', 延年: '西', 伏位: '東北', 禍害: '南', 六煞: '東', 五鬼: '北', 絕命: '東南' },
  9: { name: '離', group: '東四命', 生氣: '東', 天醫: '東南', 延年: '北', 伏位: '南', 禍害: '東北', 六煞: '西南', 五鬼: '西', 絕命: '西北' },
};
export const KUA_STARS = [
  { key: '生氣', good: true, use: '財運、事業、升遷', tip: '辦公桌面向這裡、大門或常待的位置在這裡最好' },
  { key: '天醫', good: true, use: '健康、貴人', tip: '適合床頭或長輩房' },
  { key: '延年', good: true, use: '感情、人際、婚姻', tip: '適合主臥或約會、談合作時坐的方向' },
  { key: '伏位', good: true, use: '穩定、讀書、靜心', tip: '適合書桌、神明桌' },
  { key: '禍害', good: false, use: '小是非、小病痛', tip: '放雜物、浴室較無妨' },
  { key: '六煞', good: false, use: '爛桃花、人際糾紛', tip: '避免當臥房或辦公座位' },
  { key: '五鬼', good: false, use: '口舌、意外、小人', tip: '避免長時間待著，保持整潔' },
  { key: '絕命', good: false, use: '大破財、重病（最凶）', tip: '適合廁所、儲藏室，不要放床和辦公桌' },
];

function digitRoot(n) {
  let x = Math.abs(n);
  while (x > 9) x = String(x).split('').reduce((a, c) => a + Number(c), 0);
  return x;
}

/** 以立春為界的年份（例如 2026-02-03 還算 2025 年） */
export function liChunYear({ y, m, d }) {
  const gz = Solar.fromYmd(y, m, d).getLunar().getYearInGanZhiByLiChun();
  return gz === yearGanZhi(y) ? y : y - 1;
}

/** 命卦數（1～9，沒有 5）；性別不明回傳 null */
export function kuaNumber(year, gender) {
  if (gender !== '男' && gender !== '女') return null;
  const s = digitRoot(year);
  let k = gender === '男' ? digitRoot(11 - s) : digitRoot(4 + s);
  if (k === 5) k = gender === '男' ? 2 : 8;
  return k;
}

export function personalDirections(birth, gender) {
  const year = liChunYear(birth);
  const k = kuaNumber(year, gender);
  if (!k) return null;
  const t = KUA[k];
  return { kua: k, name: `${t.name}卦`, group: t.group, year, stars: KUA_STARS.map((s) => ({ ...s, ...KUA_STAR_DETAIL[s.key], dir: t[s.key] })) };
}

// ── 九宮飛星
const STAR_INFO = {
  1: { name: '一白貪狼', kind: 'good', theme: '人緣、桃花、貴人', tip: '保持整潔，可以擺水種植物或小魚缸，人緣更好' },
  2: { name: '二黑巨門', kind: 'bad', theme: '病符，小病痛、身體容易累', tip: '放銅葫蘆或金屬擺件化解；不要放紅色東西，避免動土' },
  3: { name: '三碧祿存', kind: 'bad', theme: '是非口舌、官司爭執', tip: '放紅色小物或紅色地墊化解；這裡不要放綠色植物' },
  4: { name: '四綠文曲', kind: 'good', theme: '文昌，考試、升職、讀書', tip: '書桌放這裡，或擺四支水養的富貴竹' },
  5: { name: '五黃廉貞', kind: 'bad', theme: '五黃煞，意外、破財、重病（最凶）', tip: '保持安靜、不要動土裝修；放銅葫蘆、六帝錢等金屬化解；千萬別放紅色或點燈' },
  6: { name: '六白武曲', kind: 'good', theme: '偏財、貴人、權力', tip: '保持明亮，可以擺金屬或黃色系擺件' },
  7: { name: '七赤破軍', kind: 'bad', theme: '破財、口舌、防小偷', tip: '放一杯清水或藍黑色物品化解，門窗留意安全' },
  8: { name: '八白左輔', kind: 'good', theme: '正財、置產（傳統財星）', tip: '擺黃水晶、聚寶盆或陶瓷擺件，保持乾淨明亮' },
  9: { name: '九紫右弼', kind: 'good', theme: '喜慶、名聲', tip: '擺紅色、紫色物品或綠色植物，燈要亮' },
};
// 洛書飛行順序：中宮 → 西北 → 西 → 東北 → 南 → 北 → 西南 → 東 → 東南
const FLY_ORDER = ['中', '西北', '西', '東北', '南', '北', '西南', '東', '東南'];
const ZHI_DIR = { 子: '北', 丑: '東北', 寅: '東北', 卯: '東', 辰: '東南', 巳: '東南', 午: '南', 未: '西南', 申: '西南', 酉: '西', 戌: '西北', 亥: '西北' };
const OPPOSITE = { 北: '南', 南: '北', 東: '西', 西: '東', 東北: '西南', 西南: '東北', 東南: '西北', 西北: '東南' };

/** 某顆星入中宮後，依洛書順序飛到八方 */
function flyFrom(center) {
  const at = {};
  FLY_ORDER.forEach((dir, i) => {
    at[dir] = ((center - 1 + i) % 9) + 1;
  });
  return { center, at, stars: FLY_ORDER.map((dir) => ({ dir, star: at[dir], ...STAR_INFO[at[dir]] })) };
}

/** 三元九運：九運（2024–2043）九紫是當運財星、八白退氣；換運時這段說明會跟著換，不寫死在星的文字裡 */
export function periodOf(year) {
  const ly = LunarYear.fromYear(year);
  const yun = tw(ly.getYun());
  const note = yun === '九運'
    ? '目前是下元九運（2024–2043 年）：九紫是當運的財星，八白是退氣的財星，兩個方位都可以擺招財物。'
    : `目前是${tw(ly.getYuan())}${yun}。`;
  return { yuan: tw(ly.getYuan()), yun, note };
}

/** 某一年（以立春為界）的九宮飛星，以及太歲、歲破方位 */
export function flyingStars(year) {
  const zhi = yearGanZhi(year)[1];
  const taisui = ZHI_DIR[zhi];
  return { year, ...flyFrom((11 - (year % 9)) % 9 || 9), taisui: { dir: taisui, zhi, breaker: OPPOSITE[taisui] }, period: periodOf(year) };
}

/**
 * 本月的九宮飛星（月紫白，以「節」換月）。入中的星交給 lunar-typescript 的 getMonthNineStar：
 * 它和「子午卯酉年寅月八白入中、辰戌丑未年五黃、寅申巳亥年二黑，逐月退一」的口訣逐月核對過一致。
 */
export function monthlyStars({ y, m, d }) {
  const lunar = Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar();
  const from = lunar.getPrevJie(true).getSolar();
  const to = lunar.getNextJie(true).getSolar().next(-1);
  return {
    ...flyFrom(lunar.getMonthNineStar().getIndex() + 1),
    monthZhi: lunar.getMonthZhiExact(),
    from: { y: from.getYear(), m: from.getMonth(), d: from.getDay() },
    to: { y: to.getYear(), m: to.getMonth(), d: to.getDay() },
  };
}

/** 方位文字：中宮寫成「房子中央」 */
export const place = (dir) => (dir === '中' ? '房子中央' : dir);

// ── 明財位：站在大門往屋內看，斜對角就是財位
export function wealthCorner(door) {
  if (door === 'left') return { corners: ['right'], text: '大門在左邊：財位在進門後的右手邊最裡面那個角落。' };
  if (door === 'right') return { corners: ['left'], text: '大門在右邊：財位在進門後的左手邊最裡面那個角落。' };
  return { corners: ['left', 'right'], text: '大門在中間：最裡面的左右兩個角落都是財位，選比較安靜、有實牆的那一角。' };
}
export const CORNER_RULES = {
  do: ['保持明亮（燈常開或採光好）', '保持乾淨、不堆雜物', '背後是實牆（像有靠山）', '可以坐或擺穩重的吉祥物、圓葉綠色植物'],
  avoid: ['擺重物壓著（大衣櫃、大書櫃）', '是走道、窗戶或門（財位見空）', '放垃圾桶、鞋櫃、雜物', '頭頂有橫樑', '放仙人掌等尖刺植物', '很多派別也認為財位不要放魚缸（見財化水）'],
};

// ── 依五行的開運物（民俗常見對照）
export const ELEMENT_ITEMS = {
  木: {
    colors: '綠色、青色', shapes: '長條形、直立', materials: '木頭、竹、棉麻', direction: '東、東南',
    crystals: [{ name: '綠幽靈', use: '事業、正財' }, { name: '綠髮晶', use: '正財、貴人' }, { name: '東菱玉', use: '安定、人緣' }],
    plants: ['發財樹（馬拉巴栗）', '金錢樹', '富貴竹', '黃金葛', '龜背芋', '琴葉榕'],
    plantNote: '植物本身屬木，是你最好的開運物，越有生氣越好。',
    flowers: ['綠色系盆栽為主', '白色或綠色繡球花'],
    desk: '小盆栽（黃金葛、富貴竹）、木質筆筒、綠色文具',
  },
  火: {
    colors: '紅色、紫色、橘色', shapes: '三角形、尖形', materials: '燈具、蠟燭、皮革', direction: '南',
    crystals: [{ name: '紫水晶', use: '智慧、貴人、靜心' }, { name: '紅紋石', use: '人緣、感情' }, { name: '石榴石', use: '活力、行動力' }],
    plants: ['紅邊竹蕉', '變葉木', '朱蕉（紅竹）'],
    plantNote: '木生火，綠色植物對你也有幫助；配紅色或紫色的花更好。',
    flowers: ['火鶴花（安祖花）', '紅色長壽花', '紅色或紫色蝴蝶蘭', '聖誕紅'],
    desk: '一盞好看的檯燈、紫水晶、紅色或紫色小物',
  },
  土: {
    colors: '黃色、咖啡色、米色', shapes: '方形、扁平', materials: '陶瓷、石頭', direction: '中央、東北、西南',
    crystals: [{ name: '黃水晶', use: '偏財、聚財' }, { name: '虎眼石', use: '決斷力、偏財' }, { name: '黃玉髓', use: '穩定、守財' }],
    plants: ['多肉植物（種在陶盆）', '萬年青（陶盆）'],
    plantNote: '植物屬木、木剋土，不用放太多；選陶盆、黃色系的花和盆器。',
    flowers: ['文心蘭（跳舞蘭）', '向日葵', '黃色菊花'],
    desk: '陶瓷筆筒、黃水晶或聚寶盆、方形的收納盒',
  },
  金: {
    colors: '白色、金色、銀色', shapes: '圓形、弧形', materials: '金屬、銅、不鏽鋼', direction: '西、西北',
    crystals: [{ name: '白水晶', use: '淨化、平衡' }, { name: '鈦晶', use: '魄力、偏財' }, { name: '銀髮晶', use: '專注、貴人' }],
    plants: ['圓葉椒草', '銀皇后（粗肋草）', '白鶴芋', '銅錢草'],
    plantNote: '植物適量就好，挑圓葉、開白花的，配金屬或白色盆器。',
    flowers: ['白色蝴蝶蘭', '白百合', '白玫瑰', '茉莉花', '梔子花'],
    desk: '金屬筆筒或名片架、白水晶、銅製小擺件',
  },
  水: {
    colors: '黑色、深藍色', shapes: '波浪形、不規則', materials: '玻璃、鏡面、水', direction: '北',
    crystals: [{ name: '黑曜石', use: '擋煞、護身' }, { name: '海藍寶', use: '溝通、表達' }, { name: '黑髮晶', use: '擋小人、專注' }],
    plants: ['水耕黃金葛', '水養富貴竹', '銅錢草（水養）'],
    plantNote: '水耕植物最適合你，水和綠意一次都有。',
    flowers: ['紫羅蘭', '藍色繡球花', '桔梗', '薰衣草'],
    desk: '水耕小植物、玻璃或藍黑色系文具、黑曜石',
  },
};
const HETU = { 水: [1, 6], 火: [2, 7], 木: [3, 8], 金: [4, 9], 土: [5, 10] };
const FISH_BY_ELEMENT = {
  木: '綠色、藍色系的小型魚（孔雀魚、紅綠燈魚，群游的熱鬧感最好）',
  火: '紅色系（紅劍魚、血鸚鵡、紅色金魚）',
  土: '黃色、金色系（金魚、黃金鯉；大型的金龍魚要很大的缸）',
  金: '白色、銀色、金色系（白色或金色金魚）',
  水: '黑色、深色系（黑摩利），或任何顏色都可以',
};

/** 適不適合養魚、養什麼、養幾條、放哪裡 */
export function fishAdvice(ys) {
  if (!ys) return null;
  const { primary, secondary, avoid } = ys;
  const where = '放在客廳或辦公室的明亮處，最好在你的生氣方或今年一白、九紫的方位；不要放臥室、灶台旁、神桌下。';
  const care = '魚缸要定期換水、保持乾淨，魚死了要立刻撈出再補，不然反而是破財的象徵。';
  // 先看主要的喜用五行：水是主角、木靠水生 → 適合；火被水剋、水是忌 → 不建議；其他看次要的喜用
  if (primary === '水') {
    return { fit: 'great', title: '很適合養魚', text: `你的喜用就是「水」，魚缸（活水）是對你最加分的擺設。魚的顏色不拘，${FISH_BY_ELEMENT.水}；數量取 ${HETU.水.join(' 或 ')} 條（水的河圖數）。`, where, care };
  }
  if (primary === '木') {
    return { fit: 'good', title: '適合養魚', text: `水能生木，對喜用「木」的你有幫助。魚選${FISH_BY_ELEMENT.木}；數量 ${HETU.木.join(' 或 ')} 條。魚缸旁擺幾盆綠色植物效果更好。`, where, care };
  }
  if (primary === '火' || avoid.includes('水')) {
    return { fit: 'no', title: '不建議養魚', text: primary === '火'
      ? `水會剋火，對喜用「火」的你不加分。真的想養，選小缸、${FISH_BY_ELEMENT.火}、2 或 7 條，旁邊放綠色植物（水生木、木生火，用木來通關）。`
      : `「水」是你的忌神（${avoidReason(ys)}），大魚缸會讓氣場更偏。想養寵物魚的話，選小缸、放在不常待的角落。`, where: '避開辦公桌正前方與財位。', care };
  }
  if (secondary === '水') {
    return { fit: 'good', title: '適合養小缸魚', text: `你的次要喜用是「水」，養魚有幫助，但主角是「${primary}」：魚挑${FISH_BY_ELEMENT[primary]}，數量 ${HETU[primary].join(' 或 ')} 條。`, where, care };
  }
  return { fit: 'ok', title: '可以養，小缸就好', text: `「水」對你不加分也不扣分。想養的話選小缸、魚挑${FISH_BY_ELEMENT[primary]}，數量 ${HETU[primary].join(' 或 ')} 條。`, where, care };
}

// ── 命裡的財庫
const KU = { 水: ['辰'], 火: ['戌'], 金: ['丑'], 木: ['未'], 土: ['辰', '戌'] }; // 土寄生在辰（水土同宮）或戌（火土同宮），兩派都列
const WEALTH_OF = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
const CLASH = { 辰: '戌', 戌: '辰', 丑: '未', 未: '丑' };

/** 八字財庫：財星的庫在不在命盤裡、有沒有被沖開，以及接下來哪幾年會沖開 */
export function baziWealthStore(bazi, fromYear) {
  if (!bazi || !bazi.ok) return null;
  const dm = bazi.dayMaster.wx;
  const wealthWx = WEALTH_OF[dm];
  const kuList = KU[wealthWx];
  const zhis = bazi.pillars.filter(Boolean).map((p) => p.zhi);
  const have = kuList.filter((k) => zhis.includes(k));
  const opened = have.filter((k) => zhis.includes(CLASH[k]));
  const target = have.length ? have : kuList;
  const openYears = [];
  for (let y = fromYear; y < fromYear + 12 && openYears.length < 2; y += 1) {
    if (target.some((k) => yearGanZhi(y)[1] === CLASH[k])) openYears.push(y);
  }
  const lines = [`你的日主屬${dm}，財星是「${wealthWx}」，${wealthWx}的庫在「${kuList.join('、')}」${wealthWx === '土' ? '（土的庫兩派說法不同，都列出來）' : ''}。`];
  if (!have.length) {
    lines.push('命盤裡沒有財庫：錢來得快也去得快。對你來說，「制度」就是財庫：薪水一進來就自動轉存、買保險或不動產，存得住比賺得多重要。');
  } else if (opened.length) {
    lines.push(`命盤裡有財庫（${have.join('、')}），而且已經被沖開：大進大出、敢花也會賺，一定要有固定的存錢規則，不然賺多少花多少。`);
  } else {
    lines.push(`命盤裡有財庫（${have.join('、')}），還沒被沖開：你天生能存錢、守得住，屬於細水長流型，累積久了很可觀。`);
  }
  if (openYears.length) lines.push(`接下來 ${openYears.join('、')} 年會沖動財庫：錢的進出會變大，是投資置產的機會，也要防一次大花費。`);
  return { wealthWx, kuList, have, opened, openYears, lines };
}

/** 紫微田宅宮（傳統稱為財庫）：主星、祿、忌、空劫 */
export function ziweiWealthStore(ziwei) {
  if (!ziwei || !ziwei.ok) return null;
  const p = ziwei.palaces.find((x) => x.name === '田宅');
  if (!p) return null;
  const all = [...p.major, ...p.minor];
  const names = all.map((s) => s.name);
  const lines = [];
  const major = p.major.length ? p.major : (ziwei.palaces.find((q) => q.index === (p.index + 6) % 12) || { major: [] }).major;
  if (major.length) lines.push(`田宅宮${p.major.length ? '' : '（無主星，借對宮）'}主星是${major.map((s) => s.name).join('、')}：${major.map((s) => (ZIWEI_STARS[s.name] ? ZIWEI_STARS[s.name].wealth : '')).filter(Boolean).join('')}`);
  let tone = 0;
  if (all.some((s) => s.mutagen === '化祿') || names.includes('祿存')) {
    tone += 1;
    lines.push('田宅宮有祿（化祿或祿存）：財庫豐厚，有機會靠房地產或家族資源累積。');
  }
  if (all.some((s) => s.mutagen === '化忌')) {
    tone -= 1;
    lines.push('田宅宮有化忌：財庫容易有漏洞，買房、家用支出要多規劃，別借錢給家人以外的人周轉。');
  }
  if (names.includes('地空') || names.includes('地劫')) {
    tone -= 1;
    lines.push(`田宅宮有${names.filter((n) => n === '地空' || n === '地劫').join('、')}：存錢容易被意外花掉，緊急預備金要先存好。`);
  }
  if (!tone && lines.length < 2) lines.push('田宅宮沒有明顯的祿或忌：財庫穩定，靠時間慢慢累積。');
  return { tone, lines };
}

/**
 * 開運佈置總表。
 * @param {{bazi?:object, ziwei?:object, birth:{y,m,d}, gender?:string, today:{y,m,d}, door?:'left'|'middle'|'right'}} input
 */
export function buildFengshui({ bazi = null, ziwei = null, birth, gender = null, today, door = 'middle' }) {
  const ys = yongShen(bazi);
  const year = liChunYear(today);
  const fs = flyingStars(year);
  const personal = personalDirections(birth, gender);
  const items = ys ? { primary: ELEMENT_ITEMS[ys.primary], secondary: ELEMENT_ITEMS[ys.secondary] } : null;
  const corner = wealthCorner(door);
  const month = monthlyStars(today);
  const goodStars = fs.stars.filter((s) => s.kind === 'good' && s.dir !== '中');
  const badStars = fs.stars.filter((s) => s.kind === 'bad');
  const sheng = personal ? personal.stars.find((s) => s.key === '生氣').dir : null;
  const nine = fs.stars.find((s) => s.star === 9);
  const eight = fs.stars.find((s) => s.star === 8);
  const five = fs.stars.find((s) => s.star === 5);

  const plan = [];
  plan.push(`找財位：${corner.text}`);
  if (sheng) plan.push(`你的個人財位（生氣方）在「${sheng}」：辦公桌面向${sheng}，或把常坐的位置放在屋子的${sheng}邊。`);
  plan.push(`${year} 年的財星：九紫在「${place(nine.dir)}」、八白在「${place(eight.dir)}」，這兩個方位保持明亮乾淨，${ys ? `擺${ELEMENT_ITEMS[ys.primary].crystals[0].name}或${ELEMENT_ITEMS[ys.primary].plants[0]}` : '擺圓葉植物或黃水晶'}。`);
  if (items) plan.push(`財位擺什麼：你的喜用是「${ys.primary}」，選${items.primary.colors}系、${items.primary.materials}材質的東西，例如${items.primary.crystals[0].name}、${items.primary.plants.slice(0, 2).join('或')}。`);
  plan.push(`${year} 年要避開：五黃在「${place(five.dir)}」，那裡不要動土、不要放紅色或點燈，放銅葫蘆或金屬擺件；太歲在「${fs.taisui.dir}」、歲破在「${fs.taisui.breaker}」，避免在這兩個方位動土裝修。`);
  // 有利方位剛好碰上今年的五黃、二黑或太歲時，兩個建議會互相打架：那個方位今年只做化解，開運擺設改放次要喜用的方位
  const badAt = { [five.dir]: ['五黃'], [fs.stars.find((s) => s.star === 2).dir]: ['二黑'] };
  (badAt[fs.taisui.dir] ||= []).push('太歲');
  const clash = items ? items.primary.direction.split('、').filter((d) => badAt[d]).map((d) => ({ dir: d, what: badAt[d] })) : [];
  if (clash.length) {
    plan.push(`注意：你的有利方位${clash.map((c) => `「${c.dir}」今年剛好是${c.what.join('、')}`).join('；')}所在。今年那裡只做化解（金屬擺件、保持安靜），開運擺設改放在次要喜用「${ys.secondary}」的方位「${items.secondary.direction}」。`);
  }
  const m5 = month.stars.find((s) => s.star === 5);
  const m9 = month.stars.find((s) => s.star === 9);
  plan.push(`這個月（${month.from.m}/${month.from.d}–${month.to.m}/${month.to.d}）：五黃飛到「${place(m5.dir)}」，那裡這個月也不要動工；九紫到「${place(m9.dir)}」，可以加強擺設。`);
  if (personal) plan.push(`床頭與辦公座位不要放在你的絕命方「${personal.stars.find((s) => s.key === '絕命').dir}」與五鬼方「${personal.stars.find((s) => s.key === '五鬼').dir}」。`);

  return {
    ys,
    year,
    flying: fs,
    month,
    goodStars,
    badStars,
    personal,
    corner,
    rules: CORNER_RULES,
    items,
    fish: fishAdvice(ys),
    store: { bazi: baziWealthStore(bazi, today.y), ziwei: ziweiWealthStore(ziwei) },
    desk: deskAdvice(personal, ys),
    clash,
    plan,
  };
}

/**
 * 辦公座位：每條規則附上「做不到時怎麼辦」。多數人的座位是公司排的，只講理想位置等於沒講。
 * @returns {{rule:string, fix:string}[]}
 */
function deskAdvice(personal, ys) {
  const items = [];
  const deskItem = ys ? ELEMENT_ITEMS[ys.primary].desk.split('、')[0] : '圓葉小盆栽';
  if (personal) {
    const d = (k) => personal.stars.find((s) => s.key === k).dir;
    items.push({
      rule: `面向你的生氣方「${d('生氣')}」最好；其次是天醫「${d('天醫')}」或延年「${d('延年')}」。`,
      fix: `至少不要面向絕命「${d('絕命')}」；在桌面靠${d('生氣')}的那一角放${deskItem}，手機、常用的文件也放那一側。`,
    });
  }
  items.push({ rule: '座位背後是實牆（有靠山），不要背對門或走道。', fix: '換高背椅、椅背掛一件外套，背後放櫃子或高盆栽；桌上放一面小鏡子看得到身後。' });
  items.push({ rule: '不要正對門口（門沖），也不要坐在橫樑或冷氣出風口正下方。', fix: '門沖就把座位斜一點，桌前放檔案架或盆栽擋；樑壓就往旁邊挪，挪不了在桌上放一盞往上照的燈；冷氣直吹加擋風板。' });
  items.push({ rule: '桌面左邊放較高的東西（檔案、主機），右邊保持低而整齊（左青龍、右白虎）。', fix: '左右以坐在位子上為準；左邊沒空間時，至少讓右邊不要比左邊高、不要堆雜物。' });
  items.push({ rule: '桌面保持清爽，壞掉的文具、枯掉的植物馬上換掉。', fix: '' });
  if (ys) items.push({ rule: `桌上可以放：${ELEMENT_ITEMS[ys.primary].desk}。`, fix: '' });
  return items;
}

export { DIRS };
