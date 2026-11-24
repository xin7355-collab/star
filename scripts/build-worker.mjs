// 把 worker/worker.js 與 ai-model-router 打包成單一檔案 worker/dist/star-ai-worker.js，
// 方便在手機上整份貼進 Cloudflare 後台（後台編輯器不能 npm install）。
// 用法：npm run build:worker
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

await build({
  entryPoints: [join(ROOT, 'worker/worker.js')],
  outfile: join(ROOT, 'worker/dist/star-ai-worker.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: false,
  // router 的 selftest（只在 Node 用）才會 require fs/path；Worker 執行時不會走到，標成外部即可
  external: ['fs', 'path'],
  legalComments: 'inline',
  banner: {
    js: [
      '// 星座手帳 AI 短評 Worker（由 npm run build:worker 自動產生，請勿手改；原始碼在 worker/worker.js）',
      '// 部署：Cloudflare 後台 → 你的 Worker → Edit code → 整份貼上這個檔案 → Deploy。設定方式見 worker/README.md。',
      '// 內含 skl ai-model-router（model_router.js）。',
    ].join('\n'),
  },
  logLevel: 'warning',
});
console.log('已產生 worker/dist/star-ai-worker.js');
