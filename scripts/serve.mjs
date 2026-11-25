// 本機預覽／測試用的靜態伺服器（不需安裝套件）：gzip 壓縮、正確的 MIME，接近 GitHub Pages 的行為。
// 用法：node scripts/serve.mjs [port]（預設 4173；0 = 自動挑），開 http://127.0.0.1:4173/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  // GitHub Pages 對 .wasm 回 application/wasm（瀏覽器才能邊下載邊編譯）；.task 是 MediaPipe 的模型包（zip）
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt']);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    // 擋掉 ../ 跳出網站根目錄、以及隱藏資料夾（.git、.claude）
    if (!file.startsWith(ROOT) || file.slice(ROOT.length).split(sep).some((part) => part.startsWith('.'))) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const ext = extname(file);
    let body = await readFile(file);
    const headers = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-cache' };
    if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      body = gzipSync(body);
      headers['content-encoding'] = 'gzip';
    }
    headers['content-length'] = body.length;
    res.writeHead(200, headers).end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  }
});
// PORT 給 0 時由系統挑空的連接埠，所以印實際的號碼（E2E 離線測試靠這行知道網址）
server.listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/`));
