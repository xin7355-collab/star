# AI 短評 Worker（選用）

App 不需要這個也能完整使用：運勢分數、星盤、八字、紫微、農民曆、配對、塔羅都在手機上離線計算。
這個 Worker 只負責多一張「AI 短評」卡片，而且 **API Key 只放在 Cloudflare，不會出現在 GitHub 或手機上**。

## 用 iPhone 部署（約 10 分鐘）

> Cloudflare 介面偶爾改版，按鈕名稱以實際畫面為準。

1. **建立 Worker**：Safari 登入 dash.cloudflare.com →「Workers & Pages」→「Create」→「Create Worker」→ 名稱填 `star-ai` →「Deploy」→「Edit code」→
   打開 GitHub 上的 [`worker/dist/star-ai-worker.js`](dist/star-ai-worker.js)（按「Raw」→ 全選複製），整份貼上取代原本的程式 →「Deploy」。
   （`worker/worker.js` 是原始碼，裡面引用了另一個檔案，不能直接貼。）
2. **建立 KV**：「Storage & Databases」→「KV」→「Create」→ 名稱 `star-fortune`。回到 Worker →「Settings」→「Bindings」→「Add」→「KV namespace」→ Variable name 填 `FORTUNE_KV`、選 `star-fortune`。
3. **設定金鑰與網站**：Worker →「Settings」→「Variables and Secrets」→「Add」：
   - 類型 **Secret**，名稱 `ANTHROPIC_API_KEY`，值貼上你的 Anthropic API Key
   - 類型 **Text**，名稱 `ALLOWED_ORIGINS`，值填 `https://xin7355-collab.github.io`
4. **（建議）排程預先產生**：Worker →「Settings」→「Triggers」→「Cron Triggers」→ 加入 `5 16 * * *`（每天台灣時間 00:05 先把當天內容產生好）。
5. **接上 App**：複製 Worker 網址（像 `https://star-ai.xxxx.workers.dev`），到 GitHub 網頁版打開 `js/config.js` → 鉛筆圖示 → 改成
   `export const AI_ENDPOINT = 'https://star-ai.xxxx.workers.dev';` → Commit。

測試：Safari 打開 `https://star-ai.xxxx.workers.dev/`，看到 `{"ok":true,"service":"star-ai"}` 就是正常。

**請到 Anthropic 後台（console.anthropic.com → Billing / Limits）設定每月花費上限**，避免意外費用。

## 模型怎麼選（不寫死模型名稱）

依專案守則使用 skl 的 `ai-model-router`（`worker/model_router.cjs`）：程式只寫等級 `smart`，
執行時查 Anthropic 官方模型清單，自動挑最新的 Sonnet；模型下架會自動換，回覆不是合格 JSON 會自動升級到 `best`（Opus）。
一次產生最多送出 6 個請求。要指定某個模型時，加 Text 變數 `MODEL`（例如填你想用的模型代號），它會排在第一順位。

## 費用估算（僅供參考）

- 內容依「期間」產生、12 星座一次產生並存進 KV：**不論多少人用，每天約 1 次 AI 呼叫**，週、月、年各再 1 次。
- smart 等級（目前是 Sonnet）每次約 600 輸入＋2,500 輸出 token，估計每月 1 美元上下；升級到 Opus 的次數多時會更高。
  實際以 Anthropic 帳單為準。
- Cloudflare Workers 與 KV 的免費額度足夠這個用量。

## 安全與穩定設計

| 風險 | 處理方式 |
|---|---|
| 金鑰外洩 | 只存在 Cloudflare Secret；只走 HTTP 標頭，不放網址；錯誤訊息與日誌不含金鑰 |
| 被別的網站盜用 | `ALLOWED_ORIGINS` 以外的網站一律 403 |
| 大量請求燒錢 | 以台灣日期為快取鍵，同一期間只產生一次；產生中回 202，失敗冷卻 60 秒；一次最多 6 個 AI 請求 |
| 模型下架、限流、伺服器忙 | ai-model-router：自動換模型、429 依類型等待或換模型、5xx 指數退避；付費服務逾時不重送（避免重複收費） |
| 惡意內容注入畫面 | 只接受 12 個星座鍵的 JSON 字串、去除控制字元並限長；前端只用 `textContent` 顯示 |

## 開發

- 原始碼：`worker/worker.js`；改完執行 `npm run build:worker` 產生 `worker/dist/star-ai-worker.js`。
- 測試：`tests/worker.test.js`（模擬 KV 與 Anthropic API，含 router 的自我測試與打包檔的實際執行）。
