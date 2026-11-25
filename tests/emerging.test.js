// 新興產業適配度：資料完整、排名給分、喜用五行加減分、AI 建議涵蓋每種工作性質。離線可跑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMERGING, AI_ADVICE, emergingFit } from '../js/core/emerging.js';
import { NATURES } from '../js/core/career.js';

test('每個產業都有說明、五行、適合的工作性質、四種角色和怎麼開始', () => {
  assert.equal(EMERGING.length, 13);
  for (const e of EMERGING) {
    assert.ok(e.desc && e.entry && e.name, e.id);
    assert.ok(e.wx.length && e.wx.every((w) => '木火土金水'.includes(w)), e.id);
    assert.ok(e.natures.length && e.natures.every((n) => NATURES[n]), e.id);
    for (const g of ['tech', 'bridge', 'creative', 'care']) assert.ok(e.roles[g], `${e.id} ${g}`);
  }
  for (const k of Object.keys(NATURES)) assert.ok(AI_ADVICE[k], k);
});

test('適配度：依工作性質的排名給分（不看票數多寡）＋喜用五行；理由寫出是哪個性質、哪個五行', () => {
  const nat = (key, count) => ({ key, label: NATURES[key].label, count });
  const ys = { primary: '火', secondary: '水', avoid: ['土', '金'] };
  const r = emergingFit({ ranked: [nat('research', 3), nat('expert', 2), nat('care', 1)], ys });
  const by = (id) => r.find((e) => e.id === id);
  // AI（研究＋技術、火水）：3＋2＋火 2＋水 1＝8；長照（只有助人 1 分、土是忌神）：1－1＝0
  assert.equal(by('ai').score, 8);
  assert.equal(by('ai').level, '很適合');
  assert.equal(by('silver').score, 0);
  assert.equal(by('silver').level, '要多花力氣');
  assert.match(by('silver').why[1], /「土」是你的忌神/);
  assert.match(by('ai').why[0], /研究分析型、專業技術型/);
  assert.equal(by('ai').role, EMERGING.find((e) => e.id === 'ai').roles.tech); // 最強的是研究分析 → 技術型角色
  // 由高到低排序
  for (let i = 1; i < r.length; i += 1) assert.ok(r[i - 1].score >= r[i].score);
  // 票數加倍，分數不變（資料比較完整的人不會每個產業都「很適合」）
  const doubled = emergingFit({ ranked: [nat('research', 6), nat('expert', 4), nat('care', 2)], ys });
  assert.deepEqual(doubled.map((e) => e.score), r.map((e) => e.score));
  // 沒有喜用神（八字算不出來）也能算，只看工作性質
  assert.equal(emergingFit({ ranked: [nat('create', 2)] }).find((e) => e.id === 'content').score, 3);
});
