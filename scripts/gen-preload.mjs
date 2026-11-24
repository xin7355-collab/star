// 產生 index.html 裡的 <link rel="modulepreload"> 清單。
// 為什麼：ES module 要一層層 import 才知道下一個檔案（app.js → views → core → vendor），
// 手機網路每一層多一次往返；第一次開啟時 astronomy（最大的檔）在第 3 層才開始下載。
// 預先宣告整張靜態模組圖，瀏覽器就能一開始平行下載。
// 用法：node scripts/gen-preload.mjs（tests/pwa.test.js 會檢查清單是否與程式同步）
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const START = '<!-- modulepreload:start（node scripts/gen-preload.mjs 產生）-->';
const END = '<!-- modulepreload:end -->';

export function staticGraph(entry = 'js/app.js') {
  const depth = new Map();
  const walk = (file, d) => {
    if (depth.has(file) && depth.get(file) <= d) return;
    depth.set(file, d);
    const src = readFileSync(join(ROOT, file), 'utf8');
    // 一般寫法 import { a } from './x.js' 與壓縮過的 vendor 寫法 import{a}from"./x.js" 都要抓到
    for (const m of src.matchAll(/(?:^|;)\s*import\s*(?:[\w*{}\s,$]+?\s*from\s*)?["']([^"']+\.js)["']/gm)) {
      walk(normalize(join(dirname(file), m[1])).split('\\').join('/'), d + 1);
    }
  };
  walk(entry, 0);
  // 深的（較晚才會被發現的）排前面，最大的 vendor 檔最先開始下載
  return [...depth.entries()].filter(([f]) => f !== entry).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([f]) => f);
}

// 預設分頁「今日」一打開就會 import() 的模組（農曆、八字、時機、偏財）：雖然是動態載入，
// 但一定會用到，也一起預載。否則要等 app.js 跑完才開始下載，再一層層發現 lunar.js、shared-chunk.js
// （慢速 4G 每層多 150ms 以上）。其他分頁的模組維持用到才載入。
export const EAGER = ['js/core/bazi.js', 'js/core/timing.js', 'js/core/windfall.js', 'js/core/daily.js', 'js/core/calendar.js', 'js/core/numerology.js'];

export function preloadList() {
  const seen = new Set();
  const out = [];
  for (const f of [...staticGraph(), ...EAGER.flatMap((e) => [...staticGraph(e), e])]) {
    if (seen.has(f) || f === 'js/app.js') continue;
    seen.add(f);
    out.push(f);
  }
  // 順序：先放 app.js 的靜態模組圖（畫面骨架要的），再放「今日」會動態載入的模組。
  // 實測（CPU 降速 4 倍、慢速 4G）：農曆大檔排最前面時，骨架延後近 1 秒才出現（大檔搶走頻寬）
  return out;
}

export function preloadBlock() {
  const lines = preloadList().map((f) => `  <link rel="modulepreload" href="${f}">`);
  return [`  ${START}`, ...lines, `  ${END}`].join('\n');
}

if (process.argv[1] && relative(process.argv[1], fileURLToPath(import.meta.url)) === '') {
  const file = join(ROOT, 'index.html');
  const html = readFileSync(file, 'utf8');
  const block = preloadBlock();
  const next = html.includes(START)
    ? html.replace(new RegExp(`  ${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END}`), block)
    : html.replace('  <script type="module" src="js/app.js"></script>', `${block}\n  <script type="module" src="js/app.js"></script>`);
  writeFileSync(file, next);
  console.log(`index.html：${preloadList().length} 個 modulepreload`);
}
