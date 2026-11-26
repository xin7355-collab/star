// 配對的「老師怎麼看」：把星盤合盤（synastry.js）和八字合婚（family.js 的 pairOf）合起來，
// 依兩人現在的關係（還在認識／交往中／已婚或同居）給：斷語、原因、化解（弱的地方逐項給做法）、加分的地方、
// 下一步怎麼走、紅燈與求助專線、搭配看哪些工具，還有兩個人都順的日子。純函式，可在 Node 測試；畫面在 js/views/match.js。
//
// 寫給以後改文案的人：
// - 命盤講的是「哪裡容易卡、要多花多少力氣」，不是「能不能在一起」。不替人決定分手，給判斷的方法（三件事、婚前五件事）。
// - 有暴力、控制、威脅這類紅燈，不管命盤多合都先保護自己，附專線（2026-11 查證：113 保護專線、1925 安心專線
//   都是 24 小時；412-8185 家庭教育諮詢專線，手機撥 02-412-8185，有固定服務時段）。
// - 民俗化解（通關五行、生肖六合）標明是民俗做法；真正的化解寫成做得到的相處方法。
// - 口吻是命理老師對面講話：先下斷語，再講白話的原因，最後一定給做法。不嚇人、不打包票。

import { branchRelations, ganRelation } from './bazi.js';
import { BRIDGE } from './family.js';
import { liuheAnimal } from './master-texts.js';
import { SIGN_ASPECTS } from './zodiac.js';

export const STATUSES = [
  { value: 'dating', label: '還在認識' },
  { value: 'couple', label: '交往中' },
  { value: 'married', label: '已婚／同居' },
];

export const LEVELS = [
  { id: 'hard', label: '挑戰較多' },
  { id: 'work', label: '用心經營' },
  { id: 'good', label: '合得來' },
  { id: 'great', label: '天作之合' },
];

const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };

// 星盤四項（synastry.js 的 THEMES）：強的時候怎麼用、弱的時候怎麼化解
const THEME = {
  emotion: {
    name: '情感默契',
    strong: '情緒很合拍，懂得對方需要什麼，這是感情最好的地基。',
    weak: '情緒節奏不同步：一個想說、一個想靜，常常一個在氣頭上、一個還沒進入狀況。',
    use: '把「懂對方」用在關鍵時刻：對方低潮時，你就是他最好的避風港。',
    fix: { title: '化解：情緒不同步', steps: ['每天留十分鐘問「你今天還好嗎」，只聽，不急著給建議。', '吵架時說「我覺得……」，不說「你都……」。', '約好一個暫停暗號：誰說出口就先停二十分鐘，冷靜了再談。'] },
  },
  attraction: {
    name: '吸引力',
    strong: '吸引力強，看到對方就有感覺。',
    weak: '火花比較少，日子一忙容易變成室友。',
    use: '你們的吸引力是天生的優勢，別讓忙碌把它磨掉：約會照排，打扮照做。',
    fix: { title: '化解：火花變少', steps: ['每兩週一次「第一次約會」：去一個兩個人都沒去過的地方。', '每天至少一次擁抱或牽手，身體的親近不要只留在晚上。', '說出對方吸引你的地方，越具體越好，例如「你剛剛專心修東西的樣子很帥」。'] },
  },
  talk: {
    name: '溝通理解',
    strong: '講話對得上，討論事情很少誤會。',
    weak: '說話方式不同，同一句話容易聽成兩個意思。',
    use: '你們很會一起想事情：旅行、買房、創業這種要討論的事，一起規劃特別順。',
    fix: { title: '化解：容易誤會', steps: ['重要的事（時間、錢、答應對方的事）用文字再確認一次。', '回應前先複述：「你的意思是……對嗎？」', '一次只談一件事，不翻舊帳。'] },
  },
  bond: {
    name: '長久穩定',
    strong: '責任感和承諾感相近，適合走長遠。',
    weak: '談到長期的事（錢、責任、未來）壓力比較大。',
    use: '你們適合長跑：一起訂三年、五年的目標，會越走越穩。',
    fix: { title: '化解：長期壓力大', steps: ['把錢、家務、雙方家人的分工寫下來，一年檢查一次。', '每一季開一次「兩人會議」：這段時間哪裡好、哪裡要改。', '壓力大時直接說「我現在需要……」，不要讓對方猜，也別把對方當出氣筒。'] },
  },
};

// 只有太陽星座（快速配對）時：照星座相位給化解（synastry.js 的 relationStory 只有兩句提醒）
const QUICK_FIX = {
  0: { title: '化解：太像了，缺點一起放大', steps: ['同樣的脾氣不要一起發：一個人上火時，另一個人先退一步。', '各自保留自己的朋友和興趣，不要把對方當成全世界。', '吵架時先說一件對方做得好的事，再說要改的地方。'] },
  1: THEME.talk.fix,
  3: THEME.emotion.fix,
  5: THEME.talk.fix,
  6: { title: '化解：互相吸引又互相拉扯', steps: ['把對方當成鏡子：他讓你不舒服的地方，常常是你自己也有的課題。', '爭執時找第三個選擇，不要比誰贏。', '輪流當決定的人：這次聽你的，下次聽我的。'] },
};

const VERDICT = {
  great: '是少見的好組合：彼此懂，也有吸引力。好姻緣也要用心顧，別把順當成理所當然。',
  good: '整體合得來，個性和相處的節奏大致對得上；有一兩個地方要磨，磨過了就是你們的默契。',
  work: '是「要用心經營」的組合：不是不合，是相處要多花一點力氣。方法對了，一樣走得長長久久。',
  hard: '先天的拉扯比較多。老師不會叫你們分開，但要說實話：這段關係要比別人多付出，值不值得、做不做得到，要你們自己決定。',
};
const SPARK = '星盤看你們很來電，八字看過日子的習慣、誰主導容易卡：談戀愛甜，住在一起才是真正的功課。';
const SLOW = '星盤看個性差得多，八字卻是互相幫忙的組合：一開始不一定來電，越相處越覺得對方可靠，是「日久見真情」型。';

const PATH = {
  dating: {
    title: '還在認識：要不要繼續？',
    lead: {
      great: '緣分不錯，可以大方往前走。只是「合」不等於「對」，用三個月好好確認下面三件事。',
      good: '緣分不錯，可以大方往前走。只是「合」不等於「對」，用三個月好好確認下面三件事。',
      work: '不是不能走，要先看你們願不願意為對方調整。用下面三件事檢查，比分數還準。',
      hard: '命盤顯示磨合成本高。還在認識的階段，老師建議放慢腳步、不急著定下來，多看看他在壓力下、在你家人朋友面前是什麼樣子。',
    },
    checklist: [
      '吵架之後能好好和好，問題有被解決，不是同一件事一吵再吵。',
      '對未來（要不要結婚、生小孩、錢怎麼管、住哪裡）談得出共識，至少願意好好談。',
      '跟他在一起，你更像自己、更有力量，不是更累、更小心翼翼。',
    ],
    rule: '三件都是：分數再低也值得走下去。兩件以上不是：分數再高也要認真想想，及早放手，對兩個人都好。',
  },
  couple: {
    title: '交往中：要不要走向婚姻？',
    lead: {
      great: '感情的地基好，可以開始談長遠的事了。',
      good: '感情的地基好，可以開始談長遠的事了。',
      work: '走得下去，但結婚前要把容易卡的地方先談開。',
      hard: '先天磨合多。結婚前，老師建議先同住或一起長途旅行看看，真實的生活最準。',
    },
    checklist: [
      '錢：要不要共同帳戶、誰管錢、能接受多少負債。',
      '家務：誰做什麼，忙的時候怎麼分。',
      '雙方家人：過年怎麼過、要不要和長輩住。',
      '小孩：要不要生、生幾個、誰帶。',
      '工作與住處：誰的工作優先、要不要搬家。',
    ],
    rule: '這五件都談得出共識，命盤上的弱點就只是小摩擦；談不攏的那一件，就是你們最該先處理的功課。',
  },
  married: {
    title: '已經結婚：老師不談分，談怎麼過得更好',
    lead: {
      great: '底子好，婚姻還是要經營。命盤告訴你們「容易在哪裡吵」，知道了就能先繞開。',
      good: '婚姻裡合不合只是起點。命盤告訴你們「容易在哪裡吵」，知道了就能先繞開。',
      work: '婚姻裡合不合只是起點。命盤告訴你們「容易在哪裡吵」，知道了就能先繞開。',
      hard: '婚姻裡合不合只是起點，你們要比別人多用一點心。如果已經很累了，找專業的人一起談不是失敗，是對這段婚姻的投資。',
    },
    checklist: [
      '每週一段兩人時間：不談小孩、不談帳單，只聊彼此。',
      '吵架三不：不翻舊帳、不在孩子面前、冷戰不過夜。',
      '每天說一件感謝對方的事，越具體越好。',
      '各自保留一點空間：自己的朋友、興趣、獨處時間。',
    ],
    rule: '四件做到三件，命盤上的弱點就只是偶爾的摩擦。',
    help: '想找人聊夫妻溝通：家庭教育諮詢專線 412-8185（手機撥 02-412-8185），免費，有固定服務時段。',
  },
};

export const RED_FLAGS = {
  title: '不管命盤怎麼說，先保護自己',
  items: [
    '動手、摔東西，或威脅要傷害你、傷害自己。',
    '控制你的錢、手機、交友和行蹤。',
    '一再說謊、劈腿，答應會改卻一直沒改。',
    '酗酒、賭博、吸毒，不肯處理。',
    '你在他身邊常常害怕、不敢說真話。',
  ],
  note: '有這些情況，再好的命盤都不值得你留下。',
  help: '有危險先打 110；家暴、性暴力打 113 保護專線（24 小時、免付費）；心裡撐不住時打 1925 安心專線（24 小時）。',
};

/** 0～3：星盤總分（和 synastry.js 的 labelFor 同一組門檻） */
const astroLevel = (total) => (total >= 85 ? 3 : total >= 70 ? 2 : total >= 55 ? 1 : 0);
/** 0～3：八字合婚（pairOf 的 tone：good 互相加分／mid 要磨合／care 容易摩擦） */
const baziLevel = (pair) => (pair.tone === 'good' ? (pair.score.plus >= 2 ? 3 : 2) : pair.tone === 'mid' ? 1 : 0);

/**
 * @param {{astro:object, bazi?:{pair:object, a:object, b:object}|null, status?:string, names:[string,string], watch?:{name:string, items:string[]}[]}} o
 *   astro：synastry.scorePair 的結果；bazi：family.pairOf 的結果和兩人的 memberOf；watch：family.familyOverview(...).watch（今年要注意的人）
 */
export function coupleReading({ astro, bazi = null, status = 'couple', names, watch = [] }) {
  const [A, B] = names;
  const st = PATH[status] ? status : 'couple';
  const a = astroLevel(astro.total);
  const b = bazi ? baziLevel(bazi.pair) : null;
  // 兩套都有時取平均（四捨五入到整數）；八字只有 0～3 的粗分，星盤是細分數，兩邊一樣重
  const n = b === null ? a : Math.round((a + b) / 2 - 0.01);
  const level = LEVELS[Math.max(0, Math.min(3, n))].id;
  let pattern = null;
  if (b !== null && a >= 2 && b <= 1) pattern = 'spark';
  else if (b !== null && a <= 1 && b >= 2) pattern = 'slow';
  const verdict = `老師看${A}和${B}這一對：${pattern === 'spark' ? SPARK : pattern === 'slow' ? SLOW : VERDICT[level]}`;

  const why = [];
  const remedies = [];
  const boosts = [];
  if (astro.mode === 'aspects') {
    const bands = [...astro.bands].sort((x, y) => y.score - x.score);
    const top = bands[0];
    if (top.score >= 60) {
      why.push({ tone: 'good', text: `星盤・${THEME[top.id].name}最好：${THEME[top.id].strong}` });
      if (top.score >= 70) boosts.push(THEME[top.id].use);
    }
    // 最弱的兩項（低於 60 才算弱）
    for (const w of bands.slice(-2).reverse().filter((x) => x.score < 60)) {
      why.push({ tone: 'bad', text: `星盤・${THEME[w.id].name}比較弱：${THEME[w.id].weak}` });
      remedies.push(THEME[w.id].fix);
    }
  } else if (astro.story) {
    const steps = SIGN_ASPECTS.findIndex((x) => x.name === astro.story.aspect);
    why.push({ tone: steps === 2 || steps === 4 ? 'good' : steps === 0 ? 'info' : 'bad', text: `太陽星座：${astro.story.summary}${astro.story.flavor}` });
    if (QUICK_FIX[steps]) remedies.push(QUICK_FIX[steps]);
    else boosts.push('星座相位順，相處起來輕鬆；把這份輕鬆拿來一起做新的事，感情才不會停在原地。');
  }

  if (bazi) {
    const { pair, a: ma, b: mb } = bazi;
    why.push({ tone: pair.tone === 'good' ? 'good' : pair.tone === 'care' ? 'bad' : 'info', text: `八字合婚：${pair.label}。` });
    for (const note of pair.notes.filter((x) => x.tone !== 'info').slice(0, 3)) why.push({ tone: note.tone, text: note.text });
    // 通關：一方的日主五行剋另一方
    if (pair.bridge) {
      const [X, Y] = KE[ma.dm] === mb.dm ? [ma.dm, mb.dm] : [mb.dm, ma.dm];
      const br = BRIDGE[pair.bridge];
      remedies.push({
        title: `民俗化解：用「${pair.bridge}」通關`,
        steps: [`${X}剋${Y}，但${X}生${pair.bridge}、${pair.bridge}又生${Y}：用${pair.bridge}把兩個人接起來，強的那方的力氣轉成照顧。`, `家裡多放${br.items}。`, `有空${br.together}。`],
        note: '這是傳統合婚的化解思路，當作提醒；真正的通關，是強勢的那方說話放軟、多問對方的想法。',
      });
    }
    // 生肖六沖：民俗擺雙方的六合生肖
    const zr = branchRelations(ma.zodiacZhi, mb.zodiacZhi);
    if (zr.includes('六沖')) {
      remedies.push({
        title: `化解：生肖相沖（${ma.animal}、${mb.animal}）`,
        steps: [`民俗做法：家裡擺${liuheAnimal(ma.zodiacZhi)}和${liuheAnimal(mb.zodiacZhi)}的小擺件（分別和${ma.animal}、${mb.animal}六合），取「合」來緩和「沖」。`, '實際的做法：買房、換工作、搬家這種大事，先私下商量好再對外說，不要一方突然宣布。'],
      });
    } else if (zr.some((r) => r === '六合' || r === '半合')) boosts.push(`生肖相合（${ma.animal}、${mb.animal}）：一起出門、一起規劃的事，民俗說運勢會互相加分。`);
    // 日柱天剋地沖：觀念差很多
    if (ganRelation(ma.dayGan, mb.dayGan) === '相沖' && branchRelations(ma.dayZhi, mb.dayZhi).includes('六沖')) {
      remedies.push({ title: '化解：日柱天剋地沖（觀念差很多）', steps: ['重大決定先各自寫下想法和理由，交換看完再談。', '接受「我們想法不同」本身不是問題，問題是不肯聽完。', '找一個雙方都信任的長輩或朋友，大事卡住時請他當中間人。'] });
    }
    // 一方是另一方的忌神：相處容易累
    const tired = [[ma, mb], [mb, ma]].filter(([x, y]) => x.ys && x.ys.avoid.includes(y.dm)).map(([x]) => x.name);
    if (tired.length) {
      remedies.push({ title: `化解：${tired.join('和')}相處容易累`, steps: ['各自保留獨處的時間，每週至少一個晚上做自己的事。', `${tired.join('、')}多接觸自己的喜用五行（命盤→八字可以看到喜用和幸運色），把能量補回來。`, '累的時候直接說「我需要休息一下」，不是不愛，是充電。'] });
    }
    // 喜用相生：一方的日主生另一方的日主（誰照顧誰）
    if (SHENG[ma.dm] === mb.dm || SHENG[mb.dm] === ma.dm) {
      const giver = SHENG[ma.dm] === mb.dm ? ma.name : mb.name;
      boosts.push(`${giver}天生比較會照顧對方：被照顧的那方多說謝謝、也主動分擔，關係會更穩。`);
    }
  }

  // 今年要多體諒誰（交往中、已婚才講：還在認識不用背對方的流年）
  const thisYear = st === 'dating' ? [] : watch.filter((w) => w.items.length).map((w) => `${w.name}：${w.items[0]}`);

  const path = PATH[st];
  return {
    level,
    levelLabel: LEVELS.find((x) => x.id === level).label,
    pattern,
    verdict,
    why: why.slice(0, 6),
    remedies: remedies.slice(0, 4),
    boosts: boosts.slice(0, 3),
    path: { title: path.title, lead: path.lead[level], checklist: path.checklist, rule: path.rule, help: st === 'married' ? path.help : null },
    thisYear,
    redFlags: RED_FLAGS,
    combos: combosFor(st, !!bazi),
  };
}

/** 搭配看哪些工具（go：畫面要切去哪裡） */
function combosFor(status, hasBazi) {
  const list = [];
  if (status !== 'dating') list.push({ label: '家人關係', why: '同住怎麼分房間、全家誰幫誰', go: ['destiny', { tool: 'family' }] });
  list.push({ label: '開運佈置', why: hasBazi ? '臥室、桃花位怎麼擺，用通關的顏色布置' : '臥室、桃花位怎麼擺', go: ['destiny', { tool: 'fengshui' }] });
  if (status !== 'dating') list.push({ label: '人生時間軸', why: '看各自今年、明年的起伏，對方低潮的年份多體諒', go: ['destiny', { tool: 'liunian' }] });
  list.push({ label: '塔羅', why: '問一個具體的問題，例如「我們接下來三個月會怎樣」', go: ['oracle', { panel: 'tarot' }] });
  list.push({ label: '解惑', why: status === 'married' ? '卡在一件事（搬家、生小孩、誰換工作）時起一卦看做法' : '卡在一個決定（要不要繼續、要不要結婚）時起一卦看趨勢和做法', go: ['oracle', { panel: 'jiehuo' }] });
  return list;
}

/**
 * 兩個人都順的日子：兩人各自用 timing.chooseDays 算同一段日期，挑兩人都沒被排除、兩人分數都至少 60 的，
 * 依「比較低的那個分數」排（一方很順、一方很衰的日子不推薦）。
 * @param a chooseDays(...).days（第一個人）
 * @param b chooseDays(...).days（第二個人，同一段日期）
 * @param names 兩人的稱呼：擇日的理由寫的是「你的日支」，兩個人一起看時換成名字才知道是誰的
 */
export function sharedDays(a, b, n = 3, names = null) {
  const byIso = new Map(b.map((d) => [d.iso, d]));
  const out = [];
  for (const x of a) {
    const y = byIso.get(x.iso);
    if (!y || x.marks.length || y.marks.length) continue;
    const low = Math.min(x.score, y.score);
    if (low < 60) continue;
    // 農民曆宜忌是那一天的，兩人一樣：同一句只留一次
    const who = (r, k) => (names ? { ...r, text: r.text.replace(/你的/g, `${names[k]}的`) } : r);
    const reasons = [...x.reasons.filter((r) => r.tone === 'good').slice(0, 2).map((r) => who(r, 0)), ...y.reasons.filter((r) => r.tone === 'good').slice(0, 2).map((r) => who(r, 1))];
    out.push({ iso: x.iso, label: x.label, score: low, ganzhi: x.ganzhi, reasons: reasons.filter((r, i) => reasons.findIndex((q) => q.text === r.text) === i).slice(0, 2) });
  }
  return out.sort((p, q) => q.score - p.score || p.iso.localeCompare(q.iso)).slice(0, n);
}
