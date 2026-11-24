# UI 完工簽核（design-qa）

依 `.claude/skills/design-qa/assets/finish_signoff.md` 範本填寫；貼的是腳本的判定行，不是摘要。

**畫面／流程：** 五個分頁（今日、時運、命盤、占卜〔塔羅／樂透選號／配對〕、我的）＋分享圖卡
**版本：** APP_VER 見 `js/version.js`（本次簽核在 2026-11-24 的提交）
**擷取的寬度：** 320 × 760、390 × 760、1440 × 760（`npm run qa:design`，Chromium）
**設計稿：** 無（2026-11-24 改版為「星夜鎏金」主題：深夜藍底＋金色重點；色彩集中在 `css/tokens.css`、`js/ui/palette.js`）
**審查人（要真人）：** 尚未指定（目前只有自動檢查，見第 4 節）

## 1. 原始碼檢查（`finish_lint.py css js index.html`）

- 判定：`design-qa finish lint: CLEAN  (52 files; 0 blocker, 0 high, 0 warn; template traits 0 -> generic risk LOW)`
- 已修：顏色散落 → 全部改用 `css/tokens.css` 的變數與 `js/ui/palette.js`（TOKEN_DRIFT；改版時把系統標籤底色、幸運色色票、遮罩黑色也收進變數）
- 抑制（各附理由）：`index.html` 五個分頁按鈕與「關閉」按鈕標 `design-qa: allow BUTTON_NO_ACTION`。
  點擊事件在 `js/app.js` 統一綁定（第 52、125 行），工具只看同一行所以誤判
- 樣板感：generic risk LOW

## 2. 狀態表（`state_matrix_checker.py --matrix docs/qa/states.csv`）

- 判定：`design-qa state matrix: COMPLETE  (23 surfaces, 100% of required states covered; 0 blocker, 0 high, 0 warn)`
- 新增四個畫面：工作與方向、開運佈置、血型（資料畫面，含長內容）、解惑（表單：驗證錯誤、起卦中、成功、模組載入失敗）
- 改版新增的畫面：今日儀表板、吉時表、近期提醒、擇日、樂透選號、姓名分析、綜合解讀、底部分頁
- 標 NA 的狀態與理由：運勢卡／名單／查詢紀錄的 loading（本機同步計算或讀取）、運勢卡 error（純計算，沒有外部呼叫）、
  農民曆 empty（每天都有資料）、塔羅與匯入備份的 busy／disabled（同步完成）、所有 hover（觸控裝置為主）
- 這次補上的：生日表單 `submitting`（按鈕「計算中…」並停用，E2E 攔住函式庫下載實測）、
  `server_error`（沒有伺服器；唯一會失敗的是延後載入的農曆函式庫，E2E 實測提示與保留已填資料）、
  六個資料畫面的 `long_content`、整頁 `wide_1440`

## 3. 實際畫面稽核（`rendered_audit.py`，每張快照一次）

`npm run qa:design` 共 76 張，全部 `CLEAN`（0 blocker、0 high、0 warn）。快照時開「減少動態效果」並等動畫播完，量的是使用者最後看到的畫面：

| 快照組 | 寬度 | 狀態 | 判定 | Blocker | 豁免 |
|---|---|---|---|---|---|
| empty-me、empty-today、empty-destiny | 320／390 | 第一次使用（空白） | CLEAN | 0 | 2（見下） |
| today、fortune、me、reading、bazi、ziwei、name、career、fengshui、blood、jiehuo、match、tarot、lotto | 320／390 | 有資料 | CLEAN | 0 | 2（me） |
| long-*（同上十四頁） | 320／390 | 長內容：50 人、300 筆紀錄、20 字無空格英文名字、6 字本名、宜 30 項、AI 200 字 | CLEAN | 0 | 2（me） |
| wide-*（同上十四頁） | 1440 | 長內容 | CLEAN | 0 | 2（me） |

- 改版時抓到、已修好的：擇日熱度格綠底白字對比只有 3.79:1（改深綠，最亮格仍有 6.4:1）、
  吉時條在 320 寬每格只有 17.7px（窄螢幕改兩排，每格 34px）、分數環的金色進度弧沒畫出來
  （`@property --p` 設成不繼承，畫在 `::before` 的弧永遠是 0；E2E 改成檢查 `::before` 本身，先確認測試抓得到這個錯再修）、
  畫面出現「nullnullnull」（原生 `replaceChildren` 會把 null 印成文字，農民曆卡片原本就有這個問題；
  全部改用 `fill()`，並加上靜態檢查與 E2E「不得出現 null／undefined」）
- 新功能抓到、已修好的：解惑「適合的日子」顯示「[object Object]」（擇日的理由是物件，直接 join 成文字；
  修好後把這個錯放回去確認 E2E 會失敗，版面測試也加上「[object」檢查）；開運佈置說喜火的人有利方位是南，
  同一頁又說今年南方五黃不能放紅色（改成碰到五黃、二黑、太歲時提醒今年改放次要喜用的方位）；飛星說明出現「（…（…））」雙層括號
- 稽核工具本身的時機問題（已處理）：進場動畫第一格是透明，剛插入就量會得到 1:1 對比 → 腳本改成等畫面刷新兩格、有限動畫播完再量

- 豁免（`docs/qa/design-qa-waivers.csv`）：「選擇備份檔」隱藏的檔案輸入框 TARGET_TOO_SMALL、FOCUS_UNVERIFIED。
  實際操作的是旁邊看得見的按鈕（WCAG 2.5.8 Equivalent 例外），輸入框設 `tabindex=-1`、有 `aria-label`
- 焦點資料來自真的鍵盤 Tab 走一遍：是
- CONTRAST_UNVERIFIED：0（裝飾漸層移到 `body::before`，內容底下都是實心底色，對比可實際量測）
- 長內容測試抓到並修好的：沒有空格的長英文／網址撐出水平捲動（320 寬時 3356px）→ `body` 加
  `overflow-wrap: anywhere`；紀錄只列最近 50 筆卻沒說 → 加提示「全部 N 筆都在匯出備份檔裡」
- 工具盲點（已處理）：快照預設只收前 400 個文字元素，長內容時被隱藏分頁佔滿 → 腳本放寬到 20000
- CI 的 WebKit（Safari 引擎）另外抓到、已修好的：配對頁 320 寬水平捲動 57px。星座選單選中的文字比選單寬，
  WebKit 畫面上裁掉、版面卻仍算進可捲動範圍（Chromium 不會）→ select 加 overflow:hidden＋刪節號，
  快速配對欄寬改 2:3。修正後 CI 的 E2E 18/18（Chromium 9＋WebKit 9）通過
- 改版（今日、時運、命盤、占卜、我的）後 CI run 45334665526：E2E 28/28（Chromium 14＋WebKit 14，沒有重試）、
  design-qa 56 張 CLEAN
- 新增工作方向、開運佈置、血型、解惑後 CI run 45380479737：E2E 34/34（Chromium 17＋WebKit 17，沒有重試）、
  design-qa 76 張 CLEAN
- 解惑加六爻排盤表後：320 寬時表格比卡片寬 16px，「變出」欄被切掉（Playwright 量 scrollWidth 270 > 254）→
  字級 13px、左右留白 2px、「官鬼 辰土」允許在空格處換行，量到 254 = 254；用神那一列加金色左線（深色模式底色太淡）。
  本機 design-qa 76 張 CLEAN、finish lint 64 個檔案 CLEAN、狀態表 23 個畫面 COMPLETE。
  CI run 45408082989：E2E 36/36（Chromium 18＋WebKit 18，沒有重試）、design-qa 76 張 CLEAN

## 4. 腳本量不到的（要人工）

- [ ] 螢幕閱讀器（iPhone 旁白 VoiceOver）走一次主要流程：**沒驗到**
- [x] 文案：16 張一般快照裡實際顯示的 449 段文字跑 zh-tw-humanizer 的 `check.py`：機械檢查通過
  （只量得到每段前 80 字；錯誤訊息、提示框等沒出現在快照裡的文字靠程式碼審閱）
- [x] 真實極端資料：最長名字、最多名單與紀錄（上表 long-*）；慢速網路見 `docs/qa/performance.md`
- [ ] 真的 iPhone Safari：**沒驗到**（雲端只有 Chromium；CI 用 WebKit 跑 E2E，最接近但不等於實機）
- [x] 動畫：E2E 另有一組開著動畫跑（分數環、數字、彩球、吉時條），其他測試與 design-qa 在「減少動態效果」下量最終畫面

## 決定

- [x] 可上線：沒有 blocker，每個豁免都有 WCAG 例外依據
- [ ] 上線但有待辦
- [ ] 未完成

簽核：Claude Code（自動檢查）；真人審查待補　日期：2026-11-24
