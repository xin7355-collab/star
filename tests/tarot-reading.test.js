// 塔羅解讀：牌位情境、主題、宮廷牌代表的人、整副牌陣（大牌比例、花色、數字、逆位、元素互動）。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK, SPREADS, drawSpread, seededRandom } from '../js/core/tarot.js';
import { readCard, readSpread, elementRelation, cardMark, cardMeta, TOPICS } from '../js/core/tarot-reading.js';

const mk = (id, position, reversed = false) => {
  const c = DECK.find((d) => d.id === id);
  return { position, card: c.name, id: c.id, major: c.major, orientation: reversed ? '逆位' : '正位', keywords: reversed ? c.reversed : c.upright };
};

test('78 張 × 正逆位 × 每個牌位 × 每個主題都讀得出來，沒有漏字或空白', () => {
  const positions = [...new Set(SPREADS.flatMap((s) => s.positions))];
  for (const d of DECK) {
    for (const rev of [false, true]) {
      for (const pos of positions) {
        for (const t of TOPICS) {
          const r = readCard(mk(d.id, pos, rev), t.id);
          assert.ok(r.frame.length > 8 && !r.frame.includes('{k}'), `${d.name} ${pos}`);
          assert.ok(['火', '水', '風', '土'].includes(r.element));
          assert.ok(['light', 'neutral', 'shadow'].includes(r.tone));
          if (t.id === 'general') assert.equal(r.topicText, '');
          else assert.ok(r.topicText.startsWith(`${t.label}：`) && r.topicText.length > 8 && !/undefined/.test(r.topicText), `${d.name} ${t.id}`);
        }
      }
    }
  }
});

test('同一張牌放在不同牌位，讀法不同：太陽在阻力是「用過頭」，在建議是「主動去做」', () => {
  const block = readCard(mk('major-19', '阻力'));
  const advice = readCard(mk('major-19', '建議'));
  assert.match(block.frame, /用過頭/);
  assert.match(advice.frame, /^建議你主動去做：成功、快樂、活力/);
  // 挑戰牌在建議位：要正視，不是逃避
  assert.match(readCard(mk('major-16', '建議')).frame, /^建議你正視「突變/);
  // 惡魔逆位是掙脫，性質轉為順勢；高塔正逆位都是挑戰
  assert.equal(cardMeta('major-15', true).tone, 'light');
  assert.deepEqual([cardMeta('major-16', false).tone, cardMeta('major-16', true).tone], ['shadow', 'shadow']);
});

test('主題：大牌逐張寫，小牌用花色領域 × 數字階段；宮廷牌可能代表一個人', () => {
  assert.match(readCard(mk('major-6', '現在'), 'love').topicText, /兩情相悅/);
  assert.match(readCard(mk('major-6', '現在'), 'work').topicText, /合作順利/);
  assert.match(readCard(mk('major-6', '現在', true), 'money').topicText, /財務決定反覆/);
  assert.equal(readCard(mk('聖杯-2', '現在'), 'love').topicText, '感情：情感交流與內心感受正處在「合作與成長」的階段。');
  const queen = readCard(mk('聖杯-12', '現在'));
  assert.match(queen.person, /成熟的女性或照顧者，個性溫柔感性/);
  assert.equal(readCard(mk('聖杯-2', '現在')).person, '');
  assert.deepEqual([cardMark(cardMeta('major-21')), cardMark(cardMeta('寶劍-0')), cardMark(cardMeta('錢幣-13'))], ['XXI', 'A', '王']);
});

test('整副牌陣：大牌偏多、主導花色、重複數字、宮廷牌、逆位比例、相鄰元素', () => {
  const majors = readSpread(['major-0', 'major-10', 'major-21'].map((id, i) => readCard(mk(id, ['過去', '現在', '可能走向'][i]))), 'three');
  assert.ok(majors.insights.some((x) => x.title === '大牌偏多'));
  // 愚者（風）→命運之輪（火）：互相助長；命運之輪（火）→世界（土）：影響不大
  assert.match(majors.insights.find((x) => x.title === '過去→現在').text, /^風遇火：互相助長/);
  assert.match(majors.insights.find((x) => x.title === '現在→可能走向').text, /^火遇土：影響不大/);
  assert.match(majors.summary, /^從愚者（正位）到命運之輪（正位），可能走向世界（正位）：整體往好的方向走/);

  const swords = readSpread([mk('寶劍-4', '核心', true), mk('寶劍-4', '根源'), mk('寶劍-12', '阻力', true), mk('聖杯-4', '潛力', true), mk('錢幣-1', '建議')].map((c) => readCard(c)), 'five');
  const titles = swords.insights.map((x) => x.title);
  assert.ok(titles.includes('沒有大牌'));
  assert.ok(titles.includes('寶劍最多'));
  assert.ok(titles.includes('3 張「五」'));
  assert.ok(titles.includes('宮廷牌'));
  assert.ok(!titles.includes('逆位偏多')); // 5 張裡 3 張逆位，不到三分之二
  assert.match(swords.summary, /卡住你的是寶劍皇后（逆位）.*先處理「冷漠」/);

  assert.deepEqual(['火水', '風土', '水土', '火火'].map((p) => elementRelation(p[0], p[1]).kind), ['contrary', 'contrary', 'friendly', 'same']);
  // 單張不做牌陣分析，總結就是那張牌的讀法
  const one = readSpread([readCard(mk('major-1', '今日指引'))], 'single');
  assert.deepEqual(one.insights, []);
  assert.match(one.summary, /^魔術師（正位）：今天的主題是/);
});

test('實際抽牌接得上解讀（種子亂數重現）', () => {
  for (const id of ['single', 'three', 'five']) {
    const r = drawSpread(id, { rng: seededRandom(7) });
    const cards = r.cards.map((c) => readCard(c, 'work'));
    const sp = readSpread(cards, id);
    assert.ok(sp.summary.length > 10);
    assert.ok(cards.every((c) => c.topicText.startsWith('工作：')));
  }
});
