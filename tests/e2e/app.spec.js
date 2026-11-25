// 手機尺寸端對端測試：真的打開網頁、點按鈕，確認功能、隱私（不上傳）、離線與版面。
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const SERVE = fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));

const ME = {
  id: 'p-0123456789abcdef', name: '我', fullName: '王小明', birthOrder: 0, gender: '男', self: true, createdAt: '2026-11-24T00:00:00.000Z',
  raw: { calendar: 'solar', era: 'roc', year: 79, month: 8, day: 15, leap: false, knowTime: true, time: '06:20', placeId: 'taipei', lat: null, lon: null, tz: 'Asia/Taipei', fold: null, solar: null },
};

const MOM = {
  id: 'p-fedcba9876543210', name: '媽媽', fullName: '陳美玲', birthOrder: 0, gender: '女', createdAt: '2026-11-24T00:00:00.000Z',
  raw: { calendar: 'solar', era: 'roc', year: 51, month: 11, day: 20, leap: false, knowTime: true, time: '09:00', placeId: 'taipei', lat: null, lon: null, tz: 'Asia/Taipei', fold: null, solar: null },
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
/** 掌紋分頁裡某一張卡（用標題精確比對：標題卡的副標也寫了「拍照描線」） */
const palmCard = (page, title) => page.locator('#view-destiny section.card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
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
  await page.locator('.period-bar label', { hasText: '今年' }).click();
  await expect(fv.locator('ol.days li').first()).toBeVisible();
  await expect(fv.locator('.card').first().locator('ol.days li')).toHaveCount(12);
});

test('時運：期間列貼在分頁列正上方（不會浮在內容中間）；往下捲收起、往上捲再出現', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await tab(page, 'fortune');
  await expect(page.locator('#view-fortune .chip-row.yi .chip').first()).toBeVisible();
  const bar = page.locator('.period-bar');
  await expect(bar).toBeVisible();
  // 捲動後等兩格畫面，讓捲動事件處理完（連續捲兩次在同一格裡只看得到最後的位置）
  const scrollTo = async (y) => {
    await page.evaluate((top) => window.scrollTo(0, top === 'end' ? document.documentElement.scrollHeight : top), y);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  };
  // 捲到底：期間列下緣接在分頁列上緣。iPhone Safari 曾把它定位在「時運」內容的底部，浮在畫面中間擋住字
  await scrollTo('end');
  await expect(bar).toBeVisible();
  const [b, t] = [await bar.boundingBox(), await page.locator('.tabbar').boundingBox()];
  expect(Math.abs(b.y + b.height - t.y)).toBeLessThanOrEqual(1);
  // 往上捲一段、再往下捲：收到分頁列後面；再往上捲：出現
  await scrollTo(400);
  await scrollTo(900);
  await expect(bar).toHaveClass(/tucked/);
  await expect(bar).toBeHidden();
  await scrollTo(700);
  await expect(bar).not.toHaveClass(/tucked/);
  await expect(bar).toBeVisible();
  // 其他分頁看不到期間列
  await tab(page, 'today');
  await expect(bar).toBeHidden();
});

test('分享圖卡：先預覽，可以勾「匿名」拿掉名字和出生時間，勾選會記住', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await tab(page, 'me');
  const me = page.locator('#view-me');
  await me.getByRole('button', { name: '存成圖卡' }).click();
  const sheet = page.locator('.sheet');
  const img = sheet.locator('img.sheet-img');
  await expect(img).toHaveAttribute('alt', /^我的星盤：/);
  await expect(sheet.getByRole('link', { name: '下載 my-chart.png' })).toBeVisible();
  const anon = sheet.getByRole('checkbox', { name: '匿名：不顯示名字、出生時間和提問' });
  await expect(anon).not.toBeChecked();
  await anon.check();
  await expect(img).toHaveAttribute('alt', /^星盤：/);
  expect(await page.evaluate(() => localStorage.getItem('star.v1.shareAnon'))).toBe('true');
  // 關掉再開：記得上次勾了匿名
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await me.getByRole('button', { name: '存成圖卡' }).click();
  await expect(sheet.getByRole('checkbox', { name: '匿名：不顯示名字、出生時間和提問' })).toBeChecked();
  await expect(sheet.locator('img.sheet-img')).toHaveAttribute('alt', /^星盤：/);
});

test('名單：編輯儲存不會洗掉掌紋結果和藝名；「我的」表單可以直接加、改、移除藝名', async ({ page }) => {
  const palm = { school: 'gender', dominant: 'right', left: {}, right: {} };
  await seed(page, [{ ...ME, palm, altNames: [{ kind: '藝名', name: '王明星' }] }]);
  await page.goto('/');
  await tab(page, 'me');
  const me = page.locator('#view-me');
  const row = me.locator('ul.people li').first();
  await expect(row).toContainText('藝名 王明星');
  await row.getByRole('button', { name: '編輯' }).click();
  // 有藝名時進階區自動打開，原本的藝名已經填好
  await expect(me.getByRole('textbox', { name: '第 1 個藝名或筆名' })).toHaveValue('王明星');
  await me.getByRole('button', { name: '＋ 加藝名或筆名' }).click();
  await expect(me.getByRole('textbox', { name: '第 2 個藝名或筆名' })).toBeFocused();
  await me.getByRole('combobox', { name: '第 2 個名字的種類' }).selectOption('筆名');
  await me.getByRole('textbox', { name: '第 2 個藝名或筆名' }).fill('abc');
  await me.getByRole('button', { name: '計算並儲存' }).click();
  await expect(page.locator('#toast')).toContainText('「abc」請輸入 2～6 個中文字');
  await me.getByRole('textbox', { name: '第 2 個藝名或筆名' }).fill('林小筆');
  await me.getByRole('button', { name: '計算並儲存' }).click();
  await expect(row).toContainText('藝名 王明星・筆名 林小筆');
  const people = () => page.evaluate(() => JSON.parse(localStorage.getItem('star.v1.people')));
  // 名單是整筆覆蓋儲存：表單沒有的欄位（掌紋結果）也要留著
  expect((await people())[0].palm).toEqual(palm);
  expect((await people())[0].altNames).toEqual([{ kind: '藝名', name: '王明星' }, { kind: '筆名', name: '林小筆' }]);
  await row.getByRole('button', { name: '編輯' }).click();
  await me.getByRole('button', { name: '移除第 1 個名字' }).click();
  await me.getByRole('button', { name: '計算並儲存' }).click();
  await expect(row).not.toContainText('王明星');
  expect((await people())[0].altNames).toEqual([{ kind: '筆名', name: '林小筆' }]);
  expect((await people())[0].palm).toEqual(palm);
});

test('切換查看的人：頁首同一個選單，在命盤換人，今日、我的都跟著換；在我的換回來，命盤也跟著回來', async ({ page }) => {
  await seed(page, [ME, MOM]);
  await page.goto('/');
  const who = page.getByRole('combobox', { name: '目前查看的人' });
  await expect(who).toHaveValue(ME.id);
  await tab(page, 'destiny');
  await who.selectOption(MOM.id);
  await expect(page.locator('#view-destiny')).toContainText('媽媽的綜合解讀');
  await tab(page, 'today');
  await expect(page.locator('#today-hero h2')).toHaveText('媽媽的今天');
  await expect(who).toHaveValue(MOM.id);
  // 「我的」頁有自己的切換，頁首不重複放；兩邊是同一個「目前查看的人」
  await tab(page, 'me');
  await expect(who).toBeHidden();
  const meSwitch = page.locator('#view-me .person-switch select');
  await expect(meSwitch).toHaveValue(MOM.id);
  await meSwitch.selectOption(ME.id);
  await tab(page, 'destiny');
  await expect(who).toHaveValue(ME.id);
  await expect(page.locator('#view-destiny')).toContainText('我的綜合解讀');
  await page.reload();
  await expect(page.getByRole('combobox', { name: '目前查看的人' })).toHaveValue(ME.id);
});

test('瑪雅合盤：選一個人看彼此落在對方五大神諭的位置；瑪雅密碼的合盤跟著選同一個人、有說明', async ({ page }) => {
  await seed(page, [ME, MOM]);
  await page.goto('/');
  await tab(page, 'destiny');
  const dv = page.locator('#view-destiny');
  await dv.getByRole('combobox', { name: '選擇命理工具' }).selectOption('maya');
  const card = dv.locator('section.card', { hasText: '銀河印記合盤' });
  await expect(card).toContainText('選一個人');
  await card.getByRole('combobox', { name: '和誰合盤（銀河印記）' }).selectOption(MOM.id);
  // 1990/8/15＝KIN 109 超頻紅月、1962/11/20＝KIN 126 太陽白世界橋：彼此都不在對方的五大神諭裡
  await expect(card.getByRole('img', { name: '媽媽：KIN 126 太陽白世界橋' })).toBeVisible();
  await expect(card).toContainText('你們兩個：彼此都不在對方的五大神諭裡');
  await dv.locator('details.maya-code > summary').click();
  await expect(dv.getByRole('combobox', { name: '和誰合盤', exact: true })).toHaveValue(MOM.id);
  await expect(dv.getByText(/合盤是把兩個人的 A～E 並排/)).toBeVisible();
  await expect(dv.locator('details.maya-code table.compare')).toBeVisible();
});

test('姓名：藝名和本名並排比較（存在手機、可移除）；匿名試算不儲存、可比多個名字', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await tab(page, 'destiny');
  const dv = page.locator('#view-destiny');
  await dv.getByRole('combobox', { name: '選擇命理工具' }).selectOption('name');
  const card = (title) => dv.locator('section.card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  const alt = card('藝名、筆名');
  await expect(alt.getByText('還沒有加藝名或筆名。加了會和本名並排比較。')).toBeVisible();
  await alt.getByRole('combobox', { name: '名字種類' }).selectOption('藝名');
  await alt.getByRole('textbox', { name: '藝名或筆名' }).fill('王明星');
  await alt.getByRole('button', { name: '加入比較' }).click();
  await expect(page.locator('#toast')).toContainText('已加入藝名「王明星」');
  const rows = card('藝名、筆名').locator('table.name-cmp tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('王小明');
  await expect(rows.nth(0)).toContainText('本名');
  await expect(rows.nth(1)).toContainText('王明星');
  await expect(card('藝名、筆名').locator('tr.best')).toHaveCount(1);
  // 存在名單裡：重開 App 還在；名單只多存名字，沒有別的
  const people = JSON.parse(await page.evaluate(() => localStorage.getItem('star.v1.people')));
  expect(people[0].altNames).toEqual([{ kind: '藝名', name: '王明星' }]);
  await page.reload();
  await tab(page, 'destiny');
  await expect(card('藝名、筆名').locator('table.name-cmp tbody tr')).toHaveCount(2);
  // 看完整分析：上面的姓名分析換成這個名字
  await card('藝名、筆名').getByRole('button', { name: '看完整分析' }).nth(1).click();
  await expect(card('姓名分析').getByRole('textbox', { name: '姓名（含姓氏）' })).toHaveValue('王明星');
  await expect(dv.locator('.name-chars .hz')).toHaveText(['王', '明', '星']);
  await card('藝名、筆名').getByRole('button', { name: '移除藝名「王明星」' }).click();
  await expect(card('藝名、筆名').getByText('還沒有加藝名或筆名。加了會和本名並排比較。')).toBeVisible();

  // 匿名試算：不存檔，重開 App 就沒了
  const trialCard = card('匿名試算');
  const input = trialCard.getByRole('textbox', { name: '要試算的名字' });
  await input.fill('林小雨');
  await trialCard.getByRole('button', { name: '加入比較' }).click();
  await input.fill('陳大文');
  await input.press('Enter');
  await expect(trialCard.locator('table.name-cmp tbody tr')).toHaveCount(2);
  await expect(trialCard.locator('thead th')).toHaveText(['名字', '綜合分', '人格', '總格', '三才']);
  await trialCard.getByRole('checkbox', { name: /配合我的八字/ }).check();
  await expect(trialCard.locator('thead th').last()).toHaveText('補到喜用');
  const stored = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)).join(''));
  expect(stored).not.toContain('林小雨');
  expect(stored).not.toContain('陳大文');
  await trialCard.getByRole('button', { name: '移除「林小雨」' }).click();
  await expect(trialCard.locator('table.name-cmp tbody tr')).toHaveCount(1);
  await page.reload();
  await tab(page, 'destiny');
  await expect(card('匿名試算').getByText('還沒有加名字。一次可以比 6 個。')).toBeVisible();
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
  // 瑪雅銀河印記也在綜合解讀裡：個性（印記＋調性）和今年（流年印記）
  // 七個面向固定順序：第一個是個性、最後一個是今年（「個性」兩字也會出現在健康的內文裡，不用文字找）
  await expect(dv.locator('details.area').first()).toContainText('銀河印記 KIN 109「超頻紅月」');
  await expect(dv.locator('details.area').last()).toContainText(/流年印記是 KIN \d+「/);
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
  // 人生時間軸：10 年、先講哪幾年要注意，點開一年看可能遇到的事；接下來 12 個月（節氣換月）
  const life = dv.locator('section.card.feature', { hasText: '的人生時間軸' });
  await expect(life.locator('details.ly')).toHaveCount(10);
  await expect(life.getByText('最需要注意：')).toBeVisible();
  await life.locator('details.ly').first().locator('summary').click();
  await expect(life.locator('details.ly').first()).toContainText('工作：');
  await expect(life.locator('details.ly').first().locator('.sys', { hasText: '生命靈數' })).toBeVisible();
  await expect(dv.locator('ol.months > li')).toHaveCount(12);
  await tool.selectOption('ziwei');
  await expect(dv.locator('.ziwei-grid .palace')).toHaveCount(12);
  // 紫微重點：命宮、身宮、生年四化（庚年：太陽祿、武曲權、太陰科、天同忌）、大限只有一步是「現在」
  const zs = dv.locator('section.card.feature', { hasText: '的紫微重點' });
  await expect(zs).toContainText('命宮天機、天梁');
  await expect(zs).toContainText('身宮在遷移宮');
  await expect(zs).toContainText('天同化忌在財帛');
  await expect(zs.locator('ol.decades > li.now')).toHaveCount(1);
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
  // 瑪雅曆（13 月亮曆）：1990-08-15＝KIN 109 超頻紅月；五大神諭照規則算（引導同色、支持相加 19、挑戰差 10、隱藏相加 261）
  await expect(dv.locator('.kin-no')).toHaveText('KIN 109');
  await expect(dv.locator('.kin-title')).toHaveText('超頻紅月');
  await expect(dv.getByRole('img', { name: '超頻紅月（KIN 109）的圖騰與調性' })).toBeVisible();
  await expect(dv.locator('.oracle-cell figcaption')).toHaveText(['引導超頻紅地球', '挑戰超頻藍風暴', '主印記超頻紅月', '支持超頻白狗', '隱藏推動太陽黃人']);
  await expect(dv.getByText('你在「紅蛇波符」的第 5 天')).toBeVisible(); // 波符從 KIN 105（紅蛇）開始
  await expect(dv.locator('svg.tzolkin .tz-cell')).toHaveCount(260);
  await expect(dv.locator('svg.tzolkin .tz-cell.ws')).toHaveCount(13);
  await expect(dv.locator('svg.tzolkin .tz-me')).toHaveCount(1);
  // 20 圖騰總覽：先打開自己的，點別的換說明
  await expect(dv.locator('.seal-btn')).toHaveCount(20);
  await expect(dv.locator('.seal-detail h3')).toHaveText('9. 紅月（Muluk）・你的圖騰');
  await dv.getByRole('button', { name: '14. 白巫師' }).click();
  await expect(dv.locator('.seal-detail h3')).toHaveText('14. 白巫師（Ix）');
  await expect(dv.getByRole('button', { name: '14. 白巫師' })).toHaveAttribute('aria-pressed', 'true');
  await tool.selectOption('numerology');
  // 圓環只放主命數（整串放進去在 iPhone 會超出圓環），加總過程寫在旁邊
  await expect(dv.locator('.score-ring b')).toHaveText('6');
  await expect(dv.getByText('生日數字加總：33／6')).toBeVisible();
  // 1990-08-15：只有事業線（1-5-9），空缺 2、3、4、6、7；另一派圈進天賦數 3、3 與生命數 6 會多出智慧線
  await expect(dv.locator('.nine-lines line')).toHaveCount(1);
  await expect(dv.getByRole('heading', { name: '空缺數：2、3、4、6、7' })).toBeVisible();
  await dv.locator('summary', { hasText: '另一派' }).click();
  await expect(dv.getByText(/多了智慧線/)).toBeVisible();
  await tool.selectOption('chenggu');
  await expect(dv.locator('blockquote.poem')).toBeVisible();
  await expect(dv.getByText(/現代看法/).first()).toBeVisible(); // 白話和骨重區間的說明都有「現代看法」
  // 1990/8/15 卯時：庚午年 9 錢＋六月 1 兩 6 錢＋廿五 1 兩 5 錢＋卯時 1 兩＝5 兩；歌訣「中年福祿也多遭」→ 中年起飛型
  await expect(dv.locator('.cg-weight')).toHaveText('5 兩');
  await expect(dv.locator('.cg-bar .cg-seg')).toHaveCount(4);
  await expect(dv.getByRole('heading', { name: '人生三段：中年起飛型' })).toBeVisible();
  await expect(dv.getByRole('img', { name: '歌訣說：早年平穩、中年順利、晚年順利' })).toBeVisible();
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
    // 等 78 張牌攤開的過場跑完再點（CI 機器慢時，過場中途量到的位置會點空）
    await page.waitForFunction(() => [...document.querySelectorAll('.rt-card')].every((c) => c.getAnimations().every((a) => a.playState !== 'running')), null, { timeout: 5000 });
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
  // 配對圖卡勾匿名：兩個人換成 A、B（不是兩個「某人」，相位才看得出是誰的行星）
  await mv.locator('.match-result').getByRole('button', { name: '存成圖卡' }).click();
  const sheet = page.locator('.sheet');
  await expect(sheet.locator('img.sheet-img')).toHaveAttribute('alt', '我 × 媽媽');
  await sheet.getByRole('checkbox', { name: '匿名：不顯示名字、出生時間和提問' }).check();
  await expect(sheet.locator('img.sheet-img')).toHaveAttribute('alt', 'A × B');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

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
  // 新興產業：AI 時代的建議＋13 個產業依適配度排序，第一個打開、寫出角色和怎麼開始
  const em = dv.locator('section.card', { hasText: '新興產業適不適合你' });
  await expect(em.getByRole('heading', { name: 'AI 時代，你可以這樣做' })).toBeVisible();
  await expect(em.locator('details.em')).toHaveCount(13);
  await expect(em.locator('details.em').first()).toContainText('你可以做的角色：');
  await expect(em.locator('details.em').first()).toContainText('怎麼開始：');
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

test('今日：朗讀今天的重點（只用內建語音、可以停止），唸的內容和畫面一致', async ({ page }) => {
  // 換成假的語音引擎：記下要唸的句子，不真的出聲；一個內建的台灣語音、一個雲端語音（不能被選到）
  await page.addInitScript(() => {
    window.__spoken = [];
    window.__voice = null;
    const voices = [{ name: 'Google 國語', lang: 'zh-TW', localService: false }, { name: 'Mei-Jia', lang: 'zh-TW', localService: true }];
    const fake = {
      getVoices: () => voices,
      speak(u) { window.__spoken.push(u.text); window.__voice = u.voice ? u.voice.name : null; window.__last = u; },
      cancel() { window.__cancelled = (window.__cancelled || 0) + 1; },
      addEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    window.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) { this.text = text; };
  });
  await page.clock.setFixedTime(new Date('2026-11-25T10:00:00+08:00'));
  await seed(page);
  await page.goto('/');
  const btn = page.locator('#today-hero').getByRole('button', { name: '朗讀今天的重點' });
  await btn.click();
  await expect(page.locator('#today-hero').getByRole('button', { name: '停止朗讀' })).toHaveAttribute('aria-pressed', 'true');
  const spoken = (await page.evaluate(() => window.__spoken)).join('');
  expect(await page.evaluate(() => window.__voice)).toBe('Mei-Jia');
  const score = await page.locator('#today-hero .score-ring b').textContent();
  expect(spoken).toContain(`今日指數 ${score} 分`);
  expect(spoken).toContain('11月25日星期三');
  expect(spoken).toContain('今天的瑪雅印記是宇宙藍猴');
  // 唸完（最後一句的 onend）按鈕恢復；唸到一半按停止也會恢復
  await page.evaluate(() => window.__last.onend());
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await btn.click();
  await page.locator('#today-hero').getByRole('button', { name: '停止朗讀' }).click();
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__cancelled)).toBeGreaterThan(0);
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

test('今日：今天的瑪雅印記、和主印記的關係、下次銀河生日；直接到瑪雅曆，瑪雅密碼預設收起', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-25T10:00:00+08:00'));
  await seed(page);
  await page.goto('/');
  const card = page.locator('#today-maya');
  // 2026/11/25＝KIN 91 宇宙藍猴；1990/8/15 的主印記是 KIN 109 超頻紅月，18 天後（12/13）回到 KIN 109
  await expect(card.getByRole('heading', { name: '今天的瑪雅印記' })).toBeVisible();
  await expect(card).toContainText('KIN 91・宇宙藍猴');
  await expect(card.getByRole('img', { name: '今天的圖騰與調性：宇宙藍猴（KIN 91）' })).toBeVisible();
  await expect(card).toContainText('今天問自己：我如何超越？');
  await expect(card).toContainText('今天的圖騰和你的五大神諭沒有直接連結');
  await expect(card).toContainText('你的主印記是 KIN 109 超頻紅月；下次銀河生日 12/13（還有 18 天）');
  await card.getByRole('button', { name: '看我的瑪雅曆' }).click();
  const dv = page.locator('#view-destiny');
  await expect(dv.locator('.kin-no')).toHaveText('KIN 109');
  // 瑪雅密碼是另一套算法：預設收起；打開後勾雙胞胎分流會重畫，打開的狀態要留著
  const code = dv.locator('details.maya-code');
  await expect(code).toHaveJSProperty('open', false);
  await code.locator(':scope > summary').click(); // 裡面還有「白話解說」的小收合
  await expect(dv.locator('.maya-cell').first()).toBeVisible();
  await dv.locator('#maya-twin').check();
  await expect(dv.locator('details.maya-code')).toHaveJSProperty('open', true);
  expect(await page.evaluate(() => localStorage.getItem('star.v1.mayaCodeOpen'))).toBe('true');
  // 銀河生日當天
  await page.clock.setFixedTime(new Date('2026-12-13T10:00:00+08:00'));
  await page.reload();
  await expect(page.locator('#today-maya')).toContainText('今天是你的銀河生日');
  await expect(page.locator('#today-maya')).not.toContainText('下次銀河生日');
});

test('人生時間軸：把要注意的日子加到手機行事曆（service worker 回 text/calendar、勾選會記住、內容不含生日、不連外）', async ({ page, browserName, baseURL }) => {
  await page.clock.setFixedTime(new Date('2026-11-25T10:00:00+08:00'));
  const requests = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
  await seed(page);
  await page.goto('/');
  // 等 service worker 接手這一頁：iPhone 要靠它回 text/calendar 才會問要不要加入行事曆
  if (browserName === 'chromium') await page.waitForFunction(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller), null, { timeout: 30_000 });
  await tab(page, 'destiny');
  const dv = page.locator('#view-destiny');
  await dv.getByRole('combobox', { name: '選擇命理工具' }).selectOption('liunian');
  const box = dv.locator('section.card.feature', { hasText: '的人生時間軸' }).locator('details.ics');
  await box.locator('summary').click();
  const count = box.locator('.ics-count');
  await expect(count).toHaveText(/共 \d+ 個提醒/);
  const total = Number((await count.textContent()).match(/共 (\d+) 個/)[1]);
  // 1990/8/15 卯時男命、2026/11/25：銀河生日 12/13、交大運 2028/8/10 都在預覽或清單裡
  await expect(box.locator('label.check')).toHaveCount(5);
  await expect(box.locator('.ics-list li').first()).toContainText('2026/');
  const merc = box.locator('label.check', { hasText: '水星逆行' });
  const nMerc = Number((await merc.textContent()).match(/・(\d+) 個/)[1]);
  expect(nMerc).toBeGreaterThan(0);
  await merc.locator('input').uncheck();
  await expect(count).toHaveText(new RegExp(`共 ${total - nMerc} 個提醒`));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('star.v1.icsKinds')))).not.toContain('mercury');
  if (browserName === 'chromium') {
    // 等放進快取（勾選後非同步寫入），再按：桌機 Chromium 會把 text/calendar 當下載，iPhone Safari 會問要不要加入
    await page.waitForFunction(async () => {
      const res = await (await caches.open('star-ics')).match(new URL('cal/reminders.ics', document.baseURI).href);
      return !!res && !/SUMMARY:水星逆行/.test(await res.text()); // 流月的說明裡也會提到水逆，只看標題
    });
    const [dl] = await Promise.all([page.waitForEvent('download'), box.getByRole('button', { name: '加到行事曆' }).click()]);
    expect(dl.url()).toBe(`${baseURL}/cal/reminders.ics`); // service worker 回的，不是 blob
    const text = await readFile(await dl.path(), 'utf8');
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect((text.match(/BEGIN:VEVENT/g) || []).length).toBe(total - nMerc);
    expect(text).toContain('SUMMARY:銀河生日：KIN 109 超頻紅月');
    expect(text).toContain('DTSTART;VALUE=DATE:20280810');
    expect(text).not.toContain('SUMMARY:水星逆行');
    expect(text).not.toMatch(/1990|0815/);
    // 頁面留在原地
    await expect(count).toBeVisible();
    // 快取被清掉時（換手機、清除資料），那個網址給說明和回 App 的連結，不會去問伺服器
    await page.evaluate(() => caches.delete('star-ics'));
    await page.goto('/cal/reminders.ics');
    await expect(page.getByText('提醒檔已經過期了')).toBeVisible();
    await expect(page.getByRole('link', { name: '回到 App' })).toBeVisible();
    // 這一頁本來就回 404（檔案不在了），瀏覽器主控台會記一筆「Failed to load resource」，不算執行期錯誤
    errors = errors.filter((e) => !/status of 404.*\/cal\/reminders\.ics/.test(e));
  } else {
    // 不支援分享檔案時，「分享檔案」改開面板給下載連結
    await box.getByRole('button', { name: '分享檔案' }).click();
    await expect(page.locator('#sheet-body a[download="star-reminders.ics"]')).toBeVisible();
  }
  expect(requests.filter((r) => !r.url.startsWith(baseURL) && !/^(blob|data):/.test(r.url))).toEqual([]);
  expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
});

test('開運佈置：手機羅盤（iPhone 要權限、跟著轉、往哪轉、對準提示、換目標、Android 絕對方位；拒絕和沒感測器都有替代做法）', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-25T10:00:00+08:00'));
  // 模擬 iPhone：第一次按「不允許」、第二次按「允許」
  await page.addInitScript(() => {
    let n = 0;
    if (!window.DeviceOrientationEvent) window.DeviceOrientationEvent = class extends Event {};
    window.DeviceOrientationEvent.requestPermission = () => Promise.resolve(n++ === 0 ? 'denied' : 'granted');
  });
  await seed(page);
  await page.goto('/');
  await tab(page, 'destiny');
  const dv = page.locator('#view-destiny');
  await dv.getByRole('combobox', { name: '選擇命理工具' }).selectOption('fengshui');
  const btn = dv.getByRole('button', { name: '用手機羅盤找方位' });
  const sheet = page.locator('#sheet');
  await btn.click();
  await expect(sheet).toHaveAttribute('aria-label', '手機羅盤');
  await expect(page.locator('#sheet-title')).toHaveText('手機羅盤');
  await expect(sheet).toContainText('沒有拿到「動作與方向」的權限');
  await expect(sheet).toContainText('跳出詢問時選「允許」');
  await page.locator('#sheet-close').click();
  await btn.click();
  // iPhone 的事件：webkitCompassHeading（一般 Event 加屬性，各瀏覽器都能模擬）
  const ios = (v) => page.evaluate((hd) => { const e = new Event('deviceorientation'); Object.defineProperty(e, 'webkitCompassHeading', { value: hd }); window.dispatchEvent(e); }, v);
  const now = page.locator('.cp-now');
  const guide = page.locator('.cp-guide');
  await expect(guide).toHaveText('');
  await ios(100);
  await expect(now).toHaveText('手機頭朝：東（乙山 100°）');
  // 2026 年一白入中：九紫在東南、八白在東、五黃在南；太歲（午）也在南
  await expect(guide).toHaveText('往右轉 35°，就會對準東南的今年財星（九紫）');
  await expect(page.locator('.lp-rot')).toHaveAttribute('transform', 'rotate(-100.0 150 150)');
  await expect(page.locator('.lp-mark.on')).toHaveCount(1);
  await ios(200); // 一次轉超過 60° 直接跳過去
  await expect(guide).toHaveText('往左轉 65°，就會對準東南的今年財星（九紫）');
  await ios(135);
  await expect(guide).toHaveText('✓ 對準了：前面就是東南的今年財星（九紫）');
  await expect(guide).toHaveClass(/\bon\b/);
  await expect(page.locator('#sheet-body [aria-live="polite"]')).toHaveText('對準了，前面就是東南的今年財星（九紫）');
  // 換成要避開的五黃（南）
  await page.getByRole('combobox', { name: '要找哪個方位' }).selectOption('five');
  await expect(guide).toHaveText('往右轉 45°，就會對準南的五黃煞（要避開）');
  await expect(page.locator('.cp-legend')).toContainText('今年財星');
  await expect(page.locator('.cp-legend')).toContainText('太歲（避開）');
  await page.locator('#sheet-close').click();
  // Android：先來一筆全是 null 的絕對事件（沒有磁力計的情況），不能把之後的有效事件擋掉；有效的絕對事件用 360－alpha
  await btn.click();
  const android = (alpha) => page.evaluate((a) => { const e = new Event('deviceorientationabsolute'); Object.defineProperty(e, 'alpha', { value: a }); Object.defineProperty(e, 'absolute', { value: true }); window.dispatchEvent(e); }, alpha);
  await android(null);
  await android(180);
  await expect(now).toHaveText('手機頭朝：南（午山 180°）');
  await page.locator('#sheet-close').click();
  // 都沒有資料（電腦）：幾秒後說明替代做法
  await btn.click();
  await expect(now).toHaveText('收不到指南針的資料', { timeout: 10_000 });
  await expect(sheet).toContainText('內建的「指南針」App');
});

test('版面：320px 寬的手機，各分頁與面板都沒有水平捲動、沒有「null／undefined」字樣', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const stops = [['today'], ['fortune'], ['destiny'], ['destiny', 'name'], ['destiny', 'career'], ['destiny', 'fengshui'], ['destiny', 'family'], ['destiny', 'bazi'], ['destiny', 'blood'], ['destiny', 'numerology'], ['destiny', 'maya'], ['destiny', 'ziwei'], ['destiny', 'liunian'], ['destiny', 'chenggu'], ['oracle', '解惑'], ['oracle', '塔羅'], ['oracle', '樂透'], ['oracle', '配對'], ['me']];
  for (const [view, sub] of stops) {
    if (view === 'oracle') await oracle(page, sub);
    else await tab(page, view);
    if (view === 'destiny' && sub) await page.getByRole('combobox', { name: '選擇命理工具' }).selectOption(sub);
    // 解惑要起過卦，結果（卦象、好日子）才會出現
    if (sub === '解惑') await page.locator('#oracle-jiehuo').getByRole('button', { name: '起卦' }).click();
    await page.waitForTimeout(700);
    const visible = await page.locator(`#view-${view}`).innerText();
    expect(visible, `${view}${sub ? `／${sub}` : ''} 出現程式值`).not.toMatch(/\bnull\b|\bundefined\b|NaN|\[object /);
    // 圓環裡的數字不能超出圓環（生命靈數「32／5」曾在 iPhone 上超出去）：字寬要小於圓環內徑（扣掉兩邊 8px 的環）
    const ringOverflow = await page.locator(`#view-${view} .score-ring`).evaluateAll((rings) => rings
      .filter((r) => r.offsetParent)
      .map((r) => ({ ring: Math.round(r.getBoundingClientRect().width), text: Math.round(r.querySelector('b')?.getBoundingClientRect().width || 0), label: r.textContent }))
      .filter((x) => x.text > x.ring - 16));
    expect(ringOverflow, `${view}${sub ? `／${sub}` : ''} 圓環裡的字超出圓環`).toEqual([]);
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
  const picker = palmCard(page, '看圖選線形');
  const photo = palmCard(page, '拍照描線（選用）');
  // 預設傳統「男左女右」：「我」是男生，一打開就看左手
  await expect(dv.getByRole('combobox', { name: '看哪隻手的看法' })).toHaveValue('gender');
  await expect(dv.locator('input[name="palm-hand"]:checked')).toHaveValue('left');
  await expect(dv.getByText('這是主要看的手：傳統「男左女右」，男生看左手。')).toBeVisible();
  await expect(dv.getByRole('combobox', { name: '慣用手' })).toBeHidden(); // 只有「看慣用手」這派才問
  // 看圖自選：第一題是斷掌，選完自動跳到下一題
  await expect(dv.getByRole('heading', { name: /感情線和智慧線是分開的/ })).toBeVisible();
  await opts.getByRole('button', { name: '半斷掌', exact: true }).click();
  await expect(dv.getByRole('heading', { name: /生命線（繞著拇指根部的弧線）/ })).toBeVisible();
  await opts.getByRole('button', { name: '短（到掌中）', exact: true }).click();
  await expect(dv.locator('.palm-item')).toHaveCount(2);
  // 還沒儲存就整頁重載（iPhone 切到別的 App 再回來常這樣）：選擇要接回來
  await page.reload();
  await tab(page, 'destiny');
  await expect(dv.locator('.palm-step', { hasText: '斷掌' }).first()).toContainText('半斷掌');
  await expect(dv.getByText('上次還沒儲存的選擇已經接回來了，記得按儲存')).toBeVisible();
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
  await expect(photo.getByRole('img', { name: '示範：第 1 個點在食指根部的中間' })).toBeVisible();
  await center();
  await page.mouse.click(...at(IDX));
  await expect(dv.getByText('點照片上的「小指根部的中間」')).toBeVisible();
  // 復原：第 1 個點拿掉，再點一次
  await photo.getByRole('button', { name: '復原：點第 1 個位置（食指根部）' }).click();
  await expect(dv.getByText('點照片上的「食指根部的中間」')).toBeVisible();
  await center();
  await page.mouse.click(...at(IDX));
  await center();
  await page.mouse.click(...at(PNK));
  await expect(dv.getByText('點照片上的「手腕橫紋的中間」')).toBeVisible();
  await center();
  await page.mouse.click(...at(WRS));
  // 合成的照片是右手的方向（食指在小指右邊），現在看的是左手：提醒，確認沒拍錯就繼續
  await expect(photo.getByText(/從你點的三個位置看，這張像是右手；現在選的是左手/)).toBeVisible();
  await photo.getByRole('button', { name: '沒錯，是左手' }).click();
  await expect(photo.locator('.palm-side')).toHaveCount(0);
  await expect(photo.locator('.palm-instr')).toHaveText('描生命線');
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
  await photo.locator('.palm-step', { hasText: '感情線' }).click();
  await expect(photo.getByRole('img', { name: /示範：感情線的位置/ })).toBeVisible();
  await center();
  await trace([[-0.12, 0.22], [0.2, 0.2], [0.5, 0.18], [0.78, 0.11], [0.95, 0.02]]);
  await expect(dv.getByText(/依你描的線推測：感情線「長、尾端上揚」/)).toBeVisible();
  await expect(photo.locator('.palm-step', { hasText: '感情線' })).toContainText('已描 1 筆');
  await photo.locator('.palm-step', { hasText: '生命線' }).click();
  await center();
  await trace([[1.04, 0.34], [0.86, 0.5], [0.78, 0.7], [0.82, 0.88], [0.9, 1.0]]);
  // 描的是生命線本身：覆蓋掉剛才手選的「短」，選項列也跟著更新
  await expect(picker.locator('.palm-step', { hasText: '生命線' })).toContainText('長、弧度大');
  await expect(dv.locator('.palm-diagram .palm-line.traced')).toHaveCount(2);
  // 自己把生命線改回「短」，再描事業線：生命線要保留自己選的（以前會被描線的判斷蓋回去）
  await picker.locator('.palm-step', { hasText: '生命線' }).click();
  await opts.getByRole('button', { name: '短（到掌中）', exact: true }).click();
  await photo.getByRole('button', { name: '下一條：智慧線' }).click();
  await photo.locator('.palm-step', { hasText: '事業線' }).click();
  await center();
  await trace([[0.55, 1.0], [0.56, 0.72], [0.58, 0.45], [0.6, 0.2]]);
  await expect(picker.locator('.palm-step', { hasText: '事業線' })).toContainText('從手腕直上');
  await expect(picker.locator('.palm-step', { hasText: '生命線' })).toContainText('短（到掌中）');
  await expect(photo.getByText(/生命線「長、弧度大」（你選了「短（到掌中）」，保留你的）/)).toBeVisible();
  // 復原、重做：事業線那一筆拿掉又放回來，選項跟著變；手選的生命線不受影響
  await photo.getByRole('button', { name: '復原：描事業線' }).click();
  await expect(photo.locator('.palm-note')).toHaveText('已復原：描事業線');
  await expect(photo.locator('.palm-step', { hasText: '事業線' })).toContainText('未描');
  await expect(picker.locator('.palm-step', { hasText: '事業線' })).toContainText('未選');
  await photo.getByRole('button', { name: '重做：描事業線' }).click();
  await expect(photo.locator('.palm-step', { hasText: '事業線' })).toContainText('已描 1 筆');
  await expect(picker.locator('.palm-step', { hasText: '事業線' })).toContainText('從手腕直上');
  await expect(picker.locator('.palm-step', { hasText: '生命線' })).toContainText('短（到掌中）');
  // 放大鏡：手指按著時出現、放開就收起來；太短的一筆不算，而且說清楚為什麼
  await center();
  const q0 = at(uv([0.4, 0.55]));
  await page.mouse.move(...q0);
  await page.mouse.down();
  await page.mouse.move(q0[0] + 3, q0[1] + 2, { steps: 2 });
  await expect(photo.locator('.palm-loupe')).toBeVisible();
  await page.mouse.up();
  await expect(photo.locator('.palm-loupe')).toBeHidden();
  await expect(photo.locator('.palm-note')).toHaveText(/這一筆太短/);

  // 存進名單：重開 App 還在；名單裡只有選項代碼，沒有照片
  await dv.getByRole('button', { name: '存到我的資料' }).click();
  await expect(page.locator('#toast')).toContainText('照片沒有儲存');
  const saved = await page.evaluate(() => localStorage.getItem('star.v1.people'));
  expect(saved).not.toContain('data:image');
  expect(JSON.parse(saved)[0].palm).toMatchObject({ school: 'gender', left: { simian: 'half', life: 'short', heart: 'long-curve', fate: 'wrist' } });
  await page.reload();
  await tab(page, 'destiny');
  await expect(picker.locator('.palm-step', { hasText: '感情線' })).toContainText('長、尾端上揚');
  await expect(dv.locator('canvas.palm-canvas')).toHaveCount(0); // 照片重開就沒了

  // 右手（參考手）選真斷掌：感情線、智慧線的題目拿掉；比較時以男左女右的左手為準
  await dv.locator('.seg label', { hasText: '右手' }).click();
  await expect(dv.getByText('這隻手當參考：傳統「男左女右」以左手為主。').first()).toBeVisible();
  await opts.getByRole('button', { name: '真斷掌', exact: true }).click();
  await expect(picker.locator('.palm-step')).toHaveCount(5);
  await expect(dv.getByRole('heading', { name: '左右手比較' })).toBeVisible();
  await expect(dv.getByText(/斷掌：主要看的左手是「半斷掌：兩線有一段接在一起」，右手是「真斷掌：一條橫線貫穿手掌」。照男左女右以左手為準，右手當參考/)).toBeVisible();
  // 換成「看慣用手」：才出現慣用手的選單；選了右手就講天生（左手）和後天（右手）
  await dv.getByRole('combobox', { name: '看哪隻手的看法' }).selectOption('dominant');
  await expect(dv.getByText(/選了慣用手，就能看出哪一邊是後天的發展/)).toBeVisible();
  await dv.getByRole('combobox', { name: '慣用手' }).selectOption('right');
  await expect(dv.getByText(/斷掌：天生（左手）是「半斷掌：兩線有一段接在一起」，後天（右手）是「真斷掌：一條橫線貫穿手掌」/)).toBeVisible();

  // 隱私：照片和選項都沒有送出去
  expect(requests.filter((r) => !r.url.startsWith(baseURL) && !/^(blob|data):/.test(r.url))).toEqual([]);
  expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
});

test('掌紋描線：範例手掌練習（示範圖、對答案、不填選項）、照片左右手提醒與搬移、清除照片可以復原、加強掌紋', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await tab(page, 'destiny');
  const dv = page.locator('#view-destiny');
  await dv.getByRole('combobox', { name: '選擇命理工具' }).selectOption('palm');
  const picker = palmCard(page, '看圖選線形');
  const photo = palmCard(page, '拍照描線（選用）');
  // 還沒拍照：拍照範例三張（好的、太遠、手腕沒拍到）
  await expect(photo.locator('.palm-shot')).toHaveCount(3);
  await expect(photo.getByRole('img', { name: '可以：整隻手和手腕都入鏡、手指併攏' })).toBeVisible();
  await expect(photo.getByRole('img', { name: '不行：手腕沒拍到：第 3 個點沒地方點' })).toBeVisible();

  const cv = photo.locator('canvas.palm-canvas');
  let box;
  const center = async () => {
    await cv.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    box = await cv.boundingBox();
  };
  // 範例手掌是 714×884 的畫布；三個校正點的位置由 App 自己給（和畫的時候同一套座標）
  const at = ([x, y]) => [box.x + (x / 714) * box.width, box.y + (y / 884) * box.height];
  const points = (hand) => page.evaluate(async (hd) => (await import('/js/ui/palm-chart.js')).practicePoints(hd), hand);
  async function calibrate(pts) {
    for (const k of ['index', 'pinky', 'wrist']) {
      await center();
      await page.mouse.click(...at(pts[k]));
    }
  }
  async function trace(pts, list) {
    const mid = [(pts.index[0] + pts.pinky[0]) / 2, (pts.index[1] + pts.pinky[1]) / 2];
    const uv = ([u, v]) => [pts.pinky[0] + u * (pts.index[0] - pts.pinky[0]) + v * (pts.wrist[0] - mid[0]), pts.pinky[1] + u * (pts.index[1] - pts.pinky[1]) + v * (pts.wrist[1] - mid[1])];
    await center();
    const q = list.map(uv).map(at);
    await page.mouse.move(...q[0]);
    await page.mouse.down();
    for (const r of q.slice(1)) await page.mouse.move(...r, { steps: 6 });
    await page.mouse.up();
  }
  const LIFE = [[1.04, 0.34], [0.86, 0.5], [0.78, 0.7], [0.82, 0.88], [0.9, 1.0]];

  // 練習：畫出來的範例手掌（「我」是男生，男左女右先看左手，範例也是左手）
  await photo.getByRole('button', { name: '用範例手掌練習' }).click();
  await expect(photo.getByText(/練習模式：這是畫出來的範例手掌，描的線不會填進你的選項/)).toBeVisible();
  await expect(photo.getByRole('img', { name: '示範：第 1 個點在食指根部的中間' })).toBeVisible();
  const left = await points('left');
  await calibrate(left);
  await expect(photo.getByRole('img', { name: '示範：生命線的位置，從圓點描到箭頭' })).toBeVisible();
  await expect(photo.locator('.palm-side')).toHaveCount(0); // 範例就是左手，不會提醒
  await trace(left, LIFE);
  await expect(photo.getByText('生命線：判斷成「長、弧度大」，和範例一樣。')).toBeVisible();
  await expect(photo.getByText('還沒描：智慧線、感情線、事業線。')).toBeVisible();
  await expect(picker.locator('.palm-step', { hasText: '生命線' })).toContainText('未選'); // 練習不填選項
  await photo.getByRole('button', { name: '下一條：智慧線' }).click();
  await expect(photo.locator('.palm-step.on')).toContainText('智慧線');
  // 加強掌紋：開關有狀態
  await photo.getByRole('button', { name: '加強掌紋' }).click();
  await expect(photo.getByRole('button', { name: '加強掌紋' })).toHaveAttribute('aria-pressed', 'true');
  await photo.getByRole('button', { name: '結束練習' }).click();
  await expect(cv).toHaveCount(0);
  await expect(photo.locator('.palm-shot')).toHaveCount(3);

  // 右手的範例手掌當成照片，但現在看的是左手：提醒，一鍵移到右手
  const png = await page.evaluate(async () => (await import('/js/ui/palm-chart.js')).practicePalm('right').canvas.toDataURL('image/png').split(',')[1]);
  await photo.locator('input[type="file"]').setInputFiles({ name: 'right.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  const right = await points('right');
  await calibrate(right);
  await expect(photo.getByText(/從你點的三個位置看，這張像是右手；現在選的是左手/)).toBeVisible();
  await photo.getByRole('button', { name: '移到右手' }).click();
  await expect(dv.locator('input[name="palm-hand"]:checked')).toHaveValue('right');
  await expect(photo.locator('.palm-note')).toHaveText('照片已經移到右手。');
  await trace(right, LIFE);
  await expect(picker.locator('.palm-step', { hasText: '生命線' })).toContainText('長、弧度大');
  // 清除照片按錯了：可以復原，描過的線還在
  await photo.getByRole('button', { name: '清除照片' }).click();
  await expect(cv).toHaveCount(0);
  await photo.getByRole('button', { name: '復原：清除照片' }).click();
  await expect(cv).toHaveCount(1);
  await expect(photo.locator('.palm-step', { hasText: '生命線' })).toContainText('已描 1 筆');
  // 加強掌紋換照片也維持開著（這次開在練習時）
  await expect(photo.getByRole('button', { name: '加強掌紋' })).toHaveAttribute('aria-pressed', 'true');
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

test('塔羅：自訂牌組（檔名認牌、對不到的列出來、逐張換圖、牌背、改回內建、匯出 zip、移除）；圖只存在手機', async ({ page, baseURL }) => {
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
  // 先找到結果訊息再比內容：失敗時報告會印出實際寫了什麼（例如「讀不進來」的原因），不只是「找不到」
  await expect(tv.locator('p', { hasText: /^已匯入/ })).toContainText('已匯入 2 張；1 個檔名對不到牌：IMG_0001.png');
  await expect(tv.getByText('目前用自訂牌組：已換 2／78 張，缺的牌用內建牌面。')).toBeVisible();
  // 自訂圖沒有字：牌名由 App 蓋在牌面下方
  await expect(tv.locator('.daily-tarot .ta-face.custom')).toHaveCount(1);
  await expect(tv.locator('.daily-tarot .ta-face.custom .ta-name')).toHaveText('權杖三');
  // 逐張換圖（iPhone 相簿的照片改不了檔名）：選牌 → 選圖；牌背也能換，翻牌前看到的就是它
  const pick = tv.getByRole('combobox', { name: '要換圖的牌' });
  await pick.selectOption('major-0');
  await tv.locator('input[aria-label="選擇這張牌的圖"]').setInputFiles({ name: 'IMG_5678.png', mimeType: 'image/png', buffer });
  await expect(tv.getByText('已換成你的圖：愚者')).toBeVisible();
  await expect(pick.locator('option[value="major-0"]')).toHaveText('愚者（已換）');
  await pick.selectOption('back');
  await tv.locator('input[aria-label="選擇這張牌的圖"]').setInputFiles({ name: 'IMG_9999.png', mimeType: 'image/png', buffer });
  await expect(tv.getByText('目前用自訂牌組：已換 3／78 張＋牌背，缺的牌用內建牌面。')).toBeVisible();
  await expect(tv.locator('.daily-tarot .tc-back .ta-back.custom')).toHaveCount(1);
  // 改回內建
  await pick.selectOption('major-0');
  await tv.getByRole('button', { name: '改回內建' }).click();
  await expect(tv.getByText('愚者改回內建牌面')).toBeVisible();
  await expect(pick.locator('option[value="major-0"]')).toHaveText('愚者');
  // 匯出整副（zip，檔名是中文牌名）：沒有分享面板的瀏覽器改成下載連結
  await tv.getByRole('button', { name: '匯出牌組（zip）' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#sheet a[download]').click()]);
  expect(download.suggestedFilename()).toBe('star-tarot-deck-2026-11-25.zip');
  const zipBytes = await readFile(await download.path());
  for (const name of ['權杖三.jpg', '聖杯王牌.jpg', '牌背.jpg']) expect(zipBytes.includes(Buffer.from(name))).toBe(true);
  expect(zipBytes.includes(Buffer.from('愚者.jpg'))).toBe(false);
  await page.locator('#sheet-close').click();
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
