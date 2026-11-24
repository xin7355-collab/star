// 拼音（數字聲調）→ 注音符號。台灣使用者看注音比看拼音直覺，姓名分析用來顯示每個字的唸法。
// 例：wang2 → ㄨㄤˊ、lv4 → ㄌㄩˋ、zhi1 → ㄓ、ju2 → ㄐㄩˊ、er2 → ㄦˊ。

const INITIALS = [
  ['zh', 'ㄓ'], ['ch', 'ㄔ'], ['sh', 'ㄕ'],
  ['b', 'ㄅ'], ['p', 'ㄆ'], ['m', 'ㄇ'], ['f', 'ㄈ'], ['d', 'ㄉ'], ['t', 'ㄊ'], ['n', 'ㄋ'], ['l', 'ㄌ'],
  ['g', 'ㄍ'], ['k', 'ㄎ'], ['h', 'ㄏ'], ['j', 'ㄐ'], ['q', 'ㄑ'], ['x', 'ㄒ'], ['r', 'ㄖ'], ['z', 'ㄗ'], ['c', 'ㄘ'], ['s', 'ㄙ'],
];

const FINALS = {
  a: 'ㄚ', o: 'ㄛ', e: 'ㄜ', ai: 'ㄞ', ei: 'ㄟ', ao: 'ㄠ', ou: 'ㄡ', an: 'ㄢ', en: 'ㄣ', ang: 'ㄤ', eng: 'ㄥ', ong: 'ㄨㄥ', er: 'ㄦ',
  i: 'ㄧ', ia: 'ㄧㄚ', ie: 'ㄧㄝ', iao: 'ㄧㄠ', iu: 'ㄧㄡ', iou: 'ㄧㄡ', ian: 'ㄧㄢ', in: 'ㄧㄣ', iang: 'ㄧㄤ', ing: 'ㄧㄥ', iong: 'ㄩㄥ',
  u: 'ㄨ', ua: 'ㄨㄚ', uo: 'ㄨㄛ', uai: 'ㄨㄞ', ui: 'ㄨㄟ', uei: 'ㄨㄟ', uan: 'ㄨㄢ', un: 'ㄨㄣ', uen: 'ㄨㄣ', uang: 'ㄨㄤ', ueng: 'ㄨㄥ',
  v: 'ㄩ', ve: 'ㄩㄝ', van: 'ㄩㄢ', vn: 'ㄩㄣ',
};

const TONE_MARK = { 1: '', 2: 'ˊ', 3: 'ˇ', 4: 'ˋ', 5: '' };

/** 零聲母的 y／w 開頭改寫成韻母本身（yu → v、wei → uei…） */
function zeroInitial(s) {
  if (s.startsWith('yu')) return `v${s.slice(2)}`;
  if (s.startsWith('yi')) return `i${s.slice(2)}`;
  if (s.startsWith('y')) return `i${s.slice(1)}`;
  if (s.startsWith('wu')) return `u${s.slice(2)}`;
  if (s.startsWith('w')) return `u${s.slice(1)}`;
  return s;
}

/**
 * @param {string} pinyin 不含聲調的拼音（ü 寫 v）
 * @param {number} tone 1–5（5 = 輕聲）
 * @returns {string|null} 注音；拼不出來時回傳 null
 */
export function toZhuyin(pinyin, tone) {
  let initial = '';
  let rest = pinyin;
  const hit = INITIALS.find(([p]) => pinyin.startsWith(p));
  if (hit) {
    initial = hit[1];
    rest = pinyin.slice(hit[0].length);
    // zhi chi shi ri zi ci si 的 i 不發音
    if (rest === 'i' && /^(zh|ch|sh|r|z|c|s)$/.test(hit[0])) rest = '';
    // ju qu xu 的 u 其實是 ü
    if (/^[jqx]$/.test(hit[0]) && rest.startsWith('u')) rest = `v${rest.slice(1)}`;
  } else {
    rest = zeroInitial(pinyin);
  }
  const final = rest === '' ? '' : FINALS[rest];
  if (final === undefined) return null;
  const body = initial + final;
  if (!body) return null;
  return tone === 5 ? `˙${body}` : body + TONE_MARK[tone];
}

/** 拼音的聲母（給「相鄰兩字聲母相同、不好唸」的判斷用）；零聲母回傳空字串 */
export function initialOf(pinyin) {
  const hit = INITIALS.find(([p]) => pinyin.startsWith(p));
  return hit ? hit[0] : '';
}
