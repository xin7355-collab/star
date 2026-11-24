// 命盤 → 血型：個性、工作、感情、遇到困境時怎麼調適，以及和名單上其他人的相處。
// 血型性格是流行文化說法（見 core/blood.js），畫面上一律標明；下拉選單只是預覽，要存請到「我的」編輯。

import { h, fill } from '../ui/dom.js';
import { cardHead } from '../ui/icons.js';
import { BLOOD, BLOOD_TYPES, bloodMatch } from '../core/blood.js';

const chips = (list) => h('div', { class: 'chips' }, list.map((t) => h('span', { class: 'chip', text: t })));

export function drawBlood(p, { ctx, actions }) {
  let type = p.bloodType || '';
  const box = h('div', { 'aria-live': 'polite' });
  const sel = h('select', { 'aria-label': '血型', onchange: (e) => { type = e.target.value; paint(); } }, h('option', { value: '', text: '選擇血型' }), BLOOD_TYPES.map((t) => h('option', { value: t, text: `${t} 型` })));
  sel.value = type;

  function paint() {
    if (!type) {
      fill(box, h('p', { class: 'muted', text: '選一個血型看看。在「我的」→ 編輯 →「進階」填了血型，綜合解讀、工作方向、解惑與配對也會一起參考。' }));
      return;
    }
    const b = BLOOD[type];
    const others = ctx.getPeople().filter((x) => x.id !== p.id && x.bloodType);
    fill(
      box,
      h('ul', { class: 'reasons' }, h('li', { class: 'tone-info', text: `個性：${b.personality}` }), h('li', { class: 'tone-good', text: `優點：${b.strengths}` }), h('li', { class: 'tone-bad', text: `要注意：${b.watch}` })),
      h('h3', { text: '工作' }),
      h('p', { text: b.work }),
      chips(b.jobs),
      h('h3', { text: '感情' }),
      h('p', { text: b.love }),
      h('h3', { text: '遇到困境時' }),
      h('p', { text: b.stress }),
      h('p', { text: `可以這樣做：${b.cope}` }),
      h('p', { class: 'summary gold', text: b.advice }),
      others.length ? h('h3', { text: '和名單上的人' }) : null,
      others.length ? h('ul', { class: 'reasons' }, others.map((o) => h('li', { class: 'tone-info', text: `${o.name}（${o.bloodType} 型）：${bloodMatch(type, o.bloodType).text}` }))) : null,
      p.bloodType !== type ? h('p', { class: 'hint', text: `這是預覽。${p.name}在名單裡${p.bloodType ? `填的是 ${p.bloodType} 型` : '還沒填血型'}，到「我的」編輯才會存起來。` }) : null,
      actions(p, 'blood', `${type} 型`, `${type} 型：${b.personality}`),
    );
  }
  paint();
  return h(
    'section',
    { class: 'card' },
    cardHead(h, 'heart', `${p.name}的血型`, '流行文化說法，和其他系統一起看'),
    h('div', { class: 'field' }, h('span', { class: 'field-label', text: '血型' }), sel),
    box,
    h('p', { class: 'hint', text: '血型性格源自日本，研究上沒有發現血型和個性有關；這裡只當作看自己的一個角度。綜合解讀時，只有和其他系統說法一致的特質才算共同點。' }),
  );
}
