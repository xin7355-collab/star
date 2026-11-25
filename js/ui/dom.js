// 小型 DOM 工具。所有文字一律走 textContent，不用 innerHTML，避免任何注入風險。

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'style' && typeof value === 'object') setStyle(el, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 設定行內樣式。CSS 變數（--i 這類）一定要用 setProperty：
 * 直接指定 el.style['--i'] 瀏覽器會默默忽略，依序出現的動畫就全部同時跳出來（曾經這樣壞了很久）。
 */
function setStyle(el, styles) {
  for (const [k, v] of Object.entries(styles)) {
    if (v === null || v === undefined) continue;
    if (k.startsWith('--')) el.style.setProperty(k, String(v));
    else el.style[k] = v;
  }
}

/** SVG 版的 h()：屬性一律用 setAttribute（含 class），文字走 textContent */
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'text') el.textContent = value;
    else if (key === 'style' && typeof value === 'object') setStyle(el, value);
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/**
 * 換掉全部子元素。null／false 會略過、陣列會攤平。
 * 不要直接用原生 replaceChildren：它會把 null 印成文字「null」（農民曆卡片曾經出現過「nullnullnull」）。
 */
export function fill(el, ...children) {
  clear(el);
  append(el, children);
  return el;
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

let uid = 0;
export function nextId(prefix = 'f') {
  uid += 1;
  return `${prefix}-${uid}`;
}

/** 分段切換鈕（radio 外觀做成按鈕） */
export function segmented({ name, options, value, onChange, label }) {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label || name });
  for (const opt of options) {
    const id = nextId(name);
    const input = h('input', { type: 'radio', name, id, value: opt.value, checked: opt.value === value });
    input.addEventListener('change', () => {
      if (input.checked) onChange?.(opt.value);
    });
    wrap.append(input, h('label', { for: id, text: opt.label }));
  }
  return wrap;
}

export function scoreClass(score) {
  if (score >= 75) return 'lv-high';
  if (score >= 55) return 'lv-mid';
  if (score >= 40) return 'lv-low';
  return 'lv-poor';
}

/** 分數長條（參考 sbti RadarBar 的呈現方式，自行實作） */
export function scoreBar(label, score) {
  return h(
    'div',
    { class: `bar ${scoreClass(score)}` },
    h('div', { class: 'bar-head' }, h('span', { text: label }), h('b', { text: `${score}` })),
    h('div', { class: 'bar-track', role: 'img', 'aria-label': `${label} ${score} 分` }, h('div', { class: 'bar-fill', style: { width: `${Math.max(3, score)}%` } })),
  );
}
