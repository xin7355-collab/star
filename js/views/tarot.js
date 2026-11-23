// 「塔羅」：單張／三張／五張；使用裝置加密亂數、均勻不放回抽牌。問題不儲存、不上傳。

import { h, clear, segmented } from '../ui/dom.js';
import { drawSpread, SPREADS } from '../core/tarot.js';
import { load, save } from '../ui/storage.js';

export function mountTarot(root, ctx) {
  let spread = load('tarotSpread', 'three');
  if (!SPREADS.some((s) => s.id === spread)) spread = 'three';
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
        question,
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', text: '洗牌並抽牌', onclick: draw })),
        h('p', { class: 'hint', text: '使用手機的加密亂數，78 張牌每張機率相同、同一次不會重複，正逆位各半。' }),
      ),
      resultBox,
    );
  }

  function draw() {
    const r = drawSpread(spread);
    const q = question.value.trim();
    clear(resultBox);
    resultBox.append(
      h(
        'section',
        { class: 'card' },
        h('h2', { text: `${r.label}牌陣` }),
        q ? h('p', { class: 'muted', text: `問題：${q}` }) : null,
        h(
          'ol',
          { class: 'tarot-list' },
          r.cards.map((c) =>
            h(
              'li',
              { class: c.orientation === '逆位' ? 'rev' : '' },
              h('span', { class: 'pos', text: c.position }),
              h('div', { class: 'tarot-name' }, h('b', { text: c.card }), h('span', { class: 'badge', text: c.orientation }), c.major ? h('span', { class: 'badge alt', text: '大牌' }) : null),
              h('p', { text: c.keywords }),
            ),
          ),
        ),
        h('div', { class: 'actions' }, h('button', {
          type: 'button',
          class: 'btn',
          text: '存成圖卡',
          onclick: () => ctx.share({
            title: `塔羅・${r.label}牌陣`,
            subtitle: q ? `問題：${q}` : '',
            lines: r.cards.map((c) => `${c.position}｜${c.card}（${c.orientation}）：${c.keywords}`),
          }, 'tarot.png'),
        })),
      ),
    );
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  render();
}
