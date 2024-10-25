const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');


// 设置延迟 1 秒再执行，默认 1 秒，异步执行
const delay = (ms = 1000 ) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  // 启动浏览器
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 设置缓存路径
  const storageStatePath = path.resolve(__dirname, 'storageState.json');

  // 判断是否有本地缓存的登录信息，如果有，则直接加载
  if (fs.existsSync(storageStatePath)) {
    console.log('加载本地缓存的登录信息...');
    await context.addCookies(JSON.parse(fs.readFileSync(storageStatePath, 'utf8')).cookies);
  } else {
    console.log('没有本地缓存的登录信息，请扫码登录...');
    await page.goto('https://mp.weixin.qq.com/');
    console.log('请在 60 秒内扫码登录...');

    // 如果出现特定元素，说明登录成功
    await page.waitForSelector('.weui-desktop_name', {
      timeout: 60000
    });

    // 保存当前cookie到缓存中，方便下次使用
    const storageState = await context.storageState();
    fs.writeFileSync(storageStatePath, JSON.stringify(storageState));
    console.log('登录成功，已经保存cookie...');
  }

  // 继续进行其他操作
  await page.goto('https://mp.weixin.qq.com');
  console.log('进入公众号管理页面···');

  await delay(1000);

  // 例如，验证页面上的某些元素
  const visibleWeuiDesktopName = await page.locator('.weui-desktop_name').isVisible();

  if (visibleWeuiDesktopName) {
    console.log('存在公众号名称···');
  } else {
    console.log('不存在公众号名称···');
    // 提示重新登录
    console.log('请重新登录···');
    // 重新登录
    await context.clearCookies();
    await page.goto('https://mp.weixin.qq.com/');
    // 等待登录
    await page.waitForSelector('.weui-desktop_name', {
      timeout: 60000
    });
  }

  console.log('登录成功，开始进行其他操作···');
  await delay(1000);
  const page1Promise = page.waitForEvent('popup');

  // 点击图片消息按钮
  await page.locator('div:nth-child(4) > .new-creation__menu-content').click();
  const page1 = await page1Promise;
  await delay(1000);

  // 上传本地图片作为封面图
  const imagePath = path.resolve('D:\\Users\\桌面', '截图_20241008200736.png');

  // 检查文件是否存在
  if (!fs.existsSync(imagePath)) {
    console.error('文件不存在:', imagePath);
    return;
  }

  console.log('文件存在:', imagePath);
  await delay(1000);
  try {

    // 等待文件输入框出现并设置文件
    // 注意，要使用通配符去匹配选择器
    const fileInput = await page1.waitForSelector('[id^="rt_rt_"] > input[type="file"]', { state: 'attached' });
    console.log('文件输入框已找到');

    await fileInput.setInputFiles(imagePath);
    console.log('文件上传成功');

  } catch (error) {
    console.error('设置文件失败:', error);
  }

  // 输入标题
  await page1.getByPlaceholder('请在这里输入标题（选填）').click();
  await page1.getByPlaceholder('请在这里输入标题（选填）').fill('测试标题');
  console.log('输入标题成功');
  await delay(1000);
  // 输入描述
  await page1.locator('div').filter({ hasText: /^填写描述信息，让大家了解更多内容$/ }).nth(1).click();
  await page1.locator('div').filter({ hasText: /^填写描述信息，让大家了解更多内容$/ }).nth(1).fill('测试描述嘻嘻');
  await delay(1000);
  // 点击标签 
  await page1.locator('#js_article_tags_area').getByText('未添加').click();
  await page1.locator('#vue_app label').first().click();
  await page1.getByPlaceholder('输入后按回车添加').fill('ceshi');
  await page1.getByPlaceholder('输入后按回车添加').press('Enter');
  await page1.getByRole('button', { name: '确定' }).click();
  console.log('设置标签成功');
  await delay(1000);
  // 点击不声明
  await page1.locator('#js_claim_source_area').getByText('不声明').click();
  await page1.getByText('个人观点，仅供参考').click();
  console.log('设置创作声明成功');
  await delay(3000);
  // 点击保存为草稿
  await page1.getByRole('button', { name: '保存为草稿' }).click();
  console.log('保存为草稿成功');
  await delay(1000);
  // 关闭浏览器
  // await browser.close();
  // console.log('浏览器已经关闭');
})();
