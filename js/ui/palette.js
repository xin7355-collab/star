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
