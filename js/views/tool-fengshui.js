// 命盤 → 開運佈置：怎麼改善（重點清單）、財庫在哪裡（命裡與家裡）、方位（個人吉方與今年九宮飛星）、
// 格局改不了怎麼化解（勾選自家狀況）、擺什麼（水晶、植物、花、魚）、辦公座位。依據都是民俗風水，畫面上講明是參考。

import { h, s as svg, fill, segmented } from '../ui/dom.js';
import { load, save } from '../ui/storage.js';
import { cardHead } from '../ui/icons.js';
import { order, playWhenVisible } from '../ui/motion.js';
import { AREAS, ISSUES, PRINCIPLE, tailor, pickIssues, STAR_CURE_WHY } from '../core/fengshui-fix.js';
import { loadProfile } from './profile.js';
import { luopan, flightPath, FLY_ORDER } from '../ui/charts.js';
import { openCompass, compassDenied } from '../ui/compass-live.js';
import { askOrientation } from '../ui/orientation.js';
import { DIR_DEG } from '../core/compass.js';

const STEP = [['move', '能改就改'], ['block', '改不了：擋'], ['cure', '擋不了：化']];

/** 一項狀況的化解：為什麼、三段做法、依喜用挑植物 */
function remedyEl(issue, ys) {
  const extra = tailor(issue, ys);
  return h(
    'details',
    { class: 'fix', open: true },
    h('summary', { text: issue.label }),
    h('p', { class: 'muted small', text: issue.why }),
    h('ol', { class: 'fix-steps' }, STEP.filter(([k]) => issue[k]).map(([k, tag]) => h('li', {}, h('span', { class: `fix-tag ${k}`, text: tag }), h('span', { text: issue[k] })))),
    extra ? h('p', { class: 'hint', text: extra }) : null,
  );
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

  // 格局化解：勾選的狀況記在這支手機（下次打開還在）
  let issueIds = load('fsIssues', []);
  if (!Array.isArray(issueIds)) issueIds = [];
  let area = load('fsArea', 'door');
  if (!AREAS.some((a) => a.id === area)) area = 'door';
  const checkBox = h('div', { class: 'fix-checks' });
  const chosenBox = h('div', { 'aria-live': 'polite' });
  const areaSel = h('select', { 'aria-label': '哪個地方有狀況', onchange: (e) => { area = e.target.value; save('fsArea', area); paintFix(); } }, AREAS.map((a) => h('option', { value: a.id, text: a.label })));
  areaSel.value = area;
  const paintFix = () => {
    fill(checkBox, ...ISSUES.filter((x) => x.area === area).map((x) => h('label', { class: 'check' },
      h('input', {
        type: 'checkbox',
        checked: issueIds.includes(x.id),
        onchange: (e) => {
          issueIds = e.target.checked ? [...issueIds, x.id] : issueIds.filter((id) => id !== x.id);
          save('fsIssues', issueIds);
          paintFix();
        },
      }),
      h('span', { text: x.label }))));
    const chosen = pickIssues(issueIds);
    fill(chosenBox, chosen.length
      ? h('div', {}, h('h3', { text: `你勾的 ${chosen.length} 個狀況怎麼化解` }), ...chosen.map((x) => remedyEl(x, r.ys)))
      : h('p', { class: 'muted small', text: '勾選你家或座位有的狀況，這裡會列出化解方法。' }));
  };
  paintFix();
  const fixCard = h(
    'section',
    { class: 'card', id: 'fs-fix' },
    cardHead(h, 'shield', '格局改不了？這樣化解', '租屋、固定座位也做得到'),
    h('p', { class: 'gold', text: PRINCIPLE }),
    h('div', { class: 'field' }, h('span', { class: 'field-label', text: '哪個地方有狀況' }), areaSel),
    checkBox,
    chosenBox,
  );
  const gotoFix = (id) => {
    area = id;
    save('fsArea', area);
    areaSel.value = area;
    paintFix();
    fixCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const ys = r.ys;
  const store = r.store;
  const items = r.items;
  const fs = r.flying;
  const cells = GRID.flat().map((dir) => {
    const s = fs.stars.find((x) => x.dir === dir);
    const ms = r.month.stars.find((x) => x.dir === dir);
    // 格子依「飛到的順序」落下（--i），和金色的飛星路線同步
    return h('div', { class: `ls-cell ${s.kind}`, style: { '--i': String(FLY_ORDER.indexOf(dir)) } }, h('small', { text: F.place(dir) }), h('b', { text: s.name.slice(0, 2) }), h('span', { class: 'small', text: s.theme.split('，')[0].split('（')[0] }), h('span', { class: `ls-month ${ms.kind}`, text: `本月${ms.name.slice(0, 2)}` }));
  });

  // 手機羅盤要找的方位：第一個是預設（今年的當運財星）；落在房子中央的星沒有方向可指，不列
  const starAt = (n) => fs.stars.find((x) => x.star === n);
  const compassTargets = [
    { id: 'nine', label: '今年財星（九紫）', name: '今年財星（九紫）', legend: '今年財星', mark: '財', dir: starAt(9).dir, kind: 'good' },
    { id: 'eight', label: '今年財星（八白）', name: '今年財星（八白）', legend: '今年財星', mark: '財', dir: starAt(8).dir, kind: 'good' },
    r.personal ? { id: 'sheng', label: '你的生氣方（個人財位）', name: '生氣方', legend: '你的生氣方', mark: '生', dir: r.personal.stars.find((x) => x.key === '生氣').dir, kind: 'good' } : null,
    items ? { id: 'ys', label: `喜用「${ys.primary}」的方位`, name: `喜用${ys.primary}方位`, legend: `喜用${ys.primary}的方位`, mark: ys.primary, dir: items.primary.direction.split('、').find((d) => d in DIR_DEG), kind: 'good' } : null,
    { id: 'five', label: '要避開：五黃', name: '五黃煞（要避開）', legend: '五黃煞（避開）', mark: '煞', dir: starAt(5).dir, kind: 'bad' },
    { id: 'taisui', label: '要避開：太歲', name: '太歲（要避開）', legend: '太歲（避開）', mark: '太', dir: fs.taisui.dir, kind: 'bad' },
  ].filter((t) => t && t.dir in DIR_DEG);
  const compassBtn = h('button', {
    type: 'button',
    class: 'btn primary',
    text: '用手機羅盤找方位',
    // iPhone 的方向權限要在點擊當下要，所以先呼叫 askOrientation，拿到結果才開面板
    onclick: () => askOrientation().then((st) => (st === 'granted' ? openCompass({ sheet: ctx.sheet, personal: r.personal, targets: compassTargets }) : compassDenied(ctx.sheet))),
  });

  const cards = [
    h(
      'section',
      { class: 'card feature' },
      cardHead(h, 'gem', '怎麼改善：開運佈置重點', ys ? `喜用五行「${ys.primary}」・${r.year} 年` : `${r.year} 年`),
      planBox,
      h('p', { class: 'hint', text: '家裡或座位的格局改不了（樑壓床、門對門、財位是窗戶…）也有解：往下看「格局改不了？這樣化解」，勾選你家的狀況。' }),
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
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', text: '財位是窗戶、走道或廁所？看化解', onclick: () => gotoFix('wealth') })),
    ),
    h(
      'section',
      { class: 'card' },
      cardHead(h, 'compass', '方位', r.personal ? `你是${r.personal.name}（${r.personal.group}）・${r.year} 年九宮飛星` : `${r.year} 年九宮飛星`),
      playWhenVisible(luopan(r.personal)),
      r.personal ? h('div', { class: 'lp-legend', 'aria-hidden': 'true' }, h('span', { class: 'good', text: '你的吉方' }), h('span', { class: 'bad', text: '你的凶方' })) : null,
      h('p', { class: 'muted small center', text: '羅盤北在上：外圈是二十四山，中圈是八個方位（有填性別會標出你的八宅吉凶），內圈是後天八卦。' }),
      h('div', { class: 'actions center' }, compassBtn),
      h('p', { class: 'muted small center', text: '站在家裡中心點打開，手機指南針會直接指出今年財星、你的生氣方和要避開的五黃、太歲在哪個方向。' }),
      r.personal ? h('h3', { text: '你的吉方與凶方（八宅）' }) : null,
      r.personal ? h('p', { class: 'muted small', text: '每個方位有一顆「遊年星」。吉方放同五行的東西加強；床、座位剛好在凶方又搬不動時，用「洩」的五行化解（比硬剋溫和，是八宅派常見作法）。' }) : null,
      r.personal
        ? h('ul', { class: 'reasons' }, r.personal.stars.map((s) => h('li', { class: s.good ? 'tone-good' : 'tone-bad' }, h('b', { text: `${s.dir}・${s.key}（${s.star}${s.wx}）：` }), h('span', { text: `${s.use}。${s.tip}。${s.good ? `加強：${s.boost}。` : `改不了的話，化解：${s.cure}。`}` }))))
        : h('p', { class: 'muted', text: '個人吉方（八宅命卦）要看性別，到「我的」補上就會出現。' }),
      h('h3', { text: `${r.year} 年的財位與煞位` }),
      playWhenVisible(h('div', { class: 'luoshu-wrap' }, h('div', { class: 'luoshu', role: 'group', 'aria-label': `${r.year} 年九宮飛星，上北下南` }, cells), flightPath())),
      h('p', { class: 'muted small center', text: `上北下南（和地圖一樣）。大字是 ${r.year} 年的星，小字是這個月（${r.month.from.m}/${r.month.from.d}–${r.month.to.m}/${r.month.to.d}）的星。金線是飛星的順序：從中宮出發，依洛書飛到西北、西、東北、南、北、西南、東、東南。` }),
      h('p', { class: 'muted small', text: fs.period.note }),
      h('ul', { class: 'reasons' }, r.goodStars.map((s) => h('li', { class: 'tone-good', text: `${F.place(s.dir)}・${s.name}：${s.theme}。${s.tip}。` })), r.badStars.map((s) => h('li', { class: 'tone-bad', text: `${F.place(s.dir)}・${s.name}：${s.theme}。${s.tip}。${STAR_CURE_WHY[s.star] || ''}` }))),
      h('p', { class: 'warn', text: `太歲在${fs.taisui.dir}（${fs.taisui.zhi}）、歲破在${fs.taisui.breaker}：這兩個方位今年避免動土、裝修，座位不要背對太歲。` }),
    ),
    fixCard,
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
    h('ul', { class: 'reasons' }, r.desk.map((t) => h('li', { class: 'tone-info' }, h('span', { text: t.rule }), t.fix ? h('span', { class: 'fix-alt' }, h('b', { text: '改不了：' }), t.fix) : null))),
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', text: '座位的其他狀況怎麼化解', onclick: () => gotoFix('office') })),
    h('p', { class: 'hint', text: '風水是民俗說法，不是保證；真正改善處境的是行動。擺設當作提醒自己的儀式感就好，不需要花大錢買開運物。' }),
    actions(p, 'fengshui', '開運佈置', r.plan.slice(0, 3).join(' ')),
  ));
  return cards;
}
