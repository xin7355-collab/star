// 掌紋照片自動找三個位置（食指根部、小指根部、手腕）：用 MediaPipe 的手部關鍵點模型（Apache-2.0），全部在手機上算。
// 檔案很大（程式 14.6MB＋模型 7.8MB），按了才下載；下載後存在 service worker 的獨立快取，換版也不用重抓。
// 照片不離開手機；vendor/mediapipe/vision_bundle.mjs 已經關掉原本會把使用統計送到 Google 的記錄器（見檔頭）。
// 用完就關掉模型釋放記憶體（iPhone 記憶體吃緊時整頁會被重載）。

import { calibFromLandmarks } from '../core/palm.js';

const BASE = new URL('../../vendor/mediapipe/', import.meta.url);
const FILES = { bundle: 'vision_bundle.mjs', loader: 'vision_wasm_internal.js', wasm: 'vision_wasm_internal.wasm', model: 'hand_landmarker.task' };
// 伺服器沒給檔案大小時用來算進度（和 vendor/mediapipe 的檔案一致，tests/pwa.test.js 會檢查）
export const SIZES = { wasm: 14603354, model: 7819105 };
export const TOTAL_MB = Math.round((SIZES.wasm + SIZES.model) / 1e6);

/** 下載並回報進度（位元組）；行動網路斷斷續續時自動重試 2 次（等 2 秒、4 秒），還是不行才回報失敗 */
async function fetchBytes(url, onBytes) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchOnce(url, onBytes);
    } catch (err) {
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
}

async function fetchOnce(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body || !res.body.getReader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onBytes(buf.length);
    return buf;
  }
  const reader = res.body.getReader();
  const parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onBytes(got);
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * 在照片上找手。
 * @param {HTMLCanvasElement} canvas 照片（已縮到 1280px 內）
 * @param {{onProgress?:(text:string)=>void}} [opts]
 * @returns {Promise<{ok:true, points:{index:number[],pinky:number[],wrist:number[]}, score:number}|{ok:false, error:string}>}
 */
export async function locateHand(canvas, { onProgress = () => {} } = {}) {
  if (typeof WebAssembly !== 'object') return { ok: false, error: '這個瀏覽器不能跑辨識模型（需要 WebAssembly），請手動點三個位置。' };
  let wasmUrl = null;
  let landmarker = null;
  try {
    // 依序下載（不同時開兩個大檔），進度合在一起算
    const tick = (base) => (n) => onProgress(`下載辨識模型 ${Math.min(99, Math.round(((base + n) / (SIZES.wasm + SIZES.model)) * 100))}%（第一次約 ${TOTAL_MB}MB，之後不用再下載）`);
    const wasm = await fetchBytes(new URL(FILES.wasm, BASE), tick(0));
    const model = await fetchBytes(new URL(FILES.model, BASE), tick(SIZES.wasm));
    onProgress('辨識中…');
    const { HandLandmarker } = await import(new URL(FILES.bundle, BASE).href);
    // wasm 用自己下載好的那份（blob 網址），不要讓載入器再抓一次；型別給 application/wasm 才能邊下載邊編譯
    wasmUrl = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
    // 模型的執行紀錄（GL 版本、XNNPACK…）會一直印在主控台：只留真正的錯誤
    self.Module = { print: () => {}, printErr: (t) => { if (/^(E\d|F\d|Error)/.test(String(t))) console.warn('[手部辨識]', t); } };
    landmarker = await HandLandmarker.createFromOptions(
      { wasmLoaderPath: new URL(FILES.loader, BASE).href, wasmBinaryPath: wasmUrl },
      { baseOptions: { modelAssetBuffer: model, delegate: 'CPU' }, runningMode: 'IMAGE', numHands: 1, minHandDetectionConfidence: 0.3, minHandPresenceConfidence: 0.3 },
    );
    const res = landmarker.detect(canvas);
    const lm = res.landmarks && res.landmarks[0];
    if (!lm) return { ok: false, error: '照片裡沒找到手：手掌攤平、整隻手和手腕都入鏡、光線亮一點再拍；或直接手動點三個位置。' };
    const points = calibFromLandmarks(lm, canvas.width, canvas.height);
    const score = res.handedness && res.handedness[0] && res.handedness[0][0] ? res.handedness[0][0].score : 0;
    return points ? { ok: true, points, score } : { ok: false, error: '找到的手不完整，請手動點三個位置。' };
  } catch (err) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return { ok: false, error: offline ? '沒有網路，下載不了辨識模型：連上網路後再試，或手動點三個位置。' : '辨識模型載入失敗（可能是網路中斷或手機記憶體不夠）：請再試一次，或手動點三個位置。' };
  } finally {
    try {
      landmarker?.close();
    } catch {
      /* 已經關掉了 */
    }
    if (wasmUrl) URL.revokeObjectURL(wasmUrl);
    self.Module = undefined;
  }
}
