// 「配對」：快速（只選星座）／精準（從名單選人或另外輸入生日，可算月亮、金星、火星）；
// 最多 5 人，多人取兩兩平均。每次配對結果自動存進「我的」查詢紀錄（只在手機）。

import { h, clear, segmented, scoreClass } from '../ui/dom.js';
import { createBirthForm } from '../ui/birthform.js';
import { buildNatal, signOptions } from '../core/natal.js';
import { scorePair, scoreGroup, MAX_PEOPLE } from '../core/synastry.js';
import { SIGNS } from '../core/zodiac.js';
import { load, save } from '../ui/storage.js';

const ROWS = [
  ['Sun', '太陽'],
  ['Moon', '月亮'],
  ['Venus', '金星'],
  ['Mars', '火星'],
];

export function mountMatch(root, ctx) {
  let mode = load('matchMode', 'quick') === 'precise' ? 'precise' : 'quick';
  let quickPeople = [];
  let slots = []; // 精準模式：{ personId|'manual', form? }
  const resultBox = h('div', { class: 'match-result' });

  function initPeople() {
    const natal = ctx.getNatal();
    const active = ctx.getActive();
    const mySign = natal ? (natal.sun.certain ? natal.sun.sign : natal.sun.options[0]) : 0;
    quickPeople = [
      { name: active ? active.name : 'A', sunSign: mySign },
      { name: 'B', sunSign: (mySign + 4) % 12 },
    ];
    const people = ctx.getPeople();
    slots = [
      { personId: active ? active.id : 'manual', form: null },
      { personId: people.find((p) => p.id !== active?.id)?.id || 'manual', form: null },
    ];
  }

  function render() {
    clear(root);
    root.append(
      segmented({
        name: 'match-mode',
        label: '配對方式',
        value: mode,
        options: [{ value: 'quick', label: '快速（星座）' }, { value: 'precise', label: '精準（生日）' }],
        onChange: (next) => {
          mode = next;
          save('matchMode', mode);
          clear(resultBox);
          render();
        },
      }),
      mode === 'quick' ? renderQuick() : renderPrecise(),
      resultBox,
    );
  }

  function personHeader(i, list) {
    return h(
      'div',
      { class: 'person-head' },
      h('b', { text: `第 ${i + 1} 位` }),
      list.length > 2 ? h('button', { type: 'button', class: 'link danger', text: '移除', onclick: () => { list.splice(i, 1); render(); } }) : null,
    );
  }

  function renderQuick() {
    const cards = quickPeople.map((p, i) => {
      const nameInput = h('input', { type: 'text', maxlength: 20, value: p.name, 'aria-label': `第 ${i + 1} 位名字`, oninput: (e) => { p.name = e.target.value; } });
      const select = h('select', { 'aria-label': `第 ${i + 1} 位星座`, onchange: (e) => { p.sunSign = parseInt(e.target.value, 10); } }, SIGNS.map((s, idx) => h('option', { value: String(idx), text: `${s.glyph} ${s.name}（${s.range}）` })));
      select.value = String(p.sunSign);
      return h('div', { class: 'card person' }, personHeader(i, quickPeople), h('div', { class: 'row2' }, nameInput, select));
    });
    return h(
      'div',
      {},
      cards,
      h(
        'div',
        { class: 'actions' },
        quickPeople.length < MAX_PEOPLE ? h('button', { type: 'button', class: 'btn ghost', text: '＋ 加一個人', onclick: () => { quickPeople.push({ name: String.fromCharCode(65 + quickPeople.length), sunSign: 0 }); render(); } }) : null,
        h('button', { type: 'button', class: 'btn primary', text: '開始配對', onclick: () => run(quickPeople.map((p, i) => ({ name: p.name.trim() || `第 ${i + 1} 位`, sunSign: p.sunSign }))) }),
      ),
    );
  }

  function renderPrecise() {
    const people = ctx.getPeople();
    const cards = slots.map((slot, i) => {
      const sel = h(
        'select',
        {
          'aria-label': `第 ${i + 1} 位`,
          onchange: (e) => {
            slot.personId = e.target.value;
            slot.form = null;
            render();
          },
        },
        people.map((p) => h('option', { value: p.id, text: p.self ? `${p.name}（我）` : p.name })),
        h('option', { value: 'manual', text: '另外輸入生日…' }),
      );
      sel.value = people.some((p) => p.id === slot.personId) ? slot.personId : 'manual';
      slot.personId = sel.value;
      if (slot.personId === 'manual' && !slot.form) slot.form = createBirthForm({ withName: true, name: String.fromCharCode(65 + i) });
      return h('div', { class: 'card person' }, personHeader(i, slots), sel, slot.personId === 'manual' ? slot.form.el : null);
    });
    return h(
      'div',
      {},
      h('p', { class: 'hint', text: '從「我的」名單選人最快；有出生時間會更準（月亮位置）。' }),
      cards,
      h(
        'div',
        { class: 'actions' },
        slots.length < MAX_PEOPLE ? h('button', { type: 'button', class: 'btn ghost', text: '＋ 加一個人', onclick: () => { slots.push({ personId: 'manual', form: null }); render(); } }) : null,
        h('button', { type: 'button', class: 'btn primary', text: '開始配對', onclick: runPrecise }),
      ),
    );
  }

  async function runPrecise() {
    const result = [];
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      if (slot.personId !== 'manual') {
        const p = ctx.getPeople().find((x) => x.id === slot.personId);
        const natal = p ? ctx.natalOf(p) : null;
        if (!natal) return ctx.toast(`第 ${i + 1} 位的生日資料不完整，請到「我的」編輯`);
        result.push({ name: p.name, natal });
        continue;
      }
      const r = await slot.form.read();
      if (!r.ok) return ctx.toast(`第 ${i + 1} 位：${r.error}`);
      const natal = buildNatal(r.value);
      if (!natal.ok) {
        if (natal.needFold) slot.form.askFold(natal.options, runPrecise);
        else ctx.toast(`第 ${i + 1} 位：${natal.error}`);
        return;
      }
      result.push({ name: r.value.name || `第 ${i + 1} 位`, natal });
    }
    run(result);
  }

  function signText(person, key) {
    const opts = person.natal ? signOptions(person.natal, key) : key === 'Sun' ? [person.sunSign] : null;
    if (!opts) return '—';
    return opts.map((s) => SIGNS[s].short).join(' 或 ');
  }

  function run(people) {
    clear(resultBox);
    if (people.length === 2) {
      const r = scorePair(people[0], people[1]);
      const rows = (people[0].natal ? ROWS : ROWS.slice(0, 1)).map(([key, label]) =>
        h('tr', {}, h('th', { scope: 'row', text: label }), h('td', { text: signText(people[0], key) }), h('td', { text: signText(people[1], key) })),
      );
      resultBox.append(
        h(
          'section',
          { class: 'card' },
          h('h2', { text: `${people[0].name} × ${people[1].name}` }),
          h('div', { class: 'score-hero' }, h('div', { class: `score-ring ${scoreClass(r.total)}` }, h('b', { text: String(r.total) }), h('small', { text: r.label })), h('p', { class: 'summary', text: r.story ? `${r.story.summary}${r.story.flavor}` : '' })),
          h('div', { class: 'table-wrap' }, h('table', { class: 'compare' }, h('thead', {}, h('tr', {}, h('th', { text: '' }), h('th', { text: people[0].name }), h('th', { text: people[1].name }))), h('tbody', {}, rows))),
          r.bands.filter((b) => b.available).map((b) => bandBar(b)),
          h('p', { class: 'hint', text: `計分依據：${r.basis}。` }),
          r.story ? h('div', { class: 'tips' }, h('h3', { text: '相處建議' }), h('ul', { class: 'plain' }, r.story.tips.map((t) => h('li', { text: t })))) : null,
          shareButton(`${people[0].name} × ${people[1].name}`, r.total, r.label, [r.story ? r.story.summary : '', ...(r.story ? r.story.tips : [])]),
        ),
      );
      ctx.addHistory({ type: 'match', personId: null, title: `${people[0].name} × ${people[1].name}`, summary: `${r.total} 分・${r.label}${r.story ? `。${r.story.summary}` : ''}` });
    } else {
      const g = scoreGroup(people);
      const pairs = [...g.pairs].sort((a, b) => b.total - a.total);
      resultBox.append(
        h(
          'section',
          { class: 'card' },
          h('h2', { text: `${people.length} 人合盤` }),
          h('div', { class: 'score-hero' }, h('div', { class: `score-ring ${scoreClass(g.total)}` }, h('b', { text: String(g.total) }), h('small', { text: g.label })), h('p', { class: 'summary', text: '多人分數是所有兩兩組合的平均，人數不同也能比較。' })),
          h('ol', { class: 'pairs' }, pairs.map((p) => h('li', { class: scoreClass(p.total) }, h('span', { text: `${p.a} × ${p.b}` }), h('b', { text: `${p.total}・${p.label}` })))),
          shareButton(`${people.length} 人合盤`, g.total, g.label, pairs.slice(0, 4).map((p) => `${p.a} × ${p.b}：${p.total}`)),
        ),
      );
      ctx.addHistory({ type: 'match', personId: null, title: `${people.length} 人合盤`, summary: `${g.total} 分・${g.label}；${pairs.map((p) => `${p.a}×${p.b} ${p.total}`).join('、')}` });
    }
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bandBar(b) {
    const pct = Math.round((b.score / b.max) * 100);
    return h(
      'div',
      { class: `bar ${scoreClass(pct)}` },
      h('div', { class: 'bar-head' }, h('span', { text: b.label }), h('b', { text: `${b.score}/${b.max}` })),
      h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: `${Math.max(3, pct)}%` } })),
    );
  }

  function shareButton(title, score, label, lines) {
    return h('div', { class: 'actions' }, h('button', {
      type: 'button',
      class: 'btn',
      text: '存成圖卡',
      onclick: () => ctx.share({ title, subtitle: '星座配對', big: String(score), bigScore: score, bigLabel: label, lines: lines.filter(Boolean) }, 'match.png'),
    }));
  }

  ctx.onProfile(() => {
    initPeople();
    clear(resultBox);
    render();
  });
  initPeople();
  render();
}
