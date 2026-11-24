// 月令格局（子平法）。
//
// 取格依《子平真詮》（清・沈孝瞻）的通行做法：
//   1. 月支是日主的祿位 → 建祿格；陽干的羊刃 → 羊刃格；陰干生在寅申巳亥、月令本氣是劫財 → 月劫格。
//   2. 月支和另外兩支三合成局 → 依局的五行取格（書中的「會支」）。
//   3. 月令藏干有透出年、月、時干的 → 取透出的（本氣、中氣、餘氣依序；比劫不取，祿劫不是用神）。
//   4. 都沒透 → 取本氣；四庫月（辰戌丑未）本氣剛好是比劫時，歸建祿月劫一類。
// 成敗：書中「論用神成敗救應」的成、敗、救應條件逐條寫成程式。原典網站在開發環境連不到，
//   畫面一律白話轉述、不放原文引句，避免引錯字。
//
// 為什麼要有格局、不只看喜用神：喜用神（扶抑法）看五行平衡，回答「缺什麼、補什麼」；
// 格局看月令（出生月的主氣）在這張盤扮演的角色，回答「一生的主軸是什麼、靠什麼成事」。
// 兩套角度不同，畫面分開講；開運、幸運色、姓名搭配仍照喜用神，不會因為格局整套翻轉。

import { LunarUtil } from '../../vendor/lunar.js';
import { shiShen, branchRelations, ganRelation, yongShen, LU, YANGREN } from './bazi.js';

const GROUPS = {
  官: ['正官'],
  殺: ['七殺'],
  官殺: ['正官', '七殺'],
  財: ['正財', '偏財'],
  印: ['正印', '偏印'],
  梟: ['偏印'],
  食: ['食神'],
  傷: ['傷官'],
  食傷: ['食神', '傷官'],
  比劫: ['比肩', '劫財'],
};
const QI = ['本氣', '中氣', '餘氣'];
// 三合局用中神（子午卯酉）的本氣決定十神，局的五行和陰陽才有確定的十神
const JU = [
  { zhis: ['申', '子', '辰'], wx: '水', gan: '癸' },
  { zhis: ['寅', '午', '戌'], wx: '火', gan: '丁' },
  { zhis: ['巳', '酉', '丑'], wx: '金', gan: '辛' },
  { zhis: ['亥', '卯', '未'], wx: '木', gan: '乙' },
];
const KIND_OF = { 正官: 'zhengguan', 七殺: 'qisha', 正財: 'zhengcai', 偏財: 'piancai', 正印: 'zhengyin', 偏印: 'pianyin', 食神: 'shishen', 傷官: 'shangguan' };
const MOTHER = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };
const CHILD = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const WEALTH = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };

export const GEJU_INFO = {
  zhengguan: {
    name: '正官格',
    core: '名分、規矩與責任',
    text: '月令是正官：一生的主軸在「名分與責任」。重紀律、守信用，做事按部就班，容易得到上司和制度的信任；適合在體制裡一步步往上，社會評價就是你最值錢的資產。',
    work: '公職、大企業、管理、法務、行政、品管這類重制度與信用的工作。',
    caution: '最怕「傷官見官」：說話衝撞上司、挑戰規則，會毀掉你最值錢的信用。',
    likes: ['正財', '偏財', '正印', '偏印'],
    fears: ['傷官', '七殺'],
  },
  qisha: {
    name: '七殺格',
    core: '壓力、魄力與決斷',
    text: '月令是七殺（又叫偏官）：一生的主軸在「壓力與魄力」。常被推到需要拍板、扛風險的位置；七殺有制有化就是權力（化殺為權），沒有制化就變成壓力、小人與是非。',
    work: '需要決斷與承擔的工作：主管、創業、軍警、法律、外科、業務開發、危機處理。',
    caution: '七殺最怕沒有制化又遇到財：財會再去生殺，壓力加倍；越忙越要顧身體。',
    likes: ['食神', '傷官', '正印', '偏印'],
    fears: ['正財', '偏財', '正官'],
  },
  zhengcai: {
    name: '正財格',
    core: '經營與踏實累積',
    text: '月令是正財：一生的主軸在「經營與累積」。重實際、會算帳，錢是一分一分存起來的；對家庭與承諾負責，越穩越有。',
    work: '財務、會計、銀行、穩定的業務與管理、實體店面經營。',
    caution: '財要「身能擔」：自己不夠強時貪多反而守不住；最怕比劫（借錢、作保、合夥分財）。',
    likes: ['正官', '食神', '傷官'],
    fears: ['比肩', '劫財', '七殺'],
  },
  piancai: {
    name: '偏財格',
    core: '機會、人脈與流動的財',
    text: '月令是偏財：一生的主軸在「機會與人脈」。慷慨、會交際、對市場敏感，錢來得快也去得快，適合經手大筆資金的流動。',
    work: '業務、貿易、投資、行銷、自營事業、仲介。',
    caution: '同樣怕比劫分財；偏財重流動不重死守，投資一定要設停損。',
    likes: ['正官', '食神', '傷官'],
    fears: ['比肩', '劫財', '七殺'],
  },
  zhengyin: {
    name: '正印格',
    core: '學習、庇護與名聲',
    text: '月令是正印：一生的主軸在「學習與庇護」。有長輩、老師、制度照顧，重學問與修養，名聲比錢更重要；做事有原則、讓人放心。',
    work: '教育、研究、文化出版、醫療、公部門、需要證照的專業。',
    caution: '最怕「財壞印」：為了錢放棄專業與名聲，或和長輩為錢翻臉，通常得不償失。',
    likes: ['正官', '七殺'],
    fears: ['正財', '偏財'],
  },
  pianyin: {
    name: '偏印格',
    core: '專精、偏門學問與獨到見解',
    text: '月令是偏印：一生的主軸在「獨門的專業」。思考和一般人不同，適合鑽研冷門或高門檻的技術，直覺強、悟性高；也容易想太多、獨來獨往。',
    work: '研究、技術專家、設計、命理宗教、醫藥、資訊安全這類需要獨到見解的領域。',
    caution: '偏印太重時怕「梟神奪食」：計畫想很多卻常在最後一步放棄，要逼自己把東西做完。',
    likes: ['正官', '七殺'],
    fears: ['正財', '偏財'],
  },
  shishen: {
    name: '食神格',
    core: '才華、口福與從容',
    text: '月令是食神：一生的主軸在「才華與從容」。個性溫和、有品味、懂得享受，靠手藝、作品、服務吃飯；不急不躁，福氣常是慢慢養出來的。',
    work: '餐飲、設計、藝術、教學、內容創作、服務業、技藝類工作。',
    caution: '最怕「梟神奪食」（偏印剋食神）：靈感與福氣被打斷；也別太安逸而失去鬥志。',
    likes: ['正財', '偏財'],
    fears: ['偏印'],
  },
  shangguan: {
    name: '傷官格',
    core: '表達、創新與挑戰規則',
    text: '月令是傷官：一生的主軸在「表達與突破」。聰明、口才好、點子多，不喜歡被管；才華需要出口（生財）或約束（佩印），才不會變成衝撞。',
    work: '創作、技術研發、自由業、顧問、律師、業務、演藝與自媒體。',
    caution: '最怕「傷官見官」：和上司、規章正面衝突，容易惹官非口舌；說話留三分。',
    likes: ['正財', '偏財', '正印', '偏印'],
    fears: ['正官'],
  },
  jianlu: {
    name: '建祿格',
    core: '靠自己、白手起家',
    text: '月令是日主的祿位：一生的主軸在「靠自己」。自尊心強、能吃苦，祖業與長輩的幫助通常不多，憑本事打天下；盤裡有財、官可以用，就是自立成家的好格局。',
    work: '自己能掌握節奏的工作：專業技術、業務、創業、主管。',
    caution: '比劫已經很旺，怕再遇到比劫（朋友借錢、合夥分利），錢財要分清楚。',
    likes: ['正官', '正財', '偏財', '食神', '傷官'],
    fears: ['比肩', '劫財'],
  },
  yuejie: {
    name: '月劫格',
    core: '競爭心與自立',
    text: '月令是日主的比劫：一生的主軸在「靠自己、和人競爭」。不服輸、行動力強，和同儕、手足互相比較也互相支援；和建祿格同一類看法，要看盤裡有沒有財、官可以用。',
    work: '業務、競爭性強的行業、創業、運動與技術競賽型的工作。',
    caution: '劫財容易破財：合夥、作保、借貸都要白紙黑字。',
    likes: ['正官', '正財', '偏財', '食神', '傷官'],
    fears: ['比肩', '劫財'],
  },
  yangren: {
    name: '羊刃格',
    core: '強悍、果決與競爭',
    text: '月令是日主的羊刃：力量非常強，個性剛烈、果決、不服輸。需要官殺來駕馭，才能變成武職、管理、外科、執法這類需要膽識的成就；沒有約束就容易衝動、破財、受傷。',
    work: '軍警、外科、執法、運動、工程現場主管、需要魄力的管理職。',
    caution: '怕沒有官殺約束、怕傷官破壞約束；脾氣上來時先停十秒。',
    likes: ['正官', '七殺', '正財', '偏財'],
    fears: ['傷官', '比肩', '劫財'],
  },
};

export const STATUS_TEXT = {
  成格: '主軸有幫手、沒有被破壞，這個格局的優點容易發揮出來。',
  成中帶忌: '大方向是好的，但盤裡有一個會扯後腿的字；大運、流年再遇到它時要特別小心。',
  破格: '主軸被干擾，格局的優點打折、比較辛苦；要靠大運補上缺的東西，或後天選對環境。',
  敗中有救: '原本有破格的因素，但盤裡有字把它化解了，等於問題有人收拾，結果還是能成局。',
  平常: '月令的力量沒有明顯的幫手，也沒有被破壞；好壞多半看大運補上什麼。',
};

/** 盤上的事實：透出的天干（年、月、時干）、其他三柱地支的本氣、強弱與五行份量 */
function factsOf(bazi) {
  const [, month, day] = bazi.pillars;
  const stems = bazi.pillars.filter((p) => p && p.label !== '日柱').map((p) => ({ at: `${p.label[0]}干${p.gan}`, gan: p.gan, ss: p.shishen, label: p.label }));
  const roots = bazi.pillars.filter((p) => p && p.label !== '月柱').map((p) => ({ at: `${p.label[0]}支${p.zhi}`, zhi: p.zhi, ss: p.hidden[0].shishen }));
  const ys = yongShen(bazi);
  const dm = day.gan;
  const dmWx = bazi.dayMaster.wx;
  const total = Object.values(ys.weight).reduce((a, b) => a + b, 0);
  const wxOf = { 比劫: dmWx, 印: MOTHER[dmWx], 食傷: CHILD[dmWx], 財: WEALTH[dmWx], 官殺: Object.keys(WEALTH).find((w) => WEALTH[w] === dmWx) };
  const tou = (g) => stems.filter((s) => GROUPS[g].includes(s.ss));
  const root = (g) => roots.filter((r) => GROUPS[g].includes(r.ss));
  const see = (g) => tou(g).length > 0 || root(g).length > 0;
  const seeList = (g) => [...tou(g), ...root(g)];
  // 被合：這類十神的天干和「緊鄰」的另一個天干五合，作用被牽住。隔一位不算合（中間的字擋住），
  // 日主合別人也不算合去（合我仍為我用）——所以實際上只有年干、月干之間會合去。
  const POS = { 年柱: 0, 月柱: 1, 時柱: 3 };
  const heQu = (g) => tou(g).some((s) => stems.some((o) => Math.abs(POS[o.label] - POS[s.label]) === 1 && ganRelation(s.gan, o.gan) === '五合'));
  const at = (list) => list.map((x) => x.at).join('、');
  const share = (g) => (total ? ys.weight[wxOf[g]] / total : 0);
  return { bazi, month, dm, dmWx, stems, roots, ys, tou, root, see, seeList, heQu, at, share, strength: ys.strength };
}

/** 取格：回傳 kind 與取法說明 */
function pickGe(f) {
  const { bazi, month, dm, stems } = f;
  const mz = month.zhi;
  const main = month.hidden[0];
  const branches = bazi.pillars.filter(Boolean).map((p) => p.zhi);
  const notes = [];
  if (LU[dm] === mz) return { kind: 'jianlu', how: `月支${mz}是日主${dm}的祿位（臨官）。`, notes };
  if (YANGREN[dm] === mz) return { kind: 'yangren', how: `月支${mz}是日主${dm}的羊刃（帝旺）。`, notes };
  if (main.shishen === '劫財' && !'辰戌丑未'.includes(mz)) return { kind: 'yuejie', how: `月令${mz}的本氣${main.gan}是日主的劫財（陰干逢劫）。`, notes };

  const ju = JU.find((j) => j.zhis.includes(mz) && j.zhis.every((z) => branches.includes(z)));
  if (ju) {
    const ss = shiShen(dm, ju.gan);
    if (!GROUPS.比劫.includes(ss)) return { kind: KIND_OF[ss], fromJu: true, how: `月支${mz}和${ju.zhis.filter((z) => z !== mz).join('、')}三合成${ju.wx}局，依局的五行取格（${ju.wx}是日主的${ss}）。`, notes };
    notes.push(`月支${mz}三合成${ju.wx}局，和日主同五行，自身的力量更強。`);
  }
  const hidden = month.hidden.map((hg, i) => ({ ...hg, qi: QI[i], where: stems.filter((s) => s.gan === hg.gan).map((s) => s.at) }));
  const pick = hidden.find((hg) => hg.where.length && !GROUPS.比劫.includes(hg.shishen));
  const list = month.hidden.map((x) => x.gan).join('');
  if (pick) return { kind: KIND_OF[pick.shishen], how: `月令${mz}藏${list}，${pick.qi}${pick.gan}（${pick.shishen}）透出在${pick.where.join('、')}，取透出的字為格。`, notes };
  if (GROUPS.比劫.includes(main.shishen)) return { kind: 'yuejie', how: `月令${mz}的本氣${main.gan}是日主的${main.shishen}，藏干也沒有其他字透出，歸建祿月劫一類。`, notes };
  return { kind: KIND_OF[main.shishen], how: `月令${mz}藏${list}，沒有透出天干，以本氣${main.gan}（${main.shishen}）取格。`, notes };
}

/** 建祿、月劫、羊刃格要另外找「用」：透出的官、財、殺、食傷 */
function luUse(f, kind) {
  const order = kind === 'yangren' ? [['官', '用官'], ['殺', '用殺'], ['財', '用財'], ['食傷', '用食傷']] : [['官', '用官'], ['財', '用財'], ['殺', '用殺'], ['食傷', '用食傷']];
  const hit = order.find(([g]) => f.tou(g).length);
  return hit ? { group: hit[0], name: hit[1] } : null;
}

/**
 * 各格的成、敗、救應。每一條：{ tone: 'good' | 'bad' | 'rescue', text }。
 * 敗的條件若被救應化解，改記成 rescue；沒被化解的 bad 才算數。
 */
function judge(kind, f, fromJu = false) {
  const items = [];
  const good = (text) => items.push({ tone: 'good', text });
  // bad 附帶救應清單 [[條件, 說明]]：第一個成立的救應取代這條敗
  const bad = (text, rescues = []) => {
    const hit = rescues.find(([ok]) => ok);
    items.push(hit ? { tone: 'rescue', text: `${text}${hit[1]}` } : { tone: 'bad', text });
  };
  const { tou, root, see, seeList, heQu, at, share, strength } = f;
  const mz = f.month.zhi;
  const others = f.bazi.pillars.filter((p) => p && p.label !== '月柱');
  const rel = (p) => branchRelations(mz, p.zhi);
  const chong = others.filter((p) => rel(p).includes('六沖'));
  // 拱合（缺中神的兩支）力量弱，不算解沖
  const heJie = others.filter((p) => !chong.includes(p) && rel(p).some((r) => ['六合', '半合'].includes(r)));
  const zhiAt = (list) => list.map((p) => `${p.label[0]}支${p.zhi}`).join('、');

  switch (kind) {
    case 'zhengguan': {
      if (tou('財').length) good(`財生官（${at(tou('財'))}）：官星有財來生，名分有實質支撐，努力容易換到位置與收入。`);
      if (tou('印').length) good(`官印相生（${at(tou('印'))}）：有官有印，責任與學識、名聲互相成全，適合循正途升遷。`);
      if (tou('傷').length) bad(`傷官見官（${at(tou('傷'))}）：傷官剋正官，容易因為說話太直、挑戰規則而失去信任。`, [[tou('印').length, `但有印（${at(tou('印'))}）制住傷官：衝動有人踩煞車，破而能救。`]]);
      if (tou('殺').length) bad(`官殺混雜（${at(tou('殺'))}）：正官、七殺同時透出，規矩與壓力兩頭拉，方向容易搖擺。`, [[heQu('殺'), '但七殺被合住（合殺留官），反而變清。'], [tou('食').length, `但有食神（${at(tou('食'))}）制住七殺（去殺留官），反而變清。`]]);
      if (heQu('官')) bad('正官被合：官星被旁邊的天干合住，名分容易被牽絆，或機會讓給別人。');
      if (chong.length) bad(`月令${mz}被${zhiAt(chong)}沖：官星的根動搖，工作、職位容易變動。`, [[heJie.length, `但${zhiAt(heJie)}合住月令，合能解沖，變動有限。`]]);
      break;
    }
    case 'qisha': {
      const ren = YANGREN[f.dm] ? f.bazi.pillars.filter((p) => p && p.zhi === YANGREN[f.dm]) : [];
      if (see('食傷') && strength !== '身弱') good(`身強殺有制（${at(seeList('食傷'))}）：壓力被食傷轉成執行力，越難的事越扛得住，化殺為權。`);
      if (tou('印').length) good(`殺印相生（${at(tou('印'))}）：七殺生印、印再生身，把壓力轉成資源與地位，適合在制度或專業裡掌權。`);
      if (ren.length) good(`羊刃駕殺（${zhiAt(ren)}）：自身的剛強剛好扛得住七殺，有膽識、鎮得住場面。`);
      if (tou('財').length && !see('食傷') && !tou('印').length) bad(`七殺逢財無制（${at(tou('財'))}）：財再去生七殺，又沒有食傷制、印化，壓力與是非加倍。`);
      else if (!see('食傷') && !tou('印').length && !ren.length && strength === '身弱') bad('殺重身輕：七殺當令、日主偏弱，又沒有制化，壓力常超過能承受的範圍。');
      if (tou('官').length) bad(`官殺混雜（${at(tou('官'))}）：正官、七殺同時透出，方向容易搖擺。`, [[heQu('官'), '但正官被合住（合官留殺），反而變清。'], [tou('傷').length, `但有傷官（${at(tou('傷'))}）去掉正官（去官留殺），反而變清。`]]);
      break;
    }
    case 'zhengcai':
    case 'piancai': {
      if (tou('官').length) good(`財旺生官（${at(tou('官'))}）：錢能換到地位，地位又保護財，事業與財富互相成全。`);
      if (tou('食傷').length && strength !== '身弱') good(`食傷生財、自己擔得起（${at(tou('食傷'))}）：才華與技術能直接變現。`);
      // 財、印都透時，兩字不能緊貼（年干、月干相鄰），否則財直接剋印
      const yin = tou('印');
      const cai = tou('財');
      const touching = yin.some((a) => cai.some((b) => Math.abs(['年柱', '月柱', '日柱', '時柱'].indexOf(a.label) - ['年柱', '月柱', '日柱', '時柱'].indexOf(b.label)) === 1));
      if (yin.length && !touching) good(`財格透印、位置不相礙（${at(yin)}）：有財也有印，既會賺也有靠山與規劃。`);
      if (tou('比劫').length && share('財') < share('比劫')) bad(`財輕比重（${at(tou('比劫'))}）：比劫比財旺，錢容易被朋友、合夥、競爭分走。`, [[tou('食傷').length, `但有食傷（${at(tou('食傷'))}）把比劫的力量轉去生財，通關化解。`], [tou('官').length, `但有正官（${at(tou('官'))}）管住比劫，財得以保全。`]]);
      if (tou('殺').length) bad(`財透七殺（${at(tou('殺'))}）：財去生七殺，賺錢伴隨壓力、官非或小人。`, [[see('食'), `但有食神（${at(seeList('食'))}）制住七殺，財反而安全。`], [heQu('殺'), '但七殺被合住（存財合殺），壓力解除。']]);
      break;
    }
    case 'zhengyin':
    case 'pianyin': {
      // 三合成局時，局的力量不在逐字的份量裡，直接算重
      const heavy = fromJu || share('印') >= 1 / 3;
      if (tou('殺').length && !heavy) good(`印輕逢殺（${at(tou('殺'))}）：七殺生印，壓力反而變成養分，越磨越有分量。`);
      if (tou('官').length) good(`官印雙全（${at(tou('官'))}）：有名分也有靠山，適合體制內、專業資格路線。`);
      if (strength === '身強' && tou('食傷').length) good(`身印兩旺、用食傷洩秀（${at(tou('食傷'))}）：學到的東西有出口，能教、能寫、能做出作品。`);
      if (heavy && tou('財').length && !root('財').length) good(`印多逢財、財透根輕（${at(tou('財'))}）：剛好把過多的印收斂，不讀死書，懂得把學問變現。`);
      if (!heavy && tou('財').length) bad(`印輕逢財（${at(tou('財'))}）：財剋印，容易為了錢放棄學業或名聲，或和長輩意見不合。`, [[tou('比劫').length, `但有比劫（${at(tou('比劫'))}）擋住財，護住了印。`], [heQu('財'), '但財被合住（合財存印），印保住了。']]);
      if (strength === '身強' && heavy && tou('殺').length) bad(`身強印重又透七殺（${at(tou('殺'))}）：七殺再生印，印太多反而懶散、依賴、想很多卻不行動。`);
      break;
    }
    case 'shishen': {
      if (tou('財').length) good(`食神生財（${at(tou('財'))}）：靠手藝、口才、作品賺錢，賺得從容。`);
      if (tou('殺').length && !tou('財').length) good(`食神制殺（${at(tou('殺'))}）：用才華與溫和的手段化解壓力，以柔克剛。`);
      if (tou('梟').length) bad(`梟神奪食（${at(tou('梟'))}）：偏印剋食神，靈感與福氣容易被打斷，計畫常卡在最後一步。`, [[tou('殺').length, `但有七殺（${at(tou('殺'))}）：偏印轉去化殺（棄食就殺），反而成格。`], [tou('財').length, `但有財（${at(tou('財'))}）制住偏印，護住食神。`]]);
      if (tou('財').length && tou('殺').length) bad(`生財又露七殺（${at(tou('殺'))}）：食神生的財再去生殺，好不容易賺到的反而招來壓力。`);
      break;
    }
    case 'shangguan': {
      const strong = fromJu || share('食傷') >= 1 / 3;
      const jinShui = f.dmWx === '金' && ['亥', '子', '丑'].includes(mz);
      if (tou('財').length) good(`傷官生財（${at(tou('財'))}）：把才華、點子變成收入，最適合創業、接案、技術變現。`);
      if (tou('印').length && strong && root('印').length) good(`傷官佩印（${at(tou('印'))}）：才華有約束、有修養，說話做事有分寸，容易成為專業權威。`);
      if (strength === '身弱' && strong && tou('殺').length && tou('印').length) good(`傷官旺、身弱而透殺印（${at([...tou('殺'), ...tou('印')])}）：殺生印、印生身又制傷，反而平衡成局。`);
      if (tou('殺').length && !tou('財').length) good(`傷官駕殺（${at(tou('殺'))}）：用才華與膽識壓住壓力，適合需要突破、競爭的領域。`);
      if (tou('官').length && jinShui) good(`金水傷官喜見官（${at(tou('官'))}）：冬天的金水偏寒，見官（火）反而暖局，是例外的好組合。`);
      else if (tou('官').length) bad(`傷官見官（${at(tou('官'))}）：才華和規矩正面衝突，容易得罪上司、惹口舌官非。`, [[tou('印').length, `但有印（${at(tou('印'))}）制住傷官，衝突可控。`]]);
      if (tou('財').length && tou('殺').length) bad(`生財又帶七殺（${at(tou('殺'))}）：財去生殺，賺錢伴隨壓力。`, [[heQu('殺'), '但七殺被合住，壓力解除。']]);
      if (tou('印').length && !strong && strength === '身強') bad(`佩印卻傷輕身旺（${at(tou('印'))}）：印把僅有的才華壓住，空有能力卻放不開。`);
      break;
    }
    case 'yangren': {
      if (tou('官殺').length && !tou('食傷').length) {
        const aid = [...tou('財'), ...tou('印')];
        good(`陽刃透官殺（${at(tou('官殺'))}）：剛強的力量有官殺駕馭，能成為鎮得住場面的主管或專業人才${aid.length ? `，又有財、印（${at(aid)}）輔助，格局更完整` : ''}。`);
      }
      if (!see('官殺')) bad('陽刃無官殺：力量太強又沒有約束，容易衝動、爭執、破財或受傷。');
      else if (!tou('官殺').length) items.push({ tone: 'note', text: `官殺只藏在地支（${at(root('官殺'))}），約束的力量不夠明顯，要靠大運補上。` });
      if (tou('官殺').length && tou('食傷').length) bad(`用官殺卻帶食傷（${at(tou('食傷'))}）：管住你的力量被食傷破壞。`, [[tou('印').length, `但有印（${at(tou('印'))}）護住官殺，仍能成局。`]]);
      break;
    }
    case 'jianlu':
    case 'yuejie': {
      if (tou('官').length && (see('財') || see('印'))) good(`透官又有財、印相輔（${at(tou('官'))}）：自立之外有名分與資源，是白手起家的好格局。`);
      if (tou('財').length && see('食傷')) good(`透財又有食傷生財（${at(tou('財'))}）：靠自己的本事開源，越做越有。`);
      if (tou('殺').length && see('食傷')) good(`透七殺而有食傷制住（${at(tou('殺'))}）：能在競爭裡闖出位置。`);
      if (!tou('財').length && !tou('官').length && ((tou('殺').length && !see('食傷')) || tou('印').length)) {
        const only = [tou('殺').length ? '七殺' : '', tou('印').length ? '印' : ''].filter(Boolean).join('、');
        bad(`沒有財、官，只透出${only}（${at([...tou('殺'), ...tou('印')])}）：自己的力量沒有出口，容易辛苦卻成果有限。`);
      }
      if (tou('官').length && tou('傷').length) bad(`用官卻遇傷官（${at(tou('傷'))}）：名分容易被自己的衝動破壞。`, [[heQu('傷'), '但傷官被合住，官星保住了。']]);
      if (tou('官').length && heQu('官')) bad('用官而官星被合：名分被旁邊的字牽住，機會容易讓給別人。');
      if (tou('財').length && tou('殺').length && !see('食傷')) bad(`用財卻帶七殺（${at(tou('殺'))}）：財去生殺，賺得到卻壓力大。`, [[heQu('殺'), '但七殺被合住，財得以保全。']]);
      break;
    }
    default:
      break;
  }
  return items;
}

function statusOf(items) {
  const bads = items.filter((x) => x.tone === 'bad').length;
  const goods = items.filter((x) => x.tone === 'good').length;
  const rescues = items.filter((x) => x.tone === 'rescue').length;
  if (bads) return goods ? '成中帶忌' : '破格';
  if (rescues) return '敗中有救';
  return goods ? '成格' : '平常';
}

/** 某個十神對這個格局是幫忙、干擾還是影響不大（大運、流年用） */
export function gejuTone(g, ss) {
  if (!g || !ss) return '';
  if (g.likes.includes(ss)) return '喜';
  if (g.fears.includes(ss)) return '忌';
  return '平';
}

/**
 * 月令格局。
 * @param bazi buildBazi 的結果
 * @returns {null | {kind, name, use, how, notes, status, statusText, items, info, likes, fears, dayun}}
 */
export function geju(bazi) {
  if (!bazi || !bazi.ok || !Array.isArray(bazi.pillars) || !bazi.pillars[1]) return null;
  const f = factsOf(bazi);
  const { kind, how, notes, fromJu = false } = pickGe(f);
  if (!bazi.pillars[3]) notes.push('沒有出生時間：時干、時支沒有算進來，成敗的判斷可能不同。');
  if (bazi.uncertain.some((t) => t.includes('月柱'))) notes.push('出生當天交節氣，月柱還不確定，格局也可能不同；補上出生時間才準。');
  if (f.ys.special) notes.push(`這張盤可能是「${f.ys.special.name}」（外格）：外格不照一般的成敗看，下面的判斷僅供參考。`);
  const info = GEJU_INFO[kind];
  const use = ['jianlu', 'yuejie', 'yangren'].includes(kind) ? luUse(f, kind) : null;
  const items = judge(kind, f, fromJu);
  if (['jianlu', 'yuejie'].includes(kind) && !use) items.push({ tone: 'note', text: '盤上沒有透出財、官、食傷可以用，自己的力量需要出口，要看大運帶來什麼。' });
  // 印、傷官的喜忌會隨輕重改變：印太重反而喜財、食傷，忌再來七殺與印
  let { likes, fears } = info;
  if ((kind === 'zhengyin' || kind === 'pianyin') && (fromJu || f.share('印') >= 1 / 3)) {
    likes = ['食神', '傷官', '正財', '偏財'];
    fears = ['七殺', '正印', '偏印'];
  }
  if (kind === 'shangguan' && f.dmWx === '金' && ['亥', '子', '丑'].includes(f.month.zhi)) {
    likes = [...likes, '正官'];
    fears = [];
  }
  const status = statusOf(items);
  const g = { kind, name: info.name, use: use ? use.name : '', how, notes, status, statusText: STATUS_TEXT[status], items, info, likes, fears };
  // 目前的大運對格局：天干看十神，地支看本氣十神
  const cur = bazi.yun ? bazi.yun.list.find((d) => d.current) : null;
  if (cur) {
    const zhiSs = shiShen(f.dm, LunarUtil.ZHI_HIDE_GAN[cur.ganzhi[1]][0]);
    g.dayun = { ganzhi: cur.ganzhi, gan: { ss: cur.shishen, tone: gejuTone(g, cur.shishen) }, zhi: { ss: zhiSs, tone: gejuTone(g, zhiSs) } };
  }
  return g;
}
