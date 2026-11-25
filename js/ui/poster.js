// 分享圖卡：用 Canvas 畫成 1080×1350 圖片（IG 貼文比例）。
// iPhone：優先用系統分享面板（可存到相簿、傳 LINE / IG）；不支援時顯示圖片，長按即可儲存。
// 參考 sbti SharePoster 的思路（Canvas 繪製 + 中文逐字換行），程式為本專案自行撰寫。

import { h, fill } from './dom.js';
import { load, save } from './storage.js';
import { POSTER, LEVEL } from './palette.js';

const W = 1080;
const H = 1350;
const FONT = '"PingFang TC", "Heiti TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif';

const LEVEL_COLORS = LEVEL;

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
  bg.addColorStop(0, POSTER.bgTop);
  bg.addColorStop(1, POSTER.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 星點（固定位置，避免每次不同）
  ctx.fillStyle = POSTER.star;
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 337) % W;
    const y = (i * 521) % H;
    const r = (i % 3) + 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = POSTER.panel;
  roundRect(ctx, 60, 60, W - 120, H - 120, 40);
  ctx.fill();

  ctx.textBaseline = 'top';
  ctx.fillStyle = POSTER.text;
  ctx.font = `700 64px ${FONT}`;
  let y = 120;
  y = wrapText(ctx, spec.title, 120, y, W - 240, 80, 2);
  if (spec.subtitle) {
    ctx.fillStyle = POSTER.muted;
    ctx.font = `400 36px ${FONT}`;
    y = wrapText(ctx, spec.subtitle, 120, y + 6, W - 240, 48, 2);
  }
  y += 30;

  if (spec.big) {
    ctx.fillStyle = spec.bigScore !== undefined ? levelColor(spec.bigScore) : POSTER.accent;
    ctx.font = `800 160px ${FONT}`;
    ctx.fillText(spec.big, 120, y);
    if (spec.bigLabel) {
      ctx.fillStyle = POSTER.text;
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
    ctx.fillStyle = POSTER.text;
    ctx.font = `500 38px ${FONT}`;
    ctx.fillText(bar.label, 120, y);
    ctx.textAlign = 'right';
    ctx.fillText(String(bar.value), W - 120, y);
    ctx.textAlign = 'left';
    y += 54;
    ctx.fillStyle = POSTER.track;
    roundRect(ctx, 120, y, W - 240, 22, 11);
    ctx.fill();
    ctx.fillStyle = levelColor(bar.value);
    roundRect(ctx, 120, y, Math.max(22, ((W - 240) * bar.value) / 100), 22, 11);
    ctx.fill();
    y += 54;
  }

  ctx.fillStyle = POSTER.body;
  ctx.font = `400 36px ${FONT}`;
  for (const line of spec.lines || []) {
    if (y > H - 260) break;
    y = wrapText(ctx, line, 120, y + 8, W - 240, 52, 4);
  }

  ctx.fillStyle = POSTER.footer;
  ctx.font = `400 30px ${FONT}`;
  ctx.fillText(spec.footer || '星座手帳・僅供娛樂參考', 120, H - 150);
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('圖片產生失敗'))), 'image/png');
  });
}

/**
 * 圖卡：先在面板裡預覽，可以勾「匿名」（拿掉名字、出生時間、提問），再按分享或下載。
 * 為什麼不直接叫出系統分享面板：要讓使用者有機會選匿名，也先看到圖長什麼樣子；勾選會記住，下次預設一樣。
 * iOS 的 navigator.share 一定要在點擊當下呼叫，所以「分享」是面板裡的按鈕，不是打開面板時自動叫出。
 * @param {object} spec 圖卡內容
 * @param {{filename?:string, sheet:object, anonymize?:(spec:object)=>object, notify?:(msg:string)=>void}} opts
 */
export async function sharePoster(spec, { filename = 'star.png', sheet, anonymize = null, notify = null } = {}) {
  let anon = !!anonymize && load('shareAnon', false) === true;
  let blob = null;
  let url = null;
  const img = h('img', { class: 'sheet-img', alt: spec.title || '圖卡' });
  const link = h('a', { class: 'btn', download: filename, text: `下載 ${filename}` });
  async function paint() {
    const s = anon && anonymize ? anonymize(spec) : spec;
    blob = await canvasToBlob(renderPoster(s));
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    img.src = url;
    img.alt = s.title || '圖卡';
    link.href = url;
  }
  const probe = typeof File === 'function' ? new File([new Uint8Array(1)], filename, { type: 'image/png' }) : null;
  const canShare = !!(probe && navigator.canShare && navigator.canShare({ files: [probe] }));
  const shareBtn = canShare ? h('button', {
    type: 'button',
    class: 'btn primary',
    text: '分享／存到相簿',
    onclick: async () => {
      try {
        await navigator.share({ files: [new File([blob], filename, { type: 'image/png' })] });
      } catch (err) {
        if (!err || err.name !== 'AbortError') notify?.('分享沒有成功：可以長按圖片存到相簿，或按「下載」');
      }
    },
  }) : null;
  const anonBox = anonymize ? h('label', { class: 'check' },
    h('input', {
      type: 'checkbox',
      checked: anon,
      onchange: async (e) => {
        anon = e.target.checked;
        save('shareAnon', anon);
        await paint();
      },
    }),
    h('span', { text: '匿名：不顯示名字、出生時間和提問' })) : null;
  await paint();
  fill(sheet.body, img, anonBox, h('p', { class: 'hint center', text: '長按圖片也可以存到相簿或分享' }), h('div', { class: 'actions' }, shareBtn, link));
  sheet.open(() => {
    if (url) URL.revokeObjectURL(url);
  });
}

/**
 * 分享檔案（圖卡、備份檔共用）。
 * iOS 的 navigator.share 若同時帶 title，只會送出文字、檔案被丟掉，所以只傳 files。
 * 不支援檔案分享時：圖片顯示在面板中（可長按儲存）並附下載連結；其他檔案直接給下載連結。
 */
export async function shareFile(blob, filename, { sheet, previewAlt = '', hint = '' } = {}) {
  const file = typeof File === 'function' ? new File([blob], filename, { type: blob.type }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled'; // 使用者取消
    }
  }
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: filename, class: 'btn', text: `下載 ${filename}` });
  const parts = [];
  if (blob.type.startsWith('image/')) parts.push(h('img', { src: url, alt: previewAlt, class: 'sheet-img' }));
  if (hint) parts.push(h('p', { class: 'hint center', text: hint }));
  parts.push(h('div', { class: 'actions' }, link));
  fill(sheet.body, ...parts);
  sheet.open(() => URL.revokeObjectURL(url), blob.type.startsWith('image/') ? '分享圖卡' : '儲存檔案');
  return 'sheet';
}
