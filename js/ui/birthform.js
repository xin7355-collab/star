// 生日表單元件（「我的」與「配對」共用）。
// ・民國／西元切換
// ・「我知道出生時間」勾選後才展開時間、出生地、時區（漸進揭露，參考 V1 雙胞胎欄位的做法）
// ・日光節約重複時刻會在表單內請使用者選第一次或第二次

import { h, nextId, segmented } from './dom.js';
import { parseBirthDate, parseTime, daysInMonth, normalizeDigits, ROC_OFFSET } from '../core/date.js';
import { PLACE_GROUPS, PLACES, validateCoords } from '../core/places.js';
import { DEFAULT_TZ, listTimeZones, isValidTimeZone } from '../core/tz.js';

const EMPTY = { era: 'roc', year: '', month: '', day: '', knowTime: false, time: '', placeId: 'taipei', lat: '', lon: '', tz: DEFAULT_TZ, fold: null, name: '' };

export function createBirthForm({ initial = null, withName = false, namePlaceholder = '名字（可不填）' } = {}) {
  const v = { ...EMPTY, ...(initial || {}) };
  const ids = { year: nextId('yr'), month: nextId('mo'), day: nextId('dy'), time: nextId('tm'), place: nextId('pl'), lat: nextId('la'), lon: nextId('lo'), tz: nextId('tz'), name: nextId('nm'), know: nextId('kt') };

  let era = v.era;
  const nameInput = withName ? h('input', { id: ids.name, type: 'text', maxlength: 20, placeholder: namePlaceholder, value: v.name, autocomplete: 'off' }) : null;
  const yearInput = h('input', { id: ids.year, type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 4, autocomplete: 'off', value: v.year });
  const monthSelect = h('select', { id: ids.month }, h('option', { value: '', text: '月' }), ...Array.from({ length: 12 }, (_, i) => h('option', { value: String(i + 1), text: `${i + 1} 月` })));
  const daySelect = h('select', { id: ids.day });
  monthSelect.value = String(v.month || '');

  const updateYearHint = () => {
    yearInput.placeholder = era === 'roc' ? '例：89' : '例：2000';
  };
  const eraSeg = segmented({
    name: nextId('era'),
    label: '年份格式',
    value: era,
    options: [{ value: 'roc', label: '民國' }, { value: 'ad', label: '西元' }],
    onChange: (next) => {
      // 切換時自動換算已輸入的年份
      const raw = parseInt(normalizeDigits(yearInput.value), 10);
      if (Number.isFinite(raw)) {
        if (era === 'roc' && next === 'ad') yearInput.value = String(raw + ROC_OFFSET);
        if (era === 'ad' && next === 'roc' && raw > ROC_OFFSET) yearInput.value = String(raw - ROC_OFFSET);
      }
      era = next;
      updateYearHint();
      refreshDays();
    },
  });
  updateYearHint();

  function refreshDays() {
    const keep = daySelect.value || String(v.day || '');
    const raw = parseInt(normalizeDigits(yearInput.value), 10);
    const y = Number.isFinite(raw) ? (era === 'roc' ? raw + ROC_OFFSET : raw) : 2000;
    const m = parseInt(monthSelect.value, 10);
    const max = Number.isFinite(m) && y >= 1 ? daysInMonth(y, m) : 31;
    daySelect.replaceChildren(h('option', { value: '', text: '日' }), ...Array.from({ length: max }, (_, i) => h('option', { value: String(i + 1), text: `${i + 1} 日` })));
    if (keep && parseInt(keep, 10) <= max) daySelect.value = keep;
  }
  yearInput.addEventListener('input', refreshDays);
  monthSelect.addEventListener('change', refreshDays);
  refreshDays();
  if (v.day) daySelect.value = String(v.day);

  // ── 出生時間（勾選才展開）
  const knowBox = h('input', { id: ids.know, type: 'checkbox', checked: !!v.knowTime });
  const timeInput = h('input', { id: ids.time, type: 'time', value: v.time || '' });

  const placeSelect = h(
    'select',
    { id: ids.place },
    ...PLACE_GROUPS.map((g) => h('optgroup', { label: g.label }, ...g.places.map((p) => h('option', { value: p.id, text: p.name })))),
    h('optgroup', { label: '其他' }, h('option', { value: 'custom', text: '自訂經緯度' }), h('option', { value: 'none', text: '不知道出生地（不算上升星座）' })),
  );
  placeSelect.value = v.placeId || 'taipei';

  const latInput = h('input', { id: ids.lat, type: 'text', inputmode: 'decimal', placeholder: '緯度，例：25.03', value: v.lat });
  const lonInput = h('input', { id: ids.lon, type: 'text', inputmode: 'decimal', placeholder: '經度，例：121.56', value: v.lon });
  const customBox = h('div', { class: 'row2' }, field('緯度（北緯為正）', ids.lat, latInput), field('經度（東經為正）', ids.lon, lonInput));

  const placeHint = h('p', { class: 'hint', text: '自訂座標需要出生時間才用得到；請勾選下方「我知道出生時間」。' });
  const tzSelect = h('select', { id: ids.tz }, ...listTimeZones().map((z) => h('option', { value: z, text: z })));
  tzSelect.value = isValidTimeZone(v.tz) ? v.tz : DEFAULT_TZ;

  const foldBox = h('div', { class: 'fold-box', hidden: true });
  let fold = v.fold === 0 || v.fold === 1 ? v.fold : null;

  const timeSection = h(
    'div',
    { class: 'time-section' },
    field('出生時間', ids.time, timeInput),
    customBox,
    field('時區（選出生地會自動帶入）', ids.tz, tzSelect),
    h('p', { class: 'hint', text: '時區包含歷史日光節約時間，例如台灣 1945–1979 年夏季是 UTC+9，系統會自動換算。' }),
    foldBox,
  );

  const syncPlace = () => {
    const p = PLACES[placeSelect.value];
    customBox.hidden = placeSelect.value !== 'custom';
    placeHint.hidden = placeSelect.value !== 'custom' || knowBox.checked;
    if (p) tzSelect.value = p.tz;
  };
  placeSelect.addEventListener('change', () => {
    fold = null;
    foldBox.hidden = true;
    syncPlace();
  });
  syncPlace();
  if (v.placeId === 'custom' || v.placeId === 'none') tzSelect.value = isValidTimeZone(v.tz) ? v.tz : DEFAULT_TZ;

  const syncKnow = () => {
    timeSection.hidden = !knowBox.checked;
    placeHint.hidden = placeSelect.value !== 'custom' || knowBox.checked;
  };
  knowBox.addEventListener('change', syncKnow);
  syncKnow();
  [timeInput, tzSelect, yearInput, monthSelect, daySelect].forEach((el) =>
    el.addEventListener('change', () => {
      fold = null;
      foldBox.hidden = true;
    }),
  );

  const el = h(
    'div',
    { class: 'birth-form' },
    nameInput ? field('名字', ids.name, nameInput) : null,
    eraSeg,
    h('div', { class: 'row3' }, field('出生年', ids.year, yearInput), field('月', ids.month, monthSelect), field('日', ids.day, daySelect)),
    field('出生地（決定時區）', ids.place, placeSelect),
    placeHint,
    h('label', { class: 'check', for: ids.know }, knowBox, h('span', { text: '我知道出生時間（可算月亮精確位置、上升星座）' })),
    timeSection,
  );

  /** 讀取並驗證。回傳 {ok, value} 或 {ok:false, error} */
  function read() {
    const d = parseBirthDate({ era, year: yearInput.value, month: monthSelect.value, day: daySelect.value });
    if (!d.ok) return d;
    const value = { era, date: d.value, time: null, tz: DEFAULT_TZ, place: null, fold: null, name: nameInput ? nameInput.value.trim().slice(0, 20) : '' };
    if (knowBox.checked) {
      const t = parseTime(timeInput.value);
      if (!t.ok) return t;
      value.time = t.value;
      value.tz = tzSelect.value;
      value.fold = fold;
      if (placeSelect.value === 'custom') {
        const c = validateCoords(latInput.value, lonInput.value);
        if (!c.ok) return c;
        value.place = { ...c.value, name: '自訂座標' };
      } else if (placeSelect.value !== 'none') {
        const p = PLACES[placeSelect.value];
        value.place = { lat: p.lat, lon: p.lon, name: p.name };
      }
    } else {
      // 沒填時間：仍用出生地的時區決定「出生那一天」的起訖
      const p = PLACES[placeSelect.value];
      value.tz = p ? p.tz : tzSelect.value;
    }
    return { ok: true, value };
  }

  /** 讓使用者選擇日光節約重複時刻 */
  function askFold(options, onPick) {
    foldBox.replaceChildren(
      h('p', { class: 'warn', text: '這個時刻因日光節約時間結束出現兩次，請選擇：' }),
      ...options.map((opt) =>
        h('button', {
          type: 'button',
          class: 'btn small',
          text: opt.label,
          onclick: () => {
            fold = opt.fold;
            foldBox.hidden = true;
            onPick?.();
          },
        }),
      ),
    );
    foldBox.hidden = false;
  }

  /** 存檔用的原始值 */
  function toRaw() {
    return {
      era,
      year: normalizeDigits(yearInput.value),
      month: monthSelect.value,
      day: daySelect.value,
      knowTime: knowBox.checked,
      time: timeInput.value,
      placeId: placeSelect.value,
      lat: latInput.value,
      lon: lonInput.value,
      tz: tzSelect.value,
      fold,
      name: nameInput ? nameInput.value.trim().slice(0, 20) : '',
    };
  }

  return { el, read, toRaw, askFold, focus: () => yearInput.focus() };
}

function field(label, id, control) {
  return h('div', { class: 'field' }, h('label', { for: id, text: label }), control);
}

/** 由存檔的原始值直接解析（不建立畫面） */
export function readRaw(raw) {
  if (!raw) return { ok: false, error: '沒有資料' };
  const d = parseBirthDate({ era: raw.era, year: raw.year, month: raw.month, day: raw.day });
  if (!d.ok) return d;
  const value = { era: raw.era, date: d.value, time: null, tz: DEFAULT_TZ, place: null, fold: raw.fold ?? null, name: raw.name || '' };
  if (raw.knowTime) {
    const t = parseTime(raw.time);
    if (!t.ok) return t;
    value.time = t.value;
    value.tz = isValidTimeZone(raw.tz) ? raw.tz : DEFAULT_TZ;
    if (raw.placeId === 'custom') {
      const c = validateCoords(raw.lat, raw.lon);
      if (c.ok) value.place = { ...c.value, name: '自訂座標' };
    } else if (PLACES[raw.placeId]) {
      const p = PLACES[raw.placeId];
      value.place = { lat: p.lat, lon: p.lon, name: p.name };
    }
  } else {
    const p = PLACES[raw.placeId];
    value.tz = p ? p.tz : isValidTimeZone(raw.tz) ? raw.tz : DEFAULT_TZ;
  }
  return { ok: true, value };
}
