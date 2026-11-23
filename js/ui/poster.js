// 分享圖卡：用 Canvas 畫成 1080×1350 圖片（IG 貼文比例）。
// iPhone：優先用系統分享面板（可存到相簿、傳 LINE / IG）；不支援時顯示圖片，長按即可儲存。
// 參考 sbti SharePoster 的思路（Canvas 繪製 + 中文逐字換行），程式為本專案自行撰寫。

import { h } from './dom.js';

const W = 1080;
const H = 1350;
const FONT = '"PingFang TC", "Heiti TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif';

const LEVEL_COLORS = { high: '#4cd6a0', mid: '#ffd166', low: '#ff9f5a', poor: '#ff6b7a' };

function levelColor(score) {
  if (score >= 75) return LEVEL_COLORS.high;
  if (score >= 55) return LEVEL_COLORS.mid;
  if (score >= 40) return LEVEL_COLORS.low;
  return LEVEL_COLORS.poor;
}

function roundRect(ctx, x, y, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hh, r);
  ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 中文逐字換行，回傳畫完後的 y */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  let line = '';
  let lines = 0;
  for (const ch of String(text)) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines += 1;
      if (lines === maxLines) {
        ctx.fillText(`${line.slice(0, -1)}…`, x, y);
        return y + lineHeight;
      }
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

/**
 * @param {{title:string, subtitle?:string, big?:string, bigLabel?:string, bigScore?:number,
 *          bars?:{label:string, value:number}[], lines?:string[], footer?:string}} spec
 */
export function renderPoster(spec) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b1020');
  bg.addColorStop(1, '#25184a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 星點（固定位置，避免每次不同）
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 337) % W;
    const y = (i * 521) % H;
    const r = (i % 3) + 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(22,31,61,0.88)';
  roundRect(ctx, 60, 60, W - 120, H - 120, 40);
  ctx.fill();

  ctx.textBaseline = 'top';
  ctx.fillStyle = '#eef1ff';
  ctx.font = `700 64px ${FONT}`;
  let y = 120;
  y = wrapText(ctx, spec.title, 120, y, W - 240, 80, 2);
  if (spec.subtitle) {
    ctx.fillStyle = '#a6afd6';
    ctx.font = `400 36px ${FONT}`;
    y = wrapText(ctx, spec.subtitle, 120, y + 6, W - 240, 48, 2);
  }
  y += 30;

  if (spec.big) {
    ctx.fillStyle = spec.bigScore !== undefined ? levelColor(spec.bigScore) : '#8fb3ff';
    ctx.font = `800 160px ${FONT}`;
    ctx.fillText(spec.big, 120, y);
    if (spec.bigLabel) {
      ctx.fillStyle = '#eef1ff';
      ctx.font = `600 44px ${FONT}`;
      const bw = ctx.measureText(spec.big).width;
      ctx.font = `800 160px ${FONT}`;
      const bigW = ctx.measureText(spec.big).width;
      ctx.font = `600 44px ${FONT}`;
      ctx.fillText(spec.bigLabel, 120 + Math.max(bw, bigW) + 30, y + 90);
    }
    y += 200;
  }

  for (const bar of spec.bars || []) {
    ctx.fillStyle = '#eef1ff';
    ctx.font = `500 38px ${FONT}`;
    ctx.fillText(bar.label, 120, y);
    ctx.textAlign = 'right';
    ctx.fillText(String(bar.value), W - 120, y);
    ctx.textAlign = 'left';
    y += 54;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, 120, y, W - 240, 22, 11);
    ctx.fill();
    ctx.fillStyle = levelColor(bar.value);
    roundRect(ctx, 120, y, Math.max(22, ((W - 240) * bar.value) / 100), 22, 11);
    ctx.fill();
    y += 54;
  }

  ctx.fillStyle = '#d7dcf5';
  ctx.font = `400 36px ${FONT}`;
  for (const line of spec.lines || []) {
    if (y > H - 260) break;
    y = wrapText(ctx, line, 120, y + 8, W - 240, 52, 4);
  }

  ctx.fillStyle = '#7f89b8';
  ctx.font = `400 30px ${FONT}`;
  ctx.fillText(spec.footer || '星座手帳・僅供娛樂參考', 120, H - 150);
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('圖片產生失敗'))), 'image/png');
  });
}

/** 分享或顯示圖卡 */
export async function sharePoster(spec, { filename = 'star.png', sheet } = {}) {
  const canvas = renderPoster(spec);
  const blob = await canvasToBlob(canvas);
  const file = typeof File === 'function' ? new File([blob], filename, { type: 'image/png' }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: spec.title });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // 使用者取消
    }
  }
  const url = URL.createObjectURL(blob);
  const img = h('img', { src: url, alt: spec.title, class: 'sheet-img' });
  sheet.body.replaceChildren(img, h('p', { class: 'hint center', text: '長按圖片即可儲存到相簿或分享' }));
  sheet.open(() => URL.revokeObjectURL(url));
}
