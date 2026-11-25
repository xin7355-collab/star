// 分享圖卡的匿名版：拿掉名字、生日、提問這類個資，讓圖卡可以放心傳給別人。純函式，可在 Node 測試。
//
// 規則：
// - 單人圖卡：「王小明的八字」→「八字」：名字後面接「的」就連「的」一起拿掉，比「某人的八字」自然；其他地方的名字換成「某人」。
// - 多人圖卡（spec.multi：配對、合盤）：每個人依出現順序換成 A、B、C…，同一個人的暱稱、本名、藝名都是同一個字母。
//   全部換成「某人」的話，「王小明的太陽 三分相 陳小華的月亮」只剩「太陽 三分相 月亮」，合盤也看不出哪一組是誰。
// - 一個字的暱稱（「我」「媽」）要前面是開頭或分隔符號、後面是分隔符號（或「的」）才當成名字：一般句子常出現這些字，全部換會把內容換壞。
//   單人圖卡只在標題裡換；多人圖卡內文也換（配對內文是「我的太陽 三分相 媽的月亮」，只換標題會把暱稱留在圖上）。
// - 圖卡上標成個資的欄位（spec.private，例如出生時間、塔羅的提問）整欄拿掉。

const TEXT_FIELDS = ['title', 'subtitle', 'big', 'bigLabel'];
const SEP = '\\s×・＆&、，,：:（）()';
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// 多人圖卡先把名字換成私用區字元（一人一個），全部換完再依出現順序換成字母：
// 記號不會出現在一般文字裡，後面比對的短名字也不會咬到已經換掉的長名字（例如「小明」咬到「王小明」）。
const MARK = 0xe000;
const MAX_GROUPS = 256;
const MARKS = /[-]/g;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 每個人一組名字；只給一串名字時每個名字自成一組 */
function groupsOf(names) {
  return (names || [])
    .map((g) => [...new Set((Array.isArray(g) ? g : [g]).filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim()))])
    .filter((g) => g.length)
    .slice(0, MAX_GROUPS);
}

/** 單人圖卡：一段文字裡的名字處理掉（names 已經由長到短排好，避免「小明」先把「王小明」切壞） */
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

/** 多人圖卡：名字換成記號（entries 由長到短） */
function markText(text, entries) {
  let out = String(text);
  for (const { name, gi } of entries) {
    const mark = String.fromCharCode(MARK + gi);
    out = name.length >= 2
      ? out.split(name).join(mark)
      : out.replace(new RegExp(`(^|[${SEP}])${escape(name)}(?=的|$|[${SEP}])`, 'g'), `$1${mark}`);
  }
  return out;
}

/** 多人圖卡：依出現順序（標題、副標、內文）把每個人換成 A、B、C…；超過 26 人的換「某人」 */
function labelPeople(out, keys, groups) {
  const entries = groups.flatMap((g, gi) => g.map((name) => ({ name, gi }))).sort((a, b) => b.name.length - a.name.length);
  const fields = keys.map((k) => markText(out[k], entries));
  const lines = Array.isArray(out.lines) ? out.lines.map((l) => markText(l, entries)) : null;
  const order = [];
  for (const text of [...fields, ...(lines || [])]) {
    for (const m of text.match(MARKS) || []) if (!order.includes(m)) order.push(m);
  }
  const label = (text) => text.replace(MARKS, (m) => LABELS[order.indexOf(m)] || '某人').trim();
  keys.forEach((k, i) => { out[k] = label(fields[i]); });
  if (lines) out.lines = lines.map(label).filter(Boolean);
}

/**
 * @param {object} spec 圖卡內容（title、subtitle、lines、big、bigLabel、bars、private、multi）
 * @param {Array<string|string[]>} names 要藏起來的名字：一人一組（namesOf 的結果），或一串名字
 * @returns {object} 匿名版的圖卡內容（原本的不會被改到）
 */
export function anonymizeSpec(spec, names) {
  const groups = groupsOf(names);
  const out = { ...spec };
  for (const key of spec.private || []) delete out[key];
  delete out.private;
  delete out.multi;
  const keys = TEXT_FIELDS.filter((k) => typeof out[k] === 'string');
  if (spec.multi) {
    labelPeople(out, keys, groups);
  } else {
    const list = [...new Set(groups.flat())].sort((a, b) => b.length - a.length);
    for (const key of keys) out[key] = maskText(out[key], list, { inTitle: key === 'title' });
    if (Array.isArray(out.lines)) out.lines = out.lines.map((l) => maskText(l, list, { inTitle: false })).filter(Boolean);
  }
  if (!out.title) out.title = '星座手帳';
  return out;
}

/** 名單上每個人的名字（暱稱、本名、藝名、筆名）一人一組：多人圖卡同一個人不管用哪個名字出現，都要換成同一個字母 */
export function namesOf(people) {
  return (people || []).map((p) => [p.name, p.fullName, ...((p.altNames || []).map((a) => a.name))].filter(Boolean));
}
