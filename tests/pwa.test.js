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

// 掌紋自動定位的辨識模型（約 22MB）故意不預先快取：按了才下載，由 sw.js 存進獨立快取（見下一個測試）
const LAZY = 'vendor/mediapipe/';

test('所有前端檔案都列在離線快取清單（漏列會造成離線時壞掉）', () => {
  const files = [...walk(join(ROOT, 'js')), ...walk(join(ROOT, 'vendor')), ...walk(join(ROOT, 'css'))]
    .map(rel)
    .filter((f) => !f.endsWith('.md') && !f.endsWith('.txt') && !f.startsWith(LAZY));
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

test('畫面程式不直接用 replaceChildren（它會把 null 印成文字「null」，請改用 dom.js 的 fill）', () => {
  for (const f of walk(join(ROOT, 'js'))) {
    const code = readFileSync(f, 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\.replaceChildren\(/.test(code), `${rel(f)} 直接用了 replaceChildren`);
  }
});

test('index.html 的 modulepreload 清單與實際 import 關係同步（改了 import 請跑 node scripts/gen-preload.mjs）', async () => {
  const { preloadBlock } = await import('../scripts/gen-preload.mjs');
  assert.ok(readFileSync(join(ROOT, 'index.html'), 'utf8').includes(preloadBlock()));
});

test('行事曆檔的快取名稱與網址：sw.js 和 js/ui/ics-export.js 一致，且換版時不會被清掉', () => {
  const ui = readFileSync(join(ROOT, 'js/ui/ics-export.js'), 'utf8');
  const uiCache = /ICS_CACHE = '([^']+)'/.exec(ui)[1];
  const uiPath = /ICS_PATH = '([^']+)'/.exec(ui)[1];
  assert.equal(/const ICS_CACHE = '([^']+)'/.exec(sw)[1], uiCache);
  assert.equal(/const ICS_PATH = '([^']+)'/.exec(sw)[1], `/${uiPath}`);
  assert.match(sw, /k !== VERSION && k !== ICS_CACHE/);
});

test('辨識模型（vendor/mediapipe）：不預先快取、有獨立快取且換版不清、快取名稱跟著 MediaPipe 版本、已關掉使用量回報、檔案大小和進度計算一致', () => {
  assert.ok(!listed.some((f) => f.startsWith(LAZY)), '大檔不能放進預先快取，每個人安裝都要多抓 22MB');
  const mpCache = /const MP_CACHE = '([^']+)'/.exec(sw)[1];
  assert.match(sw, /k !== VERSION && k !== ICS_CACHE && k !== MP_CACHE/);
  const bundle = readFileSync(join(ROOT, LAZY, 'vision_bundle.mjs'), 'utf8');
  const ver = /@mediapipe\/tasks-vision (\d+\.\d+\.\d+)/.exec(bundle)[1];
  assert.equal(mpCache, `star-mediapipe-${ver}`);
  // 原版建立任務時會 new 一個記錄器，每 60 秒把統計 POST 到 Google；本專案改成不建立
  assert.ok(!bundle.includes('new Mh('), '使用量記錄器又被打開了');
  assert.ok(bundle.includes('t.o=void 0}(t,n)'), '找不到關掉記錄器的那一處修改');
  const ui = readFileSync(join(ROOT, 'js/ui/hand-detect.js'), 'utf8');
  for (const [k, file] of [['wasm', 'vision_wasm_internal.wasm'], ['model', 'hand_landmarker.task']]) {
    const size = Number(new RegExp(`${k}: (\\d+)`).exec(ui)[1]);
    assert.equal(size, statSync(join(ROOT, LAZY, file)).size, `${file} 的大小和 hand-detect.js 的 SIZES 不一致`);
  }
});
