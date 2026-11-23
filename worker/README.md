# AI 短評 Worker（選用）

App 不需要這個也能完整使用：運勢分數、星盤、配對、塔羅都在手機上離線計算。
這個 Worker 只負責多一張「AI 短評」卡片，而且**API Key 只放在 Cloudflare，不會出現在 GitHub 或手機上**。

## 用 iPhone 部署（約 10 分鐘）

> Cloudflare 介面偶爾改版，按鈕名稱以實際畫面為準。

1. **建立 Worker**：開 Safari 登入 dash.cloudflare.com →「Workers & Pages」→「Create」→「Create Worker」→ 名稱填 `star-ai` →「Deploy」→「Edit code」→ 把 `worker/worker.js` 全部內容貼上，取代原本的程式 →「Deploy」。
2. **建立 KV**：「Storage & Databases」→「KV」→「Create」→ 名稱 `star-fortune`。回到 Worker →「Settings」→「Bindings」→「Add」→「KV namespace」→ Variable name 填 `FORTUNE_KV`、選剛建立的 `star-fortune`。
3. **設定金鑰與網站**：Worker →「Settings」→「Variables and Secrets」→「Add」：
   - 類型 **Secret**，名稱 `ANTHROPIC_API_KEY`，值貼上你的 Anthropic API Key
   - 類型 **Text**，名稱 `ALLOWED_ORIGINS`，值填 `https://xin7355-collab.github.io`
4. **（建議）排程預先產生**：Worker →「Settings」→「Triggers」→「Cron Triggers」→ 加入 `5 16 * * *`（每天台灣時間 00:05 先把當天內容產生好，使用者打開就不用等）。
5. **接上 App**：複製 Worker 網址（像 `https://star-ai.xxxx.workers.dev`），到 GitHub 網頁版打開 `js/config.js` → 鉛筆圖示編輯 → 改成
   `export const AI_ENDPOINT = 'https://star-ai.xxxx.workers.dev';` → Commit。

測試：用 Safari 打開 `https://star-ai.xxxx.workers.dev/`，看到 `{"ok":true,"service":"star-ai"}` 就表示 Worker 正常。

## 費用估算（僅供參考）

- 內容依「期間」產生，12 星座一次產生，存進 KV：**不論多少人用，每天約 1 次 AI 呼叫**，每週、每月各再 1 次。
- 預設模型 `claude-opus-5-5`（每百萬 token 輸入 $4、輸出 $20）。每次約 600 輸入 + 2,500 輸出 token，估計每月約 2 美元上下，實際以 Anthropic 帳單為準。
- 想更省可加 Text 變數 `MODEL` = `claude-haiku-5-5`（每百萬 token $0.10 / $0.50），品質會較簡單。
- Cloudflare Workers 與 KV 的免費額度足夠這個用量。

## 安全與穩定設計

| 風險 | 處理方式 |
|---|---|
| 金鑰外洩 | 只存在 Cloudflare Secret；前端只拿到 Worker 網址 |
| 被別的網站盜用 | `ALLOWED_ORIGINS` 以外的網站一律 403 |
| 大量請求燒錢 | 以台灣日期為快取鍵，同一期間只產生一次；產生中回 202，失敗冷卻 60 秒 |
| AI 暫時忙碌 | 429／5xx 指數退避重試（2s→4s），尊重 `retry-after` |
| 安全分類器婉拒 | 使用伺服器端備援模型（`fallbacks: "default"`）；仍失敗則不寫入快取 |
| 惡意內容注入畫面 | 只接受符合 JSON Schema 的 12 個字串；前端只用 `textContent` 顯示 |

## 測試

`tests/worker.test.js` 用模擬的 KV 與 API 驗證：台灣日期快取鍵、同一期間只呼叫一次、退避重試、冷卻、未授權網站被擋、401 不重試。
