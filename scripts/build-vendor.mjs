// 重新產生 vendor/ 裡的第三方函式庫（全部 MIT，授權全文在 LICENSES/，來源登記在 NOTICE.md）。
// 用法：npm run build:vendor
// 為什麼要打包而不是直接用 CDN：GitHub Pages 是公開站、要離線可用；CDN 掛掉或被改版會讓 App 壞掉。
import { build } from 'esbuild';
import { readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const version = (name) => {
  const file = join(ROOT, 'node_modules', name, 'package.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).version : null;
};
const out = join(ROOT, 'vendor');

for (const f of ['lunar.js', 'iztro.js', 'shared-chunk.js', 'astronomy.min.js']) rmSync(join(out, f), { force: true });
mkdirSync(out, { recursive: true });

// 1) astronomy-engine：單檔，檔頭保留 MIT 授權
await build({
  entryPoints: [join(ROOT, 'node_modules/astronomy-engine/esm/astronomy.js')],
  outfile: join(out, 'astronomy.min.js'),
  bundle: true,
  minify: true,
  format: 'esm',
  legalComments: 'inline',
  logLevel: 'warning',
});

// 2) lunar + iztro：拆成兩個入口共用一個 chunk（農曆核心先載，紫微用到才載）
// 依實際安裝的套件列出（例如 i18next 26 起不再依賴 @babel/runtime）
const bundled = ['lunar-typescript', 'iztro', 'lunar-lite', 'i18next', 'dayjs', '@babel/runtime']
  .filter((name) => version(name))
  .map((name) => `${name} ${version(name)}`);
const banner = [
  '/*!',
  ` * 第三方函式庫（皆為 MIT）：${bundled.join('、')}。`,
  ' * 作者與授權全文見 repo 的 LICENSES/ 資料夾與 NOTICE.md。',
  ' */',
].join('\n');
await build({
  entryPoints: {
    lunar: join(ROOT, 'scripts/vendor-entries/lunar.mjs'),
    iztro: join(ROOT, 'scripts/vendor-entries/iztro.mjs'),
  },
  outdir: out,
  entryNames: '[name]',
  chunkNames: 'shared-[name]',
  bundle: true,
  splitting: true,
  minify: true,
  format: 'esm',
  legalComments: 'inline',
  banner: { js: banner },
  logLevel: 'warning',
});
console.log('vendor 已更新：astronomy.min.js、lunar.js、iztro.js、shared-chunk.js');
