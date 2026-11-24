// 「塔羅」（在「占卜」分頁裡）：單張／三張／五張，可選問的主題（綜合、感情、工作、財運）。
// 使用裝置加密亂數、均勻不放回抽牌；每張牌依牌位與主題解讀，三張以上再看整副牌陣。問題不儲存、不上傳。

import { h, clear, segmented } from '../ui/dom.js';
import { drawSpread, SPREADS } from '../core/tarot.js';
import { readCard, readSpread, cardMark, TOPICS } from '../core/tarot-reading.js';
import { load, save } from '../ui/storage.js';
import { order } from '../ui/motion.js';
import { tarotCard } from '../ui/charts.js';

export function mountTarot(root, ctx) {
  let spread = load('tarotSpread', 'three');
  if (!SPREADS.some((s) => s.id === spread)) spread = 'three';
  let topic = load('tarotTopic', 'general');
  if (!TOPICS.some((t) => t.id === topic)) topic = 'general';
  const question = h('textarea', { rows: 2, maxlength: 200, placeholder: '想問的事（可不填，只留在畫面上，不會儲存或上傳）', 'aria-label': '想問的事' });
  const resultBox = h('div', {});

  function render() {
    clear(root);
    root.append(
      h(
        'section',
        { class: 'card' },
        segmented({
          name: 'spread',
          label: '牌陣',
          value: spread,
          options: SPREADS.map((s) => ({ value: s.id, label: s.label })),
          onChange: (next) => {
            spread = next;
            save('tarotSpread', spread);
            clear(resultBox);
          },
        }),
        segmented({
          name: 'tarot-topic',
          label: '問的主題',
          value: topic,
          options: TOPICS.map((t) => ({ value: t.id, label: t.label })),
          onChange: (next) => {
            topic = next;
            save('tarotTopic', topic);
            clear(resultBox);
          },
        }),
        question,
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', text: '洗牌並抽牌', onclick: draw })),
        h('p', { class: 'hint', text: '使用手機的加密亂數，78 張牌每張機率相同、同一次不會重複，正逆位各半。抽到的牌會存進「我的」查詢紀錄（只在這支手機），問題不會存。' }),
      ),
      resultBox,
    );
  }

  function draw() {
    const r = drawSpread(spread);
    const cards = r.cards.map((c) => readCard(c, topic));
    const sp = readSpread(cards, r.spread);
    const topicLabel = TOPICS.find((t) => t.id === topic).label;
    const q = question.value.trim();
    clear(resultBox);
    resultBox.append(
      h(
        'section',
        { class: 'card' },
        h('h2', { text: `${r.label}牌陣・${topicLabel}` }),
        q ? h('p', { class: 'muted', text: `問題：${q}` }) : null,
        h(
          'ol',
          { class: 'tarot-list' },
          // 一張一張翻開（牌背轉到牌面，--i 控制先後）
          order(cards.map((c) =>
            h(
              'li',
              { class: c.orientation === '逆位' ? 'rev' : '' },
              tarotCard({ mark: cardMark(c), suit: c.suit, major: c.major, reversed: c.orientation === '逆位', title: c.major ? c.card : c.suit }),
              h(
                'div',
                { class: 'tarot-body' },
                h('span', { class: 'pos', text: c.position }),
                h('div', { class: 'tarot-name' }, h('b', { text: c.card }), h('span', { class: 'badge', text: c.orientation }), c.major ? h('span', { class: 'badge alt', text: '大牌' }) : null),
                h('p', { class: 'muted small', text: c.keywords }),
                h('p', { text: c.frame }),
                c.topicText ? h('p', { class: 'tarot-topic', text: c.topicText }) : null,
                c.person ? h('p', { class: 'muted small', text: c.person }) : null,
              ),
            ),
          )),
        ),
        cards.length >= 3
          ? [
            h('h3', { text: '整副牌怎麼看' }),
            h('p', { class: 'tarot-summary', text: sp.summary }),
            sp.insights.length ? h('ul', { class: 'reasons' }, sp.insights.map((x) => h('li', { class: 'tone-info' }, h('b', { text: `${x.title}：` }), h('span', { text: x.text })))) : null,
          ]
          : null,
        h('p', { class: 'hint', text: '同一張牌放在不同位置、問不同的事，意思會不一樣：牌位決定怎麼讀（例如好牌落在「阻力」，是提醒你別太樂觀），主題決定看哪個面向。' }),
        h('div', { class: 'actions' }, h('button', {
          type: 'button',
          class: 'btn',
          text: '存成圖卡',
          onclick: () => ctx.share({
            title: `塔羅・${r.label}牌陣・${topicLabel}`,
            subtitle: q ? `問題：${q}` : '',
            lines: [...cards.map((c) => `${c.position}｜${c.card}（${c.orientation}）：${c.keywords}`), cards.length >= 3 ? sp.summary : ''].filter(Boolean),
          }, 'tarot.png'),
        })),
      ),
    );
    // 存進本機紀錄：只存牌與主題，不存問題（畫面上承諾問題不儲存）
    ctx.addHistory({
      type: 'tarot',
      title: `${r.label}牌陣・${topicLabel}`,
      summary: cards.map((c) => `${c.position}：${c.card}（${c.orientation}）`).join('；'),
    });
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  render();
}
