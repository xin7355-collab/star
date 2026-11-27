// 瑪雅合盤的「老師怎麼看」：把兩個人的銀河印記（主要關係、圖騰的天賦和卡點、顏色、調性）和瑪雅密碼的同異，
// 組成一段指名道姓的解盤。使用者回饋「內容很普通，不知道在講什麼」：上一版只列規則和通用的句子，
// 這裡每一句都帶入兩個人的名字和圖騰，講清楚「誰的長處補誰的卡點」、卡住時誰可以做什麼。
// 文字由本 App 依 13 月亮曆的神諭規則和各圖騰的說明組成，參考就好。

import { dayRelation, kinOf, kinInfo, validDate, pairSummary, kinWithLeapDays, compositeKin } from './maya-kin.js';
import { SEAL_TEXT, TONE_TEXT, COLOR_TEXT, PAIR_MAIN, PAIR_RELATION_TEXT, COLOR_PAIR_TEXT } from './maya-texts.js';

// 句子裡只取第一段（「；」前面），整句放進引號太長
const short = (t) => t.split('；')[0].replace(/。$/, '');
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
// 四個顏色在一件事裡擅長的那一段（紅開創、白精煉、藍轉化、黃成熟），分工時帶進兩個人的顏色
const COLOR_ROLE = { red: '擅長起頭', white: '擅長整理', blue: '擅長處理變動', yellow: '擅長收尾' };

// 瑪雅密碼五個位置各講什麼（解盤裡用的短說法）
const CODE_POS = { A: '前世 A（天生的習慣）', B: '今生 B（這輩子要練的課題）', C: '潛意識 C（心裡的動力）', D: '表象 D（別人眼中的樣子）', E: '小宇宙 E（內在的核心）' };

// 兩個人都順的日子：當天的圖騰落在兩個人五大神諭的哪個位置，分數越高越適合一起做事、談重要的話；挑戰位（卡卡的）不算
const DAY_SCORE = { return: 3, analog: 3, guide: 3, occult: 2, seal: 2, color: 1 };
const DAY_NAME = { return: '銀河生日', analog: '支持', guide: '引導', occult: '隱藏推動', seal: '同圖騰', color: '同色' };

/**
 * 接下來 days 天裡，兩個人都順的日子（最多 n 天，依日期排）。
 * @returns {{date:{y,m,d}, label:string, kin:number, title:string, a:string, b:string}[]}
 */
export function sharedMayaDays(kinA, kinB, from, { days = 60, n = 3, count = 'dreamspell' } = {}) {
  if (!validDate(from)) return [];
  const list = [];
  const t0 = Date.UTC(from.y, from.m - 1, from.d);
  for (let i = 0; i < days; i += 1) {
    const dt = new Date(t0 + i * 86400000);
    const date = { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    const kin = kinOf(date, count);
    if (kin === null) continue;
    const ra = dayRelation(kin, kinA);
    const rb = dayRelation(kin, kinB);
    if (!DAY_SCORE[ra] || !DAY_SCORE[rb]) continue;
    list.push({ date, kin, ra, rb, score: DAY_SCORE[ra] + DAY_SCORE[rb], week: dt.getUTCDay() });
  }
  return list.sort((x, y) => y.score - x.score || (x.date.y - y.date.y) || (x.date.m - y.date.m) || (x.date.d - y.date.d)).slice(0, n)
    .sort((x, y) => (x.date.y - y.date.y) || (x.date.m - y.date.m) || (x.date.d - y.date.d))
    .map((x) => ({ date: x.date, label: `${x.date.m}/${x.date.d}（週${WEEK[x.week]}）`, kin: x.kin, title: kinInfo(x.kin).title, a: DAY_NAME[x.ra], b: DAY_NAME[x.rb] }));
}

/** 為什麼是這個位置：用兩個人的圖騰號碼講出算法（看得懂才信得過） */
function positionWhy(sum, a, b) {
  const sa = a.seal.n;
  const sb = b.seal.n;
  const nums = `${a.seal.name} ${sa}＋${b.seal.name} ${sb}`;
  const mean = (role) => PAIR_RELATION_TEXT[role];
  switch (sum.main) {
    case 'return': return '兩個人是同一個 KIN：圖騰和調性完全一樣。';
    case 'seal': return `兩個人是同一個圖騰（${a.seal.name}），差在調性（${a.tone.name}、${b.tone.name}）。`;
    case 'analog': return `圖騰號碼相加是 ${sa + sb}（${nums}${sa + sb === 39 ? '，減 20 就是 19' : ''}）：相加 19 是「支持」的組合。${mean('analog')}`;
    case 'antipode': return `圖騰號碼差 10（${a.seal.name} ${sa}、${b.seal.name} ${sb}）：差 10 是「挑戰」的組合。${mean('antipode')}`;
    case 'occult': return `圖騰號碼相加是 21（${nums}）：相加 21 是「隱藏推動」的組合。${mean('occult')}`;
    case 'guide': return `「引導」的圖騰和自己同顏色，由調性決定是哪一個（調性 1、6、11 的引導就是自己的圖騰）。${mean('guide')}`;
    case 'color': return `兩個圖騰同顏色（${COLOR_TEXT[a.seal.color].name}），是「引導」所在的家族，做事的出發點相近。`;
    default: {
      const type = { analogColor: '支持（紅白、藍黃）', antipodeColor: '挑戰（紅藍、白黃）', occultColor: '隱藏推動（紅黃、白藍）' }[sum.main];
      return `兩個人的圖騰都不在對方的五大神諭裡（大約六成的配對都是這樣），所以看顏色：五大神諭的三個位置，顏色固定成對，${COLOR_TEXT[a.seal.color].name}和${COLOR_TEXT[b.seal.color].name}是${type}那一組。`;
    }
  }
}

/** 斷語：依主要關係，把兩個人的天賦和卡點交叉帶進去 */
function verdictOf(sum, a, b) {
  const A = a.name;
  const B = b.name;
  const sa = SEAL_TEXT[a.seal.n];
  const sb = SEAL_TEXT[b.seal.n];
  const [gA, gB, shA, shB] = [short(sa.gift), short(sb.gift), short(sa.shadow), short(sb.shadow)];
  const nA = `${A}（${a.seal.name}）`;
  const nB = `${B}（${b.seal.name}）`;
  const cA = COLOR_TEXT[a.seal.color];
  const cB = COLOR_TEXT[b.seal.color];
  const colorPair = `${cA.name}（${cA.key}）和${cB.name}（${cB.key}）`;
  switch (sum.main) {
    case 'return':
      return `${A}和${B}是同一個 KIN（${a.title}）：天賦一樣是「${gA}」，卡住的地方也一樣是「${shA}」。你們最懂彼此，也最容易一起卡住；相處的關鍵是互相提醒，不要一起鑽牛角尖。`;
    case 'seal':
      return `${A}和${B}是同一個圖騰（${a.seal.name}）：天賦都是「${gA}」，老毛病也都是「${shA}」。差別在調性：${A}重${TONE_TEXT[a.tone.n].key}、${B}重${TONE_TEXT[b.tone.n].key}，同一件事做法不同；欣賞對方的做法，就是這段關係最大的收穫。`;
    case 'analog':
      return `${nA}和${nB}互為「支持」，是最合拍的搭檔：價值觀接近，在一起很輕鬆。${B}卡在「${shB}」的時候，${A}的「${gA}」剛好補上；${A}卡在「${shA}」的時候，${B}的「${gB}」也補得上。`;
    case 'antipode':
      return `${nA}和${nB}互為「挑戰」：${A}重「${sa.keys.join('、')}」、${B}重「${sb.keys.join('、')}」，出發點相反，常覺得對方難懂。但最能點醒${A}「${shA}」的就是${B}，最能逼${B}面對「${shB}」的也是${A}；吵得起來，正是因為彼此在意。`;
    case 'occult':
      return `${nA}和${nB}互為「隱藏推動」：平常不一定看得出有多合，真正的作用在低潮和關鍵時刻。${B}卡在「${shB}」的時候，${A}的「${gA}」能推一把；${A}卡在「${shA}」的時候，${B}的「${gB}」會在背後撐住。`;
    case 'guide': {
      const both = sum.otherInMine === 'guide' && sum.mineInOther === 'guide';
      if (both) return `${nA}和${nB}互為「引導」：迷惘的時候，聽聽對方怎麼說。${A}卡在「${shA}」時，${B}的「${gB}」能指方向；${B}卡在「${shB}」時，${A}的「${gA}」也能。`;
      const [g, f] = sum.otherInMine === 'guide' ? [b, a] : [a, b];
      const sg = SEAL_TEXT[g.seal.n];
      const sf = SEAL_TEXT[f.seal.n];
      return `${g.name}（${g.seal.name}）是${f.name}（${f.seal.name}）的「引導」：${f.name}迷惘、卡在「${short(sf.shadow)}」的時候，最值得聽${g.name}的意見——${g.name}的「${short(sg.gift)}」常能替${f.name}指出方向。反過來，${f.name}的「${short(sf.gift)}」是${g.name}做事的好幫手。`;
    }
    case 'color':
      return `${nA}和${nB}是同一個顏色家族（${cA.name}：${cA.key}）：做事的出發點相近，合作順手。${A}帶來「${gA}」，${B}帶來「${gB}」，方向一致時進展很快；要小心的是兩個人容易一起忽略同一個盲點。`;
    case 'analogColor':
      return `${nA}和${nB}的圖騰不在彼此的五大神諭裡，但顏色是「支持色」：${colorPair}強項接得起來。${A}的「${gA}」接上${B}的「${gB}」，一起做事剛好互補。`;
    case 'antipodeColor':
      return `${nA}和${nB}的圖騰不在彼此的五大神諭裡，但顏色是「挑戰色」：${colorPair}看事情的出發點不同。意見不合時，常是${B}看到了${A}「${shA}」的盲點，${A}也看到了${B}「${shB}」的盲點——吵完記得收穫。`;
    default: // occultColor
      return `${nA}和${nB}的圖騰不在彼此的五大神諭裡，但顏色是「推動色」：${colorPair}一個在前、一個在後。${A}的「${gA}」和${B}的「${gB}」，一件事從開始到完成剛好能接力；對方卡住時，你剛好能接手。`;
  }
}

/** 調性怎麼搭：同調性、相加 14（隱藏推動的調性）、其他看兩個調性各自問的問題 */
function toneWhy(sum, a, b) {
  const tA = TONE_TEXT[a.tone.n];
  const tB = TONE_TEXT[b.tone.n];
  if (sum.sameTone) return `調性一樣是 ${a.tone.n}「${tA.key}」：做事的節奏相近，都在問「${tA.q}」。`;
  const base = `${a.name}是調性 ${a.tone.n}「${tA.key}」（${tA.q}），${b.name}是調性 ${b.tone.n}「${tB.key}」（${tB.q}）`;
  if (sum.toneSum14) return `${base}：相加是 14，在 13 天的波符裡一前一後、位置對稱，節奏剛好互補。`;
  return `${base}：一個重${tA.key}、一個重${tB.key}，分工時各拿擅長的那一段。`;
}

/** 瑪雅密碼（另一套算法）的同異：哪幾個位置一樣、哪幾個不一樣，各代表什麼 */
function codeWhy(code) {
  if (!code || !code.total) return null;
  const same = code.lines.filter((l) => l.same).map((l) => CODE_POS[l.key]);
  const diff = code.lines.filter((l) => !l.same && !/不適用/.test(l.text)).map((l) => CODE_POS[l.key]);
  if (!same.length) return `瑪雅密碼（另一套算法）${code.total} 個位置都不一樣：個性和課題差異大，正好互補，也需要多一點時間懂對方。`;
  if (!diff.length) return `瑪雅密碼（另一套算法）${code.total} 個位置都一樣：像照鏡子，很懂彼此，也容易一起卡在同樣的地方。`;
  return `瑪雅密碼（另一套算法）${code.total} 個位置有 ${code.same} 個一樣：${same.join('、')}——這幾個面向你們很像；不一樣的是${diff.join('、')}，各走各的功課。`;
}

/**
 * @param {{a:object, b:object, sum:object, code?:object|null, days?:object[]|null}} o
 *   a、b：kinInfo 再加上 name（看的人自己用「你」）；sum：pairSummary(a.kin, b.kin)；code：瑪雅密碼的 explainCompare；days：sharedMayaDays
 * @returns 給 masterCard 用的 badge、verdict、why、remedies、boosts、combos
 */
export function mayaPairMaster({ a, b, sum, code = null, days = null }) {
  const A = a.name;
  const B = b.name;
  const sa = SEAL_TEXT[a.seal.n];
  const sb = SEAL_TEXT[b.seal.n];
  const M = PAIR_MAIN[sum.main];
  const cA = COLOR_TEXT[a.seal.color];
  const cB = COLOR_TEXT[b.seal.color];
  const why = [
    { tone: 'info', text: positionWhy(sum, a, b) },
    { tone: 'info', text: `${a.seal.color === b.seal.color ? `兩個人都是${cA.name}（${cA.key}）——${cA.text}` : `${A}是${cA.name}（${cA.key}）——${cA.text}${B}是${cB.name}（${cB.key}）——${cB.text}`}${COLOR_PAIR_TEXT[sum.color]}` },
    { tone: 'info', text: toneWhy(sum, a, b) },
    sum.sameWavespell ? { tone: 'good', text: `出生在同一個波符（${a.wavespell.seal.name}波符）：人生大方向的主題相似。` } : null,
    codeWhy(code) ? { tone: 'info', text: codeWhy(code) } : null,
  ].filter(Boolean);
  // 卡住時怎麼辦：兩邊各一套（先認得對方卡住的樣子、用自己的長處陪、對方自己能做的），再加上這種關係的相處原則
  const helpWhen = (x, sx, y, sy) => ({
    title: `${x.name}卡住時，${y.name}可以這樣做`,
    steps: [
      `先認得${x.name}卡住的樣子：${sx.shadow}`,
      `${y.name}用自己的長處陪一段：${short(sy.gift)}；陪就好，不要替${x.name}做完。`,
      `${x.name}自己可以：${sx.tip}`,
    ],
  });
  const remedies = [
    helpWhen(b, sb, a, sa),
    helpWhen(a, sa, b, sb),
    { title: `相處原則（${M.label}）`, steps: M.tips },
  ];
  const boosts = [
    `一起做事的分工：${A}負責「${short(sa.gift)}」（${cA.name}${COLOR_ROLE[a.seal.color]}），${B}負責「${short(sb.gift)}」（${cB.name}${COLOR_ROLE[b.seal.color]}）。`,
    sum.sameTone
      ? `做決定前一起問一次你們調性的問題：「${TONE_TEXT[a.tone.n].q}」`
      : `做決定前，兩個問題各問一次：${A}的調性問「${TONE_TEXT[a.tone.n].q}」，${B}的調性問「${TONE_TEXT[b.tone.n].q}」。`,
    days && days.length ? '重要的事、要談的話，挑下面兩個人都順的日子。' : null,
  ].filter(Boolean);
  return {
    badge: { text: M.label, cls: ['antipode', 'antipodeColor'].includes(sum.main) ? 'alt' : 'good' },
    head: M.head,
    verdict: verdictOf(sum, a, b),
    why,
    remedies,
    boosts,
    days: days || [],
    combos: [
      { label: '配對', why: '星盤＋八字合婚：感情相處的細節、兩人都順的日子', go: ['oracle', { panel: 'match' }] },
      { label: '家人關係', why: '家人之間誰幫誰、哪裡會摩擦、怎麼相處', go: ['destiny', { tool: 'family' }] },
      { label: '今日', why: '每天的瑪雅印記和你的關係', go: ['today', {}] },
    ],
  };
}


// 會被講成「不合」的關係：挑戰（圖騰差 10）和挑戰色（紅藍、白黃）
const HARD = ['antipode', 'antipodeColor'];

/**
 * 同一對人用不同算法算一次（使用者回饋：別人用瑪雅算說兩人不合，這裡沒有）：
 * 13 月亮曆、傳統馬雅曆（套用 13 月亮曆的神諭規則，是混合做法）、常見的算錯（把 2/29 也算進去）。
 * 另外附兩個 KIN 相加的「關係印記」（民間做法，查不到原始出處）。哪一種會落在挑戰，就是哪一種會被講成不合。
 * @param a、b：{ name, date }
 */
export function methodCompare(a, b) {
  const row = (key, label, note, ka, kb) => {
    if (ka === null || kb === null) return null;
    const s = pairSummary(ka, kb);
    return { key, label, note, a: kinInfo(ka), b: kinInfo(kb), main: s.main, mainLabel: PAIR_MAIN[s.main].label, hard: HARD.includes(s.main) };
  };
  const ds = row('dreamspell', '13 月亮曆', '台灣多數老師用的算法（本 App 預設）', kinOf(a.date), kinOf(b.date));
  const leap = row('leapday', '把 2 月 29 日也算進去', '常見的算錯：13 月亮曆不算 2/29，計算器沒扣掉就會差幾天', kinWithLeapDays(a.date), kinWithLeapDays(b.date));
  const rows = [
    ds,
    row('traditional', '傳統馬雅曆', "瓜地馬拉 K'iche' 族的日曆，同一天的圖騰常不同；關係用 13 月亮曆的神諭規則算（混合做法）", kinOf(a.date, 'traditional'), kinOf(b.date, 'traditional')),
    // 兩個人都和 13 月亮曆一樣（生日離 2013 年很近）就不列，免得看起來像兩種算法
    leap && ds && (leap.a.kin !== ds.a.kin || leap.b.kin !== ds.b.kin) ? leap : null,
  ].filter(Boolean);
  return { rows, composite: ds ? kinInfo(compositeKin(ds.a.kin, ds.b.kin)) : null };
}
