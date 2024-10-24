// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * 从文件中读取环境变量。
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  /* 并行运行文件中的测试 */
  fullyParallel: true,
  /* 如果你不小心在源代码中留下了 test.only，则在 CI 上使构建失败。 */
  forbidOnly: !!process.env.CI,
  /* 仅在 CI 上重试 */
  retries: process.env.CI ? 2 : 0,
  /* 在 CI 上选择退出并行测试。 */
  workers: process.env.CI ? 1 : undefined,
  /* 使用的报告器。参见 https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* 以下是所有项目的共享设置。参见 https://playwright.dev/docs/api/class-testoptions。 */
  use: {
    /* 在 `await page.goto('/')` 等操作中使用的基本 URL。 */
    // baseURL: 'http://127.0.0.1:3000',

    /* 在重试失败的测试时收集跟踪。参见 https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* 为主流浏览器配置项目 */
  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

