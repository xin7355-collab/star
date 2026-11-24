# 效能紀錄（performance-optimization）

## 改了什麼

`index.html` 加上 `<link rel="modulepreload">` 清單（由 `node scripts/gen-preload.mjs` 從 `js/app.js` 的靜態 import 產生，
`tests/pwa.test.js` 檢查清單和程式同步）。原本瀏覽器要一層一層下載 import 才知道下一個檔案，
改成一開始就平行下載，網路越慢差越多。

## 量測方式（2026-11-24）

- Chromium 模擬 iPhone 13、CPU 降速 4 倍、關閉 service worker（模擬第一次開啟）
- 網路：4G（延遲 85ms、下載 9Mbps）、慢速 4G（延遲 150ms、下載 1.6Mbps）
- 每種各跑 3 次取中位數；量「運勢分數出現」與「農民曆出現」的時間（從開始載入算起）

| 網路 | 項目 | 沒有 preload | 有 preload |
|---|---|---|---|
| 4G | 農民曆出現 | 1448 ms | 1329 ms |
| 慢速 4G | 運勢分數出現 | 1724 ms | 1659 ms |
| 慢速 4G | 農民曆出現 | 3068 ms | 2542 ms |

第二次以後開啟由 service worker 快取直接提供，運勢分數約 0.3～0.4 秒出現。

## 沒驗到

- 真的 iPhone Safari 的時間（雲端只有 Chromium 模擬）
- 4G 的「運勢分數出現」那次量測數字沒有留存，表格不列
