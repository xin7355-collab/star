// 自訂牌組：把使用者匯入的圖檔名對到牌（純函式，可在 Node 測試）。
// 支援：中文牌名（愚者、權杖王牌、聖杯侍者…）、英文（the-fool、ace-of-cups、page_of_wands…）、
// 常見編號（00、major-0、m00、wands01、cups-14、RWS_Tarot_08_Strength、Pents03）。
// 對不到、或同時像兩張牌時回傳 null，不亂猜：猜錯比對不到更糟（使用者會以為抽到別張）。

import { DECK } from './tarot.js';

const MAJOR_NAMES = DECK.filter((d) => d.major).map((d) => d.name);
// 中文的其他常見寫法（只收兩個字以上的，單字像「塔」「星」太容易誤判）
const MAJOR_ZH_ALIAS = { 魔法師: 1, 女教皇: 2, 教宗: 5, 倒吊人: 12 };
// 英文：比對時會先去掉 the、of，所以 wheel of fortune 寫成 wheel fortune
const MAJOR_EN = [
  ['fool'], ['magician', 'magus'], ['high priestess', 'priestess', 'popess'], ['empress'], ['emperor'], ['hierophant', 'pope'], ['lovers', 'lover'],
  ['chariot'], ['strength', 'fortitude'], ['hermit'], ['wheel fortune', 'wheel', 'fortune'], ['justice'], ['hanged man', 'hanged'], ['death'],
  ['temperance'], ['devil'], ['tower'], ['star'], ['moon'], ['sun'], ['judgement', 'judgment'], ['world', 'universe'],
];
const SUITS = [
  ['權杖', ['wands', 'wand', 'rods', 'rod', 'staves', 'staff', 'batons', 'clubs'], ['權杖']],
  ['聖杯', ['cups', 'cup', 'chalices', 'hearts'], ['聖杯']],
  ['寶劍', ['swords', 'sword', 'spades'], ['寶劍']],
  ['錢幣', ['pentacles', 'pentacle', 'pents', 'coins', 'coin', 'disks', 'discs', 'diamonds'], ['錢幣', '星幣', '金幣']],
];
const RANK_EN = { ace: 0, one: 0, two: 1, three: 2, four: 3, five: 4, six: 5, seven: 6, eight: 7, nine: 8, ten: 9, page: 10, princess: 10, knave: 10, knight: 11, prince: 11, queen: 12, king: 13 };
// 中文順序要先比長的（「王牌」在「王」之前、「侍者」「侍從」）
const RANK_ZH = [['王牌', 0], ['侍者', 10], ['侍從', 10], ['騎士', 11], ['皇后', 12], ['王后', 12], ['國王', 13], ['十', 9], ['九', 8], ['八', 7], ['七', 6], ['六', 5], ['五', 4], ['四', 3], ['三', 2], ['二', 1], ['一', 0]];

/** 檔名 → 比對用的字串：小寫、去副檔名、底線連字號變空白、拿掉 the／of 這類虛字 */
function normalize(filename) {
  return String(filename || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .toLowerCase()
    .replace(/[_\-.,+()[\]]+/g, ' ')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/\b(the|of|tarot|rws|card|cards|deck)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const hasWord = (text, phrase) => new RegExp(`(^| )${phrase.replace(/ /g, ' ')}( |$)`).test(text);
const numbers = (text) => (text.match(/\d+/g) || []).map(Number);

/**
 * 一個檔名對到哪張牌。
 * @returns {{id:string}|{back:true}|null} id 和 core/tarot.js 的 DECK 一樣（major-0、權杖-0…）；牌背回傳 {back:true}
 */
export function matchCardFile(filename) {
  const raw = String(filename || '');
  const text = normalize(raw);
  if (!text) return null;
  if (/(^| )(back|cardback|reverse side)( |$)|背面|牌背/.test(text)) return { back: true };

  // 花色：英文看整個字、中文看字串；出現兩種花色就不猜
  const suits = SUITS.filter(([, en, zh]) => en.some((w) => hasWord(text, w)) || zh.some((w) => raw.includes(w)));
  if (suits.length > 1) return null;
  if (suits.length === 1) {
    const suit = suits[0][0];
    const ranks = new Set();
    for (const [w, r] of Object.entries(RANK_EN)) if (hasWord(text, w)) ranks.add(r);
    const zhName = raw.replace(/\.[a-z0-9]{2,5}$/i, '').replace(suits[0][2].find((w) => raw.includes(w)) || '', '');
    for (const [w, r] of RANK_ZH) {
      if (zhName.includes(w)) {
        ranks.add(r);
        break; // 長的先比，比到就停（「王牌」不要再被當成「王」）
      }
    }
    for (const n of numbers(text)) if (n >= 1 && n <= 14) ranks.add(n - 1);
    return ranks.size === 1 ? { id: `${suit}-${[...ranks][0]}` } : null;
  }

  // 大牌：中文名、英文名、編號（要有 major／m／ar 這類標記，或檔名只有數字）
  const found = new Set();
  MAJOR_NAMES.forEach((name, i) => { if (raw.includes(name)) found.add(i); });
  for (const [alias, i] of Object.entries(MAJOR_ZH_ALIAS)) if (raw.includes(alias)) found.add(i);
  MAJOR_EN.forEach((aliases, i) => { if (aliases.some((a) => hasWord(text, a))) found.add(i); });
  if (found.size === 0) {
    const nums = numbers(text).filter((n) => n >= 0 && n <= 21);
    const marked = /(^| )(major|maj|m|ar|trump|arcana)( |$)/.test(text) || /^\d+$/.test(text.replace(/ /g, '')) || /大牌|大阿爾克那/.test(raw);
    if (marked && nums.length === 1) found.add(nums[0]);
  } else if (found.size > 1) {
    // 「wheel of fortune」同時比到 wheel 和 fortune 都是第 10 張；真的兩張不同的牌才放棄
    return null;
  }
  // 有牌名就以牌名為準：編號各家不同（馬賽牌 8 是正義、偉特牌 8 是力量），檔名也常帶版本號
  return found.size === 1 ? { id: `major-${[...found][0]}` } : null;
}

/**
 * 一批檔名的對應結果。
 * @returns {{mapped: Map<string,string>, back: string|null, unknown: string[], duplicate: string[]}}
 *   mapped：牌 id → 檔名；同一張牌出現兩個檔案時留第一個，其餘列在 duplicate
 */
export function mapFiles(names) {
  const mapped = new Map();
  const unknown = [];
  const duplicate = [];
  let back = null;
  for (const name of names) {
    const m = matchCardFile(name);
    if (!m) unknown.push(name);
    else if (m.back) {
      if (back) duplicate.push(name);
      else back = name;
    } else if (mapped.has(m.id)) duplicate.push(name);
    else mapped.set(m.id, name);
  }
  return { mapped, back, unknown, duplicate };
}
