// 分享圖卡（Canvas）用的顏色。Canvas 讀不到 CSS 變數，所以在這裡集中定義，
// 數值與 css/tokens.css 對應（主題「星夜鎏金」）；改主題時兩邊一起改。

export const POSTER = {
  bgTop: '#070b1a',
  bgBottom: '#2a1f6e',
  star: 'rgba(255,255,255,0.6)',
  panel: 'rgba(17,25,54,0.9)',
  text: '#f5f1e8',
  muted: '#aab2d6',
  body: '#e4dfd2',
  footer: '#8a93bd',
  accent: '#e9c46a',
  track: 'rgba(255,255,255,0.12)',
};

export const LEVEL = { high: '#5fe0b5', mid: '#f6c453', low: '#f59e63', poor: '#ff7a8a' };

// 塔羅牌面（SVG 漸層的色票；SVG 的 stop-color 不能用 CSS 變數，所以放這裡）：
// 金箔、牌背，以及四元素各自的底色（上、中、下）與光暈色
export const TAROT = {
  gold: [[0, '#fff3c9'], [0.28, '#e9c46a'], [0.52, '#b4842a'], [0.78, '#f6dc9b'], [1, '#c4912f']],
  back: [[0, '#1b1f57'], [0.5, '#2c2270'], [1, '#141845']],
  bg: {
    fire: ['#3d0f1d', '#6e1e22', '#2b0a14'],
    water: ['#0a1c40', '#114470', '#071430'],
    air: ['#1a1642', '#3a2c80', '#110e2e'],
    earth: ['#0e2a1d', '#2f4c1f', '#0a1c13'],
  },
  glow: { fire: '#ffb36b', water: '#7fd8ff', air: '#d4c1ff', earth: '#c4ea8f' },
};

// 掌紋照片描線（Canvas 讀不到 CSS 變數）：導引虛線、描線外圈陰影、校正點
export const PALM_CANVAS = {
  guide: 'rgba(255,255,255,0.75)',
  shadow: 'rgba(0,0,0,0.55)',
  marker: 'rgba(0,0,0,0.6)',
  markerLine: '#f6dc9b',
  fallbackLine: '#e9c46a',
  // 放大鏡：照片外面的底色、十字準星
  loupeBg: '#151a33',
  crosshair: '#ffffff',
};

// 練習用的範例手掌（畫在 Canvas 上、當成照片描）：背景、膚色、陰影、紋路。
// 刻意用接近真實照片的膚色，而不是主題色，練習時看到的才會跟拍自己的手一樣
export const PALM_PRACTICE = {
  bgTop: '#4b4f63',
  bgBottom: '#2f3242',
  skin: '#eec2a6',
  skinShade: '#d39b7f',
  crease: '#a86f5c',
  line: '#8d5443',
};

// AR 星空（Canvas）：永遠是夜空，不跟著淺色／深色主題變；天體顏色接近肉眼看到的顏色（火星偏紅、天王星偏青）
export const AR_SKY = {
  skyTop: '#050814',
  skyBottom: '#13203d',
  ground: 'rgba(14, 30, 22, 0.92)',
  groundOnCamera: 'rgba(8, 20, 14, 0.35)', // 開相機時地面只淡淡蓋一層，看得到實景
  horizon: 'rgba(160, 220, 190, 0.8)',
  direction: '#bfe8d2',
  ecliptic: 'rgba(245, 196, 81, 0.55)',
  sign: 'rgba(245, 220, 160, 0.85)',
  mine: '#f5c451',
  label: '#ffffff',
  labelDim: 'rgba(255, 255, 255, 0.6)',
  outline: 'rgba(0, 0, 0, 0.7)', // 字外框：星空和相機畫面上都看得清楚
  sunGlow: 'rgba(245, 196, 81, 0.25)',
  moonGlow: 'rgba(233, 237, 245, 0.18)',
  body: { Sun: '#f5c451', Moon: '#e9edf5', Mercury: '#b8b2a7', Venus: '#fff1c1', Mars: '#ff7a5c', Jupiter: '#f0d3a2', Saturn: '#e6c98f', Uranus: '#9fe3ef', Neptune: '#7fa8ff' },
};
