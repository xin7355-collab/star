// 命盤 → 工作與方向：目前的工作和想做的工作（選單）、換跑道建議、適合的工作性質（多系統投票）、比較順的行業、
// 新興產業（AI 等）適不適合、職場優勢與地雷、未來三年、十年方向。

import { h, fill } from '../ui/dom.js';
import { cardHead } from '../ui/icons.js';
import { partsList } from '../ui/widgets.js';
import { masterCard } from '../ui/master.js';
import { loadProfile } from './profile.js';
import { EMERGING_NOTE } from '../core/emerging.js';
import { JOB_GROUPS, TENURES, MAX_TARGETS, sanitizeCareer, careerPlan, careerMaster, DISTANCE } from '../core/jobs.js';

const TONE = { good: { cls: 'lv-high', text: '順' }, mid: { cls: 'lv-mid', text: '平' }, hard: { cls: 'lv-poor', text: '要多用心' } };
const FIT = { 很適合: 'lv-high', 可以試試: 'lv-mid', 要多花力氣: 'lv-low' };
const chips = (list) => h('div', { class: 'chips' }, list.map((t) => h('span', { class: 'chip', text: t })));

export async function drawCareer(p, input, opts, { ctx, actions, mayaTime }) {
  const [prof, { buildCareer }, { buildLifeline }, { yongShen }] = await Promise.all([
    loadProfile(ctx, p, input, opts, { mayaTime, withName: false }), import('../core/career.js'), import('../core/lifeline.js'), import('../core/bazi.js')]);
  const r = buildCareer({ natal: prof.natal, bazi: prof.bazi, ziwei: prof.ziwei, birth: input.date, bloodType: p.bloodType || '', today: opts.today, lifePathNumber: prof.lifePathNumber });
  const f = r.future;
  const ys = prof.bazi && prof.bazi.ok ? yongShen(prof.bazi) : null;
  // 換跑道的時機看人生時間軸的 10 年（和「人生時間軸」同一套）
  const L = prof.bazi && prof.bazi.ok ? buildLifeline({ bazi: prof.bazi, natal: prof.natal, birth: input.date, today: opts.today, gender: p.gender }) : null;
  const age = opts.today.y - input.date.y - (opts.today.m < input.date.m || (opts.today.m === input.date.m && opts.today.d < input.date.d) ? 1 : 0);
  const planCard = jobPlanCard({ p, ctx, r, ys, years: L ? L.years : [], age });

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
    planCard.card,
    planCard.master,
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

const FIT_CLASS = { 很適合: 'lv-high', 可以: 'lv-mid', 要多花力氣: 'lv-low' };

/**
 * 「你的工作與換跑道」：目前的工作、年資、想做的工作（最多 3 個，都是下拉選單）。
 * 選了就馬上重算下面的分析（不用先存）；按「存到○○的資料」才存進名單（和掌紋一樣：名單整筆存檔會讓整頁重畫）。
 * 老師怎麼看的卡片跟著一起更新。
 */
function jobPlanCard({ p, ctx, r, ys, years, age }) {
  const saved = sanitizeCareer(p.career) || { current: '', tenure: '', targets: [] };
  const plan = { current: saved.current, tenure: saved.tenure, targets: [...saved.targets] };
  const who = p.self ? '你' : p.name;
  const body = h('div', { class: 'job-analysis', 'aria-live': 'polite' });
  const master = h('div', { class: 'job-master' });
  const saveBtn = h('button', { type: 'button', class: 'btn primary', text: `存到${p.name}的資料` });
  const savedHint = h('p', { class: 'muted small', role: 'status' });

  const jobSelect = (label, value, { withStatus, onChange }) => {
    const sel = h('select', { 'aria-label': label, onchange: (e) => onChange(e.target.value) },
      h('option', { value: '', text: withStatus ? '（還沒選）' : '（不選）' }),
      JOB_GROUPS.filter((g) => withStatus || g.id !== 'status').map((g) => h('optgroup', { label: g.name }, g.jobs.map((x) => h('option', { value: x.id, text: x.name })))));
    sel.value = value || '';
    return sel;
  };
  const tenureSel = h('select', { 'aria-label': '做了多久', onchange: (e) => { plan.tenure = e.target.value; update(); } }, TENURES.map((t) => h('option', { value: t.value, text: t.label })));
  tenureSel.value = plan.tenure;
  const curSel = jobSelect('目前的工作', plan.current, { withStatus: true, onChange: (v) => { plan.current = v; plan.targets = plan.targets.filter((t) => t && t !== v); update(true); } });
  const targetBox = h('div', { class: 'job-targets' });
  const paintTargets = () => fill(targetBox, Array.from({ length: MAX_TARGETS }, (_, i) => jobSelect(`想做的工作 ${i + 1}`, plan.targets[i] || '', {
    withStatus: false,
    onChange: (v) => {
      const next = [...plan.targets];
      next[i] = v;
      plan.targets = next.filter((t, k) => t && t !== plan.current && next.indexOf(t) === k);
      update(true);
    },
  })));

  function update(repaintSelects = false) {
    if (repaintSelects) paintTargets();
    const clean = sanitizeCareer(plan) || { current: '', tenure: '', targets: [] };
    const res = careerPlan({ ...clean, ranked: r.ranked, ys, years, name: who, age });
    const dirty = JSON.stringify(clean) !== JSON.stringify(sanitizeCareer(p.career) || { current: '', tenure: '', targets: [] });
    saveBtn.disabled = !dirty;
    savedHint.textContent = dirty ? '有變更還沒儲存（分析已經照新的選擇算好了）。' : clean.current || clean.targets.length ? '已存在這支手機。' : '';
    fill(body,
      res.from && res.curFit ? [
        h('h3', { text: `現在的「${res.from.name}」` }),
        h('p', {}, h('span', { class: `badge ${FIT_CLASS[res.curFit.level]}`, text: res.curFit.level }), h('span', { class: 'muted small', text: `　適合分數 ${res.curFit.score}` })),
        h('ul', { class: 'reasons' }, res.curFit.why.map((t) => h('li', { class: 'tone-info', text: t }))),
      ] : null,
      res.items.length ? [
        h('h3', { text: '想做的工作（最適合的排前面）' }),
        res.items.map((it, k) => h('details', { class: 'more job-item', open: k === 0 },
          h('summary', {}, h('b', { text: it.job.name }), ' ', h('span', { class: `badge ${FIT_CLASS[it.fit.level]}`, text: it.fit.level }),
            it.delta !== null ? h('span', { class: 'muted small', text: `　比現在${it.delta > 0 ? `高 ${it.delta}` : it.delta < 0 ? `低 ${-it.delta}` : '一樣'}` }) : null),
          h('ul', { class: 'reasons' }, it.fit.why.map((t) => h('li', { class: 'tone-info', text: t }))),
          h('p', {}, h('b', { text: '轉換難度：' }), h('span', { text: `${DISTANCE[it.distance]}${it.bridge ? `（建議先經過「${it.bridge.name}」）` : ''}` })),
          h('p', {}, h('b', { text: '怎麼轉：' })),
          h('ol', { class: 'plan' }, it.plan.map((t) => h('li', { text: t }))),
          h('p', {}, h('b', { text: '怎麼入行：' }), h('span', { text: it.job.entry })),
          h('p', {}, h('b', { text: '要補的能力：' }), h('span', { text: it.job.skills })),
          h('p', {}, h('b', { text: `AI 的影響（${it.ai.level}）：` }), h('span', { text: it.ai.note })))),
      ] : null,
      res.timing.best.length || res.timing.soon || res.timing.avoid.length ? [
        h('h3', { text: '什麼時候換最好' }),
        h('ul', { class: 'reasons' },
          res.timing.soon ? h('li', { class: 'tone-good', text: `${res.timing.soon.year} 年（${res.timing.soon.level}${res.timing.soon.signals.length ? `，${res.timing.soon.signals.join('、')}` : ''}）：近三年裡最適合轉換的一年。` }) : h('li', { class: 'tone-info', text: '近三年沒有特別適合大轉換的年份：照步驟準備、穩穩轉就好，不用硬等。' }),
          res.timing.best.filter((y) => !res.timing.soon || y.year !== res.timing.soon.year).map((y) => h('li', { class: 'tone-good', text: `${y.year} 年（${y.level}）：${y.signals.join('、')}，十年裡最適合轉換、開新局的年份之一。` })),
          res.timing.avoid.length ? h('li', { class: 'tone-bad', text: `${res.timing.avoid.join('、')} 年最要小心：先準備，不要裸辭。` }) : null),
        h('p', { class: 'muted small', text: '看人生時間軸的 10 年：傷官、七殺、偏印、食神、偏財年，沖月支（環境變動），換大運，生命靈數 1 的新循環，落在順的年份最適合轉換。' }),
      ] : null,
      res.suggest.length ? [
        h('h3', { text: `${who === '你' ? '你' : who}可能沒想到、但很適合的工作` }),
        h('ul', { class: 'reasons' }, res.suggest.map((s) => h('li', { class: 'tone-good' },
          h('b', { text: s.job.name }), ' ', h('span', { class: `badge ${FIT_CLASS[s.fit.level]}`, text: s.fit.level }),
          h('div', { class: 'small', text: s.fit.why[0] }),
          plan.targets.length < MAX_TARGETS ? h('button', { type: 'button', class: 'btn small', text: '加到想做的工作', onclick: () => { plan.targets = [...plan.targets, s.job.id]; update(true); } }) : null))),
      ] : null);
    const m = careerMaster(res, r.natures);
    fill(master, masterCard({
      title: '老師怎麼看你的工作',
      sub: '補充或修正你的想法、怎麼轉、什麼時候轉',
      badge: m.badge ? { text: m.badge, cls: m.badge === '很適合' ? 'good' : m.badge === '要多花力氣' ? 'danger' : 'alt' } : null,
      verdict: m.verdict,
      why: m.why,
      remedies: m.remedies,
      boosts: m.boosts,
      combos: m.combos,
      onGo: (view, opts) => ctx.go(view, opts),
    }));
  }

  saveBtn.onclick = () => {
    const career = sanitizeCareer(plan);
    // 先帶上原本的資料：名單整筆覆蓋儲存，不帶的話掌紋、藝名這類別處存的欄位會被洗掉
    const res = ctx.savePerson({ ...p, career: career || undefined });
    if (!res.ok) return ctx.toast(res.error);
    ctx.toast('已存在這支手機');
  };
  paintTargets();
  update();
  const card = h('section', { class: 'card feature', id: 'job-plan' },
    cardHead(h, 'compass', `${who === '你' ? '你' : who}的工作與換跑道`, '選現在的工作和想做的工作，看哪個最適合、怎麼轉、什麼時候轉'),
    h('div', { class: 'field' }, h('span', { class: 'field-label', text: '目前的工作' }), curSel),
    h('div', { class: 'field' }, h('span', { class: 'field-label', text: '做了多久' }), tenureSel),
    h('div', { class: 'field' }, h('span', { class: 'field-label', text: `想做的工作（最多 ${MAX_TARGETS} 個，可以不選）` }), targetBox),
    body,
    h('div', { class: 'actions' }, saveBtn),
    savedHint,
    h('p', { class: 'hint', text: '適合程度＝你命盤裡最強的工作性質（八字、紫微、星座、生命靈數、血型投票）有沒有對上這個工作，加上行業五行是不是你的喜用。工作的分類和 AI 影響是本 App 依 2026 年台灣的情況整理的；選擇只存在這支手機。' }));
  return { card, master };
}
