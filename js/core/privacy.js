// 分享圖卡的匿名版：拿掉名字、生日、提問這類個資，讓圖卡可以放心傳給別人。純函式，可在 Node 測試。
//
// 規則：
// - 「王小明的八字」→「八字」：名字後面接「的」就連「的」一起拿掉，比「某人的八字」自然。
// - 其他地方的名字換成「某人」。
// - 一個字的暱稱（「我」「媽」）只在標題裡、而且前後是分隔符號時才換：一般句子常出現這些字，全部換會把內容換壞。
// - 圖卡上標成個資的欄位（spec.private，例如出生時間、塔羅的提問）整欄拿掉。

const TEXT_FIELDS = ['title', 'subtitle', 'big', 'bigLabel'];
const SEP = '\\s×・＆&、，,：:（）()';
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 一段文字裡的名字處理掉（names 已經由長到短排好，避免「小明」先把「王小明」切壞） */
function maskText(text, names, { inTitle }) {
  let out = String(text);
  for (const name of names) {
    if (name.length >= 2) {
      out = out.split(`${name}的`).join('').split(name).join('某人');
    } else if (inTitle) {
      const n = escape(name);
      out = out
        .replace(new RegExp(`(^|[${SEP}])${n}的`, 'g'), '$1')
        .replace(new RegExp(`(^|[${SEP}])${n}(?=$|[${SEP}])`, 'g'), '$1某人');
    }
  }
  return out.replace(/^[・\s]+|[・\s]+$/g, '').trim();
}

/**
 * @param {object} spec 圖卡內容（title、subtitle、lines、big、bigLabel、bars、private）
 * @param {string[]} names 要藏起來的名字（名單上每個人的暱稱、本名、藝名）
 * @returns {object} 匿名版的圖卡內容（原本的不會被改到）
 */
export function anonymizeSpec(spec, names) {
  const list = [...new Set((names || []).filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim()))]
    .sort((a, b) => b.length - a.length);
  const out = { ...spec };
  for (const key of TEXT_FIELDS) {
    if (typeof out[key] === 'string') out[key] = maskText(out[key], list, { inTitle: key === 'title' });
  }
  if (Array.isArray(out.lines)) out.lines = out.lines.map((l) => maskText(l, list, { inTitle: false })).filter(Boolean);
  for (const key of spec.private || []) delete out[key];
  delete out.private;
  if (!out.title) out.title = '星座手帳';
  return out;
}

/** 名單上所有人的名字（暱稱、本名、藝名、筆名），給匿名圖卡用 */
export function namesOf(people) {
  return (people || []).flatMap((p) => [p.name, p.fullName, ...((p.altNames || []).map((a) => a.name))]).filter(Boolean);
}
