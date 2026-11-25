// 紫微重點：把整張紫微盤濃縮成一頁看得懂的重點——命宮、身宮、命主身主、生年四化落在哪裡、
// 十二宮的強項與要多花心力的宮、大限（十年一步）走勢、今年流年命宮與流年四化。
// 原本的命盤是「點一宮看細節」，沒有總結，看完不知道重點在哪。文字由本 App 撰寫。純函式，可在 Node 測試。

import { sanFang } from './ziwei-pattern.js';
import { mutagenIn, ZIWEI_STARS, PALACE_DOMAIN, DECADE_FOCUS } from './reading-texts.js';

/** 身宮只會落在命、夫妻、財帛、遷移、官祿、福德六宮：代表後天（中年以後）的重心 */
export const BODY_PALACE_TEXT = {
  命宮: '身宮和命宮同宮：先天和後天一致，個性鮮明、說到做到，一生主要靠自己。',
  夫妻: '身宮在夫妻宮：中年以後很重視伴侶和合作關係，感情與婚姻對你的影響特別大。',
  財帛: '身宮在財帛宮：中年以後的重心在賺錢和理財，安全感來自財務穩定。',
  遷移: '身宮在遷移宮：常在外面跑、適合外地發展，出外比待在原地更容易遇到機會。',
  官祿: '身宮在官祿宮：事業心重，工作是你的重心，成就感多半來自事業。',
  福德: '身宮在福德宮：重視精神生活和興趣，懂得享受，也容易想太多。',
};

/** 命主（依命宮地支）：一生的動力；身主（依出生年地支）：後天的課題 */
export const SOUL_STAR_TEXT = {
  貪狼: '一生的動力來自熱情和慾望，多才多藝、交際能力強。',
  巨門: '靠口才和思考吃飯，凡事愛追根究柢。',
  祿存: '重視穩定和積蓄，守財能力好。',
  文曲: '有才藝和口才，適合表達、藝術類的事。',
  廉貞: '重視原則和分寸，有企圖心。',
  武曲: '務實果斷，和錢、執行力有緣。',
  破軍: '喜歡開創和改變，不怕從頭來過。',
};
export const BODY_STAR_TEXT = {
  火星: '做事衝、反應快，後天的課題是耐心。',
  鈴星: '想法多、心思深，後天的課題是放鬆。',
  天相: '重視形象和公平，是可靠的協調者。',
  天梁: '有長者風範，喜歡照顧人、給建議。',
  天同: '重視生活品質，隨和好相處。',
  文昌: '重學習和文字，考試、文書運好。',
  天機: '腦筋動得快，擅長規劃和應變。',
};

const MUTAGENS = ['化祿', '化權', '化科', '化忌'];
const MUTAGEN_ROLE = { 化祿: '福氣與財源', 化權: '主導權與執行力', 化科: '名聲與貴人', 化忌: '要多花心力的地方' };

/**
 * @param z buildZiwei 的結果（多胞胎時傳借宮後的盤）
 * @param {{maxAge?:number}} [opts]
 */
export function ziweiSummary(z, { maxAge = 95 } = {}) {
  const find = (name) => z.palaces.find((p) => p.name === name);
  const ming = find('命宮');
  const opp = (pal) => z.palaces.find((q) => q.index === (pal.index + 6) % 12);
  const mingStars = ming.major.length ? ming.major : opp(ming).major;
  const mingText = mingStars.map((s) => ZIWEI_STARS[s.name]?.ming).filter(Boolean).join('');
  const bodyPal = z.palaces.find((p) => p.isBody);
  // 生年四化：整張盤上帶四化的星（主星、輔星都算）
  const mutagens = [];
  for (const pal of z.palaces) {
    for (const st of [...pal.major, ...pal.minor]) {
      if (MUTAGENS.includes(st.mutagen)) mutagens.push({ mutagen: st.mutagen, star: st.name, palace: pal.name, role: MUTAGEN_ROLE[st.mutagen], text: `${st.name}${mutagenIn(st.mutagen, pal.name)}` });
    }
  }
  mutagens.sort((a, b) => MUTAGENS.indexOf(a.mutagen) - MUTAGENS.indexOf(b.mutagen));
  // 十二宮強弱：每宮看三方四正（本宮、對宮、兩個三合宮）的吉星、煞星、四化
  const tones = z.palaces.map((pal) => ({ palace: pal.name, ...pick(sanFang(z, pal)) }));
  const strong = tones.filter((t) => t.tone === 'good').map((t) => t.palace);
  const weak = tones.filter((t) => t.tone === 'bad').map((t) => t.palace);
  // 大限走勢：依起始歲數排，標出現在這一步
  const hs = z.horoscope;
  const decades = z.palaces
    .filter((p) => p.decadal && p.decadal[0] <= maxAge)
    .map((p) => ({ palace: p.name, from: p.decadal[0], to: p.decadal[1], focus: DECADE_FOCUS[p.name] || '', tone: tones.find((t) => t.palace === p.name).tone, current: !!hs && p.index === hs.decadalIndex }))
    .sort((a, b) => a.from - b.from);
  let year = null;
  if (hs) {
    const yp = z.palaces.find((p) => p.index === hs.yearlyIndex);
    const where = (star) => z.palaces.find((p) => [...p.major, ...p.minor].some((s) => s.name === star))?.name || null;
    const [lu, quan, ke, ji] = hs.yearlyMutagen || [];
    year = {
      palace: yp ? yp.name : null,
      domain: yp ? PALACE_DOMAIN[yp.name] : '',
      mutagens: [['化祿', lu], ['化權', quan], ['化科', ke], ['化忌', ji]].filter(([, s]) => s).map(([m, s]) => ({ mutagen: m, star: s, palace: where(s) })),
    };
  }
  return {
    ming: { stars: mingStars.map((s) => s.name), borrowed: !ming.major.length, text: mingText },
    body: bodyPal ? { palace: bodyPal.name, text: BODY_PALACE_TEXT[bodyPal.name] || '' } : null,
    soul: { star: z.soul, text: SOUL_STAR_TEXT[z.soul] || '' },
    bodyStar: { star: z.body, text: BODY_STAR_TEXT[z.body] || '' },
    mutagens,
    strong,
    weak,
    decades,
    year,
  };
}

const pick = (sf) => ({ tone: sf.tone, score: sf.score });
