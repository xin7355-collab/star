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

const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const listed = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);

test('所有前端 JS 都列在離線快取清單（漏列會造成離線時壞掉）', () => {
  const files = [...walk(join(ROOT, 'js')), join(ROOT, 'vendor/astronomy.min.js'), join(ROOT, 'css/app.css')]
    .map((p) => relative(ROOT, p).split('\\').join('/'));
  for (const f of files) assert.ok(listed.includes(f), `sw.js 缺少 ${f}`);
});

test('快取清單裡的檔案都存在', () => {
  for (const f of listed) assert.ok(existsSync(join(ROOT, f)), `找不到 ${f}`);
});

test('前端程式不含 API 金鑰', () => {
  const files = [...walk(join(ROOT, 'js')), join(ROOT, 'index.html')];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    assert.ok(!/sk-ant-[A-Za-z0-9_-]{10,}/.test(text), `${f} 疑似含 Anthropic 金鑰`);
    assert.ok(!/x-api-key/i.test(text), `${f} 不應直接帶 x-api-key`);
  }
});
