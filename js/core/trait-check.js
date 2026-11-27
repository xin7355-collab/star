// 說中與不像：各系統說你的個性（綜合解讀的特質標籤），和興趣與性格測驗逐句對照。
//
// 用途是自我了解：說中的建議可以多參考，不像的就當提醒、不用硬套。
// 刻意不做「哪個系統最準」的排行：命理的描述本來就模糊，說中一部分很正常；比的系統和句子越多，
// 總有一個剛好說中很多（多重比較），一個人的結果分不出是準還是運氣。畫面上也附「隨便挑也會說中多少」當對照。
// 上升星座、紫微命宮要有出生時間才會列進來；不會反過來用測驗去挑時辰（那是循環論證，見 hours.js）。

import { TAGS } from './reading-texts.js';
import { BIG5, RIASEC } from './quiz.js';

/**
 * 每個特質標籤可以用測驗檢查的部分（本 App 的對照，不是各系統原典的說法）：
 * b5＝五大性格、ri＝何倫六型；hi＝分數高才算說中、lo＝分數低才算說中。null＝測驗量不到（財運、桃花、獨立自主）
 */
export const TAG_CHECKS = {
  lead: [{ k: 'ri', t: 'E', dir: 'hi' }, { k: 'b5', t: 'E', dir: 'hi' }], // 帶頭：企業型（說服、帶領）＋外向
  independent: null, // 獨立、重自由：兩份測驗都沒有直接量這一項
  steady: [{ k: 'b5', t: 'C', dir: 'hi' }, { k: 'b5', t: 'S', dir: 'hi' }], // 穩重踏實：盡責＋情緒穩定
  creative: [{ k: 'b5', t: 'O', dir: 'hi' }, { k: 'ri', t: 'A', dir: 'hi' }], // 有創意、愛表達：開放＋藝術型
  social: [{ k: 'b5', t: 'E', dir: 'hi' }, { k: 'b5', t: 'A', dir: 'hi' }], // 人緣好、善交際：外向＋親和
  sensitive: [{ k: 'b5', t: 'S', dir: 'lo' }], // 細膩敏感：情緒穩定偏低就是感受敏銳、起伏明顯
  analytic: [{ k: 'ri', t: 'I', dir: 'hi' }, { k: 'b5', t: 'O', dir: 'hi' }], // 愛思考、會分析：研究型＋開放
  adventurous: [{ k: 'b5', t: 'O', dir: 'hi' }, { k: 'b5', t: 'E', dir: 'hi' }], // 愛冒險、求變化：開放＋外向
  caring: [{ k: 'b5', t: 'A', dir: 'hi' }, { k: 'ri', t: 'S', dir: 'hi' }], // 會照顧人：親和＋社會型
  disciplined: [{ k: 'b5', t: 'C', dir: 'hi' }, { k: 'ri', t: 'C', dir: 'hi' }], // 自律守規矩：盡責＋事務型
  learning: [{ k: 'b5', t: 'O', dir: 'hi' }, { k: 'ri', t: 'I', dir: 'hi' }], // 好學：開放＋研究型（「有貴人」量不到）
  wealth: null, // 財運不是個性
  romance: null, // 魅力、桃花不是測驗量得到的
};

// 系統的順序固定（不依說中多少排）：排行會讓人以為說中多的比較準
export const SYSTEM_ORDER = ['占星', '八字', '紫微', '生命靈數', '瑪雅', '血型'];
export const VERDICT = {
  hit: { label: '說中', tone: 'tone-good' },
  half: { label: '一半一半', tone: 'tone-info' },
  miss: { label: '不像', tone: 'tone-bad' },
  na: { label: '測不到', tone: 'muted' },
};

const nameOf = (c) => (c.k === 'b5' ? BIG5[c.t].name : RIASEC[c.t].name);

/** 一個特質和測驗比：每一項換成「越高越像」的分數取平均，60 以上說中、40 以下不像，中間一半一半 */
export function verdictOf(tag, quiz) {
  const checks = TAG_CHECKS[tag];
  if (!checks || !quiz) return { verdict: 'na', detail: '測驗量不到這一項' };
  const parts = checks.map((c) => {
    const n = c.k === 'b5' ? quiz.big5[c.t] : quiz.riasec[c.t];
    return { name: nameOf(c), n, v: c.dir === 'hi' ? n : 100 - n };
  });
  const avg = Math.round(parts.reduce((a, p) => a + p.v, 0) / parts.length);
  return { verdict: avg >= 60 ? 'hit' : avg <= 40 ? 'miss' : 'half', avg, detail: parts.map((p) => `${p.name} ${p.n}`).join('、') };
}

/**
 * @param said buildReading 的 said：[{ system, source, tags }]
 * @param quiz 測驗結果（sanitizeQuiz 過的）
 * @returns {{systems, counts, base}|null} base：13 個特質裡量得到的有幾個、其中和你相符的有幾個（隨便挑也會說中的比例）
 */
export function traitCheck(said, quiz) {
  if (!quiz || !Array.isArray(said)) return null;
  const empty = () => ({ hit: 0, half: 0, miss: 0, na: 0 });
  const counts = empty();
  const systems = [];
  for (const system of SYSTEM_ORDER) {
    const items = said.filter((x) => x.system === system).map((x) => ({
      source: x.source.includes('：') ? x.source.split('：').slice(1).join('：') : x.source,
      tags: x.tags.map((tag) => ({ tag, label: TAGS[tag].label, ...verdictOf(tag, quiz) })),
    }));
    if (!items.length) continue;
    const c = empty();
    for (const it of items) for (const t of it.tags) { c[t.verdict] += 1; counts[t.verdict] += 1; }
    systems.push({ system, items, counts: c });
  }
  const testable = Object.keys(TAGS).filter((t) => TAG_CHECKS[t]);
  const hits = testable.filter((t) => verdictOf(t, quiz).verdict === 'hit').length;
  return { systems, counts, base: { testable: testable.length, hits, pct: Math.round((hits / testable.length) * 100) } };
}
