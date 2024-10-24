## 简介

通过 playwright 来实现自动化操作。

相关文档：

教程：[Playwright 中文网 (nodejs.cn)](https://playwright.nodejs.cn/)

vscode 开发调试：[入门 - VS Code | Playwright 中文网 (nodejs.cn)](https://playwright.nodejs.cn/docs/getting-started-vscode)

自动化录制：[¥Generating tests](https://playwright.nodejs.cn/docs/getting-started-vscode#generating-tests)

## playwright 与 Puppeteer

Playwright和Puppeteer都是用于自动化网页操作的工具，但它们在功能和设计上有一些区别。

### Puppeteer

1. **开发者**：由Google开发和维护。
2. **浏览器支持**：主要支持Chromium（包括Chrome和Edge）。
3. **API设计**：API设计相对简单，适合快速上手。
4. **功能**：支持大部分常见的浏览器自动化功能，如截图、PDF生成、表单填写、点击、导航等。

### Playwright

1. **开发者**：由Microsoft开发和维护。
2. **浏览器支持**：支持多种浏览器，包括Chromium、Firefox和WebKit（Safari）。
3. **API设计**：API设计更为现代和强大，支持并行测试、自动等待等高级功能。
4. **功能**：除了Puppeteer的功能外，还支持更多高级功能，如跨浏览器测试、网络拦截、地理位置模拟等。

### 哪个更好？

这取决于你的具体需求：

1. **浏览器支持**：如果你需要跨浏览器测试，Playwright是更好的选择。
2. **功能需求**：如果你需要更高级的功能和更强大的API，Playwright可能更适合你。
3. **简单易用**：如果你只是需要一些基本的自动化功能，Puppeteer可能更容易上手。

总的来说，Playwright在功能和灵活性上更胜一筹，但Puppeteer也有其简单易用的优势。选择哪个工具，主要取决于你的具体需求和项目要求。

**而且 playwright 还可以通过录制方式生成脚本，简直无敌。**

## 初始化

下面是从零开始创建一个Playwright项目的完整流程，包括安装和配置。

### 1. 安装Node.js、 vscode及插件

首先，你需要确保你的系统上已经安装了Node.js。你可以通过以下命令检查是否已经安装：

```bash
node -v
npm -v
```

如果没有安装，可以从[Node.js官网](https://nodejs.org/)下载并安装最新版本。

然后，安装 [来自市场的 VS Code 扩展](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) 或从 VS Code 中的扩展选项卡安装。

安装 [来自市场的 VS Code 扩展](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) 或从 VS Code 中的扩展选项卡安装。

![VS Code extension for Playwright](https://github.com/microsoft/playwright/assets/13063165/cab54568-3168-4b3f-bf3d-854976594903)

安装后，打开命令面板并输入：

```bash
Install Playwright
```

![install playwright](https://github.com/microsoft/playwright/assets/13063165/14e91050-24ab-4ff1-a37b-57d7c15e5c35)

选择测试：安装 Playwright 并选择你想要运行测试的浏览器。这些可以稍后在 [playwright.config](https://playwright.nodejs.cn/docs/test-configuration) 文件中配置。你还可以选择是否要将 GitHub Actions 设置为 [在 CI 上运行测试](https://playwright.nodejs.cn/docs/ci-intro)。

![choose browsers](https://github.com/microsoft/playwright/assets/13063165/c9e8a25a-e9e8-4419-aeb5-1b8ba58bd71d)

打开测试侧边栏

可以通过单击活动栏中的测试图标来打开测试侧边栏。这将使你能够访问测试资源管理器，它将向你显示项目中的所有测试以及包含项目、设置、工具和设置的 Playwright 侧边栏。

![Testing Sidebar](https://github.com/microsoft/playwright/assets/13063165/d203fe83-6015-4e7a-b816-35d373906b24)

#### 运行测试

你可以通过单击测试块旁边的绿色三角形来运行单个测试。Playwright 将运行测试的每一行，完成后你将在测试块旁边看到一个绿色勾号以及运行测试所需的时间。

![run a single test](https://github.com/microsoft/playwright/assets/13063165/69dbccfc-4e9f-40e7-bcdf-7d5c5a11f988)

运行测试并显示浏览器

你还可以运行测试并通过选择测试侧栏中的“显示浏览器”选项来显示浏览器。然后，当你单击绿色三角形来运行测试时，浏览器将打开，你将直观地看到它在测试中运行。如果你希望打开浏览器进行所有测试，请保留此选项；如果你希望测试在不打开浏览器的情况下以无头模式运行，请取消选中此选项。

![show browsers while running tests](https://github.com/microsoft/playwright/assets/13063165/9f231530-0c43-466a-b944-8cf5102f714a)

### 2. 创建一个新的项目目录

在你的工作目录下创建一个新的项目文件夹，并进入该文件夹：

```bash
mkdir playwright-demo
cd playwright-demo
```

### 3. 初始化项目

使用 `npm init`命令初始化一个新的Node.js项目：

```bash
npm init -y
```

这将创建一个默认的 `package.json`文件。

### 4. 安装Playwright

使用npm安装Playwright：

```bash
npm install playwright
```

### 5. 创建测试脚本

在项目根目录下创建一个新的JavaScript文件，例如 `example.js`：

```bash
touch example.js
```

然后在 `example.js`中编写一个简单的Playwright脚本：

```javascript
const { chromium } = require('playwright');

(async () => {
  // 启动浏览器
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // 导航到一个网页
  await page.goto('https://example.com');

  // 截图
  await page.screenshot({ path: 'example.png' });

  // 关闭浏览器
  await browser.close();
})();
```

### 6. 运行测试脚本

使用Node.js运行你的Playwright脚本：

```bash
node example.js
```

如果一切顺利，你应该会在项目目录下看到一个名为 `example.png`的截图文件。

### 7. 配置Playwright测试框架（可选）

如果你想使用Playwright的测试框架，可以安装 `@playwright/test`：

```bash
npm install @playwright/test
```

然后创建一个测试文件，例如 `example.test.js`：

```bash
touch example.test.js
```

在 `example.test.js`中编写测试代码：

```javascript
const { test, expect } = require('@playwright/test');

test('basic test', async ({ page }) => {
  await page.goto('https://example.com');
  const title = await page.title();
  expect(title).toBe('Example Domain');
});
```

### 8. 运行测试

使用Playwright测试框架运行测试：

```bash
npx playwright test
```

这将运行所有以 `.test.js`结尾的测试文件，并生成测试报告。

## 实现功能

* [ ] **微信公众号**
  * [X] 自动化发布图片消息
  * [ ] 自动化发布图文消息
  * [ ] 自动化发布视频消息
* [ ] 微信视频号
* [ ] 知乎
* [ ] 小红书
* [ ] 抖音



## 致谢

[microsoft/playwright](https://github.com/microsoft/playwright)

## 协议

非商业性许可  [CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/)
