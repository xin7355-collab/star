# UI 完工簽核（design-qa）

依 `.claude/skills/design-qa/assets/finish_signoff.md` 範本填寫；貼的是腳本的判定行，不是摘要。

**畫面／流程：** 五個分頁（我的、運勢、命理、配對、塔羅）＋分享圖卡
**版本：** APP_VER 見 `js/version.js`（本次簽核在 2026-11-24 的提交）
**擷取的寬度：** 320 × 760、390 × 760、1440 × 760（`npm run qa:design`，Chromium）
**設計稿：** 無（沿用既有深色星空主題，色彩集中在 `css/tokens.css`、`js/ui/palette.js`）
**審查人（要真人）：** 尚未指定（目前只有自動檢查，見第 4 節）

## 1. 原始碼檢查（`finish_lint.py css js index.html`）

- 判定：`design-qa finish lint: CLEAN  (37 files; 0 blocker, 0 high, 0 warn; template traits 0 -> generic risk LOW)`
- 已修：顏色散落 → 全部改用 `css/tokens.css` 的變數與 `js/ui/palette.js`（TOKEN_DRIFT）
- 抑制（各附理由）：`index.html` 五個分頁按鈕與「關閉」按鈕標 `design-qa: allow BUTTON_NO_ACTION`——
  點擊事件在 `js/app.js` 統一綁定（第 52、125 行），工具只看同一行所以誤判
- 樣板感：generic risk LOW

## 2. 狀態表（`state_matrix_checker.py --matrix docs/qa/states.csv`）

- 判定：`design-qa state matrix: COMPLETE  (11 surfaces, 100% of required states covered; 0 blocker, 0 high, 0 warn)`
- 標 NA 的狀態與理由：運勢卡／名單／查詢紀錄的 loading（本機同步計算或讀取）、運勢卡 error（純計算，沒有外部呼叫）、
  農民曆 empty（每天都有資料）、塔羅與匯入備份的 busy／disabled（同步完成）、所有 hover（觸控裝置為主）
- 這次補上的：生日表單 `submitting`（按鈕「計算中…」並停用，E2E 攔住函式庫下載實測）、
  `server_error`（沒有伺服器；唯一會失敗的是延後載入的農曆函式庫，E2E 實測提示與保留已填資料）、
  六個資料畫面的 `long_content`、整頁 `wide_1440`

## 3. 實際畫面稽核（`rendered_audit.py`，每張快照一次）

`npm run qa:design` 共 34 張，全部 `CLEAN`（0 blocker、0 high、0 warn）：

| 快照組 | 寬度 | 狀態 | 判定 | Blocker | 豁免 |
|---|---|---|---|---|---|
| empty-me、empty-destiny | 320／390 | 第一次使用（空白） | CLEAN | 0 | 2（見下） |
| fortune、me、bazi、ziwei、match、tarot | 320／390 | 有資料 | CLEAN | 0 | 2（me） |
| long-*（同上六頁） | 320／390 | 長內容：50 人、300 筆紀錄、20 字無空格英文名字、宜 30 項、AI 200 字含長網址 | CLEAN | 0 | 2（me） |
| wide-*（同上六頁） | 1440 | 長內容 | CLEAN | 0 | 2（me） |

- 豁免（`docs/qa/design-qa-waivers.csv`）：「選擇備份檔」隱藏的檔案輸入框 TARGET_TOO_SMALL、FOCUS_UNVERIFIED——
  實際操作的是旁邊看得見的按鈕（WCAG 2.5.8 Equivalent 例外），輸入框設 `tabindex=-1`、有 `aria-label`
- 焦點資料來自真的鍵盤 Tab 走一遍：是
- CONTRAST_UNVERIFIED：0（裝飾漸層移到 `body::before`，內容底下都是實心底色，對比可實際量測）
- 長內容測試抓到並修好的：沒有空格的長英文／網址撐出水平捲動（320 寬時 3356px）→ `body` 加
  `overflow-wrap: anywhere`；紀錄只列最近 50 筆卻沒說 → 加提示「全部 N 筆都在匯出備份檔裡」
- 工具盲點（已處理）：快照預設只收前 400 個文字元素，長內容時被隱藏分頁佔滿 → 腳本放寬到 20000

## 4. 腳本量不到的（要人工）

- [ ] 螢幕閱讀器（iPhone 旁白 VoiceOver）走一次主要流程——**沒驗到**
- [x] 文案：16 張一般快照裡實際顯示的 449 段文字跑 zh-tw-humanizer 的 `check.py`：機械檢查通過
  （只量得到每段前 80 字；錯誤訊息、提示框等沒出現在快照裡的文字靠程式碼審閱）
- [x] 真實極端資料：最長名字、最多名單與紀錄（上表 long-*）；慢速網路見 `docs/qa/performance.md`
- [ ] 真的 iPhone Safari——**沒驗到**（雲端只有 Chromium；CI 會用 WebKit 跑 E2E，最接近但不等於實機）

## 決定

- [x] 可上線：沒有 blocker，每個豁免都有 WCAG 例外依據
- [ ] 上線但有待辦
- [ ] 未完成

簽核：Claude Code（自動檢查）；真人審查待補　日期：2026-11-24
