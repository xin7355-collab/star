# 第三方來源與授權

## 直接內含的程式

| 檔案 | 來源 | 授權 |
|---|---|---|
| `vendor/astronomy.min.js` | [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19（Don Cross），由 npm 套件的 `esm/astronomy.js` 壓縮而成，未修改邏輯 | MIT，全文見 `LICENSES/astronomy-engine-MIT.txt`，檔頭亦保留 |

## 參考後以 JavaScript 重寫（MIT，保留原作者聲明）

| 本專案檔案 | 參考來源 | 參考內容 |
|---|---|---|
| `js/core/astro.js` | lilith-diviner `scripts/astrology.py`；tianji `scripts/fortune_calc.py` | 行星視黃經算法、上升點與天頂公式（以 lilith-diviner 結果交叉驗算） |
| `js/core/natal.js` | lilith-diviner `scripts/astrology.py` `date_ranges()` | 出生時間未知時以當天抽樣給範圍，而非假設午夜 |
| `js/core/tz.js` | lilith-diviner `scripts/astrology.py` `parse_datetime()` | 日光節約「不存在／重複」時刻的檢查 |
| `js/core/zodiac.js` | lilith-diviner `scripts/astrology.py` | 相位容許度 |
| `js/core/tarot.js` | lilith-diviner `scripts/draw.py` | 均勻不放回抽牌、逆位機率、牌陣位置 |
| `js/core/synastry.js` | tianji `scripts/fortune_calc.py` | 星座相位分數表、多人合盤取「人對均值」 |

- lilith-diviner：Copyright (c) 2026 Erfan (Erfan817)，MIT，全文見 `LICENSES/lilith-diviner-MIT.txt`
- tianji：Copyright (c) 2026，MIT，全文見 `LICENSES/tianji-MIT.txt`

## 只參考做法、沒有複製任何程式碼或文案

下列專案沒有 LICENSE 檔（預設保留所有權利），本專案只參考「概念」，程式、文案、圖片皆為自行撰寫：

- YX-NAS/sbti-miniapp：分享海報、期間切換、分數長條、配對表資料結構的概念
- rita860503-sketch/-V1：勾選才展開欄位的漸進式表單概念
- yushuangming/Horoscope：記住使用者星座的概念

塔羅牌義關鍵字、運勢計分規則、配對文案皆為本專案自行撰寫。
