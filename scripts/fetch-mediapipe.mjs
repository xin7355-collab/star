// 重新產生 vendor/mediapipe（掌紋自動定位用的手部辨識）：固定版本、逐檔核對 SHA-256，再套用本專案唯一的修改。
// 用法：npm run build:mediapipe（需要網路：npm 套件庫與 storage.googleapis.com）
// 為什麼要核對雜湊：這些檔案會在使用者手機上執行，被換掉就是供應鏈攻擊；版本或檔案一變，這裡會直接失敗。
// 本專案的修改：關掉建立任務時一定會開的使用量記錄器（每 60 秒把統計 POST 到 odml.pa.googleapis.com），
// 因為本 App 的原則是任何資料都不離開手機（tests/pwa.test.js 會檢查修改還在）。

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'vendor/mediapipe');
const VERSION = '1.2.2';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const SHA = {
  'vision_bundle.mjs': 'b65acb59b370cd6561afd9d04c29ed7a87e7ed6386922ac1b263af1f1ad06b7d', // 修改前的原檔
  'vision_wasm_internal.js': 'f2b9c17131ea79716ec6bf07b117a087b2749a6f8a1e2f1f2e77a9382092db5b',
  'vision_wasm_internal.wasm': 'f5bd25147ac89d506074293ce2675969b10e827180db95a0d9689c2ed80764ab',
  'hand_landmarker.task': 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1',
};
const LOGGER = 't.o=new Mh(t.D(),e,r)';
const HEADER = `/* @mediapipe/tasks-vision ${VERSION}（Apache-2.0，Copyright Google LLC），本專案修改過：
 * 建立任務時不再建立使用量記錄器（原本把效能與使用統計每 60 秒 POST 到 odml.pa.googleapis.com）。
 * 只改了這一處：建立記錄器的那個指派改成 void 0（其他地方都先判斷記錄器存不存在），其餘與原版相同。
 * 為什麼：本 App 的原則是任何資料都不離開手機，所有網路請求只能是同網域的 GET（tests/e2e 會檢查）。 */
`;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
function check(name, buf) {
  const got = sha256(buf);
  if (got !== SHA[name]) throw new Error(`${name} 的 SHA-256 不符（拿到 ${got}）：來源檔案變了，請人工確認後再更新雜湊`);
}

const tmp = mkdtempSync(join(tmpdir(), 'mediapipe-'));
try {
  // npm pack 只下載壓縮檔，不會執行套件的任何腳本
  execFileSync('npm', ['pack', `@mediapipe/tasks-vision@${VERSION}`, '--silent'], { cwd: tmp, stdio: ['ignore', 'pipe', 'inherit'] });
  execFileSync('tar', ['-xzf', `mediapipe-tasks-vision-${VERSION}.tgz`], { cwd: tmp });
  const pkg = join(tmp, 'package');
  const bundle = readFileSync(join(pkg, 'vision_bundle.mjs'));
  check('vision_bundle.mjs', bundle);
  for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) check(f, readFileSync(join(pkg, 'wasm', f)));
  const res = await fetch(MODEL_URL); // guardrails: ignore（開發時手動執行一次，失敗就整個停下來）
  if (!res.ok) throw new Error(`下載模型失敗：HTTP ${res.status}`);
  const model = Buffer.from(await res.arrayBuffer());
  check('hand_landmarker.task', model);

  const src = bundle.toString('utf8');
  if (src.split(LOGGER).length !== 2) throw new Error('找不到（或不只一處）建立使用量記錄器的程式：MediaPipe 改版了，請重新檢查要怎麼關掉');
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'vision_bundle.mjs'), HEADER + src.replace(LOGGER, 't.o=void 0'));
  for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) copyFileSync(join(pkg, 'wasm', f), join(OUT, f));
  writeFileSync(join(OUT, 'hand_landmarker.task'), model);
  console.log(`vendor/mediapipe 已更新：tasks-vision ${VERSION}（已關使用量回報）＋ hand_landmarker.task`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
