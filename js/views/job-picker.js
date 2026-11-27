// 工作挑選器（目前的工作、想做的工作共用）：常見工作 82 個＋官方職業分類的 380 個細類。
// 460 個選項塞進一個原生下拉，iPhone 的滾輪要滑很久，也找不到「外送」「看護」這種口語叫法，所以：
// - 主要：打字搜尋（名稱、口語叫法、官方代碼都可以），點一下就選好；
// - 其次：先選類別、再選工作（兩個原生下拉，iPhone 上是熟悉的滾輪），給不知道正式名稱的人一層一層找。
// 同一張表單的挑選器共用 group：一次只開一個，選好就收起來。
// 注音輸入：組字中（compositionstart～compositionend）不搜尋，不然每打一個注音符號就跳出「找不到」。

import { h, fill } from '../ui/dom.js';
import { JOB_GROUPS, SOC_TREE, SOC_EDITION, COMMON_COUNT, OFFICIAL_COUNT, jobOf, jobMeta, searchJobs } from '../core/jobs.js';

const MAX_HITS = 30;
let seq = 0;

const unitCount = (m) => m.subs.reduce((a, s) => a + s.units.length, 0);
// 不能選的（現在的工作、其他已選的）留在清單上但停用：從清單消失反而讓人以為漏了
const optionOf = (x, exclude) => h('option', { value: x.id, text: x.name, disabled: exclude.includes(x.id) });

function categoryOptions(withStatus) {
  return [
    h('option', { value: '', text: '（選類別）' }),
    withStatus ? h('option', { value: 'status', text: '目前沒有工作（學生、待業、照顧家庭、退休）' }) : null,
    h('option', { value: 'common', text: `常見工作（${COMMON_COUNT} 種）` }),
    h('optgroup', { label: '官方職業分類' }, SOC_TREE.map((m) => h('option', { value: m.code, text: `${m.name}（${unitCount(m)} 種）` }))),
  ];
}

function jobOptions(cat, exclude = []) {
  const head = h('option', { value: '', text: cat ? '（選工作）' : '（先選類別）' });
  const opt = (x) => optionOf(x, exclude);
  if (cat === 'status') return [head, ...JOB_GROUPS.find((g) => g.id === 'status').jobs.map(opt)];
  if (cat === 'common') return [head, ...JOB_GROUPS.filter((g) => g.id !== 'status').map((g) => h('optgroup', { label: g.name }, g.jobs.map(opt)))];
  const major = SOC_TREE.find((m) => m.code === cat);
  if (!major) return [head];
  return [head, ...major.subs.map((s) => h('optgroup', { label: s.name }, s.units.map((u) => opt({ id: u.code, name: u.name }))))];
}

/**
 * @param {{label:string, value?:string, withStatus?:boolean, exclude?:string[], placeholder?:string, group?:{open:object|null}, onPick:(id:string)=>void}} o
 *   withStatus：選單裡要不要有「學生、待業…」（只有「目前的工作」要）；
 *   exclude：不能選的代碼（想做的工作不能選現在的工作和其他已選的：選了會被濾掉，看起來像按了沒反應）；onPick 收到 '' 代表清除
 * @returns {{el:HTMLElement, close:(focusButton?:boolean)=>void}}
 */
export function jobPicker({ label, value = '', withStatus = false, exclude = [], placeholder = '（還沒選）', group = { open: null }, onPick }) {
  const id = `job-panel-${(seq += 1)}`;
  let current = value;
  let composing = false;

  const btn = h('button', { type: 'button', class: 'job-pick', 'aria-expanded': 'false', 'aria-controls': id });
  const input = h('input', { type: 'search', class: 'job-search', 'aria-label': `搜尋${label}`, placeholder: '打字找，例如：護理、外送、會計', autocomplete: 'off', enterkeyhint: 'search' });
  const hint = h('p', { class: 'muted small', role: 'status' });
  const hits = h('ul', { class: 'job-hits' });
  const catSel = h('select', { 'aria-label': `${label}：類別` }, categoryOptions(withStatus));
  const jobSel = h('select', { 'aria-label': `${label}：工作`, disabled: true }, jobOptions(''));
  const clearBtn = h('button', { type: 'button', class: 'btn small ghost', text: '清除', onclick: () => pick('') });
  const panel = h('div', { class: 'job-panel', id, hidden: true },
    input, hint, hits,
    h('p', { class: 'field-label', text: '或從類別找' }),
    h('div', { class: 'job-browse' }, catSel, jobSel),
    h('div', { class: 'actions' }, clearBtn, h('button', { type: 'button', class: 'btn small ghost', text: '收起', onclick: () => close(true) })),
    h('p', { class: 'hint', text: `常見工作 ${COMMON_COUNT} 種，加上${SOC_EDITION}的全部 ${OFFICIAL_COUNT} 種職業。` }));

  function paintButton() {
    const job = current ? jobOf(current) : null;
    btn.setAttribute('aria-label', `${label}：${job ? job.name : placeholder.replace(/[（）]/g, '')}`);
    fill(btn, h('span', { class: 'job-pick-name', text: job ? job.name : placeholder }), job ? h('span', { class: 'job-pick-meta', text: jobMeta(job) }) : null);
    clearBtn.hidden = !job;
  }

  function render() {
    if (composing) return;
    const q = input.value.trim();
    if (!q) {
      fill(hits);
      hint.textContent = '';
      return;
    }
    const res = searchJobs(q, { withStatus, limit: MAX_HITS, exclude });
    hint.textContent = !res.total ? `找不到「${q}」：換個說法（例如「司機」「店員」「工程師」），或從下面的類別找。`
      : res.total > res.hits.length ? `找到 ${res.total} 個，先列前 ${res.hits.length} 個；多打幾個字可以縮小範圍。`
        : `找到 ${res.total} 個`;
    fill(hits, res.hits.map(({ job }) => h('li', {},
      h('button', { type: 'button', class: 'job-hit', 'aria-current': job.id === current ? 'true' : null, onclick: () => pick(job.id) },
        h('b', { text: job.name }), h('span', { class: 'muted small', text: jobMeta(job) })))));
  }

  function open() {
    if (group.open && group.open !== api) group.open.close();
    group.open = api;
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    // 在點擊當下 focus：iPhone 只有使用者手勢裡的 focus 才會跳出鍵盤
    input.focus();
  }
  function close(focusButton = false) {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (group.open === api) group.open = null;
    if (focusButton) btn.focus();
  }
  function pick(v) {
    current = v;
    input.value = '';
    render();
    catSel.value = '';
    fill(jobSel, jobOptions(''));
    jobSel.disabled = true;
    paintButton();
    close(true);
    onPick(v);
  }

  btn.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    }
  });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => {
    composing = false;
    render();
  });
  input.addEventListener('input', render);
  // iPhone 鍵盤的「搜尋」鍵：收起鍵盤，讓下面的結果露出來（不自動選第一個，免得選錯）
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      input.blur();
    }
  });
  catSel.addEventListener('change', () => {
    fill(jobSel, jobOptions(catSel.value, exclude));
    jobSel.disabled = !catSel.value;
  });
  jobSel.addEventListener('change', () => {
    if (jobSel.value) pick(jobSel.value);
  });

  const api = { el: h('div', { class: 'job-picker' }, btn, panel), close };
  paintButton();
  return api;
}
