// 全螢幕抽牌儀式：洗牌 → 78 張攤成扇形 → 挑 N 張 → 逐張翻開 → 回到解讀。用到才載入。
// 公平性：整副牌在進場前就用加密亂數洗好（core/tarot.js 的 shuffleDeck），挑哪個位置都一樣，挑牌只是儀式感。
// 挑牌方式：點一下就抽；或手指在扇形上滑過，停在同一張 0.6 秒、金邊畫滿就抽出（金邊用 SVG 線條的
// stroke-dashoffset，不動 box-shadow）。隨時可以「幫我隨機挑」或「跳過儀式」，也能關掉不抽。
// 動畫只動 transform、opacity、stroke-dashoffset；動畫強度不是「完整」或系統要求減少動態時，畫面根本不會進來。

import { h, s, fill } from './dom.js';
import { cardBack, tarotCard } from './tarot-art.js';

const DWELL_MS = 600;
const CARD_W = 46;
const CARD_H = 77;

/** 加密亂數挑 n 個不重複的位置（跳過儀式、幫我隨機挑用） */
function randomPicks(n, size, taken = []) {
  const left = Array.from({ length: size }, (_, i) => i).filter((i) => !taken.includes(i));
  const out = [];
  const buf = new Uint32Array(1);
  while (out.length < n && left.length) {
    globalThis.crypto.getRandomValues(buf);
    out.push(left.splice(buf[0] % left.length, 1)[0]);
  }
  return out;
}

/**
 * @param {{title:string, positions:string[], size?:number, reveal:(fanIndex:number)=>{face:object, reversed:boolean}, backImage?:string}} opts
 * @returns {Promise<number[]|null>} 挑到的扇形位置（依牌位順序）；關掉不抽回傳 null
 */
export function runRitual({ title, positions, size = 78, reveal, backImage = null }) {
  const n = positions.length;
  const opener = document.activeElement;
  const picks = [];
  let done = false;
  let resolveFn;
  const result = new Promise((r) => { resolveFn = r; });

  const counter = h('span', { class: 'rt-count', 'aria-live': 'polite', text: `已選 0／${n}` });
  const hint = h('p', { class: 'rt-hint', text: '洗牌中…' });
  const slots = h('div', { class: `rt-slots${n > 5 ? ' two-rows' : ''}` }, positions.map((pos) => h('div', { class: 'rt-slot' }, h('div', { class: 'rt-slot-card' }), h('span', { text: pos }))));
  const fan = h('div', { class: 'rt-fan shuffling', 'aria-hidden': 'true' });
  const randomBtn = h('button', { type: 'button', class: 'btn small', text: '幫我隨機挑', onclick: () => pickMany(randomPicks(n - picks.length, size, picks)) });
  const skipBtn = h('button', { type: 'button', class: 'btn small ghost', text: '跳過儀式', onclick: () => { pickMany(randomPicks(n - picks.length, size, picks), true); } });
  const closeBtn = h('button', { type: 'button', class: 'link rt-close', 'aria-label': '關閉，不抽牌', text: '✕', onclick: () => finish(null) });
  const doneBtn = h('button', { type: 'button', class: 'btn primary rt-done', text: '看完整解讀', hidden: true, onclick: () => finish(picks.slice()) });
  const overlay = h('div', { class: 'rt', role: 'dialog', 'aria-modal': 'true', 'aria-label': `抽牌儀式：${title}` },
    h('div', { class: 'rt-top' }, h('div', {}, h('b', { text: title }), ' ', counter), closeBtn),
    hint,
    slots,
    h('div', { class: 'rt-actions' }, randomBtn, skipBtn, doneBtn),
    fan);

  // ── 扇形：每張牌繞著畫面下方的同一個支點旋轉排開；半徑等版面排好後依剩下的高度決定（見 fitFan）
  const W = Math.min(globalThis.innerWidth || 390, 560);
  const span = 100;
  const cards = Array.from({ length: size }, (_, k) => {
    const el = h('div', { class: 'rt-card', style: { '--t': `${(-span / 2 + (span * k) / (size - 1)).toFixed(2)}deg`, '--k': String(k) } }, cardBack(backImage));
    el.dataset.k = String(k);
    return el;
  });
  fan.append(...cards);
  const ring = s('svg', { class: 'rt-ring', viewBox: `0 0 ${CARD_W + 8} ${CARD_H + 8}`, 'aria-hidden': 'true' }, s('rect', { x: 2, y: 2, width: CARD_W + 4, height: CARD_H + 4, rx: 7, pathLength: 1 }));

  let hovered = null;
  let timer = null;
  let downAt = 0;
  const cardAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const c = el && el.closest ? el.closest('.rt-card') : null;
    return c && !c.classList.contains('taken') ? c : null;
  };
  function hover(c) {
    if (c === hovered) return;
    if (hovered) hovered.classList.remove('hover');
    clearTimeout(timer);
    ring.remove();
    hovered = c;
    if (!c) return;
    c.classList.add('hover');
    // 金邊重新畫一次（移除再放回去，動畫才會從頭開始）
    c.append(ring);
    timer = setTimeout(() => take(c), DWELL_MS);
  }
  fan.addEventListener('pointerdown', (e) => {
    if (fan.classList.contains('shuffling') || picks.length >= n) return;
    e.preventDefault();
    fan.setPointerCapture?.(e.pointerId);
    downAt = Date.now();
    hover(cardAt(e.clientX, e.clientY));
  });
  fan.addEventListener('pointermove', (e) => {
    if (!downAt) return;
    hover(cardAt(e.clientX, e.clientY));
  });
  const release = (e) => {
    if (!downAt) return;
    const quick = Date.now() - downAt < DWELL_MS;
    downAt = 0;
    const c = hovered;
    hover(null);
    // 點一下（沒有滑動、很快放開）就直接抽那一張
    if (quick && c && e.type === 'pointerup' && cardAt(e.clientX, e.clientY) === c) take(c);
  };
  fan.addEventListener('pointerup', release);
  fan.addEventListener('pointercancel', release);

  function take(c) {
    if (!c || c.classList.contains('taken') || picks.length >= n) return;
    if (c === hovered) hover(null);
    c.classList.add('taken');
    picks.push(Number(c.dataset.k));
    const slot = slots.children[picks.length - 1].firstChild;
    slot.append(cardBack(backImage));
    slot.classList.add('filled');
    counter.textContent = `已選 ${picks.length}／${n}`;
    navigator.vibrate?.(12);
    if (picks.length >= n) startReveal();
  }
  function pickMany(list, instant = false) {
    for (const k of list) take(cards[k]);
    if (instant) finish(picks.slice());
  }

  function startReveal() {
    fan.classList.add('gone');
    randomBtn.hidden = true;
    skipBtn.hidden = true;
    hint.textContent = '翻牌中…';
    picks.forEach((k, i) => {
      const { face, reversed } = reveal(k);
      const slot = slots.children[i].firstChild;
      const card = tarotCard(face, { reversed, back: backImage });
      card.style.setProperty('--i', String(i));
      fill(slot, card);
    });
    setTimeout(() => {
      if (done) return;
      hint.textContent = '牌都翻開了。';
      doneBtn.hidden = false;
      doneBtn.focus();
    }, 900 + n * 260);
  }

  function finish(value) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    overlay.classList.add('closing');
    document.body.style.overflow = '';
    setTimeout(() => overlay.remove(), 220);
    if (opener && opener.focus) opener.focus();
    resolveFn(value);
  }
  const onKey = (e) => { if (e.key === 'Escape') finish(null); };
  document.addEventListener('keydown', onKey);

  document.body.style.overflow = 'hidden';
  document.body.append(overlay);
  // 牌位多（凱爾特十字兩排）時上面占的高度多，扇形要縮小，最上面的牌才不會蓋住按鈕
  const fitFan = () => {
    const avail = fan.clientHeight || 260;
    fan.style.setProperty('--r', `${Math.max(120, Math.min(Math.round(W * 0.68), avail + 46 - CARD_H - 14))}px`);
  };
  fitFan();
  randomBtn.focus();
  // 洗牌：中間一疊牌左右交錯幾次，再攤開成扇形
  setTimeout(() => {
    if (done) return;
    fan.classList.remove('shuffling');
    hint.textContent = `點一下牌就抽；或手指滑過去、停在想要的那張，金邊畫滿就抽出。共要挑 ${n} 張。`;
  }, 1500);
  return result;
}
