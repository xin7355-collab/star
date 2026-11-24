// 本機紀錄（名單、查詢紀錄、設定）的資料規則與備份檔驗證。只存在使用者手機，不上傳。
// 這裡是純邏輯（不碰 localStorage／畫面），方便在 Node 測試；讀寫由 js/ui/records-store.js 負責。
// 匯入的備份檔視為不受信任的輸入：只收白名單欄位、檢查型別與長度、限制筆數，其餘一律丟棄。

export const SCHEMA = 1;
export const LIMITS = { people: 50, history: 300, name: 20, title: 60, summary: 400, detailBytes: 4000 };
export const HISTORY_TYPES = ['fortune', 'match', 'tarot', 'bazi', 'liunian', 'ziwei', 'maya', 'numerology', 'chenggu'];

const ID_RE = /^[a-z]{1,2}-[0-9a-f]{8,32}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function newId(prefix = 'p') {
  const buf = new Uint8Array(8);
  globalThis.crypto.getRandomValues(buf);
  return `${prefix}-${Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '');
const int = (v, min, max) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d{1,5}$/.test(v.trim()) ? parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const num = (v, min, max) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const isoTime = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null);

/**
 * 出生資料（表單原始值）白名單。calendar='lunar' 時另存換算好的國曆 solar，
 * 這樣 App 開啟時不必先載入農曆函式庫就能算星盤。
 */
export function sanitizeRaw(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const calendar = raw.calendar === 'lunar' ? 'lunar' : 'solar';
  const out = {
    calendar,
    era: raw.era === 'ad' ? 'ad' : 'roc',
    year: int(raw.year, -100, 2200),
    month: int(raw.month, 1, 12),
    day: int(raw.day, 1, 31),
    leap: calendar === 'lunar' ? raw.leap === true : false,
    knowTime: raw.knowTime === true,
    time: typeof raw.time === 'string' && TIME_RE.test(raw.time) ? raw.time : '',
    placeId: /^[a-z]{2,20}$/.test(String(raw.placeId || '')) ? raw.placeId : 'taipei',
    lat: num(raw.lat, -90, 90),
    lon: num(raw.lon, -180, 180),
    tz: typeof raw.tz === 'string' && /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/.test(raw.tz) && raw.tz.length <= 40 ? raw.tz : 'Asia/Taipei',
    fold: raw.fold === 0 || raw.fold === 1 ? raw.fold : null,
    solar: null,
  };
  if (out.year === null || out.month === null || out.day === null) return null;
  if (out.knowTime && !out.time) out.knowTime = false;
  if (calendar === 'lunar') {
    const s = raw.solar || {};
    const solar = { y: int(s.y, 1900, 2100), m: int(s.m, 1, 12), d: int(s.d, 1, 31) };
    if (solar.y === null || solar.m === null || solar.d === null) return null;
    out.solar = solar;
  }
  return out;
}

export function sanitizePerson(p) {
  if (!p || typeof p !== 'object') return null;
  const raw = sanitizeRaw(p.raw);
  if (!raw) return null;
  return {
    id: typeof p.id === 'string' && ID_RE.test(p.id) ? p.id : newId('p'),
    name: str(p.name, LIMITS.name) || '未命名',
    gender: p.gender === '男' || p.gender === '女' ? p.gender : '',
    self: p.self === true,
    raw,
    createdAt: isoTime(p.createdAt) || new Date().toISOString(),
  };
}

export function sanitizeHistory(e) {
  if (!e || typeof e !== 'object' || !HISTORY_TYPES.includes(e.type)) return null;
  let detail = null;
  if (e.detail !== undefined && e.detail !== null) {
    try {
      const json = JSON.stringify(e.detail);
      if (json && new TextEncoder().encode(json).length <= LIMITS.detailBytes) detail = JSON.parse(json);
    } catch {
      detail = null;
    }
  }
  const at = isoTime(e.at);
  if (!at) return null;
  return {
    id: typeof e.id === 'string' && ID_RE.test(e.id) ? e.id : newId('h'),
    type: e.type,
    at,
    personId: typeof e.personId === 'string' && ID_RE.test(e.personId) ? e.personId : null,
    title: str(e.title, LIMITS.title),
    summary: str(e.summary, LIMITS.summary),
    detail,
  };
}

export function sanitizeSettings(s) {
  const o = s && typeof s === 'object' ? s : {};
  return {
    activeId: typeof o.activeId === 'string' && ID_RE.test(o.activeId) ? o.activeId : null,
    sect: o.sect === 2 ? 2 : 1,
    solarTime: o.solarTime === 'true' ? 'true' : 'standard',
  };
}

/** 新增一筆紀錄到最前面，超過上限就丟掉最舊的 */
export function addHistory(list, entry, max = LIMITS.history) {
  const clean = sanitizeHistory({ at: new Date().toISOString(), ...entry });
  if (!clean) return list;
  return [clean, ...list.filter((x) => x.id !== clean.id)].slice(0, max);
}

/** 產生備份檔內容 */
export function exportData({ people, history, settings }) {
  return { app: 'star', schema: SCHEMA, exportedAt: new Date().toISOString(), people, history, settings };
}

/**
 * 驗證備份檔（不受信任的輸入）
 * @returns {{ok:true, value:{people,history,settings}, skipped:number} | {ok:false, error:string}}
 */
export function validateBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: '檔案內容不是星座手帳的備份' };
  if (data.app !== 'star') return { ok: false, error: '這不是星座手帳的備份檔' };
  if (data.schema !== SCHEMA) return { ok: false, error: `備份檔版本（${data.schema}）與目前 App 不相容` };
  const rawPeople = Array.isArray(data.people) ? data.people : [];
  const rawHistory = Array.isArray(data.history) ? data.history : [];
  if (rawPeople.length > LIMITS.people * 4 || rawHistory.length > LIMITS.history * 4) return { ok: false, error: '備份檔資料量異常，已拒絕匯入' };
  const people = [];
  const seen = new Set();
  let skipped = 0;
  for (const p of rawPeople) {
    const c = sanitizePerson(p);
    if (!c || seen.has(c.id)) {
      skipped += 1;
      continue;
    }
    seen.add(c.id);
    people.push(c);
  }
  const history = [];
  for (const h of rawHistory) {
    const c = sanitizeHistory(h);
    if (c) history.push(c);
    else skipped += 1;
  }
  return {
    ok: true,
    value: { people: people.slice(0, LIMITS.people), history: history.slice(0, LIMITS.history), settings: sanitizeSettings(data.settings) },
    skipped: skipped + Math.max(0, people.length - LIMITS.people) + Math.max(0, history.length - LIMITS.history),
  };
}

/** 合併匯入資料：同 id 以手機上現有的為準；紀錄依時間新到舊 */
export function mergeData(current, incoming) {
  const ids = new Set(current.people.map((p) => p.id));
  const people = [...current.people, ...incoming.people.filter((p) => !ids.has(p.id))].slice(0, LIMITS.people);
  const hids = new Set(current.history.map((h) => h.id));
  const history = [...current.history, ...incoming.history.filter((h) => !hids.has(h.id))]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, LIMITS.history);
  return { people, history, settings: current.settings };
}
