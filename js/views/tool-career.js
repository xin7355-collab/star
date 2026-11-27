// 命盤 → 工作與未來方向。照使用者的問題排（不是照計算系統排），每個問題只回答一次：
// 1. 你的狀況：現在的工作、做多久、最在意的事、收入變少能撐多久、想做的工作（都可以不填）。
//    工作用 job-picker.js 挑：常見工作＋官方職業分類全部 380 種，打字搜尋或從類別找（上一版只有 82 個，使用者回饋沒有包含全部）
// 2. 老師總評：天賦、現況、建議路線（留下往上走／先換環境／副業先行／準備好再換／全力轉換／從頭開始）、時機，並修正想法
// 3. 選項比一比：現在的工作和想做的工作並排，適合度、收入、穩定、自由、生活平衡、AI 影響、轉換難度
// 4. 你的天賦：各系統投票的工作性質＋最適合的職位（一份推薦，不再分成行業、新興產業、職位三份），細節收在摺疊裡
// 5. 工作運：未來 10 年（把「未來三年」「十年大方向」「換跑道時機」合成一條：衝、穩、守）
// 上一版的問題（使用者回饋「沒有很完美」）：推薦分三份互相打架、時機講三次、只看命盤不看現實、分數看不懂、只有換或不換。

import { h, fill, scoreBar } from '../ui/dom.js';
import { cardHead } from '../ui/icons.js';
import { partsList } from '../ui/widgets.js';
import { masterCard } from '../ui/master.js';
import { loadProfile } from './profile.js';
import { jobPicker } from './job-picker.js';
import { EMERGING, EMERGING_NOTE } from '../core/emerging.js';
import {
  TENURES, PRIORITIES, RUNWAYS, MAX_TARGETS, TRAIT_KEYS, TRAIT_LEVEL,
  sanitizeCareer, careerPlan, careerMaster, fitPct, jobOf, jobMeta, aiNoteOf, DISTANCE,
} from '../core/jobs.js';

const FIT_CLASS = { 很適合: 'lv-high', 可以: 'lv-mid', 要多花力氣: 'lv-low' };
const EM_FIT = { 很適合: 'lv-high', 可以試試: 'lv-mid', 要多花力氣: 'lv-low' };
const MODE_CLASS = { go: 'good', steady: '', hold: 'danger' };
const TREND_NAME = Object.fromEntries(EMERGING.map((e) => [e.id, e.name]));
const EMPTY = { current: '', tenure: '', priority: '', runway: '', targets: [] };
const chips = (list) => h('div', { class: 'chips' }, list.map((t) => h('span', { class: 'chip', text: t })));
const traitList = (job) => [...TRAIT_KEYS.map((t) => `${t.label} ${TRAIT_LEVEL[job[t.key]]}`), `AI 影響 ${['低', '中', '高'][job.ai]}`];
const traitChips = (job) => chips(traitList(job));
const traitLine = (job) => traitList(job).join('・');
// 時間軸上標記建議路線的那一年
const MARK_TEXT = { stay: '建議衝刺', move: '建議換環境', start: '正式投入', side: '建議轉換', prep: '建議轉換', switch: '建議轉換', try: '建議轉換' };

export async function drawCareer(p, input, opts, { ctx, actions, mayaTime }) {
  const [prof, C, { buildLifeline }, { yongShen }] = await Promise.all([
    loadProfile(ctx, p, input, opts, { mayaTime, withName: false }), import('../core/career.js'), import('../core/lifeline.js'), import('../core/bazi.js')]);
  const r = C.buildCareer({ natal: prof.natal, bazi: prof.bazi, ziwei: prof.ziwei, birth: input.date, bloodType: p.bloodType || '', today: opts.today, lifePathNumber: prof.lifePathNumber });
  const ys = prof.bazi && prof.bazi.ok ? yongShen(prof.bazi) : null;
  const L = prof.bazi && prof.bazi.ok ? buildLifeline({ bazi: prof.bazi, natal: prof.natal, birth: input.date, today: opts.today, gender: p.gender }) : null;
  const years = L ? L.years : [];
  const timeline = C.careerTimeline(years, r.future);
  const age = opts.today.y - input.date.y - (opts.today.m < input.date.m || (opts.today.m === input.date.m && opts.today.d < input.date.d) ? 1 : 0);
  const who = p.self ? '你' : p.name;

  const savedOf = () => sanitizeCareer(p.career) || EMPTY;
  const state = { ...EMPTY, ...savedOf(), targets: [...savedOf().targets] };
  const clean = () => sanitizeCareer(state) || EMPTY;
  const planNow = () => careerPlan({ ...clean(), ranked: r.ranked, ys, years, name: who, age });

  // ── 1. 你的狀況（選了馬上重算，按鈕才存進名單：名單存檔會讓整頁重畫）
  const select = (label, list, value, onChange) => {
    const sel = h('select', { 'aria-label': label, onchange: (e) => onChange(e.target.value) }, list);
    sel.value = value || '';
    return sel;
  };
  const plain = (list) => list.map((t) => h('option', { value: t.value, text: t.label }));
  const summaryLine = h('p', { class: 'job-summary' });
  const saveBtn = h('button', { type: 'button', class: 'btn primary', text: `存到${p.name}的資料` });
  const savedHint = h('p', { class: 'muted small', role: 'status' });
  const targetBox = h('div', { class: 'job-targets' });
  const pickers = { open: null }; // 一次只開一個挑選器
  // 想做的工作：已選的加一個空位（最多 3 個），三個空的挑選器排著只會占版面
  const paintTargets = () => fill(targetBox, Array.from({ length: Math.min(MAX_TARGETS, state.targets.length + 1) }, (_, i) => jobPicker({
    label: `想做的工作 ${i + 1}`, value: state.targets[i] || '', placeholder: '（不選）', group: pickers,
    exclude: [state.current, ...state.targets.filter((_, k) => k !== i)].filter(Boolean),
    onPick: (v) => {
      const next = [...state.targets];
      next[i] = v;
      state.targets = next.filter((t, k) => t && t !== state.current && next.indexOf(t) === k);
      refresh(true);
    },
  }).el));
  const curSel = jobPicker({ label: '目前的工作', value: state.current, withStatus: true, group: pickers, onPick: (v) => {
    state.current = v;
    state.targets = state.targets.filter((t) => t !== v);
    refresh(true);
  } }).el;
  const field = (label, el) => h('div', { class: 'field' }, h('span', { class: 'field-label', text: label }), el);
  const hasSaved = !!sanitizeCareer(p.career);
  const formCard = h('section', { class: 'card feature', id: 'job-plan' },
    cardHead(h, 'compass', `${who}的狀況`, '現在的工作、最在意的事、想做的工作；都可以不填'),
    summaryLine,
    h('details', { class: 'more job-form', open: !hasSaved },
      h('summary', { text: hasSaved ? '修改' : '填寫你的狀況' }),
      field('目前的工作', curSel),
      field('做了多久', select('做了多久', plain(TENURES), state.tenure, (v) => { state.tenure = v; refresh(); })),
      field('你最在意的', select('你最在意的', plain(PRIORITIES), state.priority, (v) => { state.priority = v; refresh(); })),
      field('換工作時收入變少，能撐多久', select('收入變少能撐多久', plain(RUNWAYS), state.runway, (v) => { state.runway = v; refresh(); })),
      field(`想做的工作（最多 ${MAX_TARGETS} 個）`, targetBox),
      h('div', { class: 'actions' }, saveBtn),
      savedHint),
    h('p', { class: 'hint', text: '只存選單代碼（常見工作或官方職業分類的代碼），存在這支手機。「最在意的」和「能撐多久」不會影響適合度，會影響建議走哪一條路。' }));
  saveBtn.onclick = () => {
    const career = sanitizeCareer(state);
    // 先帶上原本的資料：名單整筆覆蓋儲存，不帶的話掌紋、藝名這類別處存的欄位會被洗掉
    const res = ctx.savePerson({ ...p, career: career || undefined });
    if (!res.ok) return ctx.toast(res.error);
    ctx.toast('已存在這支手機');
  };

  // ── 2～3. 老師總評、選項比一比（跟著選擇更新）
  const masterBox = h('div', { class: 'job-master' });
  const optionsBox = h('div', { class: 'job-options' });
  const recBox = h('div', { class: 'job-recs' });
  const timelineList = h('ol', { class: 'career-years' });

  function optionBlock(job, { tag, fit, item }) {
    return h('div', { class: 'opt' },
      h('div', { class: 'opt-head' }, h('b', { text: job.name }), h('span', { class: 'badge', text: tag }), h('span', { class: `badge ${FIT_CLASS[fit.level]}`, text: fit.level }),
        item && item.distance !== 'start' ? h('span', { class: 'muted small', text: `轉換：${DISTANCE[item.distance]}` }) : null),
      h('p', { class: 'muted small opt-meta', text: jobMeta(job, { detail: true }) }),
      scoreBar('適合度', fitPct(fit.score)),
      traitChips(job),
      h('details', { class: 'more' },
        h('summary', { text: item ? '為什麼、怎麼轉、怎麼入行' : '為什麼' }),
        h('ul', { class: 'reasons' }, fit.why.map((t) => h('li', { class: 'tone-info', text: t }))),
        item ? [
          item.bridge ? h('p', {}, h('b', { text: '跳板工作：' }), h('span', { text: `先到「${item.bridge.name}」，再到「${job.name}」。` })) : null,
          h('p', {}, h('b', { text: '怎麼轉：' })),
          h('ol', { class: 'plan' }, item.plan.map((t) => h('li', { text: t }))),
          h('p', {}, h('b', { text: '怎麼入行：' }), h('span', { text: job.entry })),
          h('p', {}, h('b', { text: '要補的能力：' }), h('span', { text: job.skills })),
        ] : null,
        h('p', {}, h('b', { text: `AI 的影響（${['低', '中', '高'][job.ai]}）：` }), h('span', { text: aiNoteOf(job) }))));
  }

  function refresh(repaintTargets = false) {
    if (repaintTargets) paintTargets();
    const res = planNow();
    const c = clean();
    // 一句話的現況（摺疊收起時看這行就知道填了什麼）
    const bits = [];
    if (res.from) bits.push(`現在：${res.from.name}${c.tenure ? `（${TENURES.find((t) => t.value === c.tenure).label}）` : ''}`);
    if (c.priority) bits.push(`最在意：${PRIORITIES.find((t) => t.value === c.priority).label}`);
    if (c.runway) bits.push(`收入：${RUNWAYS.find((t) => t.value === c.runway).label}`);
    if (c.targets.length) bits.push(`想做：${c.targets.map((t) => jobOf(t).name).join('、')}`);
    summaryLine.textContent = bits.length ? bits.join('・') : '還沒填：先選現在的工作，老師才能幫你比。';
    const dirty = JSON.stringify(c) !== JSON.stringify(savedOf());
    saveBtn.disabled = !dirty;
    savedHint.textContent = dirty ? '有變更還沒儲存（下面的分析已經照新的選擇算好了）。' : hasSaved ? '已存在這支手機。' : '';

    const m = careerMaster(res, r.natures);
    fill(masterBox, masterCard({
      title: '老師總評',
      sub: '天賦、現況、建議路線、時機',
      badge: m.badge ? { text: m.badge, cls: m.badge === '留下往上走' ? 'good' : m.badge === '先換環境' ? 'alt' : '' } : null,
      verdict: m.verdict,
      why: m.why,
      remedies: m.remedies,
      boosts: m.boosts,
      combos: m.combos,
      onGo: (view, o) => ctx.go(view, o),
      whyTitle: '補充或修正你的想法',
      remedyTitle: '怎麼做',
    }));

    const blocks = [];
    if (res.from && res.curFit) blocks.push(optionBlock(res.from, { tag: '現在', fit: res.curFit, item: null }));
    for (const it of res.items) blocks.push(optionBlock(it.job, { tag: '想做', fit: it.fit, item: it }));
    fill(optionsBox, blocks.length ? h('section', { class: 'card' },
      cardHead(h, 'star', '你的選項比一比', '適合度、收入、穩定、自由、生活平衡、AI 影響'),
      blocks,
      h('p', { class: 'hint', text: '適合度看命盤（你最強的工作性質有沒有對上、行業五行是不是喜用）。收入、穩定、自由、生活平衡是台灣 2026 年這類工作的大致傾向，實際看公司和個人。' })) : null);

    // 最適合你的職位：排除已經選的；先列 3 個，其餘收起來（6 個全展開在手機上太長）；有空位就能一鍵加到想做的工作
    const recItem = (s) => h('li', { class: 'tone-good' },
      h('b', { text: s.job.name }), ' ', h('span', { class: `badge ${FIT_CLASS[s.fit.level]}`, text: s.fit.level }),
      s.job.trend ? h('span', { class: 'badge alt', text: `趨勢：${TREND_NAME[s.job.trend]}` }) : null,
      h('div', { class: 'small', text: s.fit.why[0] }),
      h('div', { class: 'muted small', text: traitLine(s.job) }),
      state.targets.length < MAX_TARGETS ? h('button', { type: 'button', class: 'btn small', text: '加到想做的工作', onclick: () => {
        state.targets = [...state.targets, s.job.id];
        formCard.querySelector('details.job-form').open = true;
        refresh(true);
      } }) : null);
    fill(recBox,
      h('ul', { class: 'reasons' }, res.suggest.slice(0, 3).map(recItem)),
      res.suggest.length > 3 ? h('details', { class: 'more' }, h('summary', { text: `再看 ${res.suggest.length - 3} 個` }), h('ul', { class: 'reasons' }, res.suggest.slice(3).map(recItem))) : null);

    // 時間軸：標出建議路線的年份
    const mark = res.path && res.path.year;
    fill(timelineList, timeline.map((y, i) => h('li', { class: `cy cy-${y.mode}` },
      h('div', { class: 'cy-head' },
        h('b', { text: String(y.year) }), h('small', { class: 'muted', text: `${y.age} 歲` }),
        h('span', { class: `badge ${MODE_CLASS[y.mode]}`, text: C.TIMELINE_MODE[y.mode].label }),
        mark === y.year ? h('span', { class: 'badge good', text: MARK_TEXT[res.path.id] || '建議轉換' }) : null,
        h('span', { class: 'cy-focus small', text: y.focus ? `${y.focus}` : y.level })),
      y.detail && i < 3 ? h('details', { class: 'more' },
        h('summary', { text: '這一年做什麼、小心什麼' }),
        h('ul', { class: 'reasons' }, y.detail.doList.map((t) => h('li', { class: 'tone-good', text: t })), y.detail.watchList.map((t) => h('li', { class: 'tone-bad', text: t }))),
        h('details', { class: 'more' }, h('summary', { text: '依據' }), partsList(y.detail.points))) : null)));
  }

  // ── 4. 你的天賦（一份推薦；行業、新興產業、各系統的依據收在摺疊裡）
  const natureCards = h('div', { class: 'traits' }, r.natures.map((n) => h('div', { class: 'trait' },
    h('div', { class: 'trait-head' }, h('b', { text: n.label }), h('span', { class: 'count', text: `${n.count} 個系統` })),
    h('p', { text: n.desc }),
    h('ul', { class: 'reasons' }, h('li', { class: 'tone-good', text: `優勢：${n.edge}` }), h('li', { class: 'tone-bad', text: `小心：${n.trap}` })),
    h('div', { class: 'muted small', text: n.sources.join('・') }))));
  const emList = h('div', { class: 'em-list' }, r.emerging.map((e) => h('details', { class: 'em' },
    h('summary', {}, h('b', { text: e.name }), h('span', { class: `em-level ${EM_FIT[e.level]}`, text: e.level })),
    h('p', { class: 'muted small', text: e.desc }),
    h('ul', { class: 'reasons' }, e.why.map((w) => h('li', { class: e.level === '要多花力氣' ? 'tone-info' : 'tone-good', text: w }))),
    h('p', {}, h('b', { text: '你可以做的角色：' }), h('span', { text: e.role })),
    h('p', {}, h('b', { text: '怎麼開始：' }), h('span', { text: e.entry })))));
  const talentCard = h('section', { class: 'card' },
    cardHead(h, 'sparkle', `${who}的天賦`, '八字・紫微・星座・生命靈數・血型一起投票'),
    h('h3', { text: r.consensus ? '最適合的工作性質' : '各系統看法比較分散，票數最多的是' }),
    natureCards,
    h('h3', { text: '最適合你的職位' }),
    recBox,
    r.aiAdvice ? h('p', { class: 'ai-box' }, h('b', { text: 'AI 時代，你可以這樣做：' }), h('span', { text: r.aiAdvice.text })) : null,
    h('details', { class: 'more' }, h('summary', { text: `新興產業適不適合你（${r.emerging.length} 個）` }), emList, h('p', { class: 'hint', text: EMERGING_NOTE })),
    r.industries ? h('details', { class: 'more' }, h('summary', { text: '比較順的行業（五行）' }), chips(r.industries.list), h('p', { class: 'hint', text: r.industries.reason })) : null,
    h('details', { class: 'more' }, h('summary', { text: `各系統怎麼說（${r.points.length}）` }), partsList(r.points)),
    prof.missing.length ? h('p', { class: 'warn', text: `補上這些資料會更準：${prof.missing.join('、')}。` }) : null);

  // ── 5. 工作運：未來 10 年
  const f = r.future;
  const decadeLines = [];
  if (f.dayun && f.dayun.current) {
    const c = f.dayun.current;
    decadeLines.push(h('li', { class: c.good ? 'tone-good' : 'tone-info' }, h('span', { class: 'sys sys-八字', text: '八字' }), h('span', { text: `現在（${c.startYear}–${c.endYear}）走「${c.shishen}」大運 ${c.ganzhi}：重點是${c.focus}。適合${c.do}；${c.watch}。${c.good ? '天干是你的喜用，這十年整體順。' : ''}` })));
  }
  if (f.dayun && f.dayun.next) {
    const n = f.dayun.next;
    decadeLines.push(h('li', { class: n.good ? 'tone-good' : 'tone-info' }, h('span', { class: 'sys sys-八字', text: '八字' }), h('span', { text: `${n.startYear} 年起換「${n.shishen}」大運 ${n.ganzhi}：重點轉為${n.focus}，可以提早準備：${n.do}。` })));
  }
  if (f.decade && f.decade.current) decadeLines.push(h('li', { class: 'tone-info' }, h('span', { class: 'sys sys-紫微', text: '紫微' }), h('span', { text: `現在大限（${f.decade.current.ages}）走到「${f.decade.current.palace}」：${f.decade.current.focus}` })));
  const summary = `${r.natures.map((n) => n.label).join('、')}；${timeline.slice(0, 3).map((y) => `${y.year} ${C.TIMELINE_MODE[y.mode].label}`).join('、')}`;
  const timelineCard = h('section', { class: 'card' },
    cardHead(h, 'calendar', '工作運：未來 10 年', '衝、穩、守：哪一年做什麼'),
    decadeLines.length ? h('ul', { class: 'reasons' }, decadeLines) : null,
    timeline.length ? timelineList : h('p', { class: 'muted', text: '時間軸需要八字：到「我的」確認生日資料。' }),
    h('p', { class: 'muted small', text: Object.values(C.TIMELINE_MODE).map((x) => `${x.label}＝${x.text}`).join('；') }),
    h('p', { class: 'hint', text: '和「人生時間軸」同一套：流年十神決定那一年工作的重點；順、小順又有升遷或變動的訊號是「衝」，注意、小心是「守」。命理是參考，真正決定方向的，是你願意花時間累積的能力。' }),
    actions(p, 'career', '工作與方向', summary));

  paintTargets();
  refresh();
  return [formCard, masterBox, optionsBox, talentCard, timelineCard];
}
