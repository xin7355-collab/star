// 家人關係：用每個人的八字看彼此怎麼互相影響，再從「我」的命盤看各種家人，最後給今年誰要注意、每個人的房間方位。
//
// ・兩人之間看五件事：日主五行誰生誰、誰剋誰（相處的主從）；對方的日主是不是我的喜用或忌（相處順不順、累不累）；
//   生肖（年支）合沖刑害；日柱天干五合、天剋地沖與日支合沖（伴侶最看這個）；八宅東四命、西四命（同住怎麼安排）。
//   有相剋時給「通關」五行（甲剋乙，就用甲所生、又能生乙的五行接起來），這是合婚常用的化解思路。
// ・從我的命盤看家人：六親星（男命財為妻、女命官為夫；父偏財、母正印；男命官殺、女命食傷為子女；比劫為兄弟朋友）
//   與宮位（年柱長輩、月柱父母兄弟、日支夫妻、時柱子女），加上紫微對應的宮。六親取法以子平通行說法為準，
//   子女的兒女之分（七殺為子、正官為女等）各派不同，這裡不細分。
// ・結論不打分數，只標「互相加分／誰是誰的助力／會吵但互補／容易摩擦／合得來／平穩」，並列出依據。

import { branchRelations, ganRelation, taiSui, liunian, yearGanZhi, avoidReason } from './bazi.js';
import { SHENGXIAO, ZHI } from './calendar.js';
import { STAR_KEYWORDS } from './reading-texts.js';

const WX = ['木', '火', '土', '金', '水'];
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const BORN_BY = Object.fromEntries(WX.map((w) => [SHENG[w], w])); // 生我的
const RULED_BY = Object.fromEntries(WX.map((w) => [KE[w], w])); // 剋我的

// 通關五行的擺設與一起做的事
const BRIDGE = {
  木: { items: '綠色植物、木質家具', together: '一起去爬山、逛公園' },
  火: { items: '溫暖明亮的燈光、紅色或紫色的小物', together: '一起運動、曬太陽' },
  土: { items: '陶瓷、石頭擺件、黃色系的布置', together: '一起下廚、好好吃頓飯' },
  金: { items: '金屬擺件、白色系的布置', together: '一起整理家裡、規劃旅行' },
  水: { items: '魚缸或水耕植物、藍黑色系的布置', together: '一起去海邊或河邊散步、好好聊天' },
};

const ZODIAC_NOTE = {
  同支: ['info', '同生肖：個性相像，容易互相理解，也容易看到彼此的缺點。'],
  六合: ['good', '生肖六合：天生合拍，容易互相體諒。'],
  半合: ['good', '生肖半合：同一國的，目標和價值觀容易一致。'],
  拱合: ['good', '生肖拱合：有默契，但力量比半合弱。'],
  六沖: ['bad', '生肖六沖：個性和節奏相反，容易一言不合，但也能補對方的盲點。'],
  相刑: ['bad', '生肖相刑：容易用自己的標準要求對方，說話要留餘地。'],
  相害: ['bad', '生肖相害：容易誤會、心裡有疙瘩，有話直接講清楚。'],
  相破: ['bad', '生肖相破：計畫容易被對方打亂，事情先講好再做。'],
};

/** 準備一個人的資料（view 先用 buildBazi、yongShen、personalDirections 算好再交進來） */
export function memberOf({ id, name, relation = '', gender = '', self = false, bazi, ys = null, kua = null }) {
  const day = bazi.pillars[2];
  return {
    id, name, relation, gender, self, bazi, ys, kua,
    dm: bazi.dayMaster.wx,
    dayGan: day.gan,
    dayZhi: day.zhi,
    zodiacZhi: ZHI[bazi.zodiac.index],
    animal: SHENGXIAO[bazi.zodiac.index],
  };
}

const needs = (m, wx) => !!m.ys && (m.ys.primary === wx || m.ys.secondary === wx);
const dislikes = (m, wx) => !!m.ys && m.ys.avoid.includes(wx);

/**
 * 兩個人之間的互相影響。A、B 的稱呼由呼叫端給（例如「你」「媽媽」），文字照著用。
 * @returns {{tone:'good'|'mid'|'care', label:string, notes:{tone:string,text:string}[], tips:string[], bridge:string|null}}
 */
export function pairOf(a, b, A = a.name, B = b.name) {
  const notes = [];
  const tips = [];
  let plus = 0;
  let minus = 0;
  const da = a.dm;
  const db = b.dm;

  // 1. 日主五行：誰生誰、誰剋誰
  let attacker = null;
  if (da === db) {
    notes.push({ tone: 'info', text: `${A}和${B}的日主都屬${da}：像戰友，想法相近、互相打氣，也容易較勁。` });
    tips.push('同一型的人：分工合作、各自負責一塊，不要搶主導。');
  } else if (SHENG[da] === db) {
    notes.push({ tone: 'info', text: `${A}的${da}生${B}的${db}：${A}比較會照顧、付出給${B}。` });
    tips.push(`${A}記得也照顧自己，不必無限付出；${B}多說謝謝，讓${A}知道付出被看見。`);
  } else if (SHENG[db] === da) {
    notes.push({ tone: 'info', text: `${B}的${db}生${A}的${da}：${B}是會照顧、支持${A}的那一方。` });
    tips.push(`${B}付出比較多：${A}多表達感謝、也主動分擔，關係會更穩。`);
  } else if (KE[da] === db) {
    attacker = 'a';
    notes.push({ tone: 'info', text: `${A}的${da}剋${B}的${db}：${A}比較強勢、主導，${B}容易覺得被管。` });
    tips.push(`${A}說話放軟、多問${B}的想法；${B}有不同意見要早點說，不要悶著。`);
  } else {
    attacker = 'b';
    notes.push({ tone: 'info', text: `${B}的${db}剋${A}的${da}：${B}比較強勢、主導，${A}容易覺得被管。` });
    tips.push(`${B}說話放軟、多問${A}的想法；${A}有不同意見要早點說，不要悶著。`);
  }

  // 2. 喜用互補：對方的日主是不是我需要的五行
  const helpsA = needs(a, db);
  const helpsB = needs(b, da);
  const hurtsA = dislikes(a, db);
  const hurtsB = dislikes(b, da);
  if (helpsA) {
    plus += 1;
    notes.push({ tone: 'good', text: `${B}的${db}正好是${A}需要的五行（喜用）：和${B}在一起，${A}比較順、比較有能量。` });
  } else if (hurtsA) {
    minus += 1;
    notes.push({ tone: 'bad', text: `${B}的${db}是${A}的忌神（${avoidReason(a.ys)}）：${A}跟${B}相處容易累，記得留喘息空間。` });
  }
  if (helpsB) {
    plus += 1;
    notes.push({ tone: 'good', text: `${A}的${da}正好是${B}需要的五行（喜用）：${B}跟${A}在一起比較順。` });
  } else if (hurtsB) {
    minus += 1;
    notes.push({ tone: 'bad', text: `${A}的${da}是${B}的忌神（${avoidReason(b.ys)}）：${B}跟${A}相處容易覺得有壓力。` });
  }

  // 3. 生肖
  const zr = branchRelations(a.zodiacZhi, b.zodiacZhi);
  for (const r of zr) {
    const n = ZODIAC_NOTE[r];
    if (!n) continue;
    notes.push({ tone: n[0], text: `${A}屬${a.animal}、${B}屬${b.animal}，${n[1]}` });
    if (r === '六合' || r === '半合') plus += 1;
    if (r === '拱合') plus += 0.5;
    if (r === '六沖') {
      minus += 1;
      tips.push('生肖相沖：買房、換工作這類大事先商量，不要突然宣布。');
    }
    if (r === '相刑' || r === '相害' || r === '相破') minus += 0.5;
  }

  // 4. 日柱（伴侶最看這個）
  const gr = ganRelation(a.dayGan, b.dayGan);
  const dr = branchRelations(a.dayZhi, b.dayZhi);
  if (gr === '五合') {
    plus += 1;
    notes.push({ tone: 'good', text: `日主${a.dayGan}、${b.dayGan}相合：彼此有默契、互相吸引（伴侶之間最明顯）。` });
  }
  if (gr === '相沖' && dr.includes('六沖')) {
    minus += 1.5;
    notes.push({ tone: 'bad', text: `日柱${a.dayGan}${a.dayZhi}和${b.dayGan}${b.dayZhi}天剋地沖：觀念差很多，重大決定一定先溝通。` });
  } else if (dr.includes('六沖')) {
    minus += 0.5;
    notes.push({ tone: 'bad', text: '日支相沖：生活作息、習慣容易衝突，各自保留一點空間。' });
  } else if (dr.includes('六合') || dr.includes('半合') || dr.includes('拱合')) {
    plus += 0.5;
    notes.push({ tone: 'good', text: '日支相合：生活習慣、作息合得來。' });
  }

  // 5. 八宅東西四命
  if (a.kua && b.kua) {
    notes.push({
      tone: 'info',
      text: a.kua.group === b.kua.group
        ? `兩人都是${a.kua.group}：住同一個家，房間方位容易一起安排。`
        : `${A}是${a.kua.group}、${B}是${b.kua.group}：同住時大門與客廳以主要負擔家計的人為主，另一人用臥室和床頭方向調整。`,
    });
  }

  // 通關：一方的五行剋另一方時，用「攻方所生、又能生守方」的五行接起來
  let bridge = null;
  if (attacker) {
    const [X, Y] = attacker === 'a' ? [da, db] : [db, da];
    bridge = SHENG[X];
    tips.unshift(`用「${bridge}」通關：${X}剋${Y}，但${X}生${bridge}、${bridge}生${Y}。家裡多放${BRIDGE[bridge].items}，有空${BRIDGE[bridge].together}。`);
  }
  if ((hurtsA || hurtsB) && tips.length < 4) tips.push('相處覺得累的時候先各自冷靜，不要在情緒上頭時談重要的事。');

  const mutual = helpsA && helpsB;
  const oneWay = helpsA !== helpsB;
  const friction = minus >= 1.5;
  let verdict;
  if (mutual) verdict = friction ? { tone: 'mid', label: '會吵，但彼此其實互補' } : { tone: 'good', label: '互相加分' };
  else if (oneWay) {
    // 一方得益、另一方卻覺得有壓力時，講清楚誰該多體諒誰（只說「誰是誰的助力」會漏掉另一半的感受）
    const lopsided = helpsA ? hurtsB : hurtsA;
    const who = helpsA ? `${B}是${A}的助力` : `${A}是${B}的助力`;
    const label = lopsided ? (helpsA ? `${B}幫${A}比較多，${A}要多體諒${B}` : `${A}幫${B}比較多，${B}要多體諒${A}`) : who;
    verdict = friction ? { tone: 'mid', label: `${label}；相處要磨合` } : { tone: lopsided ? 'mid' : 'good', label };
  } else if (friction) verdict = { tone: 'care', label: '容易摩擦，要多溝通' };
  else if (plus >= 1) verdict = { tone: 'good', label: '合得來' };
  else verdict = { tone: 'mid', label: '平穩，各自獨立' };

  return { ...verdict, notes, tips: tips.slice(0, 3), bridge, score: { plus, minus } };
}

// ── 從我的命盤看某一種家人
const STAR_WX = (dm, star) => ({
  比肩: dm, 劫財: dm, 食神: SHENG[dm], 傷官: SHENG[dm], 偏財: KE[dm], 正財: KE[dm], 七殺: RULED_BY[dm], 正官: RULED_BY[dm], 偏印: BORN_BY[dm], 正印: BORN_BY[dm],
}[star]);

/** 某種關係要看的六親星、宮位（四柱的第幾柱）、紫微宮 */
function roleOf(relation, gender, myGender) {
  switch (relation) {
    case 'parent':
      return {
        who: gender === '男' ? '父親' : gender === '女' ? '母親' : '父母',
        // 父看偏財；母看印星（正印為主，偏印也算，現代多不細分）
        stars: gender === '男' ? ['偏財'] : gender === '女' ? ['正印', '偏印'] : ['偏財', '正印'],
        pillar: 1, zw: '父母',
      };
    case 'spouse':
      return { who: '另一半', stars: myGender === '男' ? ['正財', '偏財'] : myGender === '女' ? ['正官', '七殺'] : [], pillar: 2, zw: '夫妻' };
    case 'child':
      return { who: '子女', stars: myGender === '男' ? ['七殺', '正官'] : myGender === '女' ? ['食神', '傷官'] : [], pillar: 3, zw: '子女' };
    case 'sibling':
      return { who: '兄弟姊妹', stars: ['比肩', '劫財'], pillar: 1, zw: '兄弟' };
    case 'elder':
      return { who: '長輩', stars: [], pillar: 0, zw: '父母' };
    case 'friend':
      return { who: '朋友', stars: ['比肩', '劫財'], pillar: null, zw: '僕役' };
    case 'colleague':
      return { who: '同事', stars: ['比肩', '劫財'], pillar: null, zw: '僕役' };
    default:
      return null;
  }
}
const PILLAR_NAME = ['年柱（祖上、長輩宮）', '月柱（父母、兄弟宮）', '日支（夫妻宮）', '時柱（子女宮）'];

const MUTAGEN_NOTE = {
  化祿: ['good', '有化祿：緣分深，會互相幫助。'],
  化權: ['info', '有化權：對方比較強勢，或你想主導這段關係。'],
  化科: ['good', '有化科：關係和睦，講得通道理。'],
  化忌: ['bad', '有化忌：牽掛多，容易為對方操心或有心結。'],
};

/**
 * 從「我」的命盤看這位家人：六親星、宮位（含今年流年有沒有沖到）、紫微對應宮。
 * @param me memberOf(我)；relation、gender 是這位家人的；ziwei 是我的紫微盤（可為 null）
 */
export function seenFromMe(me, relation, gender, { myGender = me.gender, ziwei = null, year }) {
  const role = roleOf(relation, gender, myGender);
  if (!role) return null;
  const lines = [];
  const { bazi, ys } = me;
  const pillars = bazi.pillars;
  if (role.stars.length) {
    let tou = 0;
    let cang = 0;
    for (const p of pillars) {
      if (!p) continue;
      if (role.stars.includes(p.shishen)) tou += 1;
      for (const hg of p.hidden) if (role.stars.includes(hg.shishen)) cang += 1;
    }
    const name = `${role.who}星（${role.stars.join('、')}）`;
    if (tou) lines.push({ tone: 'info', text: `${name}透出天干：${role.who}在你生命中的存在感強、影響大。` });
    else if (cang) lines.push({ tone: 'info', text: `${name}藏在地支裡：關係比較含蓄，心裡在意，但不常說出口。` });
    else lines.push({ tone: 'info', text: `命盤上的${name}不明顯：彼此比較獨立，緣分要靠經營。` });
    const wx = STAR_WX(bazi.dayMaster.wx, role.stars[0]);
    if (needs(me, wx)) lines.push({ tone: 'good', text: `${role.who}星屬${wx}，正好是你的喜用：${role.who}是你的助力，越親近越順。` });
    else if (dislikes(me, wx)) lines.push({ tone: 'bad', text: `${role.who}星屬${wx}，是你的忌：容易為${role.who}操心、有壓力，界線要清楚。` });
  } else if (relation === 'spouse' || relation === 'child') {
    lines.push({ tone: 'info', text: `看${role.who}星要知道你的性別（男命、女命取法不同），到「我的」補上就會出現。` });
  }
  if (role.pillar !== null) {
    const p = pillars[role.pillar];
    if (!p) {
      lines.push({ tone: 'info', text: `沒有出生時間，看不到${PILLAR_NAME[role.pillar]}。` });
    } else {
      const zhi = p.zhi;
      const clashed = pillars.filter((q, i) => q && i !== role.pillar && branchRelations(zhi, q.zhi).includes('六沖'));
      if (clashed.length) lines.push({ tone: 'bad', text: `${PILLAR_NAME[role.pillar]}被${clashed.map((q) => q.label).join('、')}沖：和${role.who}聚少離多，或觀念差異大。` });
      const yz = yearGanZhi(year)[1];
      const yr = branchRelations(zhi, yz);
      if (yr.includes('六沖')) lines.push({ tone: 'bad', text: `今年（${year}）流年${yz}沖到${PILLAR_NAME[role.pillar]}：和${role.who}的關係今年有變動（搬家、工作、想法改變），多溝通。` });
      else if (yr.includes('六合') || yr.includes('半合')) lines.push({ tone: 'good', text: `今年（${year}）流年${yz}合到${PILLAR_NAME[role.pillar]}：和${role.who}的關係今年比較靠近。` });
    }
  }
  if (ziwei) {
    const pal = ziwei.palaces.find((x) => x.name === role.zw);
    if (pal) {
      const borrowed = !pal.major.length;
      const majors = borrowed ? (ziwei.palaces.find((x) => x.index === (pal.index + 6) % 12) || { major: [] }).major : pal.major;
      const traits = majors.map((s) => STAR_KEYWORDS[s.name]).filter(Boolean);
      if (majors.length) {
        const fallen = majors.some((s) => s.brightness === '陷');
        lines.push({ tone: 'info', text: `紫微${role.zw}宮${borrowed ? '（無主星，借對宮）' : ''}是${majors.map((s) => `${s.name}${s.brightness ? `（${s.brightness}）` : ''}`).join('、')}：你眼中的${role.who}${traits.join('，')}。${fallen ? '有星曜落陷：這些特質比較容易變成缺點，多一點包容。' : ''}` });
      }
      for (const s of [...pal.major, ...pal.minor]) {
        const n = s.mutagen && MUTAGEN_NOTE[s.mutagen];
        if (n) lines.push({ tone: n[0], text: `${role.zw}宮的${s.name}${n[1]}` });
      }
    }
  }
  return { who: role.who, lines };
}

// ── 全家
/**
 * 全家的五行分布、誰是家裡的貴人、全家最需要的五行、今年要注意的人、房間方位。
 * @param members memberOf 的結果陣列
 */
export function familyOverview(members, year) {
  const byWx = Object.fromEntries(WX.map((w) => [w, members.filter((m) => m.dm === w).map((m) => m.name)]));
  const missing = WX.filter((w) => !byWx[w].length);
  const helpers = members
    .map((m) => ({ name: m.name, wx: m.dm, helps: members.filter((o) => o !== m && needs(o, m.dm)).map((o) => o.name) }))
    .filter((x) => x.helps.length >= 2)
    .sort((x, y) => y.helps.length - x.helps.length);
  const needCount = {};
  for (const m of members) if (m.ys) needCount[m.ys.primary] = (needCount[m.ys.primary] || 0) + 1;
  const topNeed = Object.entries(needCount).sort((x, y) => y[1] - x[1])[0] || null;
  const yz = yearGanZhi(year)[1];
  const watch = [];
  for (const m of members) {
    const ts = taiSui(m.zodiacZhi, yz);
    const trig = liunian(m.bazi, [year])[0].triggers;
    if (ts.length || trig.length) {
      watch.push({
        name: m.name,
        items: [
          ...(ts.length ? [`今年${ts.join('、')}：重大決定緩一緩，家人多互相照應；民俗可以安太歲。`] : []),
          ...trig.map((t) => t.text),
        ],
      });
    }
  }
  const rooms = members.filter((m) => m.kua).map((m) => {
    const d = (k) => m.kua.stars.find((s) => s.key === k).dir;
    return { name: m.name, kua: m.kua.name, group: m.kua.group, text: `臥室在房子的延年方（${d('延年')}）或天醫方（${d('天醫')}）最好；床頭朝天醫（${d('天醫')}），書桌面向生氣（${d('生氣')}）。` };
  });
  const groups = { 東四命: rooms.filter((r) => r.group === '東四命').length, 西四命: rooms.filter((r) => r.group === '西四命').length };
  return {
    byWx,
    missing,
    helpers,
    topNeed: topNeed ? { wx: topNeed[0], count: topNeed[1], ...BRIDGE[topNeed[0]] } : null,
    watch,
    rooms,
    groups,
  };
}

export { BRIDGE };
