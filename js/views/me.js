// 「我的」：目前查看的人＋本命星盤、家人朋友名單、查詢紀錄、備份與隱私。
// 所有資料只存在這支手機；備份檔由使用者自己匯出保存。

import { h, clear } from '../ui/dom.js';
import { createBirthForm, describeRaw } from '../ui/birthform.js';
import { buildNatal, describePlacement, describeBirth } from '../core/natal.js';
import { SIGNS, ELEMENTS, MODALITIES, formatDegree } from '../core/zodiac.js';
import { BODY_NAME } from '../core/astro.js';
import { newId } from '../core/records.js';

const HISTORY_SHOWN = 50;
const TYPE_LABEL = {
  fortune: '運勢', match: '配對', tarot: '塔羅', bazi: '八字', liunian: '流年', ziwei: '紫微', maya: '瑪雅', numerology: '生命靈數', chenggu: '稱骨',
};

export function mountMe(root, ctx) {
  let editing = null; // null | { id?:string, self?:boolean }

  function render() {
    clear(root);
    const people = ctx.getPeople();
    const active = ctx.getActive();
    if (!people.length) {
      root.append(renderPersonForm({ self: true }, true));
      root.append(renderBackup());
      return;
    }
    if (editing) root.append(renderPersonForm(editing, false));
    if (active) root.append(renderActive(active));
    root.append(renderPeople(people, active), renderHistory(), renderBackup());
  }

  // ── 新增／編輯一個人
  function renderPersonForm(target, first) {
    const person = target.id ? ctx.getPeople().find((p) => p.id === target.id) : null;
    const form = createBirthForm({
      initial: person ? person.raw : null,
      withName: true,
      withGender: true,
      name: person ? person.name : first ? '我' : '',
      gender: person ? person.gender : '',
    });
    const saveBtn = h('button', { type: 'button', class: 'btn primary', text: '計算並儲存' });
    const submit = async () => {
      if (saveBtn.disabled) return;
      saveBtn.disabled = true;
      saveBtn.textContent = '計算中…';
      try {
        await save();
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '計算並儲存';
      }
    };
    saveBtn.addEventListener('click', submit);
    const save = async () => {
      const r = await form.read();
      if (!r.ok) return ctx.toast(r.error);
      const natal = buildNatal(r.value);
      if (!natal.ok) {
        if (natal.needFold) form.askFold(natal.options, submit);
        else ctx.toast(natal.error);
        return;
      }
      const saved = ctx.savePerson(
        { id: person ? person.id : newId('p'), name: form.getName() || '未命名', gender: form.getGender(), self: person ? person.self : !!target.self, raw: form.toRaw(), createdAt: person?.createdAt },
        // 只有第一次輸入、或編輯正在查看的人時才切換；新增家人不搶走「我」的位置（運勢頁預設看自己）
        { activate: first || (person && person.id === ctx.getActive()?.id) },
      );
      if (!saved.ok) return ctx.toast(saved.error);
      editing = null;
      ctx.toast('已儲存在這支手機');
      render();
    };
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: first ? '輸入你的生日' : person ? `編輯：${person.name}` : '新增家人朋友' }),
      h('p', { class: 'hint', text: '資料只存在這支手機，不會上傳。' }),
      form.el,
      h(
        'div',
        { class: 'actions' },
        saveBtn,
        first ? null : h('button', { type: 'button', class: 'btn ghost', text: '取消', onclick: () => { editing = null; render(); } }),
      ),
    );
  }

  // ── 目前查看的人
  function renderActive(person) {
    const natal = ctx.natalOf(person);
    const people = ctx.getPeople();
    const switcher = h(
      'select',
      { 'aria-label': '切換查看的人', onchange: (e) => ctx.setActive(e.target.value) },
      people.map((p) => h('option', { value: p.id, text: p.self ? `${p.name}（我）` : p.name })),
    );
    switcher.value = person.id;
    const head = h('div', { class: 'person-switch' }, h('span', { class: 'muted', text: '正在看' }), switcher);
    if (!natal) {
      return h('section', { class: 'card' }, head, h('p', { class: 'warn', text: '這個人的生日資料不完整，請按「編輯」重新儲存。' }));
    }
    const sun = SIGNS[natal.sun.sign];
    const placements = [describePlacement('太陽', natal.sun), describePlacement('月亮', natal.moon)];
    if (natal.rising !== undefined) placements.push(`上升：${SIGNS[natal.rising].name}`);
    const lunarLine = h('li', { class: 'muted', text: '農曆：計算中…' });
    import('../core/calendar.js')
      .then(({ solarToLunar }) => {
        const l = solarToLunar(natal.date);
        lunarLine.textContent = `農曆：${l.yearGanZhi}年 ${l.monthName}${l.dayName}・生肖${l.zodiac}`;
        lunarLine.className = '';
      })
      .catch(() => {
        lunarLine.textContent = '農曆：載入失敗，請檢查網路後重新開啟';
      });

    const notes = [];
    if (natal.cusp) notes.push(natal.cusp);
    if (!natal.sun.certain) notes.push('出生那天太陽換星座；補上出生時間就能確定是哪一座。');
    if (natal.mode === 'date-only' && !natal.moon.certain) notes.push('月亮在出生當天換星座，補上出生時間可確定。');
    notes.push(...natal.warnings);

    return h(
      'section',
      { class: 'card result' },
      head,
      h(
        'div',
        { class: 'hero' },
        h('div', { class: 'glyph', 'aria-hidden': 'true', text: sun.glyph }),
        h(
          'div',
          {},
          h('div', { class: 'hero-title', text: natal.sun.certain ? sun.name : `${SIGNS[natal.sun.options[0]].name} / ${SIGNS[natal.sun.options[1]].name}` }),
          h('div', { class: 'hero-sub', text: `${ELEMENTS[sun.element].name}・${MODALITIES[sun.modality]}星座・${sun.range}` }),
        ),
      ),
      h('ul', { class: 'plain' }, placements.map((t) => h('li', { text: t })), lunarLine),
      notes.length ? h('details', { class: 'more' }, h('summary', { text: `說明（${notes.length}）` }), notes.map((t) => h('p', { class: 'hint', text: t }))) : null,
      natal.mode === 'timed' ? renderChart(natal) : renderRanges(natal),
      natal.mode === 'timed' && natal.aspects.length ? renderAspects(natal) : null,
      h(
        'div',
        { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', text: '看運勢', onclick: () => ctx.go('fortune') }),
        h('button', { type: 'button', class: 'btn', text: '命理', onclick: () => ctx.go('destiny') }),
        h('button', {
          type: 'button',
          class: 'btn',
          text: '存成圖卡',
          onclick: () => ctx.share({
            title: `${person.name}的星盤：${natal.sun.certain ? sun.name : '太陽換座日'}`,
            subtitle: describeBirth(natal, person.raw.era),
            big: sun.glyph,
            bigLabel: natal.sun.certain ? sun.name : '',
            lines: placements,
          }, 'my-chart.png'),
        }),
      ),
    );
  }

  function renderChart(natal) {
    const rows = Object.values(natal.positions).map((p) =>
      h('tr', {}, h('th', { scope: 'row', text: p.name }), h('td', { text: `${SIGNS[p.sign].short} ${formatDegree(p.lon)}` }), h('td', { text: p.house ? `${p.house} 宮` : '—' }), h('td', { text: p.retrograde ? '逆行' : '' })),
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
    const items = Object.values(natal.ranges).map((r) => h('li', { text: `${r.name}：${r.signs.map((s) => SIGNS[s].name).join(' → ')}` }));
    return h('details', { class: 'more' }, h('summary', { text: '出生當天各行星的可能星座' }), h('ul', { class: 'plain' }, items));
  }

  function renderAspects(natal) {
    const items = natal.aspects.slice(0, 12).map((a) => h('li', { text: `${BODY_NAME[a.a]} ${a.name} ${BODY_NAME[a.b]}（容許度 ${a.orb.toFixed(1)}°）` }));
    return h('details', { class: 'more' }, h('summary', { text: `主要相位（${natal.aspects.length}）` }), h('ul', { class: 'plain' }, items));
  }

  // ── 名單
  function renderPeople(people, active) {
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: `名單（${people.length}）` }),
      h(
        'ul',
        { class: 'people' },
        people.map((p) =>
          h(
            'li',
            { class: p.id === active?.id ? 'active' : '' },
            h('div', { class: 'people-main' }, h('b', { text: p.name }), p.self ? h('span', { class: 'badge', text: '我' }) : null, p.gender ? h('span', { class: 'badge alt', text: p.gender }) : null, h('div', { class: 'muted small', text: describeRaw(p.raw) })),
            h(
              'div',
              { class: 'people-actions' },
              p.id === active?.id ? h('span', { class: 'muted small', text: '查看中' }) : h('button', { type: 'button', class: 'link', text: '查看', onclick: () => ctx.setActive(p.id) }),
              h('button', { type: 'button', class: 'link', text: '編輯', onclick: () => { editing = { id: p.id }; render(); window.scrollTo(0, 0); } }),
              h('button', {
                type: 'button',
                class: 'link danger',
                text: '刪除',
                onclick: () => {
                  if (window.confirm(`確定要從這支手機刪除「${p.name}」？`)) ctx.deletePerson(p.id);
                },
              }),
            ),
          ),
        ),
      ),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', text: '＋ 新增家人朋友', onclick: () => { editing = {}; render(); window.scrollTo(0, 0); } })),
    );
  }

  // ── 紀錄
  function renderHistory() {
    const list = ctx.getHistory();
    const people = Object.fromEntries(ctx.getPeople().map((p) => [p.id, p.name]));
    const fmt = (iso) => {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    return h(
      'section',
      { class: 'card' },
      h(
        'details',
        { class: 'more first' },
        h('summary', { text: `查詢紀錄（${list.length}）` }),
        list.length
          ? h(
            'ul',
            { class: 'history' },
            list.slice(0, HISTORY_SHOWN).map((e) =>
              h(
                'li',
                {},
                h(
                  'details',
                  {},
                  h('summary', {}, h('span', { class: 'badge', text: TYPE_LABEL[e.type] || e.type }), h('span', { text: ` ${e.title || ''}` }), h('span', { class: 'muted small', text: ` ${fmt(e.at)}${e.personId && people[e.personId] ? `・${people[e.personId]}` : ''}` })),
                  e.summary ? h('p', { text: e.summary }) : null,
                  h('button', { type: 'button', class: 'link danger', text: '刪除這筆', onclick: () => ctx.deleteHistory(e.id) }),
                ),
              ),
            ),
          )
          : h('p', { class: 'hint', text: '塔羅抽牌、配對結果，以及你在命理頁按「存到紀錄」的內容，會保存在這裡。' }),
        // 最多存 300 筆但只列最近 50 筆（一次畫太多在舊手機會卡）；要講清楚，不然使用者以為舊紀錄不見了
        list.length > HISTORY_SHOWN ? h('p', { class: 'hint', text: `只列出最近 ${HISTORY_SHOWN} 筆；全部 ${list.length} 筆都在「匯出備份檔」裡。` }) : null,
        list.length
          ? h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn ghost', text: '清除全部紀錄', onclick: () => { if (window.confirm('確定清除全部查詢紀錄？')) ctx.clearHistory(); } }))
          : null,
      ),
    );
  }

  // ── 備份與隱私
  function renderBackup() {
    const status = h('p', { class: 'hint', text: '檢查儲存狀態中…' });
    const storage = navigator.storage;
    if (storage && storage.persisted) {
      storage.persisted().then((p) => {
        status.textContent = p ? '這支手機已允許長期保存本 App 的資料。' : '瀏覽器在空間不足或久未使用時，可能清除網站資料。建議加入主畫面並定期匯出備份。';
      }).catch(() => { status.textContent = '無法確認儲存狀態；建議定期匯出備份。'; });
    } else {
      status.textContent = '建議加入主畫面並定期匯出備份。';
    }
    // 檔案選擇器藏起來、不進 Tab 順序，由可見的「匯入備份檔」按鈕觸發（避免 1×1 的隱形可聚焦目標）
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', tabindex: '-1', 'aria-label': '選擇備份檔' });
    const importBox = h('div', { class: 'import-box', hidden: true });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      if (file.size > 1024 * 1024) return ctx.toast('備份檔太大（超過 1MB），已拒絕匯入');
      const text = await file.text();
      importBox.replaceChildren(
        h('p', { text: `要怎麼匯入「${file.name}」？` }),
        h(
          'div',
          { class: 'actions' },
          h('button', { type: 'button', class: 'btn', text: '合併（保留手機上的）', onclick: () => doImport(text, 'merge') }),
          h('button', { type: 'button', class: 'btn ghost', text: '全部取代', onclick: () => { if (window.confirm('手機上現有的名單與紀錄會被備份檔取代，確定？')) doImport(text, 'replace'); } }),
          h('button', { type: 'button', class: 'link', text: '取消', onclick: () => { importBox.hidden = true; } }),
        ),
      );
      importBox.hidden = false;
    });
    function doImport(text, mode) {
      const r = ctx.importBackup(text, mode);
      importBox.hidden = true;
      if (!r.ok) return ctx.toast(r.error);
      ctx.toast(`已匯入：名單 ${r.counts.people} 人、紀錄 ${r.counts.history} 筆${r.skipped ? `；略過 ${r.skipped} 筆格式不正確的資料` : ''}`);
    }
    return h(
      'section',
      { class: 'card' },
      h(
        'details',
        { class: 'more first' },
        h('summary', { text: '備份與隱私' }),
        h('p', { text: '名單、紀錄、設定都只存在這支手機，App 不會上傳。換手機或怕資料被清除時，請匯出備份檔自己保存。' }),
        status,
        h(
          'div',
          { class: 'actions' },
          h('button', { type: 'button', class: 'btn', text: '匯出備份檔', onclick: () => ctx.exportBackup() }),
          h('button', { type: 'button', class: 'btn', text: '匯入備份檔', onclick: () => fileInput.click() }),
          storage && storage.persist ? h('button', { type: 'button', class: 'btn ghost', text: '請瀏覽器長期保存', onclick: () => storage.persist().then((ok) => ctx.toast(ok ? '已允許長期保存' : '瀏覽器沒有同意，請加入主畫面並定期備份')).catch(() => ctx.toast('這個瀏覽器不支援')) }) : null,
        ),
        fileInput,
        importBox,
        h('div', { class: 'actions' }, h('button', {
          type: 'button',
          class: 'link danger',
          text: '清除這支手機上的全部資料',
          onclick: () => {
            if (window.confirm('名單、紀錄、設定都會刪除且無法復原（除非你有備份檔），確定？')) {
              ctx.wipeAll();
              ctx.toast('已清除');
            }
          },
        })),
      ),
    );
  }

  ctx.onProfile(render);
  ctx.onHistory(render);
  render();
}
