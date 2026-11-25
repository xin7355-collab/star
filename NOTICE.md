# 第三方來源與授權

## 直接內含的程式（`vendor/`，由 `npm run build:vendor` 從固定版本重新產生）

| 檔案 | 來源 | 授權 |
|---|---|---|
| `vendor/astronomy.min.js` | [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19（Don Cross） | MIT，`LICENSES/astronomy-engine-MIT.txt`，檔頭保留 |
| `vendor/lunar.js`、`vendor/shared-chunk.js` | [lunar-typescript](https://github.com/6tail/lunar-typescript) 1.8.6（6tail）：農曆、節氣、八字、大運、黃曆宜忌 | MIT，`LICENSES/lunar-typescript-MIT.txt` |
| `vendor/iztro.js` | [iztro](https://github.com/SylarLong/iztro) 2.6.5（SylarLong）：紫微斗數排盤；連同 lunar-lite 0.2.9、i18next 26.7.2、dayjs 1.11.23 | 皆 MIT，`LICENSES/iztro-MIT.txt`、`lunar-lite-MIT.txt`、`i18next-MIT.txt`、`dayjs-MIT.txt` |

i18next 以 `overrides` 從 iztro 預設的 23.x 升到 26.7.2，修掉 npm audit 回報的 GHSA-6jcc-5g8w-32mx；
升級前後 6 組紫微命盤輸出逐字相同。

## 按了才下載的手部辨識（`vendor/mediapipe/`，由 `npm run build:mediapipe` 從固定版本重新產生，逐檔核對 SHA-256）

| 檔案 | 來源 | 授權 |
|---|---|---|
| `vendor/mediapipe/vision_bundle.mjs`、`vision_wasm_internal.js`、`vision_wasm_internal.wasm` | [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) 1.2.2（Google）：手部關鍵點辨識的執行環境 | Apache-2.0，`LICENSES/mediapipe-Apache-2.0.txt`；**已修改** `vision_bundle.mjs`：關掉原本一定會開的使用量回報（每 60 秒 POST 到 odml.pa.googleapis.com），檔頭有說明 |
| `vendor/mediapipe/hand_landmarker.task` | [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) 模型 float16/1 | Apache-2.0，同上；未修改 |

這組約 22MB，不放進 service worker 的預先快取：使用者在掌紋按「自動找三個位置」才下載，存進獨立快取（App 換版不重抓）。
照片只在手機上辨識，不上傳（`tests/e2e` 用真的模型跑一次，確認沒有任何外部請求）。

## 來自 skl 技能庫

| 檔案 | 來源 | 授權 |
|---|---|---|
| `worker/model_router.cjs`、`worker/router_cases.json` | [xin7355-collab/skl](https://github.com/xin7355-collab/skl) `xin-toolkit/skills/ai-model-router/assets/`（原封不動複製；更新時從 skl 重新複製） | skl repo 為 MIT（Copyright (c) 2025 Alireza Rezvani），`LICENSES/skl-MIT.txt` |
| `.claude/skills/` | 同上，由 app-bootstrap 安裝的開發用技能（不會部署到網站） | 同上；個別技能另附的 LICENSE 以該檔為準 |

## 由工具產生的資料

| 檔案 | 產生方式 | 授權 |
|---|---|---|
| `js/core/zh-data.js` | `scripts/gen-zh-map.py` 用 [OpenCC](https://github.com/BYVoid/OpenCC)（opencc-python-reimplemented 0.1.7）把 lunar-typescript 的簡體字串轉成台灣繁體 | 對照資料源自 OpenCC 字典，Apache-2.0，`LICENSES/opencc-Apache-2.0.txt` |
| `js/core/kangxi-data.js` | `scripts/gen-kangxi.py` 由 Unicode Unihan 資料庫（經 npm 套件 [cjk-unihan](https://github.com/texh/cjk-unihan) 0.0.3 取得，下載時核對 sha512）的 kRSKangXi 換算康熙筆畫、kMandarin 改成數字聲調拼音；只收 Big5 範圍 13063 字 | Unihan © Unicode, Inc.，Unicode 授權，`LICENSES/unicode-LICENSE.txt`（資料已修改）；cjk-unihan 套件本身 MIT |

## 參考後以 JavaScript 重寫（MIT，保留原作者聲明）

| 本專案檔案 | 參考來源 | 參考內容 |
|---|---|---|
| `js/core/astro.js` | lilith-diviner `scripts/astrology.py`；tianji `scripts/fortune_calc.py` | 行星視黃經算法、上升點與天頂公式（以 lilith-diviner 結果交叉驗算） |
| `js/core/natal.js` | lilith-diviner `scripts/astrology.py` `date_ranges()` | 出生時間未知時以當天抽樣給範圍，而非假設午夜 |
| `js/core/tz.js` | lilith-diviner `scripts/astrology.py` `parse_datetime()` | 日光節約「不存在／重複」時刻的檢查 |
| `js/core/zodiac.js` | lilith-diviner `scripts/astrology.py` | 相位容許度 |
| `js/core/tarot.js` | lilith-diviner `scripts/draw.py` | 均勻不放回抽牌、逆位機率、牌陣位置 |
| `js/core/synastry.js` | tianji `scripts/fortune_calc.py` | 星座相位分數表、多人合盤取「人對均值」 |
| `js/core/bazi.js` | lilith-diviner `scripts/bazi_engine.py`；tianji `scripts/fortune_calc.py` | 23 點換日（sect 1）的選擇；地支六沖、相刑、相害、相破表；真太陽時的均時差公式 |
| `js/core/chenggu.js` | tianji `scripts/fortune_calc.py`、`references/weight-tables.md` | 袁天罡稱骨的年、月、日、時骨重表（歌訣為古代流傳文本，轉為繁體） |
| `js/core/iching.js` | taibu `packages/core/src/domains/meihua/calculate.ts`（taibu-core 4.1.0，commit 4b2a51a） | 梅花總斷的先後（互變俱生／俱剋、無生氣、先吉後凶）、乾坤取變卦之互、體卦旺衰與體黨用黨只論輕重；「無生氣」改成至少兩個剋體才算 |
| `js/core/liuyao.js` | taibu `packages/core/src/domains/liuyao/calculate.ts`（同上版本） | 納甲、六神、世應表；月建日辰旺衰、月破、暗動日破、旬空真假、動變、用神多現的取捨、伏神、應期的條目；八宮卦序改用演算法推出並與其表逐卦核對（64/64 一致） |

- lilith-diviner：Copyright (c) 2026 Erfan (Erfan817)，MIT，`LICENSES/lilith-diviner-MIT.txt`
- tianji：Copyright (c) 2026，MIT，`LICENSES/tianji-MIT.txt`
- taibu-core（[hhszzzz/taibu](https://github.com/hhszzzz/taibu) 的 `packages/core`）：Copyright (c) 2026 hhszzzz，MIT，`LICENSES/taibu-core-MIT.txt`。
  注意 taibu repo 根目錄（`src/` 等）是 AGPL-3.0，本專案只參考 MIT 的 `packages/core`，沒有碰 AGPL 部分。

## 只參考做法、沒有複製任何程式碼或文案

下列專案沒有 LICENSE 檔（預設保留所有權利），本專案只參考「概念」，程式、文案、圖片皆為自行撰寫：

- rita860503-sketch/-V1：瑪雅密碼 A～E 的計算規則（規則本身依 V1 程式行為重寫，關鍵字為自行撰寫；規則出處沒驗到）、勾選才展開欄位的漸進式表單
- YX-NAS/sbti-miniapp：分享海報、期間切換、分數長條、配對表資料結構的概念
- yushuangming/Horoscope：記住使用者星座的概念

塔羅牌義、運勢計分規則、配對文案、八字十神與流年解說、紫微主星簡介、生命靈數解說皆為本專案自行撰寫。
姓名學 81 數理的白話解說、三才生剋說明、綜合解讀與稱骨白話、時機與偏財說明也都是自行撰寫；
81 數理的傳統名稱（如「旱苗逢雨」）為通行說法。曾用 shunshi-naming-core（MIT）的 81 數理與三才分級做交叉比對，
但沒有複製它的資料或文字。
