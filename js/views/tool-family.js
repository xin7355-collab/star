// 命盤 → 家人關係：名單上的人彼此怎麼互相影響（誰幫誰、哪裡會摩擦、怎麼相處更好），
// 從你的命盤看各種家人（六親星、宮位、紫微），今年家裡誰要注意，每個人的房間與床頭方位。
// 只用手機上的名單計算，不送出任何資料。

import { h, s, fill } from '../ui/dom.js';
import { cardHead } from '../ui/icons.js';
import { relationLabel } from '../core/records.js';
import { loadProfile } from './profile.js';
import { playWhenVisible } from '../ui/motion.js';

const MAX = 8; // 關係圖最多放 8 個人，再多手機上看不清楚
const WX_VAR = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };
const TONE_LI = { good: 'tone-good', bad: 'tone-bad', info: 'tone-info' };
const VERDICT_CLASS = { good: 'good', mid: 'mid', care: 'care' };
const FAMILY_FIRST = ['spouse', 'parent', 'child', 'sibling', 'elder', 'relative', '', 'friend', 'colleague'];

/**
 * 關係圖：中間是選定的人，其他人圍成一圈；連線顏色代表關係（綠＝加分、金＝要磨合或平穩、紅＝容易摩擦）。
 * 線用 pathLength=1 搭配 stroke-dashoffset 畫出來，節點依序彈出（減少動態效果時直接顯示完成的圖）。
 */
function relationMap(center, others) {
  const W = 320;
  const H = 280;
  const cx = W / 2;
  const cy = H / 2;
  const R = others.length <= 3 ? 96 : 108;
  const pos = others.map((o, i) => {
    const t = (-90 + (360 / others.length) * i) * (Math.PI / 180);
    return { x: cx + R * Math.cos(t), y: cy + R * Math.sin(t) };
  });
  const edges = others.map((o, i) => s('line', {
    x1: cx, y1: cy, x2: pos[i].x, y2: pos[i].y, pathLength: 1, class: `fam-edge ${VERDICT_CLASS[o.pair.tone]}`, style: { '--i': String(i) },
  }));
  const node = (m, x, y, i, big) => s(
    'g',
    { class: `fam-node${big ? ' center' : ''}`, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, style: { '--i': String(big ? 0 : i + 1) } },
    s('g', { class: 'fam-pop' },
      s('circle', { r: big ? 30 : 24, class: `fam-dot wx-${WX_VAR[m.dm]}` }),
      s('text', { y: big ? -2 : -3, 'text-anchor': 'middle', class: 'fam-name', text: m.short }),
      s('text', { y: big ? 13 : 11, 'text-anchor': 'middle', class: 'fam-sub', text: `${m.dayGan}${m.dm}` })),
  );
  const label = `${center.short}和${others.map((o) => `${o.short}：${o.pair.label}`).join('；')}`;
  return s(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, class: 'fam-map', role: 'img', 'aria-label': `家人關係圖。${label}` },
    s('circle', { cx, cy, r: R, class: 'fam-orbit' }),
    edges,
    others.map((o, i) => node(o, pos[i].x, pos[i].y, i, false)),
    node(center, cx, cy, 0, true),
  );
}

export async function drawFamily(p, input, opts, { ctx, actions }) {
  const people = ctx.getPeople();
  const settings = ctx.getSettings();
  const [B, F, FM] = await Promise.all([import('../core/bazi.js'), import('../core/fengshui.js'), import('../core/family.js')]);
  const year = opts.today.y;

  // 中間的人排第一，其他人家人優先（配偶、父母、子女…），朋友同事放後面
  const sorted = [p, ...people.filter((x) => x.id !== p.id).sort((a, b) => FAMILY_FIRST.indexOf(a.relation || '') - FAMILY_FIRST.indexOf(b.relation || ''))];
  const skipped = [];
  const members = [];
  for (const x of sorted) {
    if (members.length >= MAX) {
      skipped.push(x.name);
      continue;
    }
    const inp = x.id === p.id ? input : ctx.inputOf(x);
    const bazi = inp ? B.buildBazi(inp, { gender: x.gender || null, sect: settings.sect, solarTime: settings.solarTime, today: opts.today }) : null;
    if (!bazi || !bazi.ok) {
      skipped.push(x.name);
      continue;
    }
    const m = FM.memberOf({ id: x.id, name: x.name, relation: x.relation || '', gender: x.gender || '', self: x.self, bazi, ys: B.yongShen(bazi), kua: F.personalDirections(inp.date, x.gender || null) });
    // 圖上與句子裡的稱呼：自己用「你」，其他人用名字（太長就截短）；有填關係的加在名字後面
    m.short = x.id === p.id && p.self ? '你' : x.name.slice(0, 4);
    m.call = x.id === p.id && p.self ? '你' : x.name;
    m.rel = x.self ? '' : relationLabel(x.relation, x.gender);
    members.push(m);
  }
  const center = members[0];
  const others = members.slice(1);
  if (!others.length) {
    return [h(
      'section',
      { class: 'card' },
      cardHead(h, 'twins', '家人關係', '要兩個人以上才看得出互相影響'),
      h('p', { text: '到「我的」新增家人（填生日，最好也填「和我的關係」），這裡就會分析你們之間誰幫誰、哪裡容易摩擦、怎麼相處更好，還有今年誰要多注意、房間怎麼分。' }),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', text: '去新增家人', onclick: () => ctx.go('me') })),
    )];
  }
  for (const o of others) o.pair = FM.pairOf(center, o, center.call, o.call);

  // 從「我」的命盤看家人：只有中間是「我」、而且有填關係時才看得出是哪一種家人
  let myZiwei = null;
  if (p.self && others.some((o) => o.relation)) {
    const prof = await loadProfile(ctx, p, input, opts, { withName: false });
    myZiwei = prof.ziwei;
  }
  // 全家的統計用稱呼（自己顯示成「你」）
  const overview = FM.familyOverview(members.map((m) => ({ ...m, name: m.call })), year);

  const summary = [];
  summary.push(`日主五行：${Object.entries(overview.byWx).filter(([, list]) => list.length).map(([wx, list]) => `${wx}（${list.join('、')}）`).join('、')}${overview.missing.length ? `；家裡沒有人屬${overview.missing.join('、')}` : ''}。`);
  for (const x of overview.helpers.slice(0, 2)) summary.push(`${x.name}是家裡的貴人：${x.name}的「${x.wx}」正好是${x.helps.join('、')}需要的五行。`);
  if (overview.topNeed) summary.push(`全家最需要的五行是「${overview.topNeed.wx}」（${overview.topNeed.count} 個人的喜用）：客廳、餐桌這些大家共用的地方，可以多放${overview.topNeed.items}；全家一起的活動：${overview.topNeed.together}。`);

  const mapCard = h(
    'section',
    { class: 'card feature' },
    cardHead(h, 'twins', '家人關係圖', `${center.call === '你' ? '你' : center.call}和 ${others.length} 位家人・${year} 年`),
    playWhenVisible(relationMap(center, others)),
    h('div', { class: 'fam-legend', 'aria-hidden': 'true' },
      h('span', { class: 'good', text: '互相加分、助力' }), h('span', { class: 'mid', text: '平穩或要磨合' }), h('span', { class: 'care', text: '容易摩擦' })),
    h('ul', { class: 'reasons' }, summary.map((t) => h('li', { class: 'tone-info', text: t }))),
    skipped.length ? h('p', { class: 'muted small', text: `沒有列入：${skipped.join('、')}（圖上最多 ${MAX} 人，或生日資料不完整）。` }) : null,
    h('p', { class: 'hint', text: '看法：日主五行誰生誰、誰剋誰（相處的主從），對方是不是你的喜用（相處順不順、累不累），生肖與日柱的合沖，還有八宅東西四命。關係是人經營出來的，命盤只是提醒你哪裡容易卡住。' }),
  );

  const pairEl = (o) => h(
    'details',
    { class: 'fam-pair' },
    h('summary', {}, h('span', { class: 'fam-who', text: `${o.call}${o.rel ? `（${o.rel}）` : ''}` }), h('span', { class: `badge fam-${VERDICT_CLASS[o.pair.tone]}`, text: o.pair.label })),
    h('h3', { text: '互相影響' }),
    h('ul', { class: 'reasons' }, o.pair.notes.map((n) => h('li', { class: TONE_LI[n.tone], text: n.text }))),
    h('h3', { text: '怎麼相處更好' }),
    h('ol', { class: 'plan' }, o.pair.tips.map((t) => h('li', { text: t }))),
    (() => {
      if (!p.self || !o.relation) return null;
      const seen = FM.seenFromMe(center, o.relation, o.gender, { myGender: p.gender, ziwei: myZiwei, year });
      if (!seen || !seen.lines.length) return null;
      return [h('h3', { text: `從你的命盤看${seen.who}` }), h('ul', { class: 'reasons' }, seen.lines.map((n) => h('li', { class: TONE_LI[n.tone], text: n.text })))];
    })(),
  );

  const cards = [
    mapCard,
    h('section', { class: 'card' }, cardHead(h, 'heart', `${center.call === '你' ? '你' : center.call}和每位家人`, '點開看互相影響、怎麼相處更好'),
      others.map(pairEl),
      p.self && others.some((o) => !o.relation) ? h('p', { class: 'hint', text: '在「我的」幫家人填上「和我的關係」，就會多一段「從你的命盤看父母、另一半、子女…」。' }) : null),
  ];

  // 其他人彼此之間（例如爸媽之間）
  const between = [];
  for (let i = 0; i < others.length; i += 1) {
    for (let j = i + 1; j < others.length; j += 1) between.push({ a: others[i], b: others[j], pair: FM.pairOf(others[i], others[j], others[i].call, others[j].call) });
  }
  if (between.length) {
    cards.push(h('section', { class: 'card' }, cardHead(h, 'twins', '其他家人之間', '例如爸媽之間、兄弟姊妹之間'),
      between.map((x) => h('details', { class: 'fam-pair' },
        h('summary', {}, h('span', { class: 'fam-who', text: `${x.a.call} ↔ ${x.b.call}` }), h('span', { class: `badge fam-${VERDICT_CLASS[x.pair.tone]}`, text: x.pair.label })),
        h('ul', { class: 'reasons' }, x.pair.notes.map((n) => h('li', { class: TONE_LI[n.tone], text: n.text }))),
        h('ol', { class: 'plan' }, x.pair.tips.map((t) => h('li', { text: t })))))));
  }

  cards.push(h('section', { class: 'card' }, cardHead(h, 'bell', `${year} 年家裡要注意`, '犯太歲、流年沖剋'),
    overview.watch.length
      ? h('ul', { class: 'reasons' }, overview.watch.map((w) => h('li', { class: 'tone-bad' }, h('b', { text: `${w.name}：` }), h('span', { text: w.items.join(' ') }))))
      : h('p', { class: 'gold', text: `今年沒有人犯太歲或流年沖剋：家運平穩，適合一起規劃大事。` })));

  if (overview.rooms.length) {
    const g = overview.groups;
    cards.push(h('section', { class: 'card' }, cardHead(h, 'compass', '房間怎麼分（八宅）', `東四命 ${g.東四命} 人・西四命 ${g.西四命} 人`),
      h('ul', { class: 'reasons' }, overview.rooms.map((r) => h('li', { class: 'tone-info' }, h('b', { text: `${r.name}（${r.kua}・${r.group}）：` }), h('span', { text: r.text })))),
      h('p', { class: 'hint', text: g.東四命 && g.西四命 ? '家裡東四命、西四命都有：大門、客廳以主要負擔家計的人為準，其他人用自己的臥室位置和床頭方向調整。' : '全家同一組（都是東四命或都是西四命），房子的方位很好安排。' }),
      overview.rooms.length < members.length ? h('p', { class: 'muted small', text: '沒有填性別的家人算不出命卦，到「我的」補上就會出現。' }) : null));
  }
  cards.push(h('section', { class: 'card' }, actions(p, 'family', '家人關係', others.map((o) => `${o.call}：${o.pair.label}`).join('；'))));
  return cards;
}
