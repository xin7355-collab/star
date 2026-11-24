// design-qa 版面稽核：用真的瀏覽器在 320／390／1440 寬打開各分頁，量對比、觸控大小、鍵盤焦點、水平捲動，
// 再交給 .claude/skills/design-qa/scripts/rendered_audit.py 判定。任何一張快照不是 CLEAN 就失敗（CI 會紅燈）。
//
// 用法：npm run qa:design            （全部：一般、長內容、1440）
//       node scripts/design-qa.cjs long （只跑其中一組：standard／long／wide）
// 快照存在 test-results/design-qa/（不進 git）。
//
// 長內容的資料是故意做到上限：名單 50 人、名字 20 字（含沒有空格的英文）、紀錄 300 筆（標題 60 字、摘要 400 字）、
// AI 短評 200 字含長網址（Worker 的上限）、宜忌最多的一天（2027-12-31）。AI 回應只在這裡模擬，不連外。
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'test-results', 'design-qa');
const PORT = 4174; // 和 E2E 的 4173 分開，兩者同時跑也不會撞
const BASE = `http://127.0.0.1:${PORT}/`;
const SKILL = path.join(ROOT, '.claude', 'skills', 'design-qa');
const collector = readFileSync(path.join(SKILL, 'assets', 'collect_snapshot.js'), 'utf8');
const PROPS = ['outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'borderColor', 'backgroundColor', 'textDecorationLine', 'color'];

const hex = (n) => n.toString(16).padStart(16, '0');
const rawOf = (i) => ({ calendar: 'solar', era: 'ad', year: 1960 + (i % 40), month: (i % 12) + 1, day: (i % 27) + 1, leap: false, knowTime: i % 3 !== 0, time: `${String(i % 24).padStart(2, '0')}:15`, placeId: 'taipei', lat: null, lon: null, tz: 'Asia/Taipei', fold: null, solar: null });
const ME = { id: `p-${hex(1)}`, name: '我', gender: '男', self: true, createdAt: '2026-11-24T00:00:00.000Z', raw: { ...rawOf(0), era: 'roc', year: 79, month: 8, day: 15, knowTime: true, time: '06:20' } };
const ZH = '王陳林黃張李吳劉蔡楊許鄭謝洪郭邱曾廖賴徐';
const LONG_PEOPLE = [ME, ...Array.from({ length: 49 }, (_, k) => {
  const i = k + 1;
  const name = i % 2 ? Array.from({ length: 20 }, (_, j) => ZH[(i + j) % ZH.length]).join('') : 'Wolfeschlegelsteinha';
  return { id: `p-${hex(i + 1)}`, name, gender: i % 2 ? '女' : '男', self: false, createdAt: '2026-11-24T00:00:00.000Z', raw: rawOf(i) };
})];
const TYPES = ['fortune', 'match', 'tarot', 'bazi', 'liunian', 'ziwei', 'maya', 'numerology', 'chenggu'];
const LONG_HISTORY = Array.from({ length: 300 }, (_, i) => ({
  id: `h-${hex(i + 1)}`, type: TYPES[i % TYPES.length], at: new Date(Date.UTC(2026, 10, 24, 12) - i * 3600000).toISOString(), personId: LONG_PEOPLE[i % 50].id,
  title: (i % 2 ? '長標題測試'.repeat(12) : 'LongTitleWithoutSpaces'.repeat(3)).slice(0, 60),
  summary: (i % 2 ? '這是一段很長的摘要，用來檢查換行與版面。'.repeat(20) : 'SummaryWithoutAnySpacesToTestOverflowWrap'.repeat(10)).slice(0, 400), detail: null,
}));
const SIGN_IDS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const AI_TEXT = ('今天適合整理思緒、規劃下一步。' + 'https://example.com/averyveryverylongunbrokenstringwithoutspaces').repeat(3).slice(0, 200);

/** 一張快照：展開所有收合區塊，再用真的 Tab 鍵走一遍，記下每個控制項的焦點樣式 */
async function snap(page, name, width) {
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { if (!d.closest('[hidden]')) d.open = true; }));
  await page.addScriptTag({ content: collector });
  // maxText 預設 400 是依文件順序取：長內容時隱藏分頁（名單 50 人、紀錄 300 筆）會先佔滿，
  // 眼前分頁的文字反而沒量到對比，所以放寬到 20000
  const s = await page.evaluate(() => window.designQaSnapshot({ focus: false, maxText: 20000 }));
  const byId = new Map(s.elements.map((e) => [e.id, e]));
  const seen = new Set();
  await page.mouse.move(0, 0);
  for (let i = 0; i < 1500; i += 1) {
    await page.keyboard.press('Tab');
    const probe = await page.evaluate(() => window.designQaFocusProbe());
    if (!probe) continue;
    if (seen.has(probe.id)) break;
    seen.add(probe.id);
    const el = byId.get(probe.id);
    if (!el) continue;
    const changed = el.rest ? PROPS.filter((k) => el.rest[k] !== probe.styles[k]) : [];
    el.focus = { indicator: probe.outlineOn || probe.shadowOn || changed.length > 0, obscured: probe.obscured, how: 'keyboard', changed };
  }
  for (const e of s.elements) if (e.interactive && !e.disabled && !e.focus) e.focus = { indicator: null, obscured: null, how: 'not reached by Tab' };
  s.keyboard_pass = { reached: seen.size };
  const file = path.join(OUT, `${name}-${width}.json`);
  writeFileSync(file, JSON.stringify(s));
  await page.evaluate(() => window.scrollTo(0, 0));
  return file;
}

async function open(browser, width, { people = null, history = [], activeIdx = 0, fixedTime = null, mockAi = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 760 }, locale: 'zh-TW', timezoneId: 'Asia/Taipei', serviceWorkers: mockAi ? 'block' : 'allow' });
  if (people) {
    await ctx.addInitScript(({ people, history, active }) => {
      if (!localStorage.getItem('star.v1.people')) {
        localStorage.setItem('star.v1.people', JSON.stringify(people));
        localStorage.setItem('star.v1.history', JSON.stringify(history));
        localStorage.setItem('star.v1.settings', JSON.stringify({ activeId: active, sect: 1, solarTime: 'standard' }));
      }
    }, { people, history, active: people[activeIdx].id });
  }
  if (mockAi) {
    await ctx.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const AI_ENDPOINT = 'https://ai.example.test';" }));
    await ctx.route('https://ai.example.test/**', (r) => r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ period: 'today', key: 'qa', validUntil: '2099-01-01T00:00:00Z', signs: Object.fromEntries(SIGN_IDS.map((k) => [k, AI_TEXT])) }),
    }));
  }
  const page = await ctx.newPage();
  if (fixedTime) await page.clock.setFixedTime(new Date(fixedTime));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return { ctx, page };
}

const tab = async (page, view) => { await page.locator(`.tabbar [data-view="${view}"]`).click(); await page.waitForTimeout(300); };

/** 有資料的各分頁：運勢 → 我的 → 八字 → 紫微 → 配對 → 塔羅 */
async function tour(browser, width, prefix, opts) {
  const files = [];
  let { ctx, page } = await open(browser, width, { ...opts, activeIdx: 0 });
  await page.waitForSelector('#view-fortune .chip-row.yi .chip');
  if (opts.mockAi) await page.waitForFunction(() => /averyvery/.test(document.querySelector('#view-fortune').textContent));
  files.push(await snap(page, `${prefix}fortune`, width));
  await tab(page, 'me');
  files.push(await snap(page, `${prefix}me`, width));
  await ctx.close();
  // 長內容組：正在看的人換成 20 字英文名字，檢查命理、配對的標題與表格
  ({ ctx, page } = await open(browser, width, { ...opts, activeIdx: opts.people.length > 2 ? 2 : 0 }));
  await tab(page, 'destiny');
  await page.waitForSelector('#view-destiny table.pillars');
  files.push(await snap(page, `${prefix}bazi`, width));
  await page.locator('#view-destiny select').nth(1).selectOption('ziwei');
  await page.waitForSelector('#view-destiny .ziwei-grid');
  files.push(await snap(page, `${prefix}ziwei`, width));
  await tab(page, 'match');
  if (opts.people.length > 2) {
    await page.locator('#view-match .seg label', { hasText: '精準' }).click();
    await page.locator('#view-match select').nth(1).selectOption(opts.people[1].id);
  }
  await page.locator('#view-match').getByRole('button', { name: '開始配對' }).click();
  await page.waitForSelector('#view-match .match-result h2');
  files.push(await snap(page, `${prefix}match`, width));
  await tab(page, 'tarot');
  await page.locator('#view-tarot').getByRole('button', { name: '洗牌並抽牌' }).click();
  await page.waitForTimeout(300);
  files.push(await snap(page, `${prefix}tarot`, width));
  await ctx.close();
  return files;
}

async function capture(browser, group) {
  const files = [];
  if (group === 'standard') {
    for (const width of [320, 390]) {
      // 第一次使用（空白狀態）
      const { ctx, page } = await open(browser, width);
      files.push(await snap(page, 'empty-me', width));
      await tab(page, 'destiny');
      files.push(await snap(page, 'empty-destiny', width));
      await ctx.close();
      files.push(...(await tour(browser, width, '', { people: [ME] })));
    }
  } else if (group === 'long') {
    for (const width of [320, 390]) files.push(...(await tour(browser, width, 'long-', { people: LONG_PEOPLE, history: LONG_HISTORY, fixedTime: '2027-12-31T10:00:00+08:00', mockAi: true })));
  } else if (group === 'wide') {
    files.push(...(await tour(browser, 1440, 'wide-', { people: LONG_PEOPLE, history: LONG_HISTORY, fixedTime: '2027-12-31T10:00:00+08:00', mockAi: true })));
  } else {
    throw new Error(`不認得的組別「${group}」，請用 standard、long 或 wide`);
  }
  return files;
}

function audit(file) {
  const args = [path.join(SKILL, 'scripts', 'rendered_audit.py'), '--snapshot', file, '--waivers', path.join(ROOT, 'docs', 'qa', 'design-qa-waivers.csv')];
  try {
    return { file, ok: true, text: execFileSync('python3', args, { encoding: 'utf8' }) };
  } catch (err) {
    return { file, ok: false, text: String(err.stdout || err.message) };
  }
}

async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch { /* 還沒啟動 */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`本機伺服器 ${BASE} 10 秒內沒有回應`);
}

(async () => {
  const groups = process.argv[2] ? [process.argv[2]] : ['standard', 'long', 'wide'];
  mkdirSync(OUT, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve.mjs'), String(PORT)], { stdio: 'ignore' });
  let failed = 0;
  try {
    await waitForServer();
    const browser = await chromium.launch();
    try {
      for (const group of groups) {
        for (const file of await capture(browser, group)) {
          const r = audit(file);
          const first = r.text.split('\n')[0];
          console.log(`${r.ok ? '✓' : '✗'} ${path.basename(file)}  ${first.replace(/^design-qa rendered audit: /, '')}`);
          if (!r.ok) {
            failed += 1;
            console.log(r.text.split('\n').filter((l) => /^\[(BLOCKER|HIGH|WARN)\]|^ {4}/.test(l)).join('\n'));
          }
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
  if (failed) {
    console.error(`\ndesign-qa：${failed} 張快照有問題（細節見上方；快照在 test-results/design-qa/）`);
    process.exit(1);
  }
  console.log('\ndesign-qa：全部快照 CLEAN');
})().catch((err) => { console.error(err); process.exit(1); });
