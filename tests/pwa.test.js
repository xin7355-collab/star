import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const rel = (p) => relative(ROOT, p).split('\\').join('/');
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const assetsBlock = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];', sw.indexOf('const ASSETS')));
const listed = [...assetsBlock.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);

test('所有前端檔案都列在離線快取清單（漏列會造成離線時壞掉）', () => {
  const files = [...walk(join(ROOT, 'js')), ...walk(join(ROOT, 'vendor')), ...walk(join(ROOT, 'css'))]
    .map(rel)
    .filter((f) => !f.endsWith('.md') && !f.endsWith('.txt'));
  for (const f of files) assert.ok(listed.includes(f), `sw.js 缺少 ${f}`);
});

test('快取清單裡的檔案都存在', () => {
  for (const f of listed) assert.ok(existsSync(join(ROOT, f)), `找不到 ${f}`);
});

test('版本號三處一致（js/version.js、version.json、sw.js）', () => {
  const appVer = /APP_VER = '([^']+)'/.exec(readFileSync(join(ROOT, 'js/version.js'), 'utf8'))[1];
  const json = JSON.parse(readFileSync(join(ROOT, 'version.json'), 'utf8')).version;
  const swVer = /const VERSION = '([^']+)'/.exec(sw)[1];
  assert.equal(json, appVer);
  assert.equal(swVer, appVer);
});

test('version.json 不被 service worker 快取（否則偵測不到新版）', () => {
  assert.ok(!listed.includes('version.json'));
  assert.match(sw, /NETWORK_ONLY = \['version\.json'\]/);
});

test('前端程式不含 API 金鑰', () => {
  const files = [...walk(join(ROOT, 'js')), join(ROOT, 'index.html')];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    assert.ok(!/sk-ant-[A-Za-z0-9_-]{10,}/.test(text), `${f} 疑似含 Anthropic 金鑰`);
    assert.ok(!/x-api-key/i.test(text), `${f} 不應直接帶 x-api-key`);
  }
});

test('iOS 分享檔案不可同時帶 title（iOS 會只送文字、丟掉檔案）', () => {
  for (const f of walk(join(ROOT, 'js'))) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/navigator\.share\(([^)]*)\)/g)) {
      assert.ok(!/title/.test(m[1]), `${rel(f)}：navigator.share 帶了 title`);
    }
  }
});

test('網頁不被搜尋引擎收錄（公開 repo）', () => {
  assert.match(readFileSync(join(ROOT, 'index.html'), 'utf8'), /<meta name="robots" content="noindex, nofollow">/);
});

test('畫面文字不使用 innerHTML（避免注入）', () => {
  for (const f of walk(join(ROOT, 'js'))) {
    const text = readFileSync(f, 'utf8');
    assert.ok(!/\.innerHTML\s*=/.test(text), `${rel(f)} 使用了 innerHTML`);
  }
});

test('index.html 的 modulepreload 清單與實際 import 關係同步（改了 import 請跑 node scripts/gen-preload.mjs）', async () => {
  const { preloadBlock } = await import('../scripts/gen-preload.mjs');
  assert.ok(readFileSync(join(ROOT, 'index.html'), 'utf8').includes(preloadBlock()));
});
