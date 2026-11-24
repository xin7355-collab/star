// 手機尺寸的端對端測試（e2e-testing 技能）。用法：npm run test:e2e
// ・本機：Chromium＋iPhone 13 尺寸（雲端工作階段只預裝 Chromium）
// ・CI：另外設 PW_WEBKIT=1 安裝並跑 WebKit（Safari 的引擎），更接近 iPhone 實機
import { defineConfig, devices } from '@playwright/test';

const iphone = devices['iPhone 13'];
const projects = [{ name: 'iphone-chromium', use: { ...iphone, browserName: 'chromium' } }];
if (process.env.PW_WEBKIT) projects.push({ name: 'iphone-webkit', use: { ...iphone, browserName: 'webkit' } });

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // 預設關掉動畫（系統「減少動態效果」）：測的是功能與結果，避免等動畫；另有一組測試專門開著動畫跑
    reducedMotion: 'reduce',
    baseURL: 'http://127.0.0.1:4173',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects,
  webServer: {
    command: 'node scripts/serve.mjs 4173',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
  },
});
