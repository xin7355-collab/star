# 星座手帳

手機優先（iPhone）的星座網頁 App。行星位置在手機上離線計算，生日不會上傳，前端沒有任何 API Key。

## 功能

| 分頁 | 內容 |
|---|---|
| 我的 | 民國／西元生日 → 太陽、月亮、上升星座；完整 10 顆行星星盤、宮位（整宮制）、相位。資料只存在這支手機，下次打開直接進「運勢」。 |
| 運勢 | 4×3 星座方格（預設選你的星座）；今日／明日／本週／本月 切換鈕固定在拇指位置；四項分數長條；「為什麼是這個分數」逐條列出行星相位；本週、本月有每日走勢與最佳日。 |
| 配對 | 快速（只選星座）或精準（輸入生日，加算月亮、金星、火星）；最多 5 人，多人分數取兩兩平均；並排對照表與相處建議。 |
| 塔羅 | 單張／三張／五張牌陣；手機加密亂數、78 張均勻不放回抽牌。 |
| 分享 | 每個結果都能「存成圖卡」：iPhone 會跳出分享面板，可存相簿或傳 LINE、IG。 |

## 計算正確性

- **星座判斷用太陽實際黃經**，不用寫死的日期表。生日剛好在交界、又沒填時間時，會顯示確切換座時刻（例：民國 89 年 3 月 20 日在台灣是「15:35 前雙魚座、之後牡羊座」）。
- **出生時間未知不假設午夜**：改列出生當天各行星的可能星座。
- **時區含歷史日光節約時間**：台灣 1945–1979 年夏季是 UTC+9，系統自動套用；遇到被跳過或重複的時刻，會請你確認，不會默默算錯。
- **生日解析不經過 `new Date("YYYY-MM-DD")`**，海外手機不會少一天。
- 行星、上升、天頂與 lilith-diviner（Python）交叉驗算，誤差小於 0.001°。
- 運勢分數是占星娛樂規則（依當天行星與你太陽星座的相位加減分），規則完全公開、同樣輸入得到同樣結果，**不是科學預測**。

## 部署到 GitHub Pages（用 iPhone）

1. GitHub App 或 Safari 打開本 repo →「Settings」→「Pages」。
2. 「Build and deployment」→ Source 選「Deploy from a branch」→ Branch 選這個分支、資料夾選「/ (root)」→「Save」。
3. 約 1～2 分鐘後打開 `https://xin7355-collab.github.io/star/`，用 Safari「分享」→「加入主畫面」，就像 App 一樣全螢幕、離線可用。

更新程式後若手機還看到舊版：關掉 App 重開一次即可（背景會自動抓新版）；發佈大改版時請把 `sw.js` 的 `VERSION` 改掉。

## AI 短評（選用）

見 [`worker/README.md`](worker/README.md)。沒設定也能完整使用；設定後運勢頁多一張「AI 短評」卡片。

## 測試

- 每次 push 都會由 GitHub Actions 自動執行全部測試（`.github/workflows/test.yml`），在 repo 的「Actions」分頁看結果。
- 電腦上：`npm test`（Node 20 以上，不需安裝任何套件）。

測試涵蓋：民國／西元與閏年、台灣歷史夏令時、交界日換座時刻（2000 年春分 07:35 UTC）、與 Python 版星盤交叉驗算、運勢可重現、配對對稱與 78 組配對表、塔羅不重複與機率均勻（卡方檢定）、AI 佇列與退避、Worker 快取與冷卻、離線快取清單完整、前端不含金鑰。

## 檔案結構

```
index.html            入口
css/app.css           樣式（手機優先）
js/app.js             分頁、分享面板、提示訊息
js/config.js          AI Worker 網址（公開設定，不放金鑰）
js/core/              計算核心（不碰畫面，可在 Node 測試）
  date.js tz.js       生日解析、時區與夏令時
  astro.js natal.js   行星位置、上升天頂、本命資料
  fortune.js          運勢計分
  synastry.js         配對評分
  tarot.js            塔羅
  zodiac.js places.js 星座與出生地資料
js/ui/                共用元件（表單、圖卡、儲存、AI 佇列）
js/views/             四個分頁
vendor/               astronomy-engine（MIT）
worker/               Cloudflare Worker（AI 代理，選用）
tests/                自動測試
sw.js manifest.webmanifest icons/  PWA（加到主畫面、離線）
```

## 隱私與安全

- 生日只存在手機的 localStorage；「我的」頁可一鍵清除。
- 塔羅問題不儲存、不上傳。
- 所有畫面文字以 `textContent` 輸出，不使用 `innerHTML`。
- AI 金鑰只在 Cloudflare Secret；GitHub Pages 是公開的，**任何金鑰都不要寫進這個 repo**。

## 授權與來源

第三方程式與參考來源見 [`NOTICE.md`](NOTICE.md)。
