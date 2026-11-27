// 多選挑選器（會的技能、證照）：和工作挑選器同一種操作——打字搜尋，或先選類別再選項目；
// 選了的顯示成一排小標籤，點 × 移除。一百多個選項放成一排排勾選框，iPhone 上要滑很久也找不到。

import { h, fill } from '../ui/dom.js';
import { searchItems } from '../core/work-profile.js';

let seq = 0;

/**
 * @param {{label:string, groups:{id:string,name:string,items:{id:string,name:string}[]}[], value?:string[], max?:number,
 *   group?:{open:object|null}, onChange:(ids:string[])=>void}} o
 *   group：和同一張表單其他挑選器共用，一次只開一個
 * @returns {{el:HTMLElement, close:(focusButton?:boolean)=>void}}
 */
export function multiPicker({ label, groups, value = [], max = 40, group = { open: null }, onChange }) {
  const id = `multi-panel-${(seq += 1)}`;
  const all = groups.flatMap((g) => g.items);
  const byId = new Map(all.map((x) => [x.id, x]));
  let chosen = value.filter((v) => byId.has(v));
  let composing = false;

  const chips = h('ul', { class: 'pick-chips', 'aria-label': `已選的${label}` });
  const addBtn = h('button', { type: 'button', class: 'btn small', 'aria-expanded': 'false', 'aria-controls': id });
  const input = h('input', { type: 'search', class: 'job-search', 'aria-label': `搜尋${label}`, placeholder: '打字找，例如：無線電、電腦、急救', autocomplete: 'off', enterkeyhint: 'search' });
  const hint = h('p', { class: 'muted small', role: 'status' });
  const hits = h('ul', { class: 'job-hits' });
  const catSel = h('select', { 'aria-label': `${label}：類別` },
    h('option', { value: '', text: '（選類別）' }), groups.map((g) => h('option', { value: g.id, text: `${g.name}（${g.items.length}）` })));
  const itemSel = h('select', { 'aria-label': `${label}：項目`, disabled: true }, h('option', { value: '', text: '（先選類別）' }));
  const panel = h('div', { class: 'job-panel', id, hidden: true },
    input, hint, hits,
    h('p', { class: 'field-label', text: '或從類別找' }),
    h('div', { class: 'job-browse' }, catSel, itemSel),
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn small ghost', text: '完成', onclick: () => close(true) })));

  const full = () => chosen.length >= max;
  function paintChips() {
    fill(chips, chosen.map((cid) => h('li', { class: 'pick-chip' },
      h('span', { text: byId.get(cid).name }),
      h('button', { type: 'button', class: 'chip-x', 'aria-label': `移除「${byId.get(cid).name}」`, text: '×', onclick: () => toggle(cid) }))));
    addBtn.textContent = chosen.length ? `＋ 再加${label}（已選 ${chosen.length}）` : `＋ 加${label}`;
  }
  function paintItems() {
    const g = groups.find((x) => x.id === catSel.value);
    fill(itemSel, h('option', { value: '', text: g ? '（選一項加進去）' : '（先選類別）' }),
      g ? g.items.map((x) => h('option', { value: x.id, text: `${chosen.includes(x.id) ? '✓ ' : ''}${x.name}`, disabled: chosen.includes(x.id) })) : null);
    itemSel.disabled = !g;
  }
  function render() {
    if (composing) return;
    const q = input.value.trim();
    if (!q) {
      fill(hits);
      hint.textContent = full() ? `最多 ${max} 項，已經選滿了。` : '';
      return;
    }
    const list = searchItems(all, q);
    hint.textContent = list.length ? `找到 ${list.length} 個，點一下加入或取消` : `找不到「${q}」：換個說法，或從下面的類別找。`;
    fill(hits, list.map((x) => h('li', {},
      h('button', { type: 'button', class: 'job-hit', 'aria-pressed': chosen.includes(x.id) ? 'true' : 'false', onclick: () => toggle(x.id) },
        h('b', { text: `${chosen.includes(x.id) ? '✓ ' : ''}${x.name}` }),
        h('span', { class: 'muted small', text: groups.find((g) => g.items.includes(x)).name })))));
  }
  function toggle(cid) {
    if (chosen.includes(cid)) chosen = chosen.filter((x) => x !== cid);
    else if (!full()) chosen = [...chosen, cid];
    paintChips();
    paintItems();
    render();
    onChange([...chosen]);
  }
  function open() {
    if (group.open && group.open !== api) group.open.close();
    group.open = api;
    panel.hidden = false;
    addBtn.setAttribute('aria-expanded', 'true');
    input.focus(); // 點擊當下 focus，iPhone 才會跳出鍵盤
  }
  function close(focusButton = false) {
    panel.hidden = true;
    addBtn.setAttribute('aria-expanded', 'false');
    if (group.open === api) group.open = null;
    if (focusButton) addBtn.focus();
  }

  addBtn.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    }
  });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => {
    composing = false;
    render();
  });
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      input.blur();
    }
  });
  catSel.addEventListener('change', paintItems);
  itemSel.addEventListener('change', () => {
    if (itemSel.value) toggle(itemSel.value);
  });

  const api = { el: h('div', { class: 'multi-picker' }, chips, addBtn, panel), close };
  paintChips();
  return api;
}
