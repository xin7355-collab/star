// 用字檢查：掌紋（尤其斷掌）和塔羅的解讀不能出現宿命、恐嚇、性別歧視或打包票的字眼。
// 為什麼要測：民俗說法常把斷掌和「剋夫」「命硬」綁在一起，對女性特別不公平；改文案時很容易不小心寫回去。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as palmTexts from '../js/core/palm-texts.js';

const BANNED = ['剋夫', '剋妻', '克夫', '克妻', '命硬', '守寡', '寡婦', '短命', '早死', '早逝', '橫死', '刑剋', '敗家', '命不好', '注定', '必定', '保證', '一定會', '絕對會', '壽命'];
// 例外：澄清誤解的那一句可以提到壽命
const ALLOWED = ['和壽命長短無關'];

/** 把模組裡所有字串（含巢狀物件）攤平 */
function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

test('掌紋文字：不出現宿命、恐嚇、打包票的字眼', () => {
  const all = strings(Object.fromEntries(Object.entries(palmTexts).filter(([, v]) => typeof v !== 'function')));
  assert.ok(all.length > 100, `只抓到 ${all.length} 段文字，檢查範圍不對`);
  for (const text of all) {
    const scrubbed = ALLOWED.reduce((t, ok) => t.split(ok).join(''), text);
    for (const word of BANNED) assert.ok(!scrubbed.includes(word), `「${word}」出現在：${text}`);
  }
});

test('斷掌說明：提到民俗說法沒有根據，並說明是常見的天生紋路', () => {
  assert.match(palmTexts.SIMIAN_NOTE, /沒有根據/);
  assert.match(palmTexts.SIMIAN_NOTE, /不代表健康有問題/);
});

test('塔羅文字（牌義、牌位讀法、總結）與配對的「老師怎麼看」：同樣不出現宿命、恐嚇、打包票的字眼', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const file of ['js/core/tarot.js', 'js/core/tarot-reading.js', 'js/views/tarot.js', 'js/core/couple.js', 'js/ui/master.js', 'js/core/master-texts.js', 'js/core/jobs.js', 'js/core/occupations.js', 'js/views/job-picker.js']) {
    const src = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const word of BANNED) assert.ok(!src.includes(word), `「${word}」出現在 ${file}`);
  }
});
