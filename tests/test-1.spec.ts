import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=2136161486');
  const page1Promise = page.waitForEvent('popup');
  await page.locator('div:nth-child(4) > .new-creation__menu-content').click();
  const page1 = await page1Promise;
  await page1.locator('#js_content_top label').click();
  await page1.locator('body').setInputFiles('截图_20241011212224.png');
  await page1.getByPlaceholder('请在这里输入标题（选填）').click();
  await page1.getByPlaceholder('请在这里输入标题（选填）').fill('测试');
  await page1.locator('div').filter({ hasText: /^填写描述信息，让大家了解更多内容$/ }).nth(1).click();
  await page1.locator('div').filter({ hasText: /^填写描述信息，让大家了解更多内容$/ }).nth(1).fill('这是一段测试的话');
  await page1.goto('https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&reprint_confirm=0&timestamp=1729742968975&type=77&appmsgid=100000313&token=2136161486&lang=zh_CN');
  await page1.locator('#js_article_tags_area').getByText('未添加').click();
  await page1.getByText('##测试').click();
  await page1.getByRole('button', { name: '确定' }).click();
  await page1.locator('#js_claim_source_area').getByText('不声明').click();
  await page1.getByText('个人观点，仅供参考').click();
  await page1.getByRole('button', { name: '保存为草稿' }).click();
});