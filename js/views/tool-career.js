// 命盤 → 工作與未來方向。照使用者的問題排（不是照計算系統排），每個問題只回答一次：
// 1. 你的狀況：現在的工作、做多久、最在意的事、收入變少能撐多久、想做的工作（都可以不填）。
//    工作用 job-picker.js 挑：常見工作＋官方職業分類全部 380 種，打字搜尋或從類別找（上一版只有 82 個，使用者回饋沒有包含全部）
//    軍警公職多問身分、單位、階級、年資（月退門檻）；「讓分析更準」收著工作型態、學歷科系、技能、證照、學習時間、想換的時間
// 2. 老師總評：天賦、現況、建議路線（留下往上走／先換環境／副業先行／準備好再換／全力轉換／撐到月退再轉／從頭開始）、時機，並修正想法
// 3. 選項比一比：現在的工作和想做的工作並排，綜合分數（各項指標）、月薪、準備度、穩定、自由、生活平衡、AI 影響、轉換難度
// 4. 綜合推薦：全部工作用同一把尺（命理天賦、興趣、性格、準備度、你在意的、AI 與未來性）排，附真實月薪
//    （使用者回饋「有把各項指標結合比對嗎？沒有推薦工作、沒有各個工作收入」：上一版推薦只看命理，收入只有高中低）
// 5. 你的本事能去哪裡：軍警專長在民間對應的工作、轉換管道、用現有技能證照就搆得到的工作
// 6. 興趣與性格測驗（quiz-card.js）：結果是綜合推薦裡的「興趣相符」「性格相符」兩項，不混進命理投票
// 7. 你的天賦：各系統投票的工作性質，新興產業、行業五行、各系統的依據收在摺疊裡
// 8. 工作運：未來 10 年（把「未來三年」「十年大方向」「換跑道時機」合成一條：衝、穩、守）
// 上一版的問題（使用者回饋「沒有很完美」）：推薦分三份互相打架、時機講三次、只看命盤不看現實、分數看不懂、只有換或不換。

import { h, fill, scoreBar } from '../ui/dom.js';
import { cardHead } from '../ui/icons.js';
import { partsList } from '../ui/widgets.js';
import { masterCard } from '../ui/master.js';
import { loadProfile } from './profile.js';
import { jobPicker } from './job-picker.js';
import { multiPicker } from './multi-picker.js';
import { quizCard } from './quiz-card.js';
import { EMERGING, EMERGING_NOTE } from '../core/emerging.js';
import {
  TENURES, PRIORITIES, RUNWAYS, MAX_TARGETS, TRAIT_KEYS, TRAIT_LEVEL,
  sanitizeCareer, careerPlan, careerMaster, jobOf, jobMeta, aiNoteOf, wageText, DISTANCE, OVERALL_PARTS, WAGE_SOURCE,
} from '../core/jobs.js';
import {
  MODES, SERVICES, MIL_ORGS, RANKS, YEARS, EDUS, MAJORS, STUDY_TIMES, WHENS, SKILL_GROUPS, CERT_GROUPS, MAX_SKILLS, MAX_CERTS,
  MIL_CHANNELS, asksService, SERVICE_OF,
} from '../core/work-profile.js';

const FIT_CLASS = { 很適合: 'lv-high', 可以: 'lv-mid', 要多花力氣: 'lv-low' };
const EM_FIT = { 很適合: 'lv-high', 可以試試: 'lv-mid', 要多花力氣: 'lv-low' };
const MODE_CLASS = { go: 'good', steady: '', hold: 'danger' };
const TREND_NAME = Object.fromEntries(EMERGING.map((e) => [e.id, e.name]));
const EMPTY = { current: '', tenure: '', priority: '', runway: '', targets: [] };
const chips = (list) => h('div', { class: 'chips' }, list.map((t) => h('span', { class: 'chip', text: t })));
const traitList = (job) => [...TRAIT_KEYS.map((t) => `${t.label} ${TRAIT_LEVEL[job[t.key]]}`), `AI 影響 ${['低', '中', '高'][job.ai]}`];
const traitChips = (job) => chips(traitList(job));
const lvOf = (n) => (n >= 70 ? 'lv-high' : n >= 50 ? 'lv-mid' : 'lv-low');
const partsText = (o) => o.parts.map((x) => `${x.label} ${x.value}`).join('・');
// 時間軸上標記建議路線的那一年
const MARK_TEXT = { stay: '建議衝刺', move: '建議換環境', start: '正式投入', side: '建議轉換', prep: '建議轉換', switch: '建議轉換', try: '建議轉換', pension: '建議轉換' };

export async function drawCareer(p, input, opts, { ctx, actions, mayaTime }) {
  const [prof, C, { buildLifeline }, { yongShen }] = await Promise.all([
    loadProfile(ctx, p, input, opts, { mayaTime, withName: false }), import('../core/career.js'), import('../core/lifeline.js'), import('../core/bazi.js')]);
  const r = C.buildCareer({ natal: prof.natal, bazi: prof.bazi, ziwei: prof.ziwei, birth: input.date, bloodType: p.bloodType || '', today: opts.today, lifePathNumber: prof.lifePathNumber });
  const ys = prof.bazi && prof.bazi.ok ? yongShen(prof.bazi) : null;
  const L = prof.bazi && prof.bazi.ok ? buildLifeline({ bazi: prof.bazi, natal: prof.natal, birth: input.date, today: opts.today, gender: p.gender, mayaCount: opts.mayaCount }) : null;
  const years = L ? L.years : [];
  const timeline = C.careerTimeline(years, r.future);
  const age = opts.today.y - input.date.y - (opts.today.m < input.date.m || (opts.today.m === input.date.m && opts.today.d < input.date.d) ? 1 : 0);
  const who = p.self ? '你' : p.name;

  const savedOf = () => sanitizeCareer(p.career) || EMPTY;
  const saved0 = savedOf();
  const state = { ...EMPTY, ...saved0, targets: [...saved0.targets], skills: [...(saved0.skills || [])], certs: [...(saved0.certs || [])] };
  const clean = () => sanitizeCareer(state) || EMPTY;
  const planNow = () => careerPlan({ ...clean(), ranked: r.ranked, ys, years, name: who, age, quiz: p.quiz || null });

  // ── 1. 你的狀況（選了馬上重算，按鈕才存進名單：名單存檔會讓整頁重畫）
  const select = (label, list, value, onChange) => {
    const sel = h('select', { 'aria-label': label, onchange: (e) => onChange(e.target.value) }, list);
    sel.value = value || '';
    return sel;
  };
  const plain = (list) => list.map((t) => h('option', { value: t.value, text: t.label }));
  const summaryLine = h('p', { class: 'job-summary' });
  const saveBtn = h('button', { type: 'button', class: 'btn primary', text: `存到${p.name}的資料` });
  // 全部清除重填：存過才有；清掉後整頁重畫，表單自動打開、回到還沒填
  const clearBtn = h('button', { type: 'button', class: 'btn small ghost', text: '全部清除，重新填寫', onclick: () => {
    if (!window.confirm('已存的工作、年資、技能、證照都會清掉，重新填寫（測驗結果不受影響）。確定？')) return;
    const res = ctx.savePerson({ ...p, career: undefined });
    if (!res.ok) return ctx.toast(res.error);
    ctx.toast('已清除，可以重新填寫');
  } });
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
    // 換成不是軍警公職的工作：身分、年資清掉（不然會拿軍職的月退規則去算一般工作）
    if (!asksService(jobOf(v))) Object.assign(state, { service: '', org: '', rank: '', svcYears: '' });
    paintService();
    refresh(true);
  } }).el;
  const field = (label, el) => h('div', { class: 'field' }, h('span', { class: 'field-label', text: label }), el);
  const hasSaved = !!sanitizeCareer(p.career);

  // 軍警公職：身分、單位、階級、年資（月退門檻、轉換難度都看它）
  // 各區塊給 id：design-qa 用 CSS 路徑當元素代號，兩個結構一樣的區塊（身分、學歷那一列）會撞號，鍵盤巡覽就提早停
  const svcBox = h('div', { class: 'svc-fields', id: 'job-svc' });
  function paintService() {
    const job = jobOf(state.current);
    if (!asksService(job)) return fill(svcBox);
    const svc = state.service || SERVICE_OF(job);
    fill(svcBox,
      field('身分', select('身分', plain(SERVICES), svc, (v) => { state.service = v; paintService(); refresh(); })),
      svc === 'mil' ? h('div', { class: 'row2' },
        field('單位', select('單位', plain(MIL_ORGS), state.org, (v) => { state.org = v; refresh(); })),
        field('階級', select('階級', plain(RANKS), state.rank, (v) => { state.rank = v; refresh(); }))) : null,
      field(svc === 'mil' ? '服役年資（總共）' : '任職年資（總共）', select('年資', plain(YEARS), state.svcYears, (v) => { state.svcYears = v; refresh(); })));
  }
  // 選填的背景：準備度、作息、學習時間的提醒都看它
  const extraBox = h('details', { class: 'more job-extra', id: 'job-extra' },
    h('summary', { text: '讓分析更準（選填）：學歷、技能、證照…' }),
    field('現在的工作型態', select('工作型態', plain(MODES), state.mode, (v) => { state.mode = v; refresh(); })),
    h('div', { class: 'row2' },
      field('學歷', select('學歷', plain(EDUS), state.edu, (v) => { state.edu = v; refresh(); })),
      field('科系', select('科系', plain(MAJORS), state.major, (v) => { state.major = v; refresh(); }))),
    field('會的技能（工作、軍中、興趣學的都算）', multiPicker({ label: '技能', groups: SKILL_GROUPS, value: state.skills, max: MAX_SKILLS, group: pickers, onChange: (ids) => { state.skills = ids; refresh(); } }).el),
    field('證照', multiPicker({ label: '證照', groups: CERT_GROUPS, value: state.certs, max: MAX_CERTS, group: pickers, onChange: (ids) => { state.certs = ids; refresh(); } }).el),
    field('每週能花多少時間學新東西', select('每週能學多久', plain(STUDY_TIMES), state.study, (v) => { state.study = v; refresh(); })),
    field('想在什麼時候換', select('想什麼時候換', plain(WHENS), state.when, (v) => { state.when = v; refresh(); })),
    h('p', { class: 'hint', text: '技能、證照、科系決定「準備度」：你已經會的，轉過去就比較近。軍中的專長也算，例如無線電、修電腦、帶人、裝備保養。' }));
  const formCard = h('section', { class: 'card feature', id: 'job-plan' },
    cardHead(h, 'compass', `${who}的狀況`, '現在的工作、最在意的事、想做的工作；都可以不填'),
    summaryLine,
    h('details', { class: 'more job-form', id: 'job-form', open: !hasSaved },
      // 存過之後表單收起：按鈕要看得出能按（使用者回饋「存了之後沒有重新填寫的地方」，原本只有一行小字「修改」）
      h('summary', { text: hasSaved ? '修改或重新填寫' : '填寫你的狀況' }),
      field('目前的工作', curSel),
      svcBox,
      field('這份工作做了多久', select('做了多久', plain(TENURES), state.tenure, (v) => { state.tenure = v; refresh(); })),
      field('你最在意的', select('你最在意的', plain(PRIORITIES), state.priority, (v) => { state.priority = v; refresh(); })),
      field('換工作時收入變少，能撐多久', select('收入變少能撐多久', plain(RUNWAYS), state.runway, (v) => { state.runway = v; refresh(); })),
      field(`想做的工作（最多 ${MAX_TARGETS} 個）`, targetBox),
      extraBox,
      h('div', { class: 'actions' }, saveBtn),
      // 清除放下一列：和「存到…」擠一列時，320 寬的手機會把存檔按鈕擠成一個字一行
      hasSaved ? h('div', { class: 'actions' }, clearBtn) : null,
      savedHint),
    h('p', { class: 'hint', text: '只存選單代碼（工作、技能、證照都是選單），存在這支手機。「最在意的」和「能撐多久」不影響適合度，會影響建議走哪一條路；技能證照影響「準備度」。' }));
  saveBtn.onclick = () => {
    const career = sanitizeCareer(state);
    // 先帶上原本的資料：名單整筆覆蓋儲存，不帶的話掌紋、藝名這類別處存的欄位會被洗掉
    const res = ctx.savePerson({ ...p, career: career || undefined });
    if (!res.ok) return ctx.toast(res.error);
    // 提示保持短：長的提示在 320 寬會折成三行，蓋住下面的欄位 3.5 秒（design-qa FOCUS_OBSCURED）
    ctx.toast('已存在這支手機');
  };

  // ── 2～3. 老師總評、選項比一比（跟著選擇更新）
  const masterBox = h('div', { class: 'job-master', id: 'job-master' });
  const optionsBox = h('div', { class: 'job-options', id: 'job-options' });
  const recBox = h('div', { class: 'job-recs', id: 'job-recs' });
  const timelineList = h('ol', { class: 'career-years' });

  const readyLine = (rd) => {
    const have = [...rd.haveSkills, ...rd.haveCerts];
    return `${rd.level}${have.length ? `：你已經有${have.join('、')}` : ''}${rd.gaps.length ? `。${rd.gaps.join('')}` : '。'}`;
  };
  // 加到想做的工作（推薦、本事卡片共用）
  const addTarget = (id) => (state.targets.length < MAX_TARGETS && !state.targets.includes(id) && id !== state.current
    ? h('button', { type: 'button', class: 'btn small', text: '加到想做的工作', onclick: () => {
      state.targets = [...state.targets, id];
      formCard.querySelector('details.job-form').open = true;
      refresh(true);
    } })
    : null);
  const abilityBox = h('div', { class: 'job-ability' });

  // 綜合分數攤開；命理的適合度變成其中一項（徽章標「命理」，不然「很適合」會被當成整體的結論）
  function optionBlock(job, { tag, fit, overall, item }) {
    return h('div', { class: 'opt' },
      h('div', { class: 'opt-head' }, h('b', { text: job.name }), h('span', { class: 'badge', text: tag }), h('span', { class: `badge ${FIT_CLASS[fit.level]}`, text: `命理${fit.level}` }),
        item && item.distance !== 'start' ? h('span', { class: 'muted small', text: `轉換：${DISTANCE[item.distance]}` }) : null),
      h('p', { class: 'muted small opt-meta', text: jobMeta(job, { detail: true }) }),
      scoreBar('綜合', overall.score),
      h('p', { class: 'muted small opt-parts', text: partsText(overall) }),
      h('p', { class: 'small opt-wage' }, h('b', { text: '收入：' }), h('span', { text: wageText(job) })),
      item && item.readiness ? h('p', { class: 'small ready-line' }, h('b', { text: '準備度：' }), h('span', { text: readyLine(item.readiness) })) : null,
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
    if (c.svcYears) bits.push(`年資 ${YEARS.find((t) => t.value === c.svcYears).label}`);
    if (c.priority) bits.push(`最在意：${PRIORITIES.find((t) => t.value === c.priority).label}`);
    if (c.runway) bits.push(`收入：${RUNWAYS.find((t) => t.value === c.runway).label}`);
    if (c.targets.length) bits.push(`想做：${c.targets.map((t) => jobOf(t).name).join('、')}`);
    if (c.skills) bits.push(`技能 ${c.skills.length} 項`);
    if (c.certs) bits.push(`證照 ${c.certs.length} 張`);
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
    if (res.from && res.curFit) blocks.push(optionBlock(res.from, { tag: '現在', fit: res.curFit, overall: res.curOverall, item: null }));
    for (const it of res.items) blocks.push(optionBlock(it.job, { tag: '想做', fit: it.fit, overall: it.overall, item: it }));
    fill(optionsBox, blocks.length ? h('section', { class: 'card', id: 'job-compare' },
      cardHead(h, 'star', '你的選項比一比', '綜合分數、月薪、準備度、穩定、自由、AI 影響'),
      blocks,
      h('p', { class: 'hint', text: '綜合分數和下面的「綜合推薦」同一把尺（怎麼算寫在那張卡的摺疊裡）；現在的工作不算準備度（你已經在做了）。穩定、自由、生活平衡是台灣這類工作的大致傾向，實際看公司和個人。' })) : null);

    // 綜合推薦：全部工作（常見＋官方 380 種）同一把尺排；前 5 個攤開、其餘收起（10 個全展開在手機上太長）
    const recItem = (s) => h('li', { class: 'tone-good' },
      h('b', { text: s.job.name }), ' ', h('span', { class: `badge ${lvOf(s.overall.score)}`, text: `綜合 ${s.overall.score}` }),
      s.job.trend ? h('span', { class: 'badge alt', text: `趨勢：${TREND_NAME[s.job.trend]}` }) : null,
      h('div', { class: 'small' }, h('b', { text: '收入：' }), h('span', { text: wageText(s.job) })),
      h('div', { class: 'muted small', text: partsText(s.overall) }),
      h('div', { class: 'muted small', text: jobMeta(s.job) }),
      addTarget(s.job.id));
    // 還沒算進來的指標：講清楚去哪裡補（「做適合自己的事」不對應工作傾向，選了就不算缺）
    const missing = [
      !p.quiz ? '興趣、性格（做下面的測驗）' : null,
      !res.filled ? '準備度（在「讓分析更準」選技能、證照、學歷）' : null,
      !res.priority ? '你在意的（選「你最在意的」）' : null,
    ].filter(Boolean);
    const q = res.quiz;
    fill(recBox, res.recommend.length ? h('section', { class: 'card', id: 'job-recommend' },
      cardHead(h, 'sparkle', `${who}的綜合推薦`, '各項指標一起比，從全部工作裡挑'),
      h('p', { class: 'small', text: `這次一起比的：${res.recommend[0].overall.parts.map((x) => x.label).join('、')}。` }),
      q ? h('p', { class: 'small', text: `測驗：興趣偏「${q.names.length ? q.names.join('、') : '沒有特別高的'}」，${q.ei.label}，外向性 ${q.ei.n}。` }) : null,
      missing.length ? h('p', { class: 'muted small', text: `還沒算進來：${missing.join('；')}。` }) : null,
      h('ul', { class: 'reasons' }, res.recommend.slice(0, 5).map(recItem)),
      // 摺疊給 id：design-qa 用最多 4 層的 CSS 路徑當代號，和本事卡的「再看 N 個」撞號會讓鍵盤巡覽提早停
      res.recommend.length > 5 ? h('details', { class: 'more', id: 'job-rec-more' }, h('summary', { text: `再看 ${res.recommend.length - 5} 個` }), h('ul', { class: 'reasons' }, res.recommend.slice(5).map(recItem))) : null,
      h('details', { class: 'more' }, h('summary', { text: '分數怎麼算' }),
        h('ul', { class: 'reasons' }, Object.values(OVERALL_PARTS).map((x) => h('li', { class: 'tone-info' }, h('b', { text: `${x.label}（${Math.round(x.w * 100)}%）：` }), h('span', { text: x.desc })))),
        h('p', { class: 'small', text: '沒有的項目不算 0 分，權重按比例分給有的項目。30 歲以上不推要從頭讀科系、考國考的工作。' }),
        h('p', { class: 'hint', text: `收入：${WAGE_SOURCE}。軍職、公職、公立學校老師、自己接案的不在這份調查裡，照實寫，不拿別的職類硬套。` }))) : null);

    // 你的本事能去哪裡：軍警專長對應的民間工作、轉換管道；用現有技能證照就搆得到的工作
    const abilityItem = (s) => h('li', { class: 'tone-good' },
      h('b', { text: s.job.name }), ' ', h('span', { class: `badge ${FIT_CLASS[s.fit.level]}`, text: s.fit.level }),
      s.readiness ? h('span', { class: 'badge alt', text: `準備度 ${s.readiness.pct}` }) : null,
      h('div', { class: 'muted small', text: jobMeta(s.job) }),
      s.readiness && (s.readiness.haveSkills.length || s.readiness.haveCerts.length)
        ? h('div', { class: 'small', text: `你已經有：${[...s.readiness.haveSkills, ...s.readiness.haveCerts].join('、')}` }) : null,
      addTarget(s.job.id));
    const list = (key, rows, n = 4) => [
      h('ul', { class: 'reasons' }, rows.slice(0, n).map(abilityItem)),
      rows.length > n ? h('details', { class: 'more', id: `job-more-${key}` }, h('summary', { text: `再看 ${rows.length - n} 個` }), h('ul', { class: 'reasons' }, rows.slice(n).map(abilityItem))) : null,
    ];
    const milSide = res.from && (res.from.group === 'military' || res.service === 'mil');
    fill(abilityBox, res.from || res.filled ? h('section', { class: 'card', id: 'job-ability' },
      cardHead(h, 'compass', `${who}的本事能去哪裡`, '你已經會的，在外面值多少'),
      res.pension ? h('p', { class: 'ai-box pension-note', text: res.pension.text }) : null,
      res.civil.length ? [h('h3', { text: `「${res.from.name}」在民間對應的工作` }), list('civil', res.civil)] : null,
      milSide ? h('details', { class: 'more' }, h('summary', { text: '軍職轉換的管道' }),
        h('ul', { class: 'reasons' }, MIL_CHANNELS.map((x) => h('li', { class: 'tone-info' }, h('b', { text: `${x.title}：` }), h('span', { text: x.text })))),
        h('p', { class: 'hint', text: '名額、類科、補助以當年的簡章和退輔會公告為準。' })) : null,
      res.ready.length ? [h('h3', { text: '用你現在的本事就搆得到的工作' }), list('ready', res.ready, 3)] : null,
      !res.filled ? h('p', { class: 'muted', text: '在上面「讓分析更準」選你會的技能、證照、學歷，這裡會列出你現在就搆得到的工作，每個想做的工作也會多一個「準備度」。' })
        : !res.ready.length && !res.civil.some((x) => x.readiness && x.readiness.pct >= 60)
          ? h('p', { class: 'muted', text: '目前選的技能、證照還沒有準備度到 60 的工作：再補幾項你會的（軍中、興趣學的都算），或看想做的工作「可以考的證照」。' }) : null) : null);

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

  // ── 7. 你的天賦（工作性質；行業、新興產業、各系統的依據收在摺疊裡）
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
  const talentCard = h('section', { class: 'card', id: 'job-talent' },
    cardHead(h, 'sparkle', `${who}的天賦`, '八字・紫微・星座・生命靈數・血型一起投票'),
    h('h3', { text: r.consensus ? '最適合的工作性質' : '各系統看法比較分散，票數最多的是' }),
    natureCards,
    h('p', { class: 'muted small', text: '具體的工作看上面的「綜合推薦」：天賦是其中一項，再加上興趣、性格、準備度、收入和 AI 影響。' }),
    r.aiAdvice ? h('p', { class: 'ai-box' }, h('b', { text: 'AI 時代，你可以這樣做：' }), h('span', { text: r.aiAdvice.text })) : null,
    h('details', { class: 'more' }, h('summary', { text: `新興產業適不適合你（${r.emerging.length} 個）` }), emList, h('p', { class: 'hint', text: EMERGING_NOTE })),
    r.industries ? h('details', { class: 'more' }, h('summary', { text: '比較順的行業（五行）' }), chips(r.industries.list), h('p', { class: 'hint', text: r.industries.reason })) : null,
    h('details', { class: 'more' }, h('summary', { text: `各系統怎麼說（${r.points.length}）` }), partsList(r.points)),
    prof.missing.length ? h('p', { class: 'warn', text: `補上這些資料會更準：${prof.missing.join('、')}。` }) : null);

  // ── 8. 工作運：未來 10 年
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
  const timelineCard = h('section', { class: 'card', id: 'job-timeline' },
    cardHead(h, 'calendar', '工作運：未來 10 年', '衝、穩、守：哪一年做什麼'),
    decadeLines.length ? h('ul', { class: 'reasons' }, decadeLines) : null,
    timeline.length ? timelineList : h('p', { class: 'muted', text: '時間軸需要八字：到「我的」確認生日資料。' }),
    h('p', { class: 'muted small', text: Object.values(C.TIMELINE_MODE).map((x) => `${x.label}＝${x.text}`).join('；') }),
    h('p', { class: 'hint', text: '和「人生時間軸」同一套：流年十神決定那一年工作的重點；順、小順又有升遷或變動的訊號是「衝」，注意、小心是「守」。命理是參考，真正決定方向的，是你願意花時間累積的能力。' }),
    actions(p, 'career', '工作與方向', summary));

  // 興趣與性格測驗：做完自動存；工作表單有沒存的變更就一起存（存檔會整頁重畫）
  const quizEl = quizCard({ p, who, ctx, today: opts.today, pendingCareer: () => (JSON.stringify(clean()) !== JSON.stringify(savedOf()) ? sanitizeCareer(state) : null) });

  paintTargets();
  paintService();
  refresh();
  return [formCard, masterBox, optionsBox, recBox, abilityBox, quizEl, talentCard, timelineCard];
}
