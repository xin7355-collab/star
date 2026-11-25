// 線條圖示（24×24，本 App 自己畫的簡單形狀）。用 createElementNS 建立，不用 innerHTML。

const SVG_NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  coin: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M9 9.5c0-1.4 1.3-2 3-2s3 .6 3 2-1.3 1.8-3 2.3-3 .9-3 2.3 1.3 2 3 2 3-.6 3-2', 'M12 6v1.5M12 16.5V18'],
  calendar: ['M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M4 10h16M9 3v4M15 3v4', 'M8 14h2M14 14h2M8 17h2'],
  bell: ['M6 16V11a6 6 0 1 1 12 0v5l2 2H4z', 'M10 20a2 2 0 0 0 4 0'],
  star: ['M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z'],
  heart: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
  gem: ['M6 4h12l3 5-9 11L3 9z', 'M3 9h18M9 4l3 16M15 4l-3 16'],
  book: ['M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z', 'M18 20a2 2 0 0 0 2-2V6', 'M9 8h5M9 11h5'],
  pen: ['M4 20l4-1 11-11-3-3L5 16z', 'M14 7l3 3'],
  balls: ['M8 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M16.5 19a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M17 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  sparkle: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z'],
  compass: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M15.5 8.5l-2 5-5 2 2-5z'],
  twins: ['M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M3 20c0-3 2.2-5 5-5s5 2 5 5M11 20c0-3 2.2-5 5-5s5 2 5 5'],
  shield: ['M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z', 'M9 12l2 2 4-4'],
  // 復原／重做：彎回來的箭頭（掌紋描線的工具列）
  undo: ['M9 15L4 10l5-5', 'M4 10h10a6 6 0 0 1 0 12h-3'],
  redo: ['M15 15l5-5-5-5', 'M20 10H10a6 6 0 0 0 0 12h3'],
  palm: ['M8 12V6a1.4 1.4 0 0 1 2.8 0v5', 'M10.8 10.5V4.4a1.4 1.4 0 0 1 2.8 0v6.1', 'M13.6 10.6V5.6a1.4 1.4 0 0 1 2.8 0V12', 'M16.4 11.5v-1.8a1.4 1.4 0 0 1 2.8 0v4.6c0 3.7-2.9 6.7-6.6 6.7h-.9c-2.2 0-4.1-1.2-5.2-3.1L4.4 14a1.5 1.5 0 0 1 2.5-1.6L8 14', 'M9.5 16c1.5-.6 3.4-.6 5 .2'],
};

/**
 * @param {keyof PATHS} name
 * @param {string} [label] 有文字意義時才給（螢幕閱讀器會念）；純裝飾不給
 */
export function icon(name, label) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  for (const d of PATHS[name] || []) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

/** 卡片標題列：圖示＋標題＋副標 */
export function cardHead(h, iconName, title, sub) {
  const ico = h('span', { class: 'ico' });
  ico.append(icon(iconName));
  return h('div', { class: 'card-head' }, ico, h('div', {}, h('h2', { text: title }), sub ? h('div', { class: 'sub', text: sub }) : null));
}
