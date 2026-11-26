// 「老師怎麼看」：各工具共用的講解區塊，像命理老師當面講：
// 斷語（一句話）→ 為什麼（白話原因）→ 化解（做得到的步驟）→ 加分（好的地方怎麼用）→ 搭配看（下一個該看的工具）。
// 結構固定、文案由各工具的 core 模組產生，這裡只負責畫；區塊的順序和樣式全 App 一致，看過一次就知道去哪裡找「怎麼辦」。

import { h } from './dom.js';
import { cardHead } from './icons.js';

const TONE = { good: 'tone-good', bad: 'tone-bad', info: 'tone-info' };

/**
 * lead：斷語上面要先放的東西（例如配對的「你們現在的關係」切換：斷語和建議都跟著它變，要先選）
 * @param {{title?:string, sub?:string, badge?:{text:string, cls?:string}|null, verdict:string, lead?:Node[], why?:{tone:string,text:string}[],
 *   remedies?:{title:string, steps:string[], note?:string}[], boosts?:string[], extra?:Node[], combos?:{label:string, why:string, go:any[]}[],
 *   onGo?:(view:string, opts:object)=>void}} o
 */
export function masterCard({ title = '老師怎麼看', sub = '斷語、原因、化解，一次講清楚', badge = null, verdict, lead = [], why = [], remedies = [], boosts = [], extra = [], combos = [], onGo = null }) {
  return h(
    'section',
    { class: 'card master' },
    cardHead(h, 'sparkle', title, sub),
    lead,
    h('p', { class: 'master-verdict' }, badge ? h('span', { class: `badge ${badge.cls || ''}`, text: badge.text }) : null, badge ? ' ' : null, verdict),
    why.length ? [h('h3', { text: '為什麼這樣說' }), h('ul', { class: 'reasons' }, why.map((w) => h('li', { class: TONE[w.tone] || 'tone-info', text: w.text })))] : null,
    // 化解一項一項收起來（第一項打開）：手機上一張卡太長會找不到後面的「下一步」
    remedies.length ? [
      h('h3', { text: '怎麼化解' }),
      remedies.map((r, k) => h('details', { class: 'remedy', open: k === 0 },
        h('summary', { text: r.title }),
        h('ol', { class: 'plan' }, r.steps.map((t, i) => h('li', { style: { '--i': String(i) }, text: t }))),
        r.note ? h('p', { class: 'muted small', text: r.note }) : null)),
    ] : null,
    boosts.length ? h('details', { class: 'more' }, h('summary', { text: '好的地方怎麼用' }), h('ul', { class: 'reasons' }, boosts.map((t) => h('li', { class: 'tone-good', text: t })))) : null,
    extra,
    combos.length && onGo ? [
      h('h3', { text: '搭配看，看得更準' }),
      h('ul', { class: 'combos' }, combos.map((c) => h('li', {},
        h('button', { type: 'button', class: 'btn small', text: c.label, onclick: () => onGo(...c.go) }),
        h('span', { class: 'muted small', text: c.why })))),
    ] : null,
  );
}
