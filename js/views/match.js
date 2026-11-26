// 「配對」：快速（只選星座）／精準（從名單選人或另外輸入生日，看兩張星盤的實際度數相位）；
// 最多 5 人，多人取兩兩平均。每次配對結果自動存進「我的」查詢紀錄（只在手機）。
// 兩個人時，下面再加「老師怎麼看」：依兩人的關係（還在認識／交往中／已婚）給斷語、化解、下一步、紅燈與專線；
// 精準模式兩人都有生日時，併入八字合婚（日主生剋、喜用互補、生肖與日柱合沖、通關）和兩個人都順的日子。

import { h, clear, segmented, scoreClass, fill } from '../ui/dom.js';
import { createBirthForm } from '../ui/birthform.js';
import { buildNatal, signOptions } from '../core/natal.js';
import { scorePair, scoreGroup, MAX_PEOPLE } from '../core/synastry.js';
import { SIGNS, mainSunSign } from '../core/zodiac.js';
import { bloodMatch } from '../core/blood.js';
import { load, save } from '../ui/storage.js';
import { masterCard } from '../ui/master.js';
import { coupleReading, sharedDays, STATUSES, RED_FLAGS } from '../core/couple.js';
import { zoneToday, DEFAULT_TZ } from '../core/tz.js';

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
  let status = load('matchStatus', 'couple');
  if (!STATUSES.some((x) => x.value === status)) status = 'couple';
  let masterToken = 0;

  function initPeople() {
    const natal = ctx.getNatal();
    const active = ctx.getActive();
    const mySign = mainSunSign(natal) ?? 0;
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
      return h('div', { class: 'card person' }, personHeader(i, quickPeople), h('div', { class: 'row2 name-sign' }, nameInput, select));
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
      // 性別選填：八字合婚的配偶星、同住的命卦要用；不填也能算
      if (slot.personId === 'manual' && !slot.form) slot.form = createBirthForm({ withName: true, withGender: true, name: String.fromCharCode(65 + i) });
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
        h('button', {
          type: 'button',
          class: 'btn primary',
          text: '開始配對',
          onclick: async (e) => {
            const btn = e.currentTarget;
            if (btn.disabled) return;
            btn.disabled = true;
            btn.textContent = '計算中…';
            try {
              await runPrecise();
            } finally {
              btn.disabled = false;
              btn.textContent = '開始配對';
            }
          },
        }),
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
        result.push({ name: p.name, natal, bloodType: p.bloodType || '', input: ctx.inputOf(p), gender: p.gender || '' });
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
      result.push({ name: r.value.name || `第 ${i + 1} 位`, natal, input: r.value, gender: r.value.gender || '' });
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
      // 兩人都在名單裡填了血型才加這一行；不計分（流行文化說法）
      const bm = bloodMatch(people[0].bloodType, people[1].bloodType);
      const rows = (people[0].natal ? ROWS : ROWS.slice(0, 1)).map(([key, label]) =>
        h('tr', {}, h('th', { scope: 'row', text: label }), h('td', { text: signText(people[0], key) }), h('td', { text: signText(people[1], key) })),
      );
      const aspects = r.mode === 'aspects' ? r.aspects : [];
      // 相處建議改由下面的「老師怎麼看」給（依弱項逐項化解），這裡不再重複列
      const masterBox = h('div', { class: 'master-box' });
      resultBox.append(
        h(
          'section',
          { class: 'card' },
          h('h2', { text: `${people[0].name} × ${people[1].name}` }),
          h('div', { class: 'score-hero' }, h('div', { class: `score-ring ${scoreClass(r.total)}` }, h('b', { text: String(r.total) }), h('small', { text: r.label })), h('p', { class: 'summary', text: aspects.length ? `最關鍵的連結：${aspects[0].text}` : r.story ? `${r.story.summary}${r.story.flavor}` : '' })),
          h('div', { class: 'table-wrap' }, h('table', { class: 'compare' }, h('thead', {}, h('tr', {}, h('th', { text: '' }), h('th', { text: people[0].name }), h('th', { text: people[1].name }))), h('tbody', {}, rows))),
          r.bands.filter((b) => b.available).map((b) => bandBar(b)),
          aspects.length ? [
            h('h3', { text: '兩張星盤的主要相位' }),
            h('ul', { class: 'reasons' }, aspects.slice(0, 5).map(aspectLi)),
            aspects.length > 5 ? h('details', { class: 'more' }, h('summary', { text: `其他 ${aspects.length - 5} 個相位` }), h('ul', { class: 'reasons' }, aspects.slice(5).map(aspectLi))) : null,
          ] : null,
          h('p', { class: 'hint', text: `計分依據：${r.basis}。` }),
          r.story && aspects.length ? h('p', { class: 'muted small', text: `太陽星座：${r.story.summary}${r.story.flavor}` }) : null,
          bm ? h('div', { class: 'point' }, h('span', { class: 'sys sys-血型', text: '血型' }), h('span', { text: `${bm.pair}：${bm.text}（流行文化說法，不計分）` })) : null,
          shareButton(`${people[0].name} × ${people[1].name}`, r.total, r.label, aspects.length ? aspects.slice(0, 3).map((x) => `${x.title}（差 ${x.dev}°）`) : [r.story ? r.story.summary : '', ...(r.story ? r.story.tips : [])]),
        ),
        masterBox,
      );
      paintMaster(masterBox, people, r);
      ctx.addHistory({ type: 'match', personId: null, title: `${people[0].name} × ${people[1].name}`, summary: `${r.total} 分・${r.label}${aspects.length ? `。${aspects[0].title}` : r.story ? `。${r.story.summary}` : ''}` });
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

  /**
   * 「老師怎麼看」：先畫只用星盤的版本，八字合婚和兩人都順的日子算好再重畫（手機上約一兩百毫秒）。
   * 關係狀態只影響文字，切換時不重算。
   */
  async function paintMaster(box, people, r) {
    const my = (masterToken += 1);
    const names = [people[0].name, people[1].name];
    let bazi = null;
    let watch = [];
    let days = null;
    let baziNote = null;
    const draw = () => {
      if (my !== masterToken) return;
      const m = coupleReading({ astro: r, bazi, status, names, watch });
      const statusSeg = segmented({
        name: 'match-status',
        label: '你們現在的關係',
        value: status,
        options: STATUSES,
        onChange: (next) => {
          status = next;
          save('matchStatus', status);
          draw();
        },
      });
      const extra = [
        h('h3', { text: m.path.title }),
        h('p', { text: m.path.lead }),
        h('ul', { class: 'reasons' }, m.path.checklist.map((t) => h('li', { class: 'tone-info', text: t }))),
        h('p', { class: 'gold', text: m.path.rule }),
        m.path.help ? h('p', { class: 'small', text: m.path.help }) : null,
        m.thisYear.length ? [h('h3', { text: '今年要多體諒對方的地方' }), h('ul', { class: 'reasons' }, m.thisYear.map((t) => h('li', { class: 'tone-info', text: t })))] : null,
        days ? [
          h('h3', { text: '兩個人都順的日子（約會、告白、重要的談話）' }),
          days.length
            ? h('ul', { class: 'reasons' }, days.map((d) => h('li', { class: 'tone-good' }, h('b', { text: d.label }), h('span', { text: `　${d.reasons.map((x) => x.text).join('；') || '兩人都順'}` }))))
            : h('p', { class: 'muted small', text: '接下來 45 天沒有兩個人都順的日子：重要的事挑其中一人順的日子，另一人多包容。' }),
          h('p', { class: 'muted small', text: '看兩人各自的流日沖合、農民曆宜忌；只有一個人填生日的話，到「時運」→擇日看自己的。' }),
        ] : null,
        h('details', { class: 'more red-flags' },
          h('summary', { text: RED_FLAGS.title }),
          h('ul', { class: 'reasons' }, RED_FLAGS.items.map((t) => h('li', { class: 'tone-bad', text: t }))),
          h('p', { text: RED_FLAGS.note }),
          h('p', { class: 'small', text: RED_FLAGS.help })),
      ];
      fill(box, masterCard({
        sub: bazi ? '星盤合盤＋八字合婚一起看' : people.every((p) => p.input) ? '星盤合盤' : '只看太陽星座；用「精準」選有生日的人，會加上八字合婚',
        badge: { text: m.levelLabel, cls: m.level === 'great' || m.level === 'good' ? 'good' : m.level === 'hard' ? 'danger' : 'alt' },
        verdict: m.verdict,
        why: m.why,
        remedies: m.remedies,
        boosts: m.boosts,
        lead: [h('div', { class: 'field' }, h('span', { class: 'field-label', text: '你們現在的關係（建議會跟著換）' }), statusSeg), baziNote ? h('p', { class: 'muted small', text: baziNote }) : null],
        extra,
        combos: m.combos,
        onGo: (view, opts) => ctx.go(view, opts),
      }));
    };
    draw();
    if (!people.every((p) => p.input)) return;
    try {
      const [B, F, FM, T] = await Promise.all([import('../core/bazi.js'), import('../core/fengshui.js'), import('../core/family.js'), import('../core/timing.js')]);
      const settings = ctx.getSettings();
      const tz = people[0].natal?.tz || DEFAULT_TZ;
      const today = zoneToday(tz);
      const ms = people.map((p, i) => {
        const bz = B.buildBazi(p.input, { gender: p.gender || null, sect: settings.sect, solarTime: settings.solarTime, today });
        if (!bz.ok) return null;
        return FM.memberOf({ id: String(i), name: p.name, gender: p.gender || '', bazi: bz, ys: B.yongShen(bz), kua: p.gender ? F.personalDirections(p.input.date, p.gender) : null });
      });
      if (!ms.every(Boolean)) throw new Error('生日資料不完整');
      bazi = { pair: FM.pairOf(ms[0], ms[1], names[0], names[1]), a: ms[0], b: ms[1] };
      watch = FM.familyOverview(ms, today.y).watch;
      const pick = (m) => T.chooseDays('love', { from: today, days: 45, bazi: m.bazi, gender: m.gender || null, tz }).days;
      days = sharedDays(pick(ms[0]), pick(ms[1]), 3, names);
    } catch {
      // 八字算不出來（資料不完整、日期超出曆法範圍）：只用星盤，不讓整個配對失敗，但要說出來（不默默少一塊）
      bazi = null;
      days = null;
      baziNote = '八字合婚這次沒算出來，先只看星盤；到「我的」確認兩個人的生日資料是否完整。';
    }
    draw();
  }

  // 一個相位：哪兩顆星、差幾度（越小越強）、白話；沒有出生時間而不確定的標「可能」
  function aspectLi(x) {
    return h('li', { class: x.tone === 'good' ? 'tone-good' : x.tone === 'hard' ? 'tone-bad' : 'tone-info' },
      h('b', { text: x.title }),
      h('span', { class: 'muted small', text: `（差 ${x.dev}°${x.certain ? '' : '・可能'}）` }),
      h('div', { text: x.text }));
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
      // multi：匿名時每個人換成 A、B…（只換成「某人」會看不出相位是誰的行星）
      onclick: () => ctx.share({ title, subtitle: '星座配對', big: String(score), bigScore: score, bigLabel: label, lines: lines.filter(Boolean), multi: true }, 'match.png'),
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
