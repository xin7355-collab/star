// 時辰不確定模式的時辰候選和「大概時段」。
// 純資料、不 import 別的模組：records.js（App 一開就載入）要用它驗證存檔，不能把八字、紫微函式庫一起拉進來。

/**
 * 13 個候選：子時跨午夜，0–1 點（早子）和 23–24 點（晚子）在「23 點換日」的派別是不同的日柱，紫微也分成兩個序號，所以分開列。
 * 每個候選取該時辰的正中間（離換時辰的邊界一小時；早子、晚子取半小時），時鐘差幾十分鐘也不會跑到隔壁時辰。
 * h、mi 是「排盤用的標準時間」（日光節約時間另外換算）。
 */
export const HOUR_SLOTS = [
  { id: 'zi0', zhi: '子', name: '早子', label: '子時', range: '0–1 點', h: 0, mi: 30 },
  { id: 'chou', zhi: '丑', name: '丑', label: '丑時', range: '1–3 點', h: 2, mi: 0 },
  { id: 'yin', zhi: '寅', name: '寅', label: '寅時', range: '3–5 點', h: 4, mi: 0 },
  { id: 'mao', zhi: '卯', name: '卯', label: '卯時', range: '5–7 點', h: 6, mi: 0 },
  { id: 'chen', zhi: '辰', name: '辰', label: '辰時', range: '7–9 點', h: 8, mi: 0 },
  { id: 'si', zhi: '巳', name: '巳', label: '巳時', range: '9–11 點', h: 10, mi: 0 },
  { id: 'wu', zhi: '午', name: '午', label: '午時', range: '11–13 點', h: 12, mi: 0 },
  { id: 'wei', zhi: '未', name: '未', label: '未時', range: '13–15 點', h: 14, mi: 0 },
  { id: 'shen', zhi: '申', name: '申', label: '申時', range: '15–17 點', h: 16, mi: 0 },
  { id: 'you', zhi: '酉', name: '酉', label: '酉時', range: '17–19 點', h: 18, mi: 0 },
  { id: 'xu', zhi: '戌', name: '戌', label: '戌時', range: '19–21 點', h: 20, mi: 0 },
  { id: 'hai', zhi: '亥', name: '亥', label: '亥時', range: '21–23 點', h: 22, mi: 0 },
  { id: 'zi1', zhi: '子', name: '晚子', label: '子時', range: '23–24 點', h: 23, mi: 30 },
];

/** 排盤用的時（0–23）落在哪個候選 */
export function slotOfHour(h) {
  if (h === 23) return 'zi1';
  if (h === 0) return 'zi0';
  return HOUR_SLOTS[Math.floor((h + 1) / 2)].id;
}

/**
 * 家人記得的大概時段（「早上生的」「半夜生的」）：是真的資訊，可以縮小範圍、存起來；
 * 和「用個性去猜時辰」不同，不會挑出一張最像你的盤。
 */
export const HOUR_WINDOWS = [
  { id: '', label: '不知道（13 個時辰都看）', slots: HOUR_SLOTS.map((s) => s.id) },
  { id: 'midnight', label: '半夜（23 點到 3 點）', slots: ['zi0', 'chou', 'zi1'] },
  { id: 'dawn', label: '清晨（3 點到 7 點）', slots: ['yin', 'mao'] },
  { id: 'morning', label: '上午（7 點到 11 點）', slots: ['chen', 'si'] },
  { id: 'noon', label: '中午（11 點到 13 點）', slots: ['wu'] },
  { id: 'afternoon', label: '下午（13 點到 17 點）', slots: ['wei', 'shen'] },
  { id: 'evening', label: '傍晚（17 點到 19 點）', slots: ['you'] },
  { id: 'night', label: '晚上（19 點到 23 點）', slots: ['xu', 'hai'] },
  { id: 'day', label: '白天（7 點到 17 點）', slots: ['chen', 'si', 'wu', 'wei', 'shen'] },
  { id: 'dark', label: '夜裡（19 點到隔天 7 點）', slots: ['zi0', 'chou', 'yin', 'mao', 'xu', 'hai', 'zi1'] },
];

/** 存檔白名單：只收清單裡的代碼，不認得就當「不知道」 */
export const sanitizeHourWindow = (v) => (typeof v === 'string' && v && HOUR_WINDOWS.some((w) => w.id === v) ? v : '');
