// 「占卜」：解惑、塔羅、樂透選號、配對放在同一個分頁，上方分段切換。各面板沿用自己的模組，只負責切換與記住上次停在哪。

import { h, segmented, fill } from '../ui/dom.js';
import { load, save } from '../ui/storage.js';
import { reducedMotion } from '../ui/motion.js';
import { mountTarot } from './tarot.js';
import { mountMatch } from './match.js';
import { mountLotto } from './lotto.js';
import { mountJiehuo } from './jiehuo.js';

const PANELS = [
  { value: 'jiehuo', label: '解惑' },
  { value: 'tarot', label: '塔羅' },
  { value: 'lotto', label: '樂透' },
  { value: 'match', label: '配對' },
];

export function mountOracle(root, ctx) {
  let panel = load('oraclePanel', 'jiehuo');
  if (!PANELS.some((p) => p.value === panel)) panel = 'jiehuo';
  const boxes = Object.fromEntries(PANELS.map((p) => [p.value, h('div', { class: 'subview', id: `oracle-${p.value}` })]));
  const segBox = h('div', { class: 'oracle-switch' });
  let lotto = null;

  function show(next) {
    panel = next;
    save('oraclePanel', panel);
    for (const [k, el] of Object.entries(boxes)) el.hidden = k !== panel;
    fill(segBox, segmented({ name: 'oracle-panel', label: '占卜項目', value: panel, options: PANELS, onChange: show }));
    // 樂透面板要用到命盤，等第一次打開才計算
    if (panel === 'lotto' && !lotto) {
      lotto = mountLotto(boxes.lotto, ctx);
      lotto.refresh();
    }
    if (!reducedMotion()) {
      boxes[panel].classList.remove('entering');
      void boxes[panel].offsetWidth;
      boxes[panel].classList.add('entering');
    }
  }

  mountJiehuo(boxes.jiehuo, ctx);
  mountTarot(boxes.tarot, ctx);
  mountMatch(boxes.match, ctx);
  root.append(segBox, boxes.jiehuo, boxes.tarot, boxes.lotto, boxes.match);
  show(panel);
  return {
    open(opts) {
      if (opts && opts.panel && boxes[opts.panel]) show(opts.panel);
    },
  };
}
