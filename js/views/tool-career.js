// 命盤 → 工作與方向：適合的工作性質（多系統投票）、比較順的行業、新興產業（AI 等）適不適合、職場優勢與地雷、未來三年、十年方向。

import { h } from '../ui/dom.js';
import { cardHead } from '../ui/icons.js';
import { partsList } from '../ui/widgets.js';
import { loadProfile } from './profile.js';
import { EMERGING_NOTE } from '../core/emerging.js';

const TONE = { good: { cls: 'lv-high', text: '順' }, mid: { cls: 'lv-mid', text: '平' }, hard: { cls: 'lv-poor', text: '要多用心' } };
const FIT = { 很適合: 'lv-high', 可以試試: 'lv-mid', 要多花力氣: 'lv-low' };
const chips = (list) => h('div', { class: 'chips' }, list.map((t) => h('span', { class: 'chip', text: t })));

export async function drawCareer(p, input, opts, { ctx, actions, mayaTime }) {
  const [prof, { buildCareer }] = await Promise.all([loadProfile(ctx, p, input, opts, { mayaTime, withName: false }), import('../core/career.js')]);
  const r = buildCareer({ natal: prof.natal, bazi: prof.bazi, ziwei: prof.ziwei, birth: input.date, bloodType: p.bloodType || '', today: opts.today, lifePathNumber: prof.lifePathNumber });
  const f = r.future;

  const natureCards = h('div', { class: 'traits' }, r.natures.map((n) => h(
    'div',
    { class: 'trait' },
    h('div', { class: 'trait-head' }, h('b', { text: n.label }), h('span', { class: 'count', text: `${n.count} 個系統` })),
    h('p', { text: n.desc }),
    chips(n.jobs),
    h('div', { class: 'muted small', text: n.sources.join('・') }),
  )));
  const edges = h('ul', { class: 'reasons' }, r.natures.flatMap((n) => [h('li', { class: 'tone-good', text: `優勢：${n.edge}` }), h('li', { class: 'tone-bad', text: `小心：${n.trap}` })]));

  const yearCards = f.years.map((y) => h(
    'div',
    { class: 'year-card' },
    h('div', { class: 'trait-head' }, h('b', { text: `${y.year}・${y.headline}` }), h('span', { class: `badge ${TONE[y.tone].cls}`, text: TONE[y.tone].text })),
    h('ul', { class: 'reasons' }, y.doList.map((t) => h('li', { class: 'tone-good', text: t })), y.watchList.map((t) => h('li', { class: 'tone-bad', text: t }))),
    h('details', { class: 'more' }, h('summary', { text: '依據' }), partsList(y.points)),
  ));

  // 新興產業：AI 時代的建議放最前面，產業依適配度排序（第一個先打開）
  const ai = r.emerging.find((e) => e.id === 'ai');
  const emergingCard = h('section', { class: 'card' },
    cardHead(h, 'sparkle', '新興產業適不適合你', 'AI、半導體、資安、綠能、長照、內容創作…'),
    r.aiAdvice ? h('div', { class: 'ai-box' },
      h('h3', { text: 'AI 時代，你可以這樣做' }),
      h('p', { text: r.aiAdvice.text }),
      h('p', { class: 'muted small', text: `依你最強的工作性質「${r.aiAdvice.nature}」。AI 產業本身對你：${ai.level}（${ai.role}）。` })) : null,
    h('div', { class: 'em-list' }, r.emerging.map((e, i) => h('details', { class: 'em', open: i === 0 },
      h('summary', {}, h('b', { text: e.name }), h('span', { class: `em-level ${FIT[e.level]}`, text: e.level })),
      h('p', { class: 'muted small', text: e.desc }),
      h('ul', { class: 'reasons' }, e.why.map((w) => h('li', { class: e.level === '要多花力氣' ? 'tone-info' : 'tone-good', text: w }))),
      h('p', {}, h('b', { text: '你可以做的角色：' }), h('span', { text: e.role })),
      h('p', {}, h('b', { text: '怎麼開始：' }), h('span', { text: e.entry }))))),
    h('p', { class: 'hint', text: EMERGING_NOTE }));

  const decadeLines = [];
  if (f.dayun && f.dayun.current) {
    const c = f.dayun.current;
    decadeLines.push(h('li', { class: c.good ? 'tone-good' : 'tone-info' }, h('span', { class: 'sys sys-八字', text: '八字' }), h('span', { text: `現在（${c.startYear}–${c.endYear}）走「${c.shishen}」大運 ${c.ganzhi}：重點是${c.focus}。適合${c.do}；${c.watch}。${c.good ? '天干是你的喜用，這十年整體順。' : ''}` })));
  }
  if (f.dayun && f.dayun.next) {
    const n = f.dayun.next;
    decadeLines.push(h('li', { class: n.good ? 'tone-good' : 'tone-info' }, h('span', { class: 'sys sys-八字', text: '八字' }), h('span', { text: `${n.startYear} 年起換「${n.shishen}」大運 ${n.ganzhi}：重點轉為${n.focus}，可以提早準備：${n.do}。` })));
  }
  if (f.decade && f.decade.current) {
    decadeLines.push(h('li', { class: 'tone-info' }, h('span', { class: 'sys sys-紫微', text: '紫微' }), h('span', { text: `現在大限（${f.decade.current.ages}）走到「${f.decade.current.palace}」：${f.decade.current.focus}` })));
  }
  if (f.decade && f.decade.next) {
    decadeLines.push(h('li', { class: 'tone-info' }, h('span', { class: 'sys sys-紫微', text: '紫微' }), h('span', { text: `下一個大限（${f.decade.next.ages}）走到「${f.decade.next.palace}」：${f.decade.next.focus}` })));
  }

  const summary = `${r.natures.map((n) => n.label).join('、')}；${f.years.map((y) => `${y.year} ${y.headline}`).join('、')}`;
  return [
    h(
      'section',
      { class: 'card feature' },
      cardHead(h, 'compass', `${p.name}適合的工作`, '八字・紫微・星座・生命靈數・血型一起投票'),
      h('h3', { text: r.consensus ? '最適合的工作性質' : '各系統看法比較分散，票數最多的是' }),
      natureCards,
      h('h3', { text: '職場上的優勢與地雷' }),
      edges,
      r.industries ? h('h3', { text: '比較順的行業' }) : null,
      r.industries ? chips(r.industries.list) : null,
      r.industries ? h('p', { class: 'hint', text: r.industries.reason }) : null,
      h('details', { class: 'more' }, h('summary', { text: `各系統怎麼說（${r.points.length}）` }), partsList(r.points)),
      prof.missing.length ? h('p', { class: 'warn', text: `補上這些資料會更準：${prof.missing.join('、')}。` }) : null,
    ),
    emergingCard,
    h('section', { class: 'card' }, cardHead(h, 'calendar', '未來三年的方向', '每年的重點、適合做的、要小心的'), yearCards),
    h(
      'section',
      { class: 'card' },
      cardHead(h, 'star', '十年的大方向', '八字大運・紫微大限'),
      decadeLines.length ? h('ul', { class: 'reasons' }, decadeLines) : h('p', { class: 'muted', text: '大運需要性別，紫微大限需要出生時間和性別；到「我的」補上就會出現。' }),
      h('p', { class: 'hint', text: '命理是參考，不是保證；真正決定方向的，是你願意花時間累積的能力。' }),
      actions(p, 'career', '工作與方向', summary),
    ),
  ];
}
