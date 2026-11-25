// 幾個分頁共用的畫面元件：吉時條、樂透彩球、近期提醒時間軸、各系統依據清單、擇日熱度格。

import { h, fill } from './dom.js';
import { order } from './motion.js';
import { wallFields, DEFAULT_TZ } from '../core/tz.js';

/**
 * 吉時條：13 格（早子到晚子），點一格在下方顯示那個時段的建議。
 * @param {Array} hours timing.hourGuide() 的結果
 * @param {{markNow?:boolean}} options markNow：標出現在這個時段（只有看今天時才標）
 */
export function hourTimeline(hours, { markNow = false } = {}) {
  let nowIdx = -1;
  if (markNow) {
    // 時辰表是台灣時間，「現在」也用台灣時間比對（人在國外時手機時區不同）
    const w = wallFields(Date.now(), DEFAULT_TZ);
    const nowHm = `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`;
    nowIdx = hours.findIndex((x) => nowHm >= x.start && nowHm <= `${x.end}:59`);
  }
  const detail = h('div', { class: 'hour-detail', 'aria-live': 'polite' });
  const buttons = hours.map((x, i) => h('button', {
    type: 'button',
    class: `hour ${x.clashMe ? 'clash' : x.luck === '吉' ? 'good' : 'bad'}${i === nowIdx ? ' now' : ''}`,
    'aria-label': `${x.start} 到 ${x.end}，${x.tianShen}，${x.clashMe ? '沖你的生肖' : x.luck}`,
    'aria-pressed': 'false',
    onclick: () => show(i),
  }, h('span', { text: x.start.slice(0, 2) })));
  order(buttons);
  function show(i) {
    const x = hours[i];
    buttons.forEach((b, j) => b.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
    fill(detail, 
      h('h3', {}, h('span', { text: `${x.start}–${x.end}・${x.ganzhi}時・${x.tianShen}` }), ' ', h('span', { class: `badge ${x.good ? 'good' : 'danger'}`, text: x.clashMe ? '沖你' : x.luck === '吉' ? '吉' : '凶' })),
      h('p', { text: x.advice }),
      x.yi.length ? h('p', { class: 'muted small', text: `傳統宜：${x.yi.join('、')}${x.ji.length ? `；忌：${x.ji.join('、')}` : ''}` }) : null,
    );
  }
  // 預設顯示現在的時段；看別天時顯示第一個「醒著的吉時」
  const firstGood = hours.findIndex((x) => x.good && x.start >= '07:00');
  show(nowIdx >= 0 ? nowIdx : firstGood >= 0 ? firstGood : 0);
  return h(
    'div',
    {},
    h('div', { class: 'hours', role: 'group', 'aria-label': '各時段吉凶' }, buttons),
    h('p', { class: 'small muted' }, h('span', { class: 'legend-dot', style: { background: 'var(--good)' } }), '吉', h('span', { class: 'legend-dot', style: { background: 'var(--poor)' } }), '凶', h('span', { class: 'legend-dot', style: { background: 'var(--low)' } }), '沖你的生肖'),
    detail,
  );
}

/** 樂透彩球（windfall.luckyNumbers() 的結果） */
export function ballsRow(r) {
  const balls = r.main.map((n) => h('span', { class: 'ball', text: String(n).padStart(2, '0') }));
  if (r.second) balls.push(h('span', { class: 'ball-sep', text: '＋' }), h('span', { class: 'ball alt', text: String(r.second).padStart(2, '0') }));
  order(balls.filter((b) => b.classList.contains('ball')));
  return h('div', { class: 'balls', role: 'img', 'aria-label': `${r.game.name}：${r.main.join('、')}${r.second ? `，第二區 ${r.second}` : ''}` }, balls);
}

/** 近期提醒時間軸（timing.upcoming() 的結果） */
export function timelineList(items, { withBasis = false } = {}) {
  return h('ol', { class: 'timeline' }, items.map((x) => h(
    'li',
    { class: x.level },
    h('div', { class: 'tl-title', text: x.title }),
    h('div', { text: x.text }),
    withBasis ? h('div', { class: 'tl-basis', text: `依據：${x.basis}` }) : null,
  )));
}

/** 各系統依據（{system, delta?, text}），系統名稱用色塊標出 */
export function partsList(parts) {
  return h('ul', { class: 'reasons' }, parts.map((p) => h(
    'li',
    { class: p.delta === null || p.delta === undefined ? 'tone-info' : p.delta >= 0 ? 'tone-good' : 'tone-bad' },
    h('span', { class: `sys sys-${p.system.replace('本命', '')}`, text: p.system }),
    h('span', { text: `${p.text}${p.delta ? `（${p.delta > 0 ? '+' : ''}${p.delta}）` : ''}` }),
  )));
}

/**
 * 擇日熱度格：一格一天，顏色越綠越適合；點一格看理由。
 * @param {Array} days timing.chooseDays().days
 */
export function heatGrid(days, onPick) {
  const lead = new Date(Date.UTC(days[0].date.y, days[0].date.m - 1, days[0].date.d)).getUTCDay();
  const level = (s) => (s >= 80 ? 4 : s >= 68 ? 3 : s >= 55 ? 2 : s >= 42 ? 1 : 0);
  const pads = Array.from({ length: lead }, () => h('span', { class: 'pad', 'aria-hidden': 'true' }));
  // 格子很窄：只寫日；第一天和每月 1 號才寫月份（「11/24」會被擠成兩行）
  const cells = days.map((d, i) => h('button', {
    type: 'button',
    class: `h${level(d.score)}`,
    'aria-label': `${d.label}，${d.score} 分`,
    'aria-pressed': 'false',
    onclick: (e) => {
      e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'));
      onPick(d);
    },
  }, h('span', { text: i === 0 || d.date.d === 1 ? `${d.date.m}/${d.date.d}` : String(d.date.d) }), h('small', { text: String(d.score) })));
  order(cells);
  const head = ['日', '一', '二', '三', '四', '五', '六'].map((w) => h('span', { class: 'heat-head', 'aria-hidden': 'true', text: w }));
  return h('div', { class: 'heat', role: 'group', 'aria-label': '每天適合程度' }, head, pads, cells);
}

/**
 * 兩端刻度：一條軌道，兩端是兩種特質，圓點的位置表示偏哪一邊。不顯示分數、不分好壞（掌紋這類「傾向」用）。
 * @param {[string, string]} ends 左端、右端的特質
 * @param {number} pos 0（最靠左）～ 4（最靠右）
 */
export function traitScale([left, right], pos) {
  const p = Math.max(0, Math.min(4, pos));
  const lean = p < 1.5 ? `偏「${left}」` : p > 2.5 ? `偏「${right}」` : '兩邊差不多';
  return h(
    'div',
    { class: 'trait-scale', role: 'img', 'aria-label': `介於「${left}」和「${right}」之間，${lean}` },
    h('div', { class: 'ts-track' }, h('span', { class: 'ts-dot', style: { left: `${(p / 4) * 100}%` } })),
    h('div', { class: 'ts-ends', 'aria-hidden': 'true' }, h('span', { text: left }), h('span', { text: right })),
  );
}
