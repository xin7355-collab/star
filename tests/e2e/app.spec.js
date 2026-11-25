// 手機尺寸端對端測試：真的打開網頁、點按鈕，確認功能、隱私（不上傳）、離線與版面。
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const SERVE = fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));

const ME = {
  id: 'p-0123456789abcdef', name: '我', fullName: '王小明', birthOrder: 0, gender: '男', self: true, createdAt: '2026-11-24T00:00:00.000Z',
  raw: { calendar: 'solar', era: 'roc', year: 79, month: 8, day: 15, leap: false, knowTime: true, time: '06:20', placeId: 'taipei', lat: null, lon: null, tz: 'Asia/Taipei', fold: null, solar: null },
};

/** 預先放一筆名單（只在第一次載入時），讓測試直接從有資料的狀態開始 */
async function seed(page, people = [ME], settings = {}) {
  await page.addInitScript(([list, extra]) => {
    if (!localStorage.getItem('star.v1.people')) {
      localStorage.setItem('star.v1.people', JSON.stringify(list));
      localStorage.setItem('star.v1.settings', JSON.stringify({ activeId: list[0].id, sect: 1, solarTime: 'standard', ...extra }));
    }
  }, [people, settings]);
}

const tab = (page, view) => page.locator(`.tabbar [data-view="${view}"]`).click();
/** 「占卜」分頁裡切到某個面板 */
async function oracle(page, label) {
  await tab(page, 'oracle');
  await page.locator('#view-oracle .seg label', { hasText: label }).click();
}

let errors;
let failedRequests;
test.beforeEach(async ({ page }) => {
  errors = [];
  failedRequests = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // 附上來源網址：「Failed to load resource」本身不說是哪個檔案，CI 偶發失敗時才查得出原因
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()} @ ${m.location().url || '?'}`); });
  page.on('requestfailed', (r) => failedRequests.push(`${r.url()}（${r.failure()?.errorText || '?'}）`));
});
test.afterEach(() => {
  expect(errors, `不應有執行期錯誤；失敗的請求：${failedRequests.join('、') || '無'}`).toEqual([]);
});

/** 另開一個本機伺服器（系統自動挑連接埠）；stop() 之後網站就連不上，跟手機沒訊號一樣 */
async function startServer() {
  const proc = spawn(process.execPath, [SERVE, '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const url = await new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => {
      const m = String(d).match(/http:\/\/127\.0\.0\.1:\d+\//);
      if (m) resolve(m[0]);
    });
    proc.once('exit', (code) => reject(new Error(`測試伺服器沒啟動就結束了（${code}）`)));
  });
  return { url, stop: () => new Promise((r) => { proc.once('exit', r); proc.kill(); }) };
}

test('第一次使用：輸入生日 → 星盤、農曆生日、今日運勢、時運與農民曆', async ({ page }) => {
  await page.goto('/');
  const me = page.locator('#view-me');
  await me.locator('.birth-form input[type="text"]').first().fill('我');
  await me.locator('.seg label', { hasText: '男' }).click();
  await me.locator('input[inputmode="numeric"]').fill('79');
  await me.locator('.birth-form select').nth(0).selectOption('8');
  await me.locator('.birth-form select').nth(1).selectOption('15');
  await me.locator('label.check', { hasText: '我知道出生時間' }).locator('input').check();
  await me.locator('input[type="time"]').fill('06:20');
  await me.getByRole('button', { name: '計算並儲存' }).click();
  await expect(me.locator('.hero-title')).toHaveText('獅子座');
  await expect(me.getByText('上升：處女座')).toBeVisible();
  await expect(me.getByText(/農曆：庚午年 六月廿五・生肖馬/)).toBeVisible();

  await me.getByRole('button', { name: '今日運勢' }).click();
  const today = page.locator('#view-today');
  await expect(today.locator('#today-hero .score-ring b')).toHaveText(/^\d{1,2}$/);
  await expect(today.locator('.hours .hour')).toHaveCount(13);

  await tab(page, 'fortune');
  const fv = page.locator('#view-fortune');
  await expect(fv.locator('.sign-btn.selected')).toContainText('獅子');
  await expect(fv.locator('.chip-row.yi .chip').first()).toBeVisible();
  await fv.locator('.period-bar label', { hasText: '今年' }).click();
  await expect(fv.locator('ol.days li').first()).toBeVisible();
  await expect(fv.locator('.card').first().locator('ol.days li')).toHaveCount(12);
});

test('今日：綜合指數有依據、吉時表可點、偏財與幸運號碼可再換一組', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  const today = page.locator('#view-today');
  await expect(today.locator('#today-hero h2')).toHaveText(/，小明$/);
  await today.locator('summary', { hasText: '這個分數怎麼來的' }).click();
  await expect(today.locator('#today-hero .sys', { hasText: '八字' })).toBeVisible();
  await expect(today.locator('#today-hero .sys', { hasText: '農民曆' })).toBeVisible();
  // 吉時表：點 11 點那格（2026-11-24 是白虎、諸事不宜，但測試日期不固定，只檢查有說明）
  await today.locator('.hour').nth(6).click();
  await expect(today.locator('.hour').nth(6)).toHaveAttribute('aria-pressed', 'true');
  await expect(today.locator('.hour-detail h3')).toContainText('11:00–12:59');
  // 幸運號碼：大樂透 6 顆，換一組後仍是 6 顆
  const balls = today.locator('.balls .ball');
  await expect(balls).toHaveCount(6);
  await today.getByRole('button', { name: '再換一組' }).click();
  await expect(balls).toHaveCount(6);
  await today.getByRole('combobox', { name: '選擇彩券' }).selectOption('superlotto638');
  await expect(today.locator('.balls .ball')).toHaveCount(7); // 第一區 6＋第二區 1
  await expect(today.getByText('不會提高中獎機率')).toBeVisible();
});

test('時運：近期提醒與擇日（換活動、點日期看理由）', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await tab(page, 'fortune');
  const fv = page.locator('#view-fortune');
  await expect(fv.locator('#reminders ol.timeline li').first()).toBeVisible();
  await expect(fv.locator('#reminders .tl-basis').first()).toContainText('依據');
  const choose = fv.locator('#choose-day');
  await choose.getByRole('combobox', { name: '想做的事' }).selectOption('move');
  await expect(choose.locator('.heat button')).toHaveCount(30);
  await expect(choose.locator('ol.pairs li')).toHaveCount(5);
  await choose.locator('.heat button').nth(3).click();
  await expect(choose.locator('.hour-detail h3')).toContainText('分');
  // 農民曆裡也有這天的時辰吉凶
  await expect(fv.locator('.almanac .hours .hour')).toHaveCount(13);
});

test('命盤：綜合解讀、八字、流年、紫微、姓名、瑪雅、生命靈數、稱骨都算得出來', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await tab(page, 'destiny');
  const dv = page.locator('#view-destiny');
  // 預設是綜合解讀：共同點至少兩個系統，七個面向
  await expect(dv.locator('.trait').first()).toBeVisible();
  await expect(dv.locator('.trait .count').first()).toHaveText(/[2-9] 個系統/);
  await expect(dv.locator('details.area')).toHaveCount(7);
  await dv.locator('details.area summary', { hasText: '財運' }).click();
  await expect(dv.locator('details.area[open] .sys', { hasText: '紫微' }).first()).toBeVisible();
  const tool = dv.getByRole('combobox', { name: '選擇命理工具' });
  await tool.selectOption('bazi');
  await expect(dv.locator('table.pillars tr.big').first()).toContainText('庚甲壬癸');
  // 格局：申月本氣庚透年干 → 偏印格；印章與成敗說明都在
  await expect(dv.locator('.geju-head h3')).toContainText('格局：偏印格');
  await expect(dv.locator('.seal')).toHaveText('偏印格');
  await tool.selectOption('liunian');
  await expect(dv.getByText(/犯太歲/).first()).toBeVisible();
  await tool.selectOption('ziwei');
  await expect(dv.locator('.ziwei-grid .palace')).toHaveCount(12);
  // 一打開就示範命宮的三方四正：連線、三個被照會的宮；命宮格局列出機月同梁
  await expect(dv.locator('.sf-lines polygon')).toHaveCount(1);
  await expect(dv.locator('.palace.sf-on')).toHaveCount(3);
  await expect(dv.locator('ul.reasons li', { hasText: '機月同梁' })).toBeVisible();
  await dv.locator('.palace', { hasText: '財帛' }).click();
  await expect(dv.locator('.palace-detail h3')).toContainText('財帛');
  await expect(dv.locator('.palace-detail')).toContainText('同陰同宮');
  await expect(dv.locator('.palace-detail')).toContainText('化忌在財帛');
  // 以前 map 把索引當宮名傳進去，畫面出現「化忌在0」
  await expect(dv.locator('.palace-detail')).not.toContainText(/在[0-9]/);
  await dv.locator('.palace', { hasText: '命宮' }).click();
  await expect(dv.locator('.palace-detail h3')).toContainText('命宮');
  await tool.selectOption('name');
  // 王小明：天格 5、人格 7、地格 11、外格 9、總格 15
  await expect(dv.locator('.grid-cell .gv')).toHaveText(['5', '7', '11', '9', '15']);
  await expect(dv.locator('.name-char .zy')).toHaveText(['ㄨㄤˊ', 'ㄒㄧㄠˇ', 'ㄇㄧㄥˊ']);
  await tool.selectOption('maya');
  await expect(dv.locator('.maya-cell')).toHaveCount(5);
  await tool.selectOption('numerology');
  await expect(dv.locator('.score-ring b')).toHaveText('33／6');
  // 1990-08-15：只有事業線（1-5-9），空缺 2、3、4、6、7；另一派圈進天賦數 3、3 與生命數 6 會多出智慧線
  await expect(dv.locator('.nine-lines line')).toHaveCount(1);
  await expect(dv.getByRole('heading', { name: '空缺數：2、3、4、6、7' })).toBeVisible();
  await dv.locator('summary', { hasText: '另一派' }).click();
  await expect(dv.getByText(/多了智慧線/)).toBeVisible();
  await tool.selectOption('chenggu');
  await expect(dv.locator('blockquote.poem')).toBeVisible();
  await expect(dv.getByText(/現代看法/)).toBeVisible();
  await dv.getByRole('button', { name: '存到紀錄' }).click();
  await tab(page, 'me');
  await expect(page.locator('#view-me summary', { hasText: '查詢紀錄（1）' })).toBeVisible();
});

test('擇日排除歲破月破、農民曆吉神與胎神、八字記號、流年天剋地沖、本月飛星（固定 2026-11-24）', async ({ page }) => {
  // 流年、月份飛星跟日期有關：把時鐘固定住，明年跑也是同一組答案
  await page.clock.setFixedTime(new Date('2026-11-24T10:00:00+08:00'));
  await seed(page);
  await page.goto('/');
  await tab(page, 'fortune');
  const fv = page.locator('#view-fortune');
  const choose = fv.locator('#choose-day');
  await choose.getByRole('combobox', { name: '想做的事' }).selectOption('move');
  await expect(choose.getByText(/30 天裡有 \d+ 天是歲破、月破或四離四絕日/)).toBeVisible();
  await fv.locator('summary', { hasText: '吉神凶煞、胎神' }).click();
  for (const label of ['吉神宜趨：', '凶煞宜忌：', '胎神占方：', '二十八宿：', '今年農民曆：']) {
    await expect(fv.locator('li', { hasText: label }).first()).toBeVisible();
  }
  await tab(page, 'destiny');
  const dv = page.locator('#view-destiny');
  const tool = dv.getByRole('combobox', { name: '選擇命理工具' });
  await tool.selectOption('bazi');
  await expect(dv.locator('table.pillars th', { hasText: '十二長生' })).toBeVisible();
  await expect(dv.getByRole('heading', { name: /^喜用神：/ })).toBeVisible();
  // 壬子日柱的旬空是寅卯，時柱癸卯落空
  await expect(dv.getByText(/空亡（日柱旬空）：寅卯，落在時柱/)).toBeVisible();
  await tool.selectOption('liunian');
  await expect(dv.locator('.ln-head').first()).toContainText('2026 丙午');
  await expect(dv.locator('.ln-head').first().locator('.badge.danger', { hasText: '天剋地沖' })).toBeVisible();
  await tool.selectOption('fengshui');
  await expect(dv.locator('.luoshu .ls-month')).toHaveCount(9);
  await expect(dv.getByText(/小字是這個月（11\/7–12\/6）的星/)).toBeVisible();
  // 羅盤標出八宅吉凶（坎卦：生氣東南、絕命西南），九宮格疊上飛星路線
  await expect(dv.locator('svg.luopan')).toHaveAttribute('aria-label', /吉方 生氣東南.*凶方.*絕命西南/);
  await expect(dv.locator('.luoshu-wrap .fly-path polyline')).toHaveCount(1);
  // 格局改不了的化解：勾了之後出現三段做法，重新整理還記得
  const fix = dv.locator('#fs-fix');
  await fix.getByRole('combobox', { name: '哪個地方有狀況' }).selectOption('bedroom');
  await fix.locator('label.check', { hasText: '床的上方有橫樑' }).click();
  await expect(fix.locator('details.fix', { hasText: '床的上方有橫樑' }).locator('.fix-tag')).toHaveText(['能改就改', '改不了：擋', '擋不了：化']);
  await expect(dv.getByText('改不了：').first()).toBeVisible(); // 辦公座位每條都有替代做法
  await page.reload();
  await tab(page, 'destiny');
  await expect(page.locator('#fs-fix details.fix', { hasText: '床的上方有橫樑' })).toBeVisible();
  // 八字：神煞、五行生剋圖；流年：干支各自對照喜用
  await page.locator('#view-destiny').getByRole('combobox', { name: '選擇命理工具' }).selectOption('bazi');
  await expect(page.locator('#view-destiny').getByRole('heading', { name: /^神煞（天乙貴人、羊刃、桃花、驛馬）$/ })).toBeVisible();
  await expect(page.locator('#view-destiny svg.wx-wheel')).toHaveAttribute('aria-label', /日主水.*喜用火、木/);
  await page.locator('#view-destiny').getByRole('combobox', { name: '選擇命理工具' }).selectOption('liunian');
  await expect(page.locator('#view-destiny .ln-head').first().locator('.badge', { hasText: '干喜・支喜' })).toBeVisible();
  // 近期提醒：滿月寫出落在哪一座
  await tab(page, 'fortune');
  await expect(page.locator('#reminders')).toContainText('雙子座滿月');
});

test('家人關係：關係圖、誰幫誰、從你的命盤看家人、其他家人之間、今年要注意、房間方位', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-24T10:00:00+08:00'));
  const raw = (y, m, d, time) => ({ calendar: 'solar', era: 'ad', year: y, month: m, day: d, leap: false, knowTime: !!time, time: time || '', placeId: 'taipei', lat: null, lon: null, tz: 'Asia/Taipei', fold: null, solar: null });
  const at = '2026-11-24T00:00:00.000Z';
  await seed(page, [
    ME,
    { id: 'p-1111111111111111', name: '爸爸', gender: '男', relation: 'parent', createdAt: at, raw: raw(1960, 3, 10, '09:00') },
    { id: 'p-2222222222222222', name: '媽媽', gender: '女', relation: 'parent', createdAt: at, raw: raw(1962, 11, 20) },
    { id: 'p-3333333333333333', name: '老婆', gender: '女', relation: 'spouse', createdAt: at, raw: raw(1991, 12, 1, '22:10') },
    { id: 'p-4444444444444444', name: '妹妹', gender: '女', relation: 'sibling', createdAt: at, raw: raw(1993, 5, 5) },
  ]);
  await page.goto('/');
  await tab(page, 'destiny');
  const dv = page.locator('#view-destiny');
  await dv.getByRole('combobox', { name: '選擇命理工具' }).selectOption('family');
  await expect(dv.locator('svg.fam-map .fam-edge')).toHaveCount(4);
  await expect(dv.locator('svg.fam-map')).toHaveAttribute('aria-label', /爸爸：爸爸是你的助力/);
  const pairs = dv.locator('section.card', { hasText: '你和每位家人' }).locator('details.fam-pair');
  await expect(pairs).toHaveCount(4);
  await pairs.filter({ hasText: '老婆（配偶、伴侶）' }).locator('summary').click();
  await expect(pairs.filter({ hasText: '老婆' })).toContainText('從你的命盤看另一半');
  await expect(pairs.filter({ hasText: '老婆' })).toContainText('流年午沖到日支（夫妻宮）');
  await expect(dv.getByRole('heading', { name: '其他家人之間' })).toBeVisible();
  await expect(dv.getByText(/^爸爸 ↔ 媽媽$/)).toBeVisible();
  await expect(dv.getByRole('heading', { name: '2026 年家裡要注意' })).toBeVisible();
  await expect(dv.getByRole('heading', { name: '房間怎麼分（八宅）' })).toBeVisible();
  // 「我的」編輯家人時看得到「和我的關係」
  await tab(page, 'me');
  await page.locator('#view-me ul.people li', { hasText: '媽媽' }).getByRole('button', { name: '編輯' }).click();
  await expect(page.getByRole('combobox', { name: '和我的關係' })).toHaveValue('parent');
});

test('多胞胎：第 2 個出生時紫微借兄弟宮，解讀說明哪裡一樣哪裡不同', async ({ page }) => {
  await seed(page, [{ ...ME, name: '弟弟', fullName: '', birthOrder: 2, self: false }]);
  await page.goto('/');
  await tab(page, 'destiny');
  const dv = page.locator('#view-destiny');
  await expect(dv.getByText('多胞胎怎麼看')).toBeVisible();
  await expect(dv.getByText(/上升星座平均每 2 小時換一個/)).toBeVisible();
  // 填了出生順序就要自動把出生時分加進瑪雅曆（否則兩個雙胞胎的瑪雅結果一模一樣）
  await expect(dv.getByText(/已把出生時分加進計算/)).toBeVisible();
  await dv.getByRole('combobox', { name: '選擇命理工具' }).selectOption('ziwei');
  await expect(dv.getByText(/多胞胎第 2 個出生/)).toBeVisible();
  await dv.locator('.palace', { hasText: '命宮' }).click();
  await expect(dv.locator('.palace-detail h3')).toContainText('原本的兄弟');
  await dv.getByRole('combobox', { name: '選擇命理工具' }).selectOption('maya');
  await expect(dv.locator('#maya-twin')).toBeChecked();
});

test.describe('動畫開啟時', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('今日：分數環轉到分數、數字數到分數、彩球與吉時條都出現，沒有錯誤', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    const ring = page.locator('#today-hero .score-ring');
    const label = await ring.getAttribute('aria-label');
    const score = label.match(/(\d+) 分/)[1];
    await expect(ring.locator('b')).toHaveText(score);
    // 進度弧畫在 ::before：要檢查偽元素拿到的 --p（只看外層元素會漏掉「弧沒畫出來」的錯）
    await expect.poll(() => ring.evaluate((el) => getComputedStyle(el, '::before').getPropertyValue('--p').trim())).toBe(score);
    await expect(page.locator('#view-today .balls .ball')).toHaveCount(6);
    await expect(page.locator('#view-today .hours .hour')).toHaveCount(13);
    await tab(page, 'destiny');
    await expect(page.locator('#view-destiny .trait').first()).toBeVisible();
  });

  test('塔羅儀式：洗牌、扇形、點牌與停留抽牌、翻牌；關掉＝不抽；動畫強度「輕量」不進儀式', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await oracle(page, '塔羅');
    const tv = page.locator('#oracle-tarot');
    await tv.getByRole('button', { name: '洗牌並抽牌' }).click();
    const rt = page.getByRole('dialog', { name: /抽牌儀式/ });
    await expect(rt).toBeVisible();
    // 關掉＝不抽：沒有結果
    await rt.getByRole('button', { name: '關閉，不抽牌' }).click();
    await expect(page.locator('.rt')).toHaveCount(0);
    await expect(tv.locator('ol.tarot-list')).toHaveCount(0);
    // 點一張、手指停在一張上 0.6 秒（金邊畫滿）抽一張、剩下的「幫我隨機挑」
    await tv.getByRole('button', { name: '洗牌並抽牌' }).click();
    await expect(page.locator('.rt-fan:not(.shuffling)')).toHaveCount(1, { timeout: 5000 });
    const fanCards = page.locator('.rt-card:not(.taken)');
    let b = await fanCards.nth(20).boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + 10);
    await expect(page.locator('.rt-count')).toHaveText('已選 1／3');
    b = await fanCards.nth(50).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + 10);
    await page.mouse.down();
    await expect(page.locator('.rt-count')).toHaveText('已選 2／3', { timeout: 3000 });
    await page.mouse.up();
    await expect(page.locator('.rt-count')).toHaveText('已選 2／3'); // 放開不會多抽一張
    await page.getByRole('button', { name: '幫我隨機挑' }).click();
    await expect(page.locator('.rt-slot .tc')).toHaveCount(3);
    await page.getByRole('button', { name: '看完整解讀' }).click();
    await expect(page.locator('.rt')).toHaveCount(0);
    await expect(tv.locator('ol.tarot-list > li')).toHaveCount(3);
    // 輕量：不進儀式、直接出結果
    await tab(page, 'me');
    await page.locator('#view-me summary', { hasText: '顯示與動畫' }).click();
    await page.locator('#view-me .seg label', { hasText: '輕量' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'lite');
    await oracle(page, '塔羅');
    await tv.getByRole('button', { name: '洗牌並抽牌' }).click();
    await expect(tv.locator('ol.tarot-list > li')).toHaveCount(3);
    await expect(page.locator('.rt')).toHaveCount(0);
  });
});

test('名單：新增農曆生日的家人（不搶走「我」）、從名單配對、塔羅，都記到本機紀錄', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await tab(page, 'me');
  const me = page.locator('#view-me');
  await me.getByRole('button', { name: '＋ 新增家人朋友' }).click();
  const form = me.locator('.card').first();
  await form.locator('.birth-form input[type="text"]').first().fill('媽媽');
  await form.locator('.seg label', { hasText: '女' }).click();
  await form.locator('.seg label', { hasText: '農曆生日' }).click();
  await form.locator('input[inputmode="numeric"]').fill('89');
  await form.locator('.birth-form select').nth(0).selectOption('2');
  await form.locator('.birth-form select').nth(1).selectOption('16');
  await form.locator('summary', { hasText: '進階' }).click();
  await form.getByRole('textbox', { name: '本名（姓名學用）' }).fill('陳美玲');
  await form.getByRole('button', { name: '計算並儲存' }).click();
  await expect(me.locator('ul.people li')).toHaveCount(2);
  await expect(me.getByText('民國 89 年 農曆二月十六')).toBeVisible();
  await expect(me.getByText(/本名 陳美玲/)).toBeVisible();
  await expect(me.locator('.person-switch select')).toHaveValue(ME.id);

  await oracle(page, '配對');
  const mv = page.locator('#oracle-match');
  await mv.locator('.seg label', { hasText: '精準' }).click();
  await mv.getByRole('button', { name: '開始配對' }).click();
  await expect(mv.locator('.match-result h2')).toHaveText('我 × 媽媽');
  // 精準配對看兩張星盤的度數相位：四項分類、主要相位附度數差
  await expect(mv.locator('.match-result .bar')).toHaveCount(4);
  await expect(mv.getByRole('heading', { name: '兩張星盤的主要相位' })).toBeVisible();
  await expect(mv.locator('.match-result ul.reasons li').first()).toContainText('°');

  await oracle(page, '塔羅');
  const tv = page.locator('#oracle-tarot');
  await tv.locator('.seg label', { hasText: '工作' }).click();
  await tv.getByRole('button', { name: '洗牌並抽牌' }).click();
  await expect(tv.locator('ol.tarot-list > li')).toHaveCount(3);
  // 每張牌有牌面圖、依主題的解讀；三張以上有整副牌的總結
  await expect(tv.locator('ol.tarot-list .tc')).toHaveCount(3);
  await expect(tv.locator('.tarot-topic').first()).toHaveText(/^工作：/);
  await expect(tv.locator('.tarot-summary')).toHaveText(/^從.+到.+，可能走向/);

  await tab(page, 'me');
  await expect(page.locator('#view-me summary', { hasText: '查詢紀錄（2）' })).toBeVisible();
});

test('占卜：樂透選號（今日固定、隨機一組、機率表、存紀錄）', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await oracle(page, '樂透');
  const lv = page.locator('#oracle-lotto');
  await expect(lv.locator('ol.days li')).toHaveCount(7);
  const first = await lv.locator('.balls').getAttribute('aria-label');
  await lv.getByRole('button', { name: '隨機抽一組' }).click();
  await lv.getByRole('button', { name: '今日號碼' }).click();
  await expect(lv.locator('.balls')).toHaveAttribute('aria-label', first); // 今日號碼固定
  await lv.getByRole('combobox', { name: '選擇彩券' }).selectOption('dailycash');
  await expect(lv.locator('.balls .ball')).toHaveCount(5);
  await expect(lv.locator('table.compare tbody tr')).toHaveCount(3);
  await lv.getByRole('button', { name: '存到紀錄' }).click();
  await expect(page.locator('#toast')).toContainText('已存到');
});

/** 第一次使用的生日表單填「農曆」生日（會用到延後載入的農曆函式庫） */
async function fillLunarFirstUse(page) {
  const me = page.locator('#view-me');
  await me.locator('.birth-form input[type="text"]').first().fill('我');
  await me.locator('.seg label', { hasText: '農曆生日' }).click();
  await me.locator('input[inputmode="numeric"]').fill('79');
  await me.locator('.birth-form select').nth(0).selectOption('6');
  await me.locator('.birth-form select').nth(1).selectOption('25');
  return me;
}

test.describe('送出狀態（攔截農曆函式庫的下載）', () => {
  // service worker 會先接手請求，page.route 就攔不到；這組測試關掉 service worker
  test.use({ serviceWorkers: 'block' });

  test('送出中：按鈕顯示「計算中…」並鎖住，不會重複送出', async ({ page }) => {
    let release;
    const gate = new Promise((r) => { release = r; });
    await page.route('**/vendor/lunar.js', async (route) => { await gate; await route.continue(); });
    await page.goto('/', { waitUntil: 'domcontentloaded' }); // 函式庫被卡住，不能等 networkidle
    const me = await fillLunarFirstUse(page);
    const btn = me.locator('.actions .btn.primary');
    await btn.click();
    await expect(btn).toHaveText('計算中…');
    await expect(btn).toBeDisabled();
    release();
    await expect(me.locator('.hero-title')).toHaveText('獅子座');
  });

  // 「再按一次」會不會成功看瀏覽器：Chrome 157 會重抓失敗的模組，Chrome 153 會記住失敗（CI 實測），
  // 所以這裡只驗提示與保留資料；提示裡已給「仍失敗請重新開啟 App」的退路
  test('載入失敗：提示能做什麼、已填資料保留', async ({ page }) => {
    await page.route('**/vendor/lunar.js', (route) => route.abort());
    await page.goto('/');
    const me = await fillLunarFirstUse(page);
    await me.locator('.actions .btn.primary').click();
    await expect(page.locator('#toast')).toContainText('農曆換算元件載入失敗：請確認網路後再按一次；仍失敗請重新開啟 App');
    await expect(me.locator('.birth-form input[type="text"]').first()).toHaveValue('我');
    await expect(me.locator('input[inputmode="numeric"]')).toHaveValue('79');
    await expect(me.locator('.actions .btn.primary')).toBeEnabled(); // 失敗後按鈕要恢復，才能再試
    // 瀏覽器會記「資源載入失敗」，這是本測試故意造成的
    errors = errors.filter((e) => !/Failed to load resource|lunar\.js|module script/i.test(e));
  });
});

test('備份：匯出 → 清除 → 匯入，名單與紀錄都還原', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await oracle(page, '塔羅');
  await page.locator('#oracle-tarot').getByRole('button', { name: '洗牌並抽牌' }).click();
  await tab(page, 'me');
  const me = page.locator('#view-me');
  await me.locator('summary', { hasText: '備份與隱私' }).click();
  await me.getByRole('button', { name: '匯出備份檔' }).click();
  const link = page.locator('#sheet a[download]');
  await expect(link).toBeVisible();
  const backup = await page.evaluate(async (u) => (await fetch(u)).text(), await link.getAttribute('href'));
  const data = JSON.parse(backup);
  expect(data.app).toBe('star');
  expect(data.people).toHaveLength(1);
  expect(data.history).toHaveLength(1);
  await page.click('#sheet-close');

  page.once('dialog', (d) => d.accept());
  await me.getByRole('button', { name: '清除這支手機上的全部資料' }).click();
  await expect(me.getByRole('heading', { name: '輸入你的生日' })).toBeVisible();
  await me.locator('summary', { hasText: '備份與隱私' }).click();
  await me.locator('input[type="file"]').setInputFiles({ name: 'star-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await me.getByRole('button', { name: '合併（保留手機上的）' }).click();
  await expect(page.locator('#toast')).toContainText('名單 1 人、紀錄 1 筆');
  await expect(me.locator('ul.people li')).toHaveCount(1);
});

test('隱私：所有請求都在同網域、沒有送出任何資料，網址不含生日', async ({ page, baseURL }) => {
  const requests = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), post: r.postData() }));
  await seed(page);
  await page.goto('/');
  await expect(page.locator('#today-hero')).toBeVisible();
  for (const view of ['fortune', 'destiny', 'oracle', 'me']) {
    await tab(page, view);
    await page.waitForTimeout(300);
  }
  await oracle(page, '樂透');
  await expect(page.locator('#oracle-lotto .balls')).toBeVisible();
  await tab(page, 'destiny');
  const tool = page.getByRole('combobox', { name: '選擇命理工具' });
  await tool.selectOption('ziwei');
  await expect(page.locator('.ziwei-grid')).toBeVisible();
  await tool.selectOption('name');
  await expect(page.locator('.grids')).toBeVisible();
  const foreign = requests.filter((r) => !r.url.startsWith(baseURL) && !/^(blob|data):/.test(r.url));
  expect(foreign, '不可連到其他網站').toEqual([]);
  expect(requests.filter((r) => r.method !== 'GET'), '不可送出資料（只能有 GET）').toEqual([]);
  expect(requests.filter((r) => /1990|0815|06(%3A|:)20/.test(r.url)), '網址不可帶生日').toEqual([]);
});

// 不用 context.setOffline：CI 的 WebKit 在模擬離線後重新整理直接失敗（WebKit encountered an internal error），
// 分不出是 App 還是模擬本身的問題。改成真的把網站關掉：請求一律連不上，只能靠 service worker 的快取，跟手機沒訊號一樣。
test('離線：載入過一次後，連不上網站也能開啟並計算', async ({ page }) => {
  const server = await startServer();
  try {
    await seed(page);
    await page.goto(server.url);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  } finally {
    await server.stop();
  }
  await page.reload();
  await expect(page.locator('#today-hero .score-ring')).toBeVisible();
  await expect(page.locator('#view-today .hours .hour')).toHaveCount(13);
  await tab(page, 'fortune');
  await expect(page.locator('#view-fortune .chip-row.yi .chip').first()).toBeVisible();
  await tab(page, 'destiny');
  const tool = page.getByRole('combobox', { name: '選擇命理工具' });
  await tool.selectOption('ziwei');
  await expect(page.locator('.ziwei-grid .palace')).toHaveCount(12);
  await tool.selectOption('name'); // 康熙筆畫資料也要能離線載入
  await expect(page.locator('.grids .grid-cell')).toHaveCount(5);
  // 檢查新版的 version.json 刻意不快取：連不上時瀏覽器會記一筆載入失敗，App 照常使用、不提示
  errors = errors.filter((e) => !/version\.json/.test(e));
});

test('命盤：工作與方向、開運佈置（財庫、財位、九宮飛星、擺設）、血型', async ({ page }) => {
  // 年度飛星、流年都是 2026 年的答案：固定時鐘，跨年後才不會變成假失敗
  await page.clock.setFixedTime(new Date('2026-11-24T10:00:00+08:00'));
  await seed(page, [{ ...ME, bloodType: 'O' }]);
  await page.goto('/');
  await tab(page, 'destiny');
  const dv = page.locator('#view-destiny');
  const tool = dv.getByRole('combobox', { name: '選擇命理工具' });
  await tool.selectOption('career');
  await expect(dv.getByRole('heading', { name: '最適合的工作性質' })).toBeVisible();
  await expect(dv.locator('.trait .count').first()).toHaveText(/[2-9] 個系統/);
  await expect(dv.locator('.year-card')).toHaveCount(3);
  await expect(dv.locator('.year-card').first()).toContainText('2026');
  await expect(dv.getByText(/大運 丁亥/)).toBeVisible();
  await tool.selectOption('fengshui');
  await expect(dv.getByText('怎麼改善：開運佈置重點')).toBeVisible();
  await expect(dv.locator('.luoshu .ls-cell')).toHaveCount(9);
  // 大字是年星（小字「本月五黃」是月星，不算）
  await expect(dv.locator('.ls-cell', { has: page.locator('b', { hasText: '五黃' }) })).toContainText('南');
  await expect(dv.getByText(/你是坎卦（東四命）/)).toBeVisible();
  await expect(dv.getByText(/「南」今年剛好是五黃、太歲所在/)).toBeVisible();
  await expect(dv.getByText('養魚：不建議養魚')).toBeVisible();
  await dv.locator('.seg label', { hasText: '左邊' }).click();
  await expect(dv.getByText(/右手邊最裡面/).first()).toBeVisible();
  await tool.selectOption('blood');
  await expect(dv.getByRole('combobox', { name: '血型' })).toHaveValue('O');
  await expect(dv.getByText(/個性：目標明確/)).toBeVisible();
  await tool.selectOption('reading');
  await expect(dv.locator('.sys.sys-血型').first()).toBeVisible();
});

test('占卜：解惑（選困擾、起卦、命盤、好日子、具體做法、存紀錄；問題文字不送出）', async ({ page }) => {
  await seed(page);
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.goto('/');
  await oracle(page, '解惑');
  const jv = page.locator('#oracle-jiehuo');
  await jv.getByRole('combobox', { name: '困擾的類型' }).selectOption('health');
  const q = '最近壓力很大睡不好怎麼辦';
  await jv.getByRole('textbox', { name: '想問的事（可不填）' }).fill(q);
  await jv.getByRole('button', { name: '起卦' }).click();
  await expect(jv.getByText('本卦（現況）')).toBeVisible();
  await expect(jv.locator('.verdict b')).toHaveText(/^(大吉|吉|小吉|小凶|凶)$/);
  await expect(jv.locator('.hexa').first().locator('.yao')).toHaveCount(6);
  await expect(jv.locator('.yao.moving')).toHaveCount(1);
  await expect(jv.locator('.hexa').nth(1).locator('.yao.flip')).toHaveCount(1); // 變卦裡變過來的那一爻會翻轉
  // 梅花總斷：用卦、互卦、變卦一起看
  await expect(jv.locator('.verdict small')).toHaveText(/^(互變俱生|互變俱剋|剋多無生|先吉後凶|先凶後吉|始終皆順|始終不利)$/);
  // 六爻：同一卦排出六行；問健康看世爻，用神那一行有底色、標著「世」
  await expect(jv.getByRole('heading', { name: '六爻細看：事情本身和應期' })).toBeVisible();
  await expect(jv.locator('table.liuyao tbody tr')).toHaveCount(6);
  await expect(jv.locator('table.liuyao tr.yong')).toHaveCount(1);
  await expect(jv.locator('table.liuyao tr.yong .ly-sy')).toHaveText('世');
  await expect(jv.locator('table.liuyao .ly-line.moving')).toHaveCount(1);
  await expect(jv.getByText('應期：接下來 30 天比較可能有消息的日子')).toBeVisible();
  await expect(jv.getByText('你的命盤怎麼看這件事')).toBeVisible();
  await expect(jv.getByText('接下來 30 天適合處理這件事的日子')).toBeVisible();
  await expect(jv.getByText(/1925 安心專線/)).toBeVisible();
  await expect(jv).not.toContainText('[object Object]');
  // 數字起卦：8、16 都是坤、6 是上爻
  await jv.locator('.seg label', { hasText: '自己選三個數字' }).click();
  await jv.getByRole('spinbutton', { name: '第 1 個數字' }).fill('8');
  await jv.getByRole('spinbutton', { name: '第 2 個數字' }).fill('16');
  await jv.getByRole('spinbutton', { name: '第 3 個數字' }).fill('6');
  await jv.getByRole('button', { name: '起卦' }).click();
  await expect(jv.locator('.card-head h2').nth(1)).toContainText('坤為地');
  await jv.getByRole('button', { name: '存到紀錄' }).click();
  await tab(page, 'me');
  await page.locator('#view-me summary', { hasText: '查詢紀錄（1）' }).click();
  await expect(page.locator('#view-me').getByText(/健康、壓力、睡不好・坤為地/)).toBeVisible();
  // 問題文字只存在手機：只向自己的網站拿程式檔，網址裡沒有問題內容
  expect(urls.filter((u) => !u.startsWith('http://127.0.0.1:4173/'))).toEqual([]);
  expect(urls.some((u) => decodeURIComponent(u).includes(q))).toBe(false);
});

test('今日：遇到困難直接到解惑，幸運小物直接到財位與開運擺設', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  const tv = page.locator('#view-today');
  await tv.getByRole('button', { name: '遇到困難？問一卦' }).click();
  await expect(page.locator('#oracle-jiehuo')).toBeVisible();
  await tab(page, 'today');
  await tv.getByRole('button', { name: '財位與開運擺設' }).click();
  await expect(page.getByRole('combobox', { name: '選擇命理工具' })).toHaveValue('fengshui');
  await expect(page.getByText('怎麼改善：開運佈置重點')).toBeVisible();
});

test('版面：320px 寬的手機，各分頁與面板都沒有水平捲動、沒有「null／undefined」字樣', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const stops = [['today'], ['fortune'], ['destiny'], ['destiny', 'name'], ['destiny', 'career'], ['destiny', 'fengshui'], ['destiny', 'family'], ['destiny', 'bazi'], ['destiny', 'blood'], ['oracle', '解惑'], ['oracle', '塔羅'], ['oracle', '樂透'], ['oracle', '配對'], ['me']];
  for (const [view, sub] of stops) {
    if (view === 'oracle') await oracle(page, sub);
    else await tab(page, view);
    if (view === 'destiny' && sub) await page.getByRole('combobox', { name: '選擇命理工具' }).selectOption(sub);
    // 解惑要起過卦，結果（卦象、好日子）才會出現
    if (sub === '解惑') await page.locator('#oracle-jiehuo').getByRole('button', { name: '起卦' }).click();
    await page.waitForTimeout(700);
    const visible = await page.locator(`#view-${view}`).innerText();
    expect(visible, `${view}${sub ? `／${sub}` : ''} 出現程式值`).not.toMatch(/\bnull\b|\bundefined\b|NaN|\[object /);
    const { overflow, culprits } = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      // 列出超出右邊界最多的元素：CI 的 WebKit 才會溢出時，靠這份清單就知道要修哪裡
      const culprits = [...document.querySelectorAll('body *')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ el, r }) => r.width > 0 && r.right > vw + 0.5 && !el.closest('[hidden]'))
        .sort((a, b) => b.r.right - a.r.right)
        .slice(0, 6)
        .map(({ el, r }) => {
          const cs = getComputedStyle(el);
          const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
          return `${el.tagName.toLowerCase()}${cls}「${(el.textContent || '').trim().slice(0, 16)}」left ${Math.round(r.left)} width ${Math.round(r.width)} right ${Math.round(r.right)}（position ${cs.position}、min-width ${cs.minWidth}、white-space ${cs.whiteSpace}）`;
        });
      const overflowNow = () => document.documentElement.scrollWidth - vw;
      const overflow = overflowNow();
      // 外框都沒超出卻還能捲動時（文字、偽元素、表單元件內部溢出）：逐層「只留一個子元素、其他先藏起來」，
      // 留下它仍會捲動就往裡面找，最後停在自己造成溢出的元素（同時有好幾個也找得到其中一個）
      const path = [];
      if (overflow > 0) {
        const pinned = []; // 往下找時把其他分支先藏著，免得別的分支（例如另一張一樣的卡片）干擾判斷；最後全部還原
        const hide = (els) => els.map((el) => { const keep = el.style.display; el.style.display = 'none'; return [el, keep]; });
        const restore = (list) => list.forEach(([el, keep]) => { el.style.display = keep; });
        let node = document.body;
        for (let depth = 0; depth < 30; depth += 1) {
          const kids = [...node.children].filter((k) => getComputedStyle(k).display !== 'none');
          const all = hide(kids);
          const selfCause = overflowNow() > 0;
          restore(all);
          if (selfCause) {
            if (path.length) path.push('（子元素全藏仍會捲動：是它自己的文字、::before／::after 或表單元件內部）');
            break;
          }
          const hit = kids.find((k) => {
            const others = hide(kids.filter((o) => o !== k));
            const still = overflowNow() > 0;
            restore(others);
            return still;
          });
          if (!hit) break;
          pinned.push(...hide(kids.filter((o) => o !== hit)));
          const r = hit.getBoundingClientRect();
          const cls = typeof hit.className === 'string' && hit.className ? `.${hit.className.trim().split(/\s+/).join('.')}` : '';
          path.push(`${hit.tagName.toLowerCase()}${cls}（left ${Math.round(r.left)}、width ${Math.round(r.width)}、scrollWidth ${hit.scrollWidth}、overflow ${getComputedStyle(hit).overflowX}）`);
          node = hit;
        }
        restore(pinned.reverse());
      }
      return { overflow, culprits: culprits.length ? culprits : path.length ? [`只留這一路就會捲動：${path.join(' > ')}`] : [] };
    });
    expect(overflow, `${view}${sub ? `／${sub}` : ''} 不應水平捲動；超出的元素：${culprits.join('；') || '無'}`).toBeLessThanOrEqual(0);
  }
});

test('掌紋：看圖選線形（含斷掌）、拍照描線自動判斷、左右手比較、存進名單；照片不上傳', async ({ page, baseURL }) => {
  await seed(page);
  const requests = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
  await page.goto('/');
  await tab(page, 'destiny');
  const dv = page.locator('#view-destiny');
  await dv.getByRole('combobox', { name: '選擇命理工具' }).selectOption('palm');
  const opts = dv.locator('.palm-options');
  // 看圖自選：第一題是斷掌，選完自動跳到下一題
  await expect(dv.getByRole('heading', { name: /感情線和智慧線是分開的/ })).toBeVisible();
  await opts.getByRole('button', { name: '半斷掌', exact: true }).click();
  await expect(dv.getByRole('heading', { name: /生命線（繞著拇指根部的弧線）/ })).toBeVisible();
  await opts.getByRole('button', { name: '短（到掌中）', exact: true }).click();
  await expect(dv.locator('.palm-item')).toHaveCount(2);
  await expect(dv.getByText(/和壽命長短無關/)).toBeVisible();
  await expect(dv.getByText(/這些說法沒有根據/)).toBeVisible();
  await expect(dv.locator('.trait-scale')).toHaveCount(2);

  // 壞掉的照片：說清楚怎麼辦，不會卡住
  await dv.locator('input[type="file"]').setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') });
  await expect(dv.getByText(/這張照片打不開.+請改用「拍照」直接拍一張/)).toBeVisible();
  // 拍照描線：用程式畫一張手掌圖當照片（測試不用真人照片）
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 800;
    const g = c.getContext('2d');
    g.fillStyle = '#6f6a73';
    g.fillRect(0, 0, 600, 800);
    g.fillStyle = '#e2b59c';
    g.beginPath();
    g.ellipse(300, 520, 170, 230, 0, 0, Math.PI * 2);
    g.fill();
    for (const [x, w] of [[200, 36], [260, 40], [325, 40], [390, 38]]) g.fillRect(x - w / 2, 120, w, 260);
    return c.toDataURL('image/png').split(',')[1];
  });
  await dv.locator('input[type="file"]').setInputFiles({ name: 'palm.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const cv = dv.locator('canvas.palm-canvas');
  await expect(cv).toBeVisible();
  await expect(dv.getByText('點照片上的「食指根部的中間」')).toBeVisible();
  // 畫布要整個在畫面裡（下緣會被分頁列蓋住）；點完校正點版面會變，之後要重新量位置
  let box;
  const center = async () => {
    await cv.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    box = await cv.boundingBox();
  };
  const at = ([x, y]) => [box.x + (x / 600) * box.width, box.y + (y / 800) * box.height];
  const IDX = [390, 300];
  const PNK = [190, 330];
  const WRS = [300, 720];
  await center();
  await page.mouse.click(...at(IDX));
  await expect(dv.getByText('點照片上的「小指根部的中間」')).toBeVisible();
  await page.mouse.click(...at(PNK));
  await expect(dv.getByText('點照片上的「手腕橫紋的中間」')).toBeVisible();
  await page.mouse.click(...at(WRS));
  await expect(dv.getByText(/用手指沿著選好的那條線描一次/)).toBeVisible();
  // 掌心框座標 → 照片座標（和 App 用同一個定義：小指根部＝0、食指根部＝1、手腕＝v 1）
  const mid = [(IDX[0] + PNK[0]) / 2, (IDX[1] + PNK[1]) / 2];
  const uv = ([u, v]) => [PNK[0] + u * (IDX[0] - PNK[0]) + v * (WRS[0] - mid[0]), PNK[1] + u * (IDX[1] - PNK[1]) + v * (WRS[1] - mid[1])];
  async function trace(points) {
    const pts = points.map(uv).map(at);
    await page.mouse.move(...pts[0]);
    await page.mouse.down();
    for (const q of pts.slice(1)) await page.mouse.move(...q, { steps: 6 });
    await page.mouse.up();
  }
  await dv.locator('.seg label', { hasText: '感情線' }).click();
  await center();
  await trace([[-0.12, 0.22], [0.2, 0.2], [0.5, 0.18], [0.78, 0.11], [0.95, 0.02]]);
  await expect(dv.getByText(/依你描的線推測：感情線「長、尾端上揚」/)).toBeVisible();
  await dv.locator('.seg label', { hasText: '生命線' }).click();
  await center();
  await trace([[1.04, 0.34], [0.86, 0.5], [0.78, 0.7], [0.82, 0.88], [0.9, 1.0]]);
  // 描的線覆蓋掉剛才手選的「短」，選項列也跟著更新
  await expect(dv.locator('.palm-step', { hasText: '生命線' }).first()).toContainText('長、弧度大');
  await expect(dv.locator('.palm-diagram .palm-line.traced')).toHaveCount(2);

  // 存進名單：重開 App 還在；名單裡只有選項代碼，沒有照片
  await dv.getByRole('button', { name: '存到我的資料' }).click();
  await expect(page.locator('#toast')).toContainText('照片沒有儲存');
  const saved = await page.evaluate(() => localStorage.getItem('star.v1.people'));
  expect(saved).not.toContain('data:image');
  expect(JSON.parse(saved)[0].palm.right).toMatchObject({ simian: 'half', life: 'long-wide', heart: 'long-curve' });
  await page.reload();
  await tab(page, 'destiny');
  await expect(dv.locator('.palm-step', { hasText: '感情線' })).toContainText('長、尾端上揚');
  await expect(dv.locator('canvas.palm-canvas')).toHaveCount(0); // 照片重開就沒了

  // 左手選真斷掌：感情線、智慧線的題目拿掉；兩手不同時比較，選了慣用手講天生和後天
  await dv.locator('.seg label', { hasText: '左手' }).click();
  await opts.getByRole('button', { name: '真斷掌', exact: true }).click();
  await expect(dv.locator('.palm-step')).toHaveCount(5);
  await expect(dv.getByRole('heading', { name: '左右手比較' })).toBeVisible();
  await expect(dv.getByText(/選了慣用手，就能看出哪一邊是後天的發展/)).toBeVisible();
  await dv.getByRole('combobox', { name: '慣用手' }).selectOption('right');
  await expect(dv.getByText(/斷掌：天生（左手）是「真斷掌：一條橫線貫穿手掌」，後天（右手）是「半斷掌：兩線有一段接在一起」/)).toBeVisible();

  // 隱私：照片和選項都沒有送出去
  expect(requests.filter((r) => !r.url.startsWith(baseURL) && !/^(blob|data):/.test(r.url))).toEqual([]);
  expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
});

test('塔羅：今日一張固定、牌陣推薦、凱爾特十字排成十字、點牌放大、逆位三讀法、二選一的選項名稱', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-25T10:00:00+08:00'));
  await seed(page);
  await page.goto('/');
  await oracle(page, '塔羅');
  const tv = page.locator('#oracle-tarot');
  const daily = tv.locator('.daily-tarot');
  // 同一個人同一天固定同一張（日期＋人算出來，Chromium 和 WebKit 一樣）
  await expect(daily.getByRole('heading', { name: '今日一張・我' })).toBeVisible();
  await expect(daily.locator('.tarot-name b')).toHaveText('權杖三');
  await daily.getByRole('textbox', { name: '今日一張的心得' }).fill('今天很順');
  await daily.getByRole('button', { name: '存心得' }).click();
  await expect(page.locator('#toast')).toContainText('心得已存在這支手機');
  await page.reload();
  await oracle(page, '塔羅');
  await expect(daily.locator('.tarot-name b')).toHaveText('權杖三');
  await expect(daily.getByRole('textbox', { name: '今日一張的心得' })).toHaveValue('今天很順');
  // 換主題不會自動換牌陣，但會標推薦、可一鍵改用
  const spreadSel = tv.getByRole('combobox', { name: '牌陣' });
  await tv.locator('.seg label', { hasText: '感情' }).click();
  await expect(spreadSel).toHaveValue('three');
  await expect(tv.getByText(/問感情推薦用「關係五張」/)).toBeVisible();
  await tv.getByRole('button', { name: '改用推薦' }).click();
  await expect(spreadSel).toHaveValue('relation');
  // 凱爾特十字：中間十字（第 2 張橫壓在第 1 張上）＋右邊一柱由下往上
  await spreadSel.selectOption('celtic');
  await tv.getByRole('button', { name: '洗牌並抽牌' }).click();
  await expect(tv.locator('.celtic .celtic-card')).toHaveCount(10);
  await expect(tv.locator('ol.tarot-list > li')).toHaveCount(10);
  await expect(tv.locator('.tarot-summary')).toContainText('最後的結果牌');
  const box = (i) => tv.locator(`.celtic .c${i}`).boundingBox();
  const [b1, b2, b7, b10] = [await box(1), await box(2), await box(7), await box(10)];
  expect(Math.abs(b1.x + b1.width / 2 - (b2.x + b2.width / 2))).toBeLessThan(2);
  expect(b2.width).toBeGreaterThan(b2.height);
  expect(b7.y).toBeGreaterThan(b10.y);
  expect(b7.x).toBeGreaterThan(b1.x + 100);
  // 逆位牌都有三種讀法
  const revCount = await tv.locator('ol.tarot-list > li.rev').count();
  await expect(tv.locator('ol.tarot-list .rev-ways')).toHaveCount(revCount);
  // 點牌放大，關掉後回到原本的牌
  await tv.locator('ol.tarot-list .tc-btn').first().click();
  const zoomDlg = page.locator('.tz[role="dialog"]');
  await expect(zoomDlg).toBeVisible();
  await expect(zoomDlg.locator('.tz-card svg')).toHaveCount(1);
  await zoomDlg.getByRole('button', { name: '關閉' }).click();
  await expect(page.locator('.tz')).toHaveCount(0);
  // 二選一：選項名稱寫進牌位（只在畫面上）
  await spreadSel.selectOption('choice');
  await tv.getByRole('textbox', { name: '選擇 A 是什麼' }).fill('留在台北');
  await tv.getByRole('textbox', { name: '選擇 B 是什麼' }).fill('去台中');
  await tv.getByRole('button', { name: '洗牌並抽牌' }).click();
  await expect(tv.locator('ol.tarot-list .pos').nth(1)).toHaveText('選擇 A（留在台北）');
  await expect(tv.locator('.tarot-summary')).toContainText('選擇 A 是');
});

test('塔羅：自訂牌組（檔名認牌、對不到的列出來、缺的用內建牌面、移除）；圖只存在手機', async ({ page, baseURL }) => {
  await page.clock.setFixedTime(new Date('2026-11-25T10:00:00+08:00'));
  await seed(page);
  const requests = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
  await page.goto('/');
  await oracle(page, '塔羅');
  const tv = page.locator('#oracle-tarot');
  await tv.locator('summary', { hasText: '牌組：' }).click();
  // 用程式畫牌圖（不用網路上的圖）：今日一張是權杖三，匯入它就能看到換成自訂圖
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 500;
    const g = c.getContext('2d');
    g.fillStyle = '#d94f8a';
    g.fillRect(0, 0, 300, 500);
    return c.toDataURL('image/png').split(',')[1];
  });
  const buffer = Buffer.from(png, 'base64');
  await tv.locator('input[type="file"][multiple]').setInputFiles([
    { name: '權杖三.png', mimeType: 'image/png', buffer },
    { name: 'ace-of-cups.png', mimeType: 'image/png', buffer },
    { name: 'IMG_0001.png', mimeType: 'image/png', buffer },
  ]);
  await expect(tv.getByText(/已匯入 2 張；1 個檔名對不到牌：IMG_0001\.png/)).toBeVisible();
  await expect(tv.getByText('目前用自訂牌組：已匯入 2／78 張，缺的牌用內建牌面。')).toBeVisible();
  await expect(tv.locator('.daily-tarot .ta-face.custom')).toHaveCount(1);
  // 存在 IndexedDB：重開還在
  await page.reload();
  await oracle(page, '塔羅');
  await expect(tv.locator('.daily-tarot .ta-face.custom')).toHaveCount(1);
  await tv.locator('summary', { hasText: '牌組：' }).click();
  page.once('dialog', (d) => d.accept());
  await tv.getByRole('button', { name: '移除自訂牌組' }).click();
  await expect(tv.getByText(/目前用內建牌面/)).toBeVisible();
  await expect(tv.locator('.daily-tarot .ta-face.custom')).toHaveCount(0);
  // 圖片只在手機裡處理：沒有對外請求、沒有送出資料
  expect(requests.filter((r) => !r.url.startsWith(baseURL) && !/^(blob|data):/.test(r.url))).toEqual([]);
  expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
});
