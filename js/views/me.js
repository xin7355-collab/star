// 「我的」：輸入生日 → 本命資料，並記在這支手機上（開 App 直接看自己的運勢）。

import { h, clear } from '../ui/dom.js';
import { createBirthForm } from '../ui/birthform.js';
import { buildNatal, describePlacement, describeBirth } from '../core/natal.js';
import { SIGNS, ELEMENTS, MODALITIES, formatDegree } from '../core/zodiac.js';
import { BODY_NAME } from '../core/astro.js';

export function mountMe(root, ctx) {
  let editing = false;

  function render() {
    clear(root);
    const profile = ctx.getProfile();
    const natal = ctx.getNatal();
    if (!profile || !natal || editing) {
      root.append(renderForm(profile));
    } else {
      root.append(
        h(
          'div',
          { class: 'summary-row' },
          h('span', { text: describeBirth(natal, profile.era) }),
          h('button', { type: 'button', class: 'link', text: '編輯', onclick: () => { editing = true; render(); } }),
        ),
        renderResult(natal, profile),
      );
    }
  }

  function renderForm(profile) {
    const form = createBirthForm({ initial: profile });
    const submit = () => {
      const r = form.read();
      if (!r.ok) {
        ctx.toast(r.error);
        return;
      }
      const natal = buildNatal(r.value);
      if (!natal.ok) {
        if (natal.needFold) form.askFold(natal.options, submit);
        else ctx.toast(natal.error);
        return;
      }
      editing = false;
      ctx.setProfile(form.toRaw(), natal);
      ctx.toast('已計算並儲存在這支手機');
    };
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: profile ? '修改生日' : '輸入你的生日' }),
      h('p', { class: 'hint', text: '資料只存在這支手機，不會上傳。' }),
      form.el,
      h(
        'div',
        { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', text: '計算並記住', onclick: submit }),
        profile ? h('button', { type: 'button', class: 'btn ghost', text: '取消', onclick: () => { editing = false; render(); } }) : null,
      ),
    );
  }

  function renderResult(natal, profile) {
    const sun = SIGNS[natal.sun.sign];
    const placements = [describePlacement('太陽', natal.sun), describePlacement('月亮', natal.moon)];
    if (natal.rising !== undefined) placements.push(`上升：${SIGNS[natal.rising].name}`);

    const notes = [];
    if (natal.cusp) notes.push(natal.cusp);
    if (!natal.sun.certain) notes.push('你出生那天太陽換星座；補上出生時間就能確定是哪一座。');
    if (natal.mode === 'date-only' && !natal.moon.certain) notes.push('月亮在你出生當天換星座，補上出生時間可確定。');
    notes.push(...natal.warnings);

    const card = h(
      'section',
      { class: 'card result' },
      h(
        'div',
        { class: 'hero' },
        h('div', { class: 'glyph', 'aria-hidden': 'true', text: sun.glyph }),
        h('div', {}, h('div', { class: 'hero-title', text: natal.sun.certain ? sun.name : `${SIGNS[natal.sun.options[0]].name} / ${SIGNS[natal.sun.options[1]].name}` }), h('div', { class: 'hero-sub', text: `${ELEMENTS[sun.element].name}・${MODALITIES[sun.modality]}星座・${sun.range}` })),
      ),
      h('ul', { class: 'plain' }, placements.map((t) => h('li', { text: t }))),
      notes.length ? h('div', { class: 'notes' }, notes.map((t) => h('p', { class: 'hint', text: t }))) : null,
      natal.mode === 'timed' ? renderChart(natal) : renderRanges(natal),
      natal.mode === 'timed' && natal.aspects.length ? renderAspects(natal) : null,
      h(
        'div',
        { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', text: '看我的運勢', onclick: () => ctx.go('fortune') }),
        h('button', {
          type: 'button',
          class: 'btn',
          text: '存成圖卡',
          onclick: () => ctx.share({
            title: `我的星盤：${natal.sun.certain ? sun.name : '太陽換座日'}`,
            subtitle: describeBirth(natal, profile.era),
            big: sun.glyph,
            bigLabel: natal.sun.certain ? sun.name : '',
            lines: placements,
          }, 'my-chart.png'),
        }),
      ),
      h(
        'div',
        { class: 'privacy' },
        h('span', { text: '生日只存在這支手機。' }),
        h('button', {
          type: 'button',
          class: 'link danger',
          text: '清除我的資料',
          onclick: () => {
            if (window.confirm('確定要清除這支手機上的生日資料？')) {
              ctx.clearProfile();
              ctx.toast('已清除');
            }
          },
        }),
      ),
    );
    return card;
  }

  function renderChart(natal) {
    const rows = Object.values(natal.positions).map((p) =>
      h(
        'tr',
        {},
        h('th', { scope: 'row', text: p.name }),
        h('td', { text: `${SIGNS[p.sign].short} ${formatDegree(p.lon)}` }),
        h('td', { text: p.house ? `${p.house} 宮` : '—' }),
        h('td', { text: p.retrograde ? '逆行' : '' }),
      ),
    );
    if (natal.angles) {
      rows.push(
        h('tr', {}, h('th', { scope: 'row', text: '上升' }), h('td', { text: `${SIGNS[Math.floor(natal.angles.ASC / 30)].short} ${formatDegree(natal.angles.ASC)}` }), h('td', { text: '1 宮' }), h('td', {})),
        h('tr', {}, h('th', { scope: 'row', text: '天頂' }), h('td', { text: `${SIGNS[Math.floor(natal.angles.MC / 30)].short} ${formatDegree(natal.angles.MC)}` }), h('td', {}), h('td', {})),
      );
    }
    return h(
      'details',
      { class: 'more' },
      h('summary', { text: '完整星盤（10 顆行星）' }),
      h('div', { class: 'table-wrap' }, h('table', { class: 'chart' }, h('thead', {}, h('tr', {}, h('th', { text: '行星' }), h('th', { text: '星座' }), h('th', { text: '宮位' }), h('th', { text: '' }))), h('tbody', {}, rows))),
      h('p', { class: 'hint', text: `熱帶黃道・${natal.houses ? natal.houses.system : '未算宮位'}・時區 ${natal.tz}（${natal.offsetLabel}）` }),
    );
  }

  function renderRanges(natal) {
    const items = Object.values(natal.ranges).map((r) =>
      h('li', { text: `${r.name}：${r.signs.map((s) => SIGNS[s].name).join(' → ')}` }),
    );
    return h('details', { class: 'more' }, h('summary', { text: '出生當天各行星的可能星座' }), h('ul', { class: 'plain' }, items));
  }

  function renderAspects(natal) {
    const items = natal.aspects.slice(0, 12).map((a) =>
      h('li', { text: `${BODY_NAME[a.a]} ${a.name} ${BODY_NAME[a.b]}（容許度 ${a.orb.toFixed(1)}°）` }),
    );
    return h('details', { class: 'more' }, h('summary', { text: `主要相位（${natal.aspects.length}）` }), h('ul', { class: 'plain' }, items));
  }

  ctx.onProfile(() => {
    editing = false;
    render();
  });
  render();
}
