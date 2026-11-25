// 抽牌儀式的公平性（先洗整副、再挑位置）、今日一張（固定又分散）、新牌陣的讀法與總結。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK, SPREADS, TOPIC_SPREAD, shuffleDeck, fromPicks, dailyCard, seededRandom } from '../js/core/tarot.js';
import { readCard, readSpread } from '../js/core/tarot-reading.js';

test('先洗整副再挑：洗出來是 78 張的排列；挑的位置對不上、重複、超出範圍都擋下', () => {
  const deck = shuffleDeck({ rng: seededRandom(7) });
  assert.deepEqual([...deck.order].sort((a, b) => a - b), DECK.map((_, i) => i));
  assert.equal(deck.flips.length, 78);
  const r = fromPicks('three', deck, [5, 40, 77]);
  assert.deepEqual(r.cards.map((c) => c.id), [5, 40, 77].map((k) => DECK[deck.order[k]].id));
  assert.deepEqual(r.cards.map((c) => c.position), ['過去', '現在', '可能走向']);
  assert.equal(r.cards[0].orientation, deck.flips[5] ? '逆位' : '正位');
  assert.throws(() => fromPicks('three', deck, [1, 2]), /張數/);
  assert.throws(() => fromPicks('three', deck, [1, 1, 2]), /位置/);
  assert.throws(() => fromPicks('three', deck, [1, 2, 78]), /位置/);
  assert.throws(() => fromPicks('nope', deck, [1]), /未知/);
});

test('公平性：不管使用者固定挑哪幾個位置，每張牌出現的機率都一樣、正逆位各半', () => {
  // 永遠挑第 0、第 77 張（最偏的挑法）：洗勻的話，結果仍該是均勻分布
  const N = 39000;
  const count = new Array(78).fill(0);
  let rev = 0;
  for (let i = 0; i < N; i += 1) {
    const deck = shuffleDeck({ rng: seededRandom(i * 2654435761) });
    const r = fromPicks('single', deck, [i % 2 ? 0 : 77]);
    count[DECK.findIndex((d) => d.id === r.cards[0].id)] += 1;
    if (r.cards[0].orientation === '逆位') rev += 1;
  }
  // 卡方檢定（自由度 77，p≈0.001 的臨界值約 122）
  const exp = N / 78;
  const chi = count.reduce((s, c) => s + ((c - exp) ** 2) / exp, 0);
  assert.ok(chi < 122, `卡方值 ${chi.toFixed(1)}`);
  assert.ok(Math.abs(rev / N - 0.5) < 0.012, `逆位比例 ${(rev / N).toFixed(3)}`);
});

test('今日一張：同一天同一個人固定同一張；換人或換天會換；一年下來分散到各張牌', () => {
  assert.deepEqual(dailyCard('2026-11-25', 'p-1'), dailyCard('2026-11-25', 'p-1'));
  assert.equal(dailyCard('2026-11-25', 'p-0123456789abcdef').card, '權杖三'); // E2E 也鎖這一張
  const seen = new Set();
  let same = 0;
  const start = Date.UTC(2026, 0, 1);
  for (let d = 0; d < 365; d += 1) {
    const t = new Date(start + d * 86400000);
    const key = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
    const a = dailyCard(key, 'p-1');
    seen.add(a.id);
    if (a.id === dailyCard(key, 'p-2').id) same += 1;
  }
  assert.ok(seen.size > 60, `一年只出現 ${seen.size} 種牌`);
  assert.ok(same < 20, `兩個人有 ${same} 天同一張`);
  assert.equal(dailyCard('2026-11-25').position, '今日指引');
});

test('新牌陣：每個牌位都有專屬讀法；依主題的推薦牌陣都存在', () => {
  for (const id of Object.values(TOPIC_SPREAD)) assert.ok(SPREADS.some((s) => s.id === id));
  const mk = (id, position, reversed = false) => {
    const c = DECK.find((d) => d.id === id);
    return { position, card: c.name, id, major: c.major, orientation: reversed ? '逆位' : '正位', keywords: reversed ? c.reversed : c.upright };
  };
  assert.equal(readCard(mk('major-19', '選擇 A')).type, 'option');
  assert.match(readCard(mk('major-19', '選擇 A')).frame, /^走這條路的發展/);
  assert.match(readCard(mk('major-16', '對方的狀態')).frame, /不一定是針對你/);
  assert.match(readCard(mk('major-16', '結果')).frame, /這不是定局/);
  assert.equal(readCard(mk('寶劍-2', '環境')).type, 'environment');
  assert.equal(readCard(mk('聖杯-5', '希望與擔心')).type, 'hope');
});

test('新牌陣的總結：二選一比較兩條路、關係五張講雙方、凱爾特十字看結果牌', () => {
  const pick = (spread, ids) => {
    const sp = SPREADS.find((s) => s.id === spread);
    return sp.positions.map((pos, i) => {
      const c = DECK.find((d) => d.id === ids[i]);
      return readCard({ position: pos, card: c.name, id: c.id, major: c.major, orientation: '正位', keywords: c.upright });
    });
  };
  // 太陽（順）對高塔（挑戰）：A 比較順
  const choice = readSpread(pick('choice', ['major-0', 'major-19', 'major-16', 'major-14']), 'choice');
  assert.match(choice.summary, /選擇 A 的牌比較順/);
  const same = readSpread(pick('choice', ['major-0', 'major-19', 'major-17', 'major-14']), 'choice');
  assert.match(same.summary, /兩條路的牌差不多/);
  assert.match(readSpread(pick('relation', ['聖杯-1', '聖杯-2', 'major-6', '寶劍-2', 'major-21']), 'relation').summary, /^你是聖杯二（正位）、對方是聖杯三（正位）/);
  assert.match(readSpread(pick('pob', ['錢幣-4', '寶劍-7', 'major-8']), 'pob').summary, /^現況是錢幣五.+先處理「受限」/);
  const celtic = readSpread(pick('celtic', DECK.slice(0, 10).map((d) => d.id)), 'celtic');
  assert.match(celtic.summary, /最後的結果牌隱者（正位）/);
});

test('逆位三種讀法與宮廷牌的兩種讀法', () => {
  const c = DECK.find((d) => d.id === 'major-7');
  const rev = readCard({ position: '現在', card: c.name, id: c.id, major: true, orientation: '逆位', keywords: c.reversed });
  assert.deepEqual(rev.revWays.map((w) => w.name), ['受阻', '過度', '轉向內在']);
  assert.match(rev.revWays[1].text, /「意志」用過頭了/);
  const up = readCard({ position: '現在', card: c.name, id: c.id, major: true, orientation: '正位', keywords: c.upright });
  assert.deepEqual(up.revWays, []);
  const k = DECK.find((d) => d.id === '寶劍-13');
  assert.match(readCard({ position: '現在', card: k.name, id: k.id, major: false, orientation: '正位', keywords: k.upright }).person, /或是提醒你培養「理性犀利、講話直」這種特質/);
});
