// 設定檔（公開，不放任何金鑰）。
//
// AI_ENDPOINT：部署 worker/worker.js 到 Cloudflare 後，把 Worker 網址貼在這裡，例如
//   export const AI_ENDPOINT = 'https://star-ai.你的帳號.workers.dev';
// 留空字串 = 不使用 AI，App 其他功能完全照常運作（運勢分數本來就是在手機上離線計算）。
// API Key 只放在 Cloudflare 的 Secret 裡，絕對不要寫進這個檔案（GitHub Pages 是公開的）。
export const AI_ENDPOINT = '';
