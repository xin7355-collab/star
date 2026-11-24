// 生日表單元件（「我的」名單與「配對」共用）。
// ・國曆／農曆（含閏月）、民國／西元切換；農曆在送出時才載入農曆函式庫換算成國曆
// ・「我知道出生時間」勾選後才展開時間與時區（漸進揭露）
// ・日光節約重複時刻會在表單內請使用者選第一次或第二次

import { h, nextId, segmented } from './dom.js';
import { parseBirthDate, parseTime, daysInMonth, normalizeDigits, ROC_OFFSET } from '../core/date.js';
import { PLACE_GROUPS, PLACES, validateCoords } from '../core/places.js';
import { DEFAULT_TZ, listTimeZones, isValidTimeZone } from '../core/tz.js';

const EMPTY = {
  calendar: 'solar', era: 'roc', year: '', month: '', day: '', leap: false,
  knowTime: false, time: '', placeId: 'taipei', lat: '', lon: '', tz: DEFAULT_TZ, fold: null,
};
const LUNAR_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const LUNAR_DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

/**
 * @param {{initial?:object, withName?:boolean, withGender?:boolean, name?:string, gender?:string}} options
 *   initial 為存檔的原始值（records.js sanitizeRaw 的格式）
 */
export function createBirthForm({ initial = null, withName = false, withGender = false, name = '', gender = '' } = {}) {
  const v = { ...EMPTY, ...(initial || {}) };
  const ids = Object.fromEntries(['year', 'month', 'day', 'time', 'place', 'lat', 'lon', 'tz', 'name', 'know', 'leap'].map((k) => [k, nextId(k)]));

  let era = v.era === 'ad' ? 'ad' : 'roc';
  let calendar = v.calendar === 'lunar' ? 'lunar' : 'solar';
  let sex = gender === '男' || gender === '女' ? gender : '';
  let lastSolar = v.solar || null;

  const nameInput = withName ? h('input', { id: ids.name, type: 'text', maxlength: 20, placeholder: '例如：媽媽、小明', value: name, autocomplete: 'off' }) : null;
  const yearInput = h('input', { id: ids.year, type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 4, autocomplete: 'off', value: v.year ?? '' });
  const monthSelect = h('select', { id: ids.month });
  const daySelect = h('select', { id: ids.day });
  const leapBox = h('input', { id: ids.leap, type: 'checkbox', checked: !!v.leap });
  const leapLabel = h('label', { class: 'check', for: ids.leap }, leapBox, h('span', { text: '閏月' }));

  const updateYearHint = () => {
    yearInput.placeholder = era === 'roc' ? '例：89' : '例：2000';
  };

  function fillMonths() {
    const keep = monthSelect.value || String(v.month || '');
    monthSelect.replaceChildren(
      h('option', { value: '', text: '月' }),
      ...Array.from({ length: 12 }, (_, i) => h('option', { value: String(i + 1), text: calendar === 'lunar' ? LUNAR_MONTHS[i] : `${i + 1} 月` })),
    );
    if (keep) monthSelect.value = keep;
  }

  function refreshDays() {
    const keep = daySelect.value || String(v.day || '');
    let max = 31;
    if (calendar === 'lunar') {
      max = 30; // 大月 30 天、小月 29 天，送出時再精確檢查
    } else {
      const raw = parseInt(normalizeDigits(yearInput.value), 10);
      const y = Number.isFinite(raw) ? (era === 'roc' ? raw + ROC_OFFSET : raw) : 2000;
      const m = parseInt(monthSelect.value, 10);
      if (Number.isFinite(m) && y >= 1) max = daysInMonth(y, m);
    }
    daySelect.replaceChildren(
      h('option', { value: '', text: '日' }),
      ...Array.from({ length: max }, (_, i) => h('option', { value: String(i + 1), text: calendar === 'lunar' ? LUNAR_DAYS[i] : `${i + 1} 日` })),
    );
    if (keep && parseInt(keep, 10) <= max) daySelect.value = keep;
  }

  const calendarSeg = segmented({
    name: nextId('cal'),
    label: '國曆或農曆',
    value: calendar,
    options: [{ value: 'solar', label: '國曆生日' }, { value: 'lunar', label: '農曆生日' }],
    onChange: (next) => {
      calendar = next;
      leapLabel.hidden = calendar !== 'lunar';
      fillMonths();
      refreshDays();
    },
  });
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
  const genderSeg = withGender
    ? segmented({
      name: nextId('sex'),
      label: '性別',
      value: sex,
      options: [{ value: '男', label: '男' }, { value: '女', label: '女' }, { value: '', label: '不填' }],
      onChange: (next) => {
        sex = next;
      },
    })
    : null;

  updateYearHint();
  fillMonths();
  yearInput.addEventListener('input', refreshDays);
  monthSelect.addEventListener('change', refreshDays);
  refreshDays();
  if (v.day) daySelect.value = String(v.day);
  leapLabel.hidden = calendar !== 'lunar';

  // ── 出生時間（勾選才展開）
  const knowBox = h('input', { id: ids.know, type: 'checkbox', checked: !!v.knowTime });
  const timeInput = h('input', { id: ids.time, type: 'time', value: v.time || '' });

  const placeSelect = h(
    'select',
    { id: ids.place },
    ...PLACE_GROUPS.map((g) => h('optgroup', { label: g.label }, ...g.places.map((p) => h('option', { value: p.id, text: p.name })))),
    h('optgroup', { label: '其他' }, h('option', { value: 'custom', text: '自訂經緯度' }), h('option', { value: 'none', text: '不知道出生地（不算上升星座）' })),
  );
  placeSelect.value = PLACES[v.placeId] || v.placeId === 'custom' || v.placeId === 'none' ? v.placeId : 'taipei';

  const latInput = h('input', { id: ids.lat, type: 'text', inputmode: 'decimal', placeholder: '緯度，例：25.03', value: v.lat ?? '' });
  const lonInput = h('input', { id: ids.lon, type: 'text', inputmode: 'decimal', placeholder: '經度，例：121.56', value: v.lon ?? '' });
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
  [timeInput, tzSelect, yearInput, monthSelect, daySelect, leapBox].forEach((el) =>
    el.addEventListener('change', () => {
      fold = null;
      foldBox.hidden = true;
    }),
  );

  const el = h(
    'div',
    { class: 'birth-form' },
    nameInput ? field('名字', ids.name, nameInput) : null,
    genderSeg ? h('div', { class: 'field' }, h('span', { class: 'field-label', text: '性別（八字大運、紫微需要）' }), genderSeg) : null,
    calendarSeg,
    eraSeg,
    h('div', { class: 'row3' }, field('出生年', ids.year, yearInput), field('月', ids.month, monthSelect), field('日', ids.day, daySelect)),
    leapLabel,
    field('出生地（決定時區）', ids.place, placeSelect),
    placeHint,
    h('label', { class: 'check', for: ids.know }, knowBox, h('span', { text: '我知道出生時間（可算月亮、上升星座、八字時柱、紫微）' })),
    timeSection,
  );

  /** 讀取並驗證（農曆會載入函式庫換算）。回傳 {ok, value} 或 {ok:false, error} */
  async function read() {
    let date;
    if (calendar === 'lunar') {
      const rawYear = parseInt(normalizeDigits(yearInput.value), 10);
      if (!Number.isFinite(rawYear)) return { ok: false, error: '請輸入出生年份（數字）' };
      const year = era === 'roc' ? rawYear + ROC_OFFSET : rawYear;
      const month = parseInt(monthSelect.value, 10);
      const day = parseInt(daySelect.value, 10);
      if (!month) return { ok: false, error: '請選擇農曆月份' };
      if (!day) return { ok: false, error: '請選擇農曆日' };
      let lunarToSolar;
      try {
        ({ lunarToSolar } = await import('../core/calendar.js'));
      } catch {
        // 第一次開啟、service worker 還沒快取完就斷網時才會發生；已填的資料保留在表單上。
        // Chromium 允許重試失敗的 import()，其他瀏覽器未必，所以也給「重新開啟」的退路
        return { ok: false, error: '農曆換算元件載入失敗：請確認網路後再按一次；仍失敗請重新開啟 App。' };
      }
      const r = lunarToSolar({ year, month, day, isLeap: leapBox.checked });
      if (!r.ok) return r;
      date = r.value;
    } else {
      const d = parseBirthDate({ era, year: yearInput.value, month: monthSelect.value, day: daySelect.value });
      if (!d.ok) return d;
      date = d.value;
    }
    lastSolar = date;
    const value = {
      era, calendar, date, time: null, tz: DEFAULT_TZ, place: null, fold: null,
      name: nameInput ? nameInput.value.trim().slice(0, 20) : '', gender: sex,
    };
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

  /** 存檔用的原始值（read() 成功後呼叫，農曆會一併存換算好的國曆） */
  function toRaw() {
    return {
      calendar,
      era,
      year: normalizeDigits(yearInput.value),
      month: monthSelect.value,
      day: daySelect.value,
      leap: calendar === 'lunar' && leapBox.checked,
      knowTime: knowBox.checked,
      time: timeInput.value,
      placeId: placeSelect.value,
      lat: latInput.value,
      lon: lonInput.value,
      tz: tzSelect.value,
      fold,
      solar: calendar === 'lunar' ? lastSolar : null,
    };
  }

  return {
    el,
    read,
    toRaw,
    askFold,
    getName: () => (nameInput ? nameInput.value.trim().slice(0, 20) : ''),
    getGender: () => sex,
    focus: () => yearInput.focus(),
  };
}

function field(label, id, control) {
  return h('div', { class: 'field' }, h('label', { for: id, text: label }), control);
}

/** 由存檔的原始值直接解析（不建立畫面、不需農曆函式庫：農曆生日已存換算好的國曆） */
export function readRaw(raw) {
  if (!raw) return { ok: false, error: '沒有資料' };
  let date;
  if (raw.calendar === 'lunar') {
    if (!raw.solar) return { ok: false, error: '農曆生日缺少換算結果，請重新編輯儲存' };
    const d = parseBirthDate({ era: 'ad', year: raw.solar.y, month: raw.solar.m, day: raw.solar.d });
    if (!d.ok) return d;
    date = d.value;
  } else {
    const d = parseBirthDate({ era: raw.era, year: raw.year, month: raw.month, day: raw.day });
    if (!d.ok) return d;
    date = d.value;
  }
  const value = { era: raw.era, calendar: raw.calendar || 'solar', date, time: null, tz: DEFAULT_TZ, place: null, fold: raw.fold ?? null };
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

/** 一行文字描述（名單、紀錄用） */
export function describeRaw(raw) {
  if (!raw) return '';
  const y = parseInt(raw.year, 10);
  const yearText = raw.era === 'roc' ? `民國 ${y} 年` : `${y} 年`;
  const md = raw.calendar === 'lunar'
    ? `農曆${raw.leap ? '閏' : ''}${LUNAR_MONTHS[raw.month - 1] || ''}${LUNAR_DAYS[raw.day - 1] || ''}`
    : `${raw.month} 月 ${raw.day} 日`;
  return `${yearText} ${md}${raw.knowTime && raw.time ? ` ${raw.time}` : ''}`;
}
