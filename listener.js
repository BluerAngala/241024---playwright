/**
 * 导入所需的模块和依赖
 */
const {
    chromium
} = require('playwright'); // 导入playwright的chromium浏览器
const fs = require('fs'); // 文件系统模块
const path = require('path'); // 路径处理模块

/**
 * 初始化Express应用
 */
const express = require('express');
const app = express();

// 设置服务器监听端口,优先使用环境变量中的端口,否则使用30221
const port = process.env.PORT || 30221;

/**
 * 创建延迟执行的Promise函数
 * @param {number} ms - 延迟的毫秒数,默认1000ms
 * @returns {Promise} 返回一个Promise对象
 */
const delay = (ms = 1000) => new Promise(resolve => setTimeout(resolve, ms));

// 使用express的json中间件解析请求体
app.use(express.json());

/**
 * 处理文章发布的POST请求
 */
app.post('/publish', async (req, res) => {
    const articleData = req.body;
    try {
        // 检查请求体是否为空
        if (!articleData) {
            return res.status(400).json({
                success: false,
                message: '请求数据不能为空'
            });
        }

        // 检查必要字段
        const requiredFields = ['title', 'description', 'imagePath'];
        for (const field of requiredFields) {
            if (!articleData[field]) {
                return res.status(400).json({
                    success: false, 
                    message: `缺少必要字段: ${field}`
                });
            }
        }

        console.log('接收到的文章数据:', articleData);
        const result = await publishArticle(articleData);
        
        if (result) {
            res.status(200).json({
                success: true,
                message: '文章发布成功'
            });
        } else {
            res.status(500).json({
                success: false,
                message: '文章发布失败'
            });
        }
    } catch (error) {
        console.error('发布过程出错:', error);
        res.status(500).json({
            success: false,
            message: error.message || '文章发布失败',
            error: error.stack
        });
    }
});

// 启动服务器
app.listen(port, () => {
    const address = `http://${require('os').hostname()}:${port}`;
    console.log(`API服务已启动，访问地址为：${address}`);
});

/**
 * 发布文章到微信公众号
 * @param {Object} articleData - 文章数据对象
 * @param {string} articleData.title - 文章标题
 * @param {string} articleData.description - 文章描述
 * @param {string} articleData.imagePath - 图片路径
 * @param {string[]} articleData.tags - 文章标签数组
 * @returns {Promise<boolean>} 返回发布是否成功
 * @throws {Error} 可能抛出网络请求、文件操作等相关错误
 */
async function publishArticle(articleData) {
    let browser = null;
    let context = null;
    
    try {
        // 解构文章数据
        const { title, description, imagePath, tags } = articleData;
        console.log('开始处理文章数据:', { title, description, imagePath, tags });

        // 处理图片路径
        let newImagePath = imagePath;
        if (imagePath.includes('http')) {
            try {
                // 下载远程图片
                const imageBuffer = await fetch(imagePath).then(res => res.arrayBuffer());
                newImagePath = path.resolve(__dirname, 'images', `${Date.now()}.png`);

                // 确保图片保存目录存在
                if (!fs.existsSync(path.dirname(newImagePath))) {
                    fs.mkdirSync(path.dirname(newImagePath), { recursive: true });
                }

                fs.writeFileSync(newImagePath, Buffer.from(imageBuffer));
                console.log('图片已下载到:', newImagePath);
            } catch (error) {
                console.error('图片下载失败:', error);
                return false;
            }
        }

        // 验证图片路径
        if (!newImagePath) {
            console.error('无效的图片路径');
            return false;
        }

        // 初始化浏览器
        browser = await chromium.launch({
            headless: false
        });
        context = await browser.newContext();
        const page = await context.newPage();

        // 处理登录逻辑
        const storageStatePath = path.resolve(__dirname, 'storageState.json');
        
        try {
            if (fs.existsSync(storageStatePath)) {
                console.log('使用缓存的登录信息...');
                await context.addCookies(JSON.parse(fs.readFileSync(storageStatePath, 'utf8')).cookies);
            } else {
                console.log('需要重新登录...');
                await handleLogin(page, context, storageStatePath);
            }
        } catch (error) {
            console.error('登录过程出错:', error);
            throw new Error('登录失败');
        }

        // 验证登录状态
        await page.goto('https://mp.weixin.qq.com');
        console.log('正在验证登录状态...');
        await delay(1000);

        const isLoggedIn = await validateLogin(page, context);
        if (!isLoggedIn) {
            throw new Error('登录状态验证失败');
        }

        // 创建新文章
        console.log('开始创建新文章...');
        const page1 = await createNewArticle(page);
        
        // 上传图片
        await uploadImage(page1, newImagePath);
        await delay(1000);
        // 填写文章内容
        await fillArticleContent(page1, title, description, tags);
        await delay(3000);
        // 保存文章
        await saveArticle(page1);
        await delay(1000);
        // 清理资源
        await browser.close();
        console.log('浏览器已关闭，发布流程完成');

        return true;

    } catch (error) {
        console.error('文章发布过程出错:', error);
        // 确保浏览器被关闭
        if (browser) {
            await browser.close().catch(console.error);
        }
        throw error;
    }
}

/**
 * 处理登录流程
 * @param {Page} page - Playwright页面对象
 * @param {BrowserContext} context - 浏览器上下文
 * @param {string} storageStatePath - 存储状态文件路径
 */
async function handleLogin(page, context, storageStatePath) {
    await page.goto('https://mp.weixin.qq.com/');
    console.log('等待扫码登录...');
    
    await page.waitForSelector('.weui-desktop_name', {
        timeout: 60000
    });

    const storageState = await context.storageState();
    fs.writeFileSync(storageStatePath, JSON.stringify(storageState));
    console.log('登录成功，已保存登录状态');
}

/**
 * 验证登录状态
 * @param {Page} page - Playwright页面对象
 * @param {BrowserContext} context - 浏览器上下文
 * @returns {Promise<boolean>} 登录状态是否有效
 */
async function validateLogin(page, context) {
    const visibleWeuiDesktopName = await page.locator('.weui-desktop_name').isVisible();
    
    if (!visibleWeuiDesktopName) {
        console.log('登录状态已失效，尝试重新登录...');
        await context.clearCookies();
        await page.goto('https://mp.weixin.qq.com/');
        await page.waitForSelector('.weui-desktop_name', {
            timeout: 60000
        });
    }
    
    return true;
}

/**
 * 创建新文章
 * @param {Page} page - Playwright页面对象
 * @returns {Promise<Page>} 返回新文章的页面对象
 */
async function createNewArticle(page) {
    const page1Promise = page.waitForEvent('popup');
    await page.locator('div:nth-child(4) > .new-creation__menu-content').click();
    return await page1Promise;
}

/**
 * 上传图片
 * @param {Page} page - Playwright页面对象
 * @param {string} imagePath - 图片路径
 */
async function uploadImage(page, imagePath) {
    if (!fs.existsSync(imagePath)) {
        throw new Error(`图片文件不存在: ${imagePath}`);
    }

    try {
        const fileInput = await page.waitForSelector('[id^="rt_rt_"] > input[type="file"]', {
            state: 'attached'
        });
        await fileInput.setInputFiles(imagePath);
        console.log('图片上传成功');
    } catch (error) {
        console.error('图片上传失败:', error);
        throw error;
    }
}

/**
 * 填写文章内容
 * @param {Page} page - Playwright页面对象
 * @param {string} title - 文章标题
 * @param {string} description - 文章描述
 * @param {string[]} tags - 文章标签
 */
async function fillArticleContent(page, title, description, tags) {
    // 填写标题
    await page.getByPlaceholder('请在这里输入标题（选填）').click();
    await page.getByPlaceholder('请在这里输入标题（选填）').fill(title);
    
    // 填写描述
    await page.evaluate((description) => {
        const element = document.querySelector('#guide_words_main > div > span.share-text__wrp > div > div');
        if (element) {
            const newDescription = description.replace(/(\n|\r\n)/g, '<br>');
            element.innerHTML = newDescription;
        }
    }, description);
    
    // 设置标签
    await page.locator('#js_article_tags_area').getByText('未添加').click();
    await page.locator('#vue_app label').first().click();
    await page.getByPlaceholder('输入后按回车添加').fill(tags[0]);
    await page.getByPlaceholder('输入后按回车添加').press('Enter');
    await page.getByRole('button', { name: '确定' }).click();
    
    // 设置声明
    await page.locator('#js_claim_source_area').getByText('不声明').click();
    await page.getByText('个人观点，仅供参考').click();
}

/**
 * 保存文章
 * @param {Page} page - Playwright页面对象
 */
async function saveArticle(page) {
    await delay(3000);
    await page.getByRole('button', { name: '保存为草稿' }).click();
    console.log('文章已保存为草稿');
    await delay(1000);
}
