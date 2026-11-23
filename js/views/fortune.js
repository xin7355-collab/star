// 「運勢」：4×3 星座方格（預設選自己的星座）＋ 今日／明日／本週／本月 切換（固定在拇指位置）。

import { h, clear, segmented, scoreBar, scoreClass } from '../ui/dom.js';
import { computeFortune, PERIODS, AREAS, periodLabel } from '../core/fortune.js';
import { SIGNS } from '../core/zodiac.js';
import { zoneToday, DEFAULT_TZ } from '../core/tz.js';
import { isoDate } from '../core/date.js';
import { aiEnabled, getAiFortune } from '../ui/ai.js';
import { load, save } from '../ui/storage.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function mountFortune(root, ctx) {
  let selected = null;
  let period = load('period', 'today');
  if (!PERIODS.some((p) => p.id === period)) period = 'today';
  const cache = new Map();
  let renderToken = 0;

  function mySigns() {
    const natal = ctx.getNatal();
    if (!natal) return [];
    return natal.sun.certain ? [natal.sun.sign] : natal.sun.options;
  }

  function defaultSign() {
    const natal = ctx.getNatal();
    if (!natal) return null;
    if (natal.sun.certain) return natal.sun.sign;
    // 換座日：取當天佔比較長的那一座
    return natal.sun.switchLocal >= '12:00' ? natal.sun.options[0] : natal.sun.options[1];
  }

  function tz() {
    return ctx.getNatal()?.tz || DEFAULT_TZ;
  }

  function getFortune(sign) {
    const today = zoneToday(tz());
    const key = `${sign}|${period}|${isoDate(today)}|${tz()}`;
    if (!cache.has(key)) cache.set(key, computeFortune(sign, period, today, tz()));
    return cache.get(key);
  }

  function render() {
    renderToken += 1;
    const token = renderToken;
    clear(root);
    if (selected === null) selected = defaultSign();
    const mine = mySigns();

    if (!ctx.getNatal()) {
      root.append(
        h(
          'div',
          { class: 'card tip' },
          h('p', { text: '先到「我的」填生日，之後打開 App 就會直接顯示你的星座。' }),
          h('button', { type: 'button', class: 'btn small', text: '去填生日', onclick: () => ctx.go('me') }),
        ),
      );
    }

    root.append(
      h(
        'div',
        { class: 'sign-grid', role: 'group', 'aria-label': '選擇星座' },
        SIGNS.map((s, i) =>
          h(
            'button',
            {
              type: 'button',
              class: `sign-btn${i === selected ? ' selected' : ''}`,
              'aria-pressed': i === selected ? 'true' : 'false',
              onclick: () => {
                selected = i;
                render();
              },
            },
            h('span', { class: 'sign-glyph', 'aria-hidden': 'true', text: s.glyph }),
            h('span', { text: s.short }),
            mine.includes(i) ? h('span', { class: 'me-badge', text: '我' }) : null,
          ),
        ),
      ),
    );

    if (selected === null) {
      root.append(h('p', { class: 'hint center', text: '點上方任一星座查看運勢' }));
      root.append(periodBar());
      return;
    }

    const f = getFortune(selected);
    const sign = SIGNS[selected];
    const scoreCard = h(
      'section',
      { class: 'card' },
      h('div', { class: 'fortune-head' }, h('h2', { text: `${sign.glyph} ${sign.name}` }), h('span', { class: 'muted', text: periodLabel(period, f.dates) })),
      h(
        'div',
        { class: 'score-hero' },
        h('div', { class: `score-ring ${scoreClass(f.scores.overall)}` }, h('b', { text: String(f.scores.overall) }), h('small', { text: '整體' })),
        h('p', { class: 'summary', text: f.summary }),
      ),
      AREAS.map((a) => scoreBar(a.label, f.scores[a.id])),
      f.notes.map((n) => h('p', { class: 'warn', text: n })),
      f.days.length > 1 ? renderDays(f) : null,
      h(
        'details',
        { class: 'more' },
        h('summary', { text: '為什麼是這個分數？' }),
        h(
          'ul',
          { class: 'reasons' },
          f.highlights.map((x) => h('li', { class: `tone-${x.tone}`, text: x.text })),
        ),
        h('p', { class: 'hint', text: '依期間內每天正午的行星位置，與這個太陽星座的相對角度（相位）推算：三分相、六分相加分；四分相、對分相扣分。僅供娛樂參考。' }),
      ),
      h(
        'div',
        { class: 'actions' },
        h('button', {
          type: 'button',
          class: 'btn',
          text: '存成圖卡',
          onclick: () => ctx.share({
            title: `${sign.name}・${periodLabel(period, f.dates)}`,
            subtitle: '依實際行星位置推算',
            big: String(f.scores.overall),
            bigScore: f.scores.overall,
            bigLabel: '整體運勢',
            bars: AREAS.map((a) => ({ label: a.label, value: f.scores[a.id] })),
            lines: [f.summary],
          }, `fortune-${sign.id}.png`),
        }),
      ),
    );
    root.append(scoreCard);

    if (aiEnabled()) root.append(renderAi(sign, token));
    root.append(periodBar());
  }

  function renderDays(f) {
    return h(
      'details',
      { class: 'more', open: f.days.length <= 7 },
      h('summary', { text: '每日走勢' }),
      h(
        'ol',
        { class: 'days' },
        f.days.map((d) => {
          const wd = WEEKDAYS[new Date(Date.UTC(d.date.y, d.date.m - 1, d.date.d)).getUTCDay()];
          const s = d.scores.overall;
          return h(
            'li',
            { class: scoreClass(s) },
            h('span', { class: 'day-label', text: `${d.date.m}/${d.date.d}（${wd}）` }),
            h('span', { class: 'day-track' }, h('span', { class: 'day-fill', style: { width: `${s}%` } })),
            h('b', { text: String(s) }),
          );
        }),
      ),
    );
  }

  function renderAi(sign, token) {
    const body = h('p', { class: 'muted', text: '載入 AI 短評中…' });
    const card = h('section', { class: 'card' }, h('h3', { text: 'AI 短評' }), body, h('p', { class: 'hint', text: '由 AI 產生的生活建議，與上方分數分開計算，僅供參考。' }));
    getAiFortune(period)
      .then((data) => {
        if (token !== renderToken) return;
        const text = data?.signs?.[sign.id];
        body.className = '';
        body.textContent = typeof text === 'string' && text ? text : '這個期間的短評尚未產生。';
      })
      .catch((err) => {
        if (token !== renderToken) return;
        body.className = 'warn';
        body.textContent = err.message;
        card.append(h('button', { type: 'button', class: 'btn small', text: '再試一次', onclick: () => render() }));
      });
    return card;
  }

  function periodBar() {
    return h(
      'div',
      { class: 'period-bar' },
      segmented({
        name: 'period',
        label: '期間',
        value: period,
        options: PERIODS.map((p) => ({ value: p.id, label: p.label })),
        onChange: (next) => {
          period = next;
          save('period', period);
          render();
        },
      }),
    );
  }

  ctx.onProfile(() => {
    selected = null;
    cache.clear();
    render();
  });
  render();
  return { refresh: render };
}
