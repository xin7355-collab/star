// 手機尺寸端對端測試：真的打開網頁、點按鈕，確認功能、隱私（不上傳）、離線與版面。
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const SERVE = fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));

const ME = {
  id: 'p-0123456789abcdef', name: '我', gender: '男', self: true, createdAt: '2026-11-24T00:00:00.000Z',
  raw: { calendar: 'solar', era: 'roc', year: 79, month: 8, day: 15, leap: false, knowTime: true, time: '06:20', placeId: 'taipei', lat: null, lon: null, tz: 'Asia/Taipei', fold: null, solar: null },
};

/** 預先放一筆名單（只在第一次載入時），讓測試直接從有資料的狀態開始 */
async function seed(page, people = [ME]) {
  await page.addInitScript((list) => {
    if (!localStorage.getItem('star.v1.people')) {
      localStorage.setItem('star.v1.people', JSON.stringify(list));
      localStorage.setItem('star.v1.settings', JSON.stringify({ activeId: list[0].id, sect: 1, solarTime: 'standard' }));
    }
  }, people);
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

test('第一次使用：輸入生日 → 星盤、農曆生日、運勢與農民曆', async ({ page }) => {
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

  await page.locator('.tabbar [data-view="fortune"]').click();
  const fv = page.locator('#view-fortune');
  await expect(fv.locator('.sign-btn.selected')).toContainText('獅子');
  await expect(fv.locator('.chip-row.yi .chip').first()).toBeVisible();
  await fv.locator('.period-bar label', { hasText: '今年' }).click();
  await expect(fv.locator('ol.days li')).toHaveCount(12);
});

test('命理：八字、流年、紫微、瑪雅、生命靈數、稱骨都算得出來', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('.tabbar [data-view="destiny"]').click();
  const dv = page.locator('#view-destiny');
  await expect(dv.locator('table.pillars tr.big').first()).toContainText('庚甲壬癸');
  const tool = dv.locator('select').nth(1);
  await tool.selectOption('liunian');
  await expect(dv.getByText(/犯太歲/).first()).toBeVisible();
  await tool.selectOption('ziwei');
  await expect(dv.locator('.ziwei-grid .palace')).toHaveCount(12);
  await dv.locator('.palace', { hasText: '命宮' }).click();
  await expect(dv.locator('.palace-detail h3')).toContainText('命宮');
  await tool.selectOption('maya');
  await expect(dv.locator('.maya-cell')).toHaveCount(5);
  await tool.selectOption('numerology');
  await expect(dv.locator('.score-ring b')).toHaveText('33／6');
  await tool.selectOption('chenggu');
  await expect(dv.locator('blockquote.poem')).toBeVisible();
  await dv.getByRole('button', { name: '存到紀錄' }).click();
  await page.locator('.tabbar [data-view="me"]').click();
  await expect(page.locator('#view-me summary', { hasText: '查詢紀錄（1）' })).toBeVisible();
});

test('名單：新增農曆生日的家人（不搶走「我」）、從名單配對、塔羅，都記到本機紀錄', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.locator('.tabbar [data-view="me"]').click();
  const me = page.locator('#view-me');
  await me.getByRole('button', { name: '＋ 新增家人朋友' }).click();
  const form = me.locator('.card').first();
  await form.locator('input[type="text"]').first().fill('媽媽');
  await form.locator('.seg label', { hasText: '女' }).click();
  await form.locator('.seg label', { hasText: '農曆生日' }).click();
  await form.locator('input[inputmode="numeric"]').fill('89');
  await form.locator('select').nth(0).selectOption('2');
  await form.locator('select').nth(1).selectOption('16');
  await form.getByRole('button', { name: '計算並儲存' }).click();
  await expect(me.locator('ul.people li')).toHaveCount(2);
  await expect(me.getByText('民國 89 年 農曆二月十六')).toBeVisible();
  await expect(me.locator('.person-switch select')).toHaveValue(ME.id);

  await page.locator('.tabbar [data-view="match"]').click();
  const mv = page.locator('#view-match');
  await mv.locator('.seg label', { hasText: '精準' }).click();
  await mv.getByRole('button', { name: '開始配對' }).click();
  await expect(mv.locator('.match-result h2')).toHaveText('我 × 媽媽');

  await page.locator('.tabbar [data-view="tarot"]').click();
  await page.locator('#view-tarot').getByRole('button', { name: '洗牌並抽牌' }).click();
  await expect(page.locator('#view-tarot ol.tarot-list li')).toHaveCount(3);

  await page.locator('.tabbar [data-view="me"]').click();
  await expect(page.locator('#view-me summary', { hasText: '查詢紀錄（2）' })).toBeVisible();
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
  await page.locator('.tabbar [data-view="tarot"]').click();
  await page.locator('#view-tarot').getByRole('button', { name: '洗牌並抽牌' }).click();
  await page.locator('.tabbar [data-view="me"]').click();
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
  for (const view of ['me', 'fortune', 'destiny', 'match', 'tarot']) {
    await page.locator(`.tabbar [data-view="${view}"]`).click();
    await page.waitForTimeout(300);
  }
  await page.locator('.tabbar [data-view="destiny"]').click();
  await page.locator('#view-destiny select').nth(1).selectOption('ziwei');
  await expect(page.locator('.ziwei-grid')).toBeVisible();
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
  await expect(page.locator('#view-fortune .score-ring')).toBeVisible();
  await expect(page.locator('#view-fortune .chip-row.yi .chip').first()).toBeVisible();
  await page.locator('.tabbar [data-view="destiny"]').click();
  await page.locator('#view-destiny select').nth(1).selectOption('ziwei');
  await expect(page.locator('.ziwei-grid .palace')).toHaveCount(12);
  // 檢查新版的 version.json 刻意不快取：連不上時瀏覽器會記一筆載入失敗，App 照常使用、不提示
  errors = errors.filter((e) => !/version\.json/.test(e));
});

test('版面：320px 寬的手機，五個分頁都沒有水平捲動', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  for (const view of ['me', 'fortune', 'destiny', 'match', 'tarot']) {
    await page.locator(`.tabbar [data-view="${view}"]`).click();
    await page.waitForTimeout(400);
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
      return { overflow: document.documentElement.scrollWidth - vw, culprits };
    });
    expect(overflow, `${view} 不應水平捲動；超出的元素：${culprits.join('；') || '無'}`).toBeLessThanOrEqual(0);
  }
});
