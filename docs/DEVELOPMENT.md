# 開發、測試與部署

## 部署

- **網站**：GitHub Pages，main 分支根目錄。設定頁：https://github.com/xin7355-collab/star/settings/pages
  →「Build and deployment」→ Source「Deploy from a branch」→ Branch「main」、資料夾「/ (root)」→「Save」。
  1～2 分鐘後生效：https://xin7355-collab.github.io/star/
- **AI Worker（選用）**：把 `worker/dist/star-ai-worker.js` 貼到 Cloudflare，步驟見 [worker/README.md](../worker/README.md)。

## 常用指令

| 指令 | 用途 | 需要 |
|---|---|---|
| `npm test` | 單元測試（計算核心、紀錄、Worker、PWA 規則） | 只要 Node 20 以上，不用安裝套件 |
| `npm ci --ignore-scripts` | 安裝開發套件（版本固定在 package-lock.json） | 下面幾個指令都要先跑 |
| `npm run test:e2e` | 手機尺寸端對端測試（Playwright，iPhone 13） | 加 `PW_WEBKIT=1` 另跑 WebKit |
| `npm run qa:design` | design-qa 版面稽核：320／390／1440 與長內容 76 張快照，全部要 CLEAN | Python 3 |
| `npm run build` | 重新打包 `vendor/`（農曆、紫微、天文函式庫）與 `worker/dist/` | |
| `node scripts/gen-preload.mjs` | 重新產生 `index.html` 的 modulepreload 清單 | |
| `python3 scripts/gen-zh-map.py` | 重新產生簡轉繁對照表 `js/core/zh-data.js` | `pip install -r requirements-dev.txt` |
| `python3 scripts/gen-kangxi.py` | 重新產生康熙筆畫與讀音 `js/core/kangxi-data.js`（自動下載 cjk-unihan 0.0.3、核對 sha512） | npm |

## 改前端時的規則

- 新增前端檔案（`js/`、`css/`、`vendor/`）要加進 `sw.js` 的 `ASSETS`，否則離線打不開（`tests/pwa.test.js` 會擋）。
- 每次改前端都把 `js/version.js`、`version.json`、`sw.js` 的版本號一起改（測試檢查三者一致）；
  手機上的舊頁面看到新版本號會自動更新。
- 改了 import 關係後跑 `node scripts/gen-preload.mjs`（測試檢查清單同步）。預設分頁「今日」一定會動態載入的模組列在
  `EAGER`，也一起預載；其他分頁的模組維持用到才載入。
- 畫面文字一律用 `textContent`，不用 `innerHTML`（測試會擋）。換掉子元素用 `dom.js` 的 `fill()`，
  不要直接用 `replaceChildren`（它會把 null 印成文字「null」，測試會擋）。
- 動畫只動 transform／opacity；要尊重「減少動態效果」（`css/app.css` 檔尾、`js/ui/motion.js`）。
  分數環的 `--p` 要是可繼承的（進度弧畫在 `::before`）。
- 函式庫輸出的簡體字經 `js/core/zh.js` 的 `tw()` 轉成台灣繁中。
- 不得新增任何把名單、生日、紀錄送出去的請求（E2E 的隱私測試會擋）。

## 自動檢查（GitHub Actions：`.github/workflows/test.yml`）

每次 push 都跑：

1. **unit**：`npm test`，再重新打包並確認 `vendor/`、`worker/dist/`、`index.html` 和 repo 裡的一樣（防止改了原始碼忘記重打包）。
2. **e2e**：Chromium 與 WebKit（Safari 的引擎）各跑一次 E2E（預設在「減少動態效果」下跑，另有一組開著動畫），
   再跑 design-qa；報告與快照上傳成 Actions 附件（保留 7 天）。

結果在 https://github.com/xin7355-collab/star/actions 。

## 檔案結構

```
index.html, manifest.webmanifest, sw.js, version.json, icons/   PWA 外殼（分頁圖示是 index.html 裡的 SVG）
css/tokens.css        顏色等設計變數（全站只從這裡取色；主題「星夜鎏金」）
css/app.css           樣式與動畫（手機優先，檔尾是「減少動態效果」）
js/app.js             分頁切換（今日、時運、命盤、占卜、我的）、分享面板、提示訊息、本機資料
js/config.js          AI Worker 網址（公開設定，不放金鑰）
js/version.js         版本號
js/core/              計算核心（不碰畫面，可在 Node 測試）
  date.js tz.js places.js     生日解析、時區與夏令時、出生地
  astro.js natal.js zodiac.js 行星位置、上升天頂、本命資料、星座
  fortune.js synastry.js      運勢計分、配對（快速看星座；精準看兩張星盤的度數相位）
  tarot.js tarot-reading.js   塔羅抽牌；牌位情境、主題（感情／工作／財運）、整副牌陣分析
  calendar.js                 農曆換算、農民曆
  bazi.js ziwei.js            八字（大運流年、犯太歲）、紫微
  geju.js                     八字月令格局（子平真詮的取格與成敗救應）
  ziwei-pattern.js            紫微雙主星組合、三方四正、命宮格局
  maya.js numerology.js chenggu.js  瑪雅曆、生命靈數、稱骨
  name.js name-texts.js zhuyin.js kangxi-data.js  姓名學（康熙筆畫、五格三才、81 數理、注音）
  timing.js                   吉時表、擇日、近期提醒（逆行、日月食、月相、換流月）
  career.js                   工作性質（多系統投票）、喜用行業、未來三年與十年方向
  fengshui.js                 開運佈置：財庫、八宅命卦、九宮飛星、明財位、水晶／魚／植物
  fengshui-fix.js             格局改不了的化解（30 種形煞，能改／擋／化三段）、八宅凶方與飛星的化解原理
  family.js                   家人關係：兩人互動、通關五行、六親與宮位、全家五行與房間方位
  iching.js iching-texts.js   梅花易數起卦、六十四卦白話、體用四階段與總斷
  liuyao.js                   六爻納甲：八宮世應、六親六神、用神旺衰、動變、伏神、應期
  jiehuo.js                   解惑的困擾類型與具體步驟
  blood.js                    血型性格與相處（流行文化）
  windfall.js                 偏財指數、樂透幸運號碼
  daily.js                    今日綜合指數、幸運色與方位
  reading.js reading-texts.js 多系統綜合解讀、多胞胎、各系統白話內容
  records.js                  名單與紀錄的驗證、備份格式
  zh.js zh-data.js            簡轉台灣繁中
js/ui/                共用元件（生日表單、圖卡、儲存、AI 佇列、自動更新、動畫 motion.js、圖示 icons.js、命理圖 charts.js（羅盤、飛星路線、五行生剋圖、八卦載入、塔羅牌面）、
                      吉時條／彩球／時間軸／擇日格 widgets.js）
js/views/             today（今日）、fortune（時運）、destiny（命盤：tool-career、tool-fengshui、tool-family、tool-blood）、
                      oracle（占卜：jiehuo、tarot、lotto、match）、me（我的）；profile.js 把一個人的各系統命盤一次算好
vendor/               打包好的第三方函式庫（來源與授權見 NOTICE.md）
worker/               Cloudflare Worker（AI 代理，選用）
scripts/              打包、產生清單與資料、本機伺服器、design-qa
tests/                單元測試；tests/e2e/ 手機尺寸端對端測試
docs/qa/              design-qa 狀態表、豁免、簽核、效能紀錄
.claude/skills/       開發用技能（見下）
```

## 開發用技能（`.claude/skills/`，來源 skl，MIT）

| 技能 | 在這個專案用來 |
|---|---|
| app-guardrails-audit | 防禦健檢：金鑰外洩、併發、退避、OOM 等 |
| idea-precheck | 選函式庫前查現成方案、授權與維護（結論在 DECISIONS.md） |
| source-driven-development | 實作照官方文件與原始碼，不憑記憶 |
| dependency-auditor | 授權與漏洞掃描 |
| commit-craft | commit 訊息格式、推送前掃金鑰 |
| e2e-testing | `tests/e2e/` 的寫法與 CI |
| design-qa | `npm run qa:design`、`docs/qa/` |
| performance-optimization | modulepreload、延後載入大型函式庫（`docs/qa/performance.md`） |
| zh-tw-humanizer | 畫面文字的台灣用語檢查 |
| ai-model-router | Worker 只寫等級（smart），模型下架自動換 |
