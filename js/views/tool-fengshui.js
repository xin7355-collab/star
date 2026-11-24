// 命盤 → 開運佈置：怎麼改善（重點清單）、財庫在哪裡（命裡與家裡）、方位（個人吉方與今年九宮飛星）、
// 擺什麼（水晶、植物、花、魚）、辦公座位。依據都是民俗風水，畫面上講明是參考。

import { h, fill, segmented } from '../ui/dom.js';
import { load, save } from '../ui/storage.js';
import { cardHead } from '../ui/icons.js';
import { order } from '../ui/motion.js';
import { loadProfile } from './profile.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) if (c) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}

/** 俯視的房間示意圖：大門在下方牆上，財位在最裡面的角落（斜對角） */
function roomDiagram(door, corners) {
  const doorX = { left: 40, middle: 110, right: 180 }[door];
  const spot = (x) => [svg('circle', { cx: x, cy: 34, r: 18, class: 'room-spot' }), svg('text', { x, y: 39, 'text-anchor': 'middle', class: 'room-label' }, '財位')];
  return svg(
    'svg',
    { viewBox: '0 0 220 160', class: 'room', role: 'img', 'aria-label': `房間示意圖：大門在${{ left: '左邊', middle: '中間', right: '右邊' }[door]}，財位在${corners.map((c) => (c === 'left' ? '左後方' : '右後方')).join('與')}的角落` },
    svg('rect', { x: 10, y: 10, width: 200, height: 130, rx: 6, class: 'room-wall' }),
    ...corners.flatMap((c) => spot(c === 'left' ? 34 : 186)),
    svg('line', { x1: doorX - 22, y1: 140, x2: doorX + 22, y2: 140, class: 'room-door' }),
    svg('path', { d: `M${doorX - 22} 140 A44 44 0 0 1 ${doorX + 22} 140`, class: 'room-arc' }),
    svg('text', { x: doorX, y: 156, 'text-anchor': 'middle', class: 'room-label muted' }, '大門'),
  );
}

// 九宮格依地圖方向排（上北下南），和羅盤圖「上南下北」不同，所以格子裡都寫上方位
const GRID = [['西北', '北', '東北'], ['西', '中', '東'], ['西南', '南', '東南']];

export async function drawFengshui(p, input, opts, { ctx, actions, mayaTime }) {
  const [prof, F] = await Promise.all([loadProfile(ctx, p, input, opts, { mayaTime, withName: false }), import('../core/fengshui.js')]);
  let door = load('fsDoor', 'middle');
  if (!['left', 'middle', 'right'].includes(door)) door = 'middle';
  const build = () => F.buildFengshui({ bazi: prof.bazi, ziwei: prof.ziwei, birth: input.date, gender: p.gender || null, today: opts.today, door });
  let r = build();

  const planBox = h('ol', { class: 'plan' });
  const cornerBox = h('div', { 'aria-live': 'polite' });
  const paint = () => {
    fill(planBox, ...order(r.plan.map((t) => h('li', { text: t }))));
    fill(cornerBox, roomDiagram(door, r.corner.corners), h('p', { class: 'gold', text: r.corner.text }));
  };
  paint();
  const doorSeg = segmented({
    name: 'fs-door',
    label: '大門在牆的哪一邊',
    value: door,
    options: [{ value: 'left', label: '左邊' }, { value: 'middle', label: '中間' }, { value: 'right', label: '右邊' }],
    onChange: (v) => { door = v; save('fsDoor', v); r = build(); paint(); },
  });

  const ys = r.ys;
  const store = r.store;
  const items = r.items;
  const fs = r.flying;
  const cells = GRID.flat().map((dir) => {
    const s = fs.stars.find((x) => x.dir === dir);
    return h('div', { class: `ls-cell ${s.kind}` }, h('small', { text: F.place(dir) }), h('b', { text: s.name.slice(0, 2) }), h('span', { class: 'small', text: s.theme.split('，')[0].split('（')[0] }));
  });
  order(cells);

  const cards = [
    h(
      'section',
      { class: 'card feature' },
      cardHead(h, 'gem', '怎麼改善：開運佈置重點', ys ? `喜用五行「${ys.primary}」・${r.year} 年` : `${r.year} 年`),
      planBox,
      ys ? h('p', { class: 'hint', text: `喜用五行怎麼來的：${ys.reasons.join('')}${ys.tiaohou ? ` ${ys.tiaohou}` : ''}` }) : h('p', { class: 'warn', text: '生日資料不完整，擺設建議只能給一般原則。' }),
    ),
    h(
      'section',
      { class: 'card' },
      cardHead(h, 'coin', '財庫在哪裡', '命裡的財庫，和家裡的財位'),
      h('h3', { text: '命裡的財庫' }),
      store.bazi ? h('ul', { class: 'reasons' }, store.bazi.lines.map((t) => h('li', { class: 'tone-info' }, h('span', { class: 'sys sys-八字', text: '八字' }), h('span', { text: t })))) : null,
      store.ziwei ? h('ul', { class: 'reasons' }, store.ziwei.lines.map((t) => h('li', { class: store.ziwei.tone > 0 ? 'tone-good' : store.ziwei.tone < 0 ? 'tone-bad' : 'tone-info' }, h('span', { class: 'sys sys-紫微', text: '紫微' }), h('span', { text: t })))) : h('p', { class: 'muted small', text: '紫微的田宅宮（財庫）需要出生時間與性別。' }),
      h('h3', { text: '家裡的財位（明財位）' }),
      h('p', { class: 'field-label', text: '站在大門往屋裡看，大門在牆的哪一邊？' }),
      doorSeg,
      cornerBox,
      h('b', { class: 'small', text: '財位要' }),
      h('ul', { class: 'reasons' }, r.rules.do.map((t) => h('li', { class: 'tone-good', text: t }))),
      h('b', { class: 'small', text: '財位不要' }),
      h('ul', { class: 'reasons' }, r.rules.avoid.map((t) => h('li', { class: 'tone-bad', text: t }))),
    ),
    h(
      'section',
      { class: 'card' },
      cardHead(h, 'compass', '方位', r.personal ? `你是${r.personal.name}（${r.personal.group}）・${r.year} 年九宮飛星` : `${r.year} 年九宮飛星`),
      r.personal ? h('h3', { text: '你的吉方與凶方' }) : null,
      r.personal
        ? h('ul', { class: 'reasons' }, r.personal.stars.map((s) => h('li', { class: s.good ? 'tone-good' : 'tone-bad' }, h('b', { text: `${s.dir}・${s.key}：` }), h('span', { text: `${s.use}。${s.tip}。` }))))
        : h('p', { class: 'muted', text: '個人吉方（八宅命卦）要看性別，到「我的」補上就會出現。' }),
      h('h3', { text: `${r.year} 年的財位與煞位` }),
      h('div', { class: 'luoshu', role: 'group', 'aria-label': `${r.year} 年九宮飛星，上北下南` }, cells),
      h('p', { class: 'muted small center', text: '上北下南（和地圖一樣）' }),
      h('ul', { class: 'reasons' }, r.goodStars.map((s) => h('li', { class: 'tone-good', text: `${F.place(s.dir)}・${s.name}：${s.theme}。${s.tip}。` })), r.badStars.map((s) => h('li', { class: 'tone-bad', text: `${F.place(s.dir)}・${s.name}：${s.theme}。${s.tip}。` }))),
      h('p', { class: 'warn', text: `太歲在${fs.taisui.dir}（${fs.taisui.zhi}）、歲破在${fs.taisui.breaker}：這兩個方位今年避免動土、裝修，座位不要背對太歲。` }),
    ),
  ];

  if (items) {
    const crystals = [...items.primary.crystals, ...items.secondary.crystals.slice(0, 1)];
    cards.push(h(
      'section',
      { class: 'card' },
      cardHead(h, 'sparkle', '擺什麼最好', `主要補「${ys.primary}」，其次「${ys.secondary}」`),
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('div', { class: 'sv', text: items.primary.colors.split('、')[0] }), h('div', { class: 'sl', text: '主色' })),
        h('div', { class: 'stat' }, h('div', { class: 'sv', text: items.primary.direction.split('、')[0] }), h('div', { class: 'sl', text: '有利方位' })),
        h('div', { class: 'stat' }, h('div', { class: 'sv', text: items.primary.shapes.split('、')[0] }), h('div', { class: 'sl', text: '形狀' }))),
      h('p', { text: `顏色：${items.primary.colors}；材質：${items.primary.materials}。次要的「${ys.secondary}」：${items.secondary.colors}。` }),
      r.clash.length ? h('p', { class: 'warn', text: `${r.year} 年「${r.clash.map((c) => c.dir).join('、')}」有${r.clash.flatMap((c) => c.what).join('、')}，今年開運擺設改放「${items.secondary.direction}」。` }) : null,
      h('h3', { text: '水晶' }),
      h('ul', { class: 'reasons' }, crystals.map((c) => h('li', { class: 'tone-good', text: `${c.name}：${c.use}` }))),
      h('h3', { text: '植物' }),
      h('div', { class: 'chips' }, items.primary.plants.map((t) => h('span', { class: 'chip', text: t }))),
      h('p', { class: 'muted small', text: items.primary.plantNote }),
      h('h3', { text: '花' }),
      h('div', { class: 'chips' }, items.primary.flowers.map((t) => h('span', { class: 'chip', text: t }))),
      h('h3', { text: `養魚：${r.fish.title}` }),
      h('p', { text: r.fish.text }),
      h('ul', { class: 'reasons' }, h('li', { class: 'tone-info', text: r.fish.where }), h('li', { class: 'tone-info', text: r.fish.care })),
    ));
  }

  cards.push(h(
    'section',
    { class: 'card' },
    cardHead(h, 'pen', '辦公室與座位', '面向、靠山、桌上擺什麼'),
    h('ul', { class: 'reasons' }, r.desk.map((t) => h('li', { class: 'tone-info', text: t }))),
    h('p', { class: 'hint', text: '風水是民俗說法，不是保證；真正改善處境的是行動。擺設當作提醒自己的儀式感就好，不需要花大錢買開運物。' }),
    actions(p, 'fengshui', '開運佈置', r.plan.slice(0, 3).join(' ')),
  ));
  return cards;
}
