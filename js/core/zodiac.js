// 十二星座基本資料（台灣慣用名稱）與相位定義。

export const ELEMENTS = {
  fire: { name: '火象', short: '火' },
  earth: { name: '土象', short: '土' },
  air: { name: '風象', short: '風' },
  water: { name: '水象', short: '水' },
};

export const MODALITIES = {
  cardinal: '開創',
  fixed: '固定',
  mutable: '變動',
};

// 熱帶黃道：牡羊座從春分點（黃經 0°）開始，每座 30°。
export const SIGNS = [
  { id: 'aries', name: '牡羊座', short: '牡羊', glyph: '♈', element: 'fire', modality: 'cardinal', range: '3/21–4/19' },
  { id: 'taurus', name: '金牛座', short: '金牛', glyph: '♉', element: 'earth', modality: 'fixed', range: '4/20–5/20' },
  { id: 'gemini', name: '雙子座', short: '雙子', glyph: '♊', element: 'air', modality: 'mutable', range: '5/21–6/21' },
  { id: 'cancer', name: '巨蟹座', short: '巨蟹', glyph: '♋', element: 'water', modality: 'cardinal', range: '6/22–7/22' },
  { id: 'leo', name: '獅子座', short: '獅子', glyph: '♌', element: 'fire', modality: 'fixed', range: '7/23–8/22' },
  { id: 'virgo', name: '處女座', short: '處女', glyph: '♍', element: 'earth', modality: 'mutable', range: '8/23–9/22' },
  { id: 'libra', name: '天秤座', short: '天秤', glyph: '♎', element: 'air', modality: 'cardinal', range: '9/23–10/23' },
  { id: 'scorpio', name: '天蠍座', short: '天蠍', glyph: '♏', element: 'water', modality: 'fixed', range: '10/24–11/22' },
  { id: 'sagittarius', name: '射手座', short: '射手', glyph: '♐', element: 'fire', modality: 'mutable', range: '11/23–12/21' },
  { id: 'capricorn', name: '摩羯座', short: '摩羯', glyph: '♑', element: 'earth', modality: 'cardinal', range: '12/22–1/19' },
  { id: 'aquarius', name: '水瓶座', short: '水瓶', glyph: '♒', element: 'air', modality: 'fixed', range: '1/20–2/18' },
  { id: 'pisces', name: '雙魚座', short: '雙魚', glyph: '♓', element: 'water', modality: 'mutable', range: '2/19–3/20' },
];

export const SIGN_INDEX = Object.fromEntries(SIGNS.map((s, i) => [s.id, i]));

export function signOfLongitude(lon) {
  const norm = ((lon % 360) + 360) % 360;
  return Math.floor(norm / 30) % 12;
}

export function degreeInSign(lon) {
  const norm = ((lon % 360) + 360) % 360;
  return norm % 30;
}

/** 依星座間隔判斷的整宮相位（0~6 格） */
export const SIGN_ASPECTS = [
  { steps: 0, angle: 0, name: '合相', tone: 'strong' },
  { steps: 1, angle: 30, name: '半六分相', tone: 'mild' },
  { steps: 2, angle: 60, name: '六分相', tone: 'harmony' },
  { steps: 3, angle: 90, name: '四分相', tone: 'tension' },
  { steps: 4, angle: 120, name: '三分相', tone: 'harmony' },
  { steps: 5, angle: 150, name: '梅花相位', tone: 'tension' },
  { steps: 6, angle: 180, name: '對分相', tone: 'tension' },
];

/** 兩個星座相差幾格（0~6） */
export function signDistance(a, b) {
  const diff = (((b - a) % 12) + 12) % 12;
  return Math.min(diff, 12 - diff);
}

export function signAspect(a, b) {
  return SIGN_ASPECTS[signDistance(a, b)];
}

/** 度數相位（本命盤用），容許度參考 lilith-diviner astrology.py（MIT） */
export const DEGREE_ASPECTS = [
  { name: '合相', angle: 0, orb: 8 },
  { name: '六分相', angle: 60, orb: 4 },
  { name: '四分相', angle: 90, orb: 6 },
  { name: '三分相', angle: 120, orb: 6 },
  { name: '對分相', angle: 180, orb: 8 },
];

export function formatDegree(lon) {
  const deg = degreeInSign(lon);
  let whole = Math.floor(deg);
  let minutes = Math.round((deg - whole) * 60);
  if (minutes === 60) {
    whole += 1;
    minutes = 0;
  }
  return `${whole}°${String(minutes).padStart(2, '0')}′`;
}
