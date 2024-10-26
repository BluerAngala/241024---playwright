/**
 * 导入所需的依赖模块
 */
const { chromium } = require('playwright'); // 用于浏览器自动化控制
const fs = require('fs'); // 文件系统操作
const path = require('path'); // 路径处理
const express = require('express'); // Web服务器框架

/**
 * 系统配置对象
 * @type {Object}
 * @property {number} port - 服务器监听端口,默认30221
 * @property {boolean} isProduction - 是否为生产环境
 * @property {string} logsDir - 日志文件存储目录
 * @property {string} storageStatePath - 登录状态存储文件路径
 * @property {number} loginTimeout - 登录超时时间(毫秒)
 * @property {number} publishTimeout - 发布超时时间(毫秒)
 * @property {boolean} debug - 是否开启调试模式
 */
const CONFIG = {
    port: process.env.PORT || 30221,
    isProduction: true,
    logsDir: path.join(__dirname, 'logs'),
    storageStatePath: path.join(__dirname, 'storageState.json'),
    loginTimeout: 120000,
    publishTimeout: 300000,
    debug: true
};

// 确保日志目录存在,不存在则创建
!fs.existsSync(CONFIG.logsDir) && fs.mkdirSync(CONFIG.logsDir);

/**
 * 工具函数集合
 * @type {Object}
 */
const utils = {
    /**
     * 延时函数
     * @param {number} ms - 延时时间(毫秒)
     * @returns {Promise<void>}
     */
    delay: (ms = 1000) => new Promise(resolve => setTimeout(resolve, ms)),

    /**
     * 日志记录函数
     * @param {string} message - 日志消息
     * @param {boolean} error - 是否为错误日志
     */
    log: (message, error = false) => {
        const logMessage = `${new Date().toISOString()} - ${message}\n`;

        // 调试模式下输出更详细的日志
        if (CONFIG.debug) {
            console[error ? 'error' : 'log'](`[DEBUG] ${message}`);
            error && console.trace();
        } else {
            console[error ? 'error' : 'log'](message);
        }

        // 写入日志文件
        fs.appendFileSync(
            path.join(CONFIG.logsDir, error ? 'error.log' : 'server.log'),
            logMessage
        );
    }
};

// 初始化Express应用
const app = express();
app.use(express.json({ limit: '50mb' })); // 设置请求体大小限制为50MB

/**
 * 全局错误处理中间件
 */
app.use((err, req, res, next) => {
    utils.log(`请求处理错误: ${err.stack}`, true);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: CONFIG.isProduction ? '未知错误' : err.stack
    });
});

// 捕获未处理的异常
process.on('uncaughtException', err => {
    utils.log(`未捕获的异常: ${err.stack}`, true);
    process.exit(1);
});

// 捕获未处理的Promise拒绝
process.on('unhandledRejection', reason => {
    utils.log(`未处理的Promise拒绝: ${reason}`, true);
});

/**
 * 浏览器管理类
 * 负责创建和管理浏览器实例、上下文和页面
 */
class BrowserManager {
    constructor() {
        this.browser = null;  // 浏览器实例
        this.context = null;  // 浏览器上下文
        this.mainPage = null; // 主页面
    }

    /**
     * 初始化浏览器实例
     * @returns {Promise<void>}
     */
    async init() {
        try {
            if (!this.browser) {
                utils.log('启动浏览器...');
                // 启动浏览器,生产环境使用无头模式
                this.browser = await chromium.launch({
                    headless: CONFIG.isProduction,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });

                // 创建新的浏览器上下文
                this.context = await this.browser.newContext();
                this.mainPage = await this.context.newPage();

                // 尝试从文件恢复登录状态
                if (fs.existsSync(CONFIG.storageStatePath)) {
                    const storage = JSON.parse(fs.readFileSync(CONFIG.storageStatePath, 'utf8'));
                    await this.context.addCookies(storage.cookies);
                }
            }
        } catch (error) {
            utils.log(`浏览器初始化失败: ${error.message}`, true);
            throw error;
        }
    }

    /**
     * 获取主页面实例
     * @returns {Promise<Page>} Playwright页面实例
     */
    async getMainPage() {
        try {
            if (!this.mainPage) {
                await this.init();
            }
            return this.mainPage;
        } catch (error) {
            utils.log(`获取主页面失败: ${error.message}`, true);
            throw error;
        }
    }

    /**
     * 清理浏览器资源
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            // 按顺序关闭页面、上下文和浏览器
            if (this.mainPage) {
                await this.mainPage.close().catch(() => { });
                this.mainPage = null;
            }
            if (this.context) {
                await this.context.close().catch(() => { });
                this.context = null;
            }
            if (this.browser) {
                await this.browser.close().catch(() => { });
                this.browser = null;
            }
            utils.log('浏览器资源清理完成');
        } catch (error) {
            utils.log(`清理浏览器资源失败: ${error.message}`, true);
        }
    }
}

// 创建浏览器管理器实例
const browserManager = new BrowserManager();

/**
 * 微信公众号操作相关函数集合
 * @type {Object}
 */
const weixinOps = {
    /**
     * 检查登录状态
     * @returns {Promise<boolean>} 是否已登录
     */
    checkLogin: async () => {
        try {
            const page = await browserManager.getMainPage();
            await page.goto('https://mp.weixin.qq.com');
            await utils.delay(2000);

            return await page.locator('.weui-desktop_name')
                .isVisible()
                .catch(() => false);
        } catch (error) {
            utils.log(`检查登录状态失败: ${error.message}`, true);
            return false;
        }
    },

    /**
     * 处理登录流程
     * @returns {Promise<string|boolean>} 成功返回二维码URL,失败返回false
     */
    handleLogin: async () => {
        try {
            const page = await browserManager.getMainPage();
            await page.goto('https://mp.weixin.qq.com/');

            const qrCodeSelector = '#header > div.banner > div > div > div.login__type__container.login__type__container__scan > img';
            await page.waitForSelector(qrCodeSelector);
            const qrcodeImage = await page.locator(qrCodeSelector).getAttribute('src');
            const qrcodeUrl = `https://mp.weixin.qq.com${qrcodeImage}`;

            await page.waitForSelector('.weui-desktop_name', { timeout: CONFIG.loginTimeout });

            const storage = {
                cookies: await browserManager.context.cookies(),
                origin: 'https://mp.weixin.qq.com'
            };
            fs.writeFileSync(CONFIG.storageStatePath, JSON.stringify(storage, null, 2));

            return qrcodeUrl;
        } catch (error) {
            utils.log(`登录操作失败: ${error.message}`, true);
            return false;
        }
    },

    /**
     * 打开文章编辑器
     * @returns {Promise<Page>} 返回编辑器页面实例
     */
    openArticleEditor: async () => {
        try {
            const page = await browserManager.getMainPage();
            utils.log('开始打开文章编辑器...');

            await page.goto('https://mp.weixin.qq.com');
            const createArticleSelector = '#app > div.main_bd_new > div:nth-child(3) > div.weui-desktop-panel__bd > div > div:nth-child(4)';
            await page.waitForSelector(createArticleSelector, { timeout: 10000 });
            await utils.delay(1000);

            utils.log('等待编辑器页面打开...');
            const [newPage] = await Promise.all([
                page.context().waitForEvent('page'),
                page.click(createArticleSelector)
            ]);

            await newPage.waitForLoadState('domcontentloaded');
            await newPage.waitForLoadState('networkidle');
            await utils.delay(2000);
            utils.log('编辑器页面加载完成');

            return newPage;
        } catch (error) {
            utils.log(`打开文章编辑器失败: ${error.message}`, true);
            throw error;
        }
    },

    /**
     * 上传封面图
     * @param {Page} page - 页面实例
     * @param {string} imagePath - 图片路径
     * @returns {Promise<boolean>} 上传是否成功
     */
    uploadCoverImage: async (page, imagePath) => {

        if (!fs.existsSync(imagePath)) {
            throw new Error(`图片文件不存在: ${imagePath}`);
        }

        try {
            const fileInputSelector = '[id^="rt_rt_"] > input[type="file"]';
            const fileInput = await page.waitForSelector(fileInputSelector, {
                state: 'attached',
                timeout: 10000
            });
            await utils.delay(1000);
            await fileInput.setInputFiles(imagePath);
            await utils.delay(1000);
            return true;
        } catch (error) {
            utils.log(`封面图上传失败: ${error.message}`, true);
            return false;
        }
    },

    /**
     * 填写文章标题
     * @param {Page} page - 页面实例
     * @param {string} title - 文章标题
     * @returns {Promise<boolean>} 设置是否成功
     */
    setArticleTitle: async (page, title) => {
        try {
            // 不存在标题，打印错误 
            if (!title) {
                utils.log('文章标题不存在，跳过填写', true);
                throw new Error('文章标题不存在');
            }
            utils.log('开始填写文章标题...');
            await page.getByPlaceholder('请在这里输入标题（选填）').fill(title);
            await utils.delay(1000);
            return true;
        } catch (error) {
            utils.log(`填写文章标题失败: ${error.message}`, true);
            return false;
        }
    },

    /**
     * 填写文章描述
     * @param {Page} page - 页面实例
     * @param {string} description - 文章描述
     * @returns {Promise<boolean>} 设置是否成功
     */
    setArticleDescription: async (page, description) => {
        try {
            if (!description) {
                utils.log('文章描述不存在，跳过填写', true);
                throw new Error('文章描述不存在');
            }
            utils.log('开始填写文章描述...');
            await page.evaluate((desc) => {
                document.querySelector('#guide_words_main > div > span.share-text__wrp > div > div').innerHTML =
                    desc.replace(/(\n|\r\n)/g, '<br>');
            }, description);
            await utils.delay(1000);
            return true;
        } catch (error) {
            utils.log(`填写文章描述失败: ${error.message}`, true);
            return false;
        }
    },

    /**
     * 设置文章标签
     * @param {Page} page - 页面实例
     * @param {string[]} tags - 标签数组
     * @returns {Promise<boolean>} 设置是否成功
     */
    setArticleTags: async (page, tags) => {
        try {
            if (!tags || tags.length === 0) {
                utils.log('文章标签不存在，跳过填写', true);
                throw new Error('文章标签不存在');
            }
            utils.log('开始设置文章标签...');
            await page.locator('#js_article_tags_area').getByText('未添加').click();
            await page.locator('#vue_app label').first().click();
            for (const tag of tags) {
                await page.getByPlaceholder('输入后按回车添加').fill(tag);
                await page.getByPlaceholder('输入后按回车添加').press('Enter');
                await utils.delay(500);
            }
            await page.getByRole('button', { name: '确定' }).click();
            await utils.delay(1000);
            return true;
        } catch (error) {
            utils.log(`设置文章标签失败: ${error.message}`, true);
            return false;
        }
    },

    /**
     * 设置文章创作声明
     * @param {Page} page - 页面实例
     * @param {Object} options - 声明选项
     * @param {string} [options.sourceType='不声明'] - 来源类型
     * @param {string} [options.contentType='个人观点，仅供参考'] - 内容类型
     * @returns {Promise<boolean>} 设置是否成功
     */
    setArticleDeclaration: async (page, options = {}) => {
        try {
            utils.log('开始设置文章创作声明...');
            const { sourceType = '不声明', contentType = '个人观点，仅供参考' } = options;

            await page.locator('#js_claim_source_area').getByText(sourceType).click();
            await utils.delay(1000);
            await page.getByText(contentType).click();
            await utils.delay(1000);
            return true;
        } catch (error) {
            utils.log(`设置文章创作声明失败: ${error.message}`, true);
            return false;
        }
    },

    /**
     * 保存为草稿
     * @param {Page} page - 页面实例
     * @returns {Promise<boolean>} 保存是否成功
     */
    saveAsDraft: async (page) => {
        try {
            utils.log('正在保存为草稿...');
            await utils.delay(1000);
            await page.getByRole('button', { name: '保存为草稿' }).click();
            await utils.delay(2000);
            return true;
        } catch (error) {
            utils.log(`保存草稿失败: ${error.message}`, true);
            return false;
        }
    },

    /**
     * 预览文章
     * @param {Page} page - 页面实例
     * @param {string} previewWxName - 预览微信号
     * @returns {Promise<boolean>} 预览是否成功
     */
    previewArticle: async (page, previewWxName) => {
        try {
            if (!previewWxName) {
                utils.log('预览微信号不存在，跳过预览', true);
                throw new Error('预览微信号不存在');
            }
            utils.log('开始预览文章...');
            await page.getByRole('button', { name: '预览' }).click();
            await utils.delay(1000);
            // 获取所有匹配的a标签
            const elements = await page.locator('#js_preview_wxname_container > span > a');
            utils.log(`已经输入的预览微信号: ${await elements.count()}`);
            // 循环点击每一个匹配的a标签
            const count = await elements.count();
            for (let i = 0; i < count; i++) {
                // 因为删除会导致a标签的索引变化，所以每次都点击第一个
                await elements.nth(0).click();
                await utils.delay(1000);
            }
            utils.log('所有预览微信号已清除');
            await page.fill('#js_preview_wxname', previewWxName);
            await utils.delay(1000);
            await page.getByRole('button', { name: '确定' }).click();
            utils.log('预览设置完成');
            return true;
        } catch (error) {
            utils.log(`预览文章失败: ${error.message}`, true);
            return false;
        }
    },

    /**
     * 保存图片到本地
     * @param {string[]} imagePath - 图片路径数组
     * @returns {Promise<string[]|boolean>} 成功返回新图片路径数组,失败返回false
     */
    saveImageToLocal: async (imagePath) => {
        try {
            let newImagePaths = [];
            for (const [index, imgPath] of imagePath.entries()) {
                if (imgPath.includes('http')) {
                    try {
                        // 下载远程图片
                        const imageBuffer = await fetch(imgPath).then(res => res.arrayBuffer());
                        // 根据当前日期生成年月日格式的子文件夹路径
                        const date = new Date();
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const subDir = path.join('images', `${year}${month}${day}`);
                        const newPath = path.resolve(__dirname, subDir, `${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
                        // 确保图片保存目录存在
                        if (!fs.existsSync(path.dirname(newPath))) {
                            fs.mkdirSync(path.dirname(newPath), { recursive: true });
                        }

                        fs.writeFileSync(newPath, Buffer.from(imageBuffer));
                        newImagePaths.push(newPath);
                        utils.log(`第${index + 1}张图片下载完成: ${newPath}`);
                    } catch (error) {
                        utils.log(`图片下载失败: ${error.message}`, true);
                        return false;
                    }
                } else {
                    newImagePaths.push(imgPath);
                }
            }
            return newImagePaths;
        } catch (error) {
            utils.log(`保存图片到本地失败: ${error.message}`, true);
            return false;
        }
    },

    /**
     * 发布文章主函数
     * @param {Object} articleData - 文章数据
     * @param {string[]} [articleData.imagePath] - 封面图路径数组
     * @param {string} articleData.title - 文章标题
     * @param {string} articleData.description - 文章描述
     * @param {string[]} articleData.tags - 文章标签数组
     * @param {string} [articleData.preview_wxname] - 预览微信号
     * @returns {Promise<boolean>} 发布是否成功
     */
    publishArticle: async (articleData) => {
        console.log('开始发布文章...', JSON.stringify(articleData));
        let page = null;

        try {
            page = await weixinOps.openArticleEditor();
            // 上传封面图
            if (articleData.imagePath) {
                // 将传输的图片先保存到本地
                const newImagePaths = await weixinOps.saveImageToLocal(articleData.imagePath);

                // 验证图片路径
                if (newImagePaths.length === 0) {
                    utils.log('无效的图片路径', true);
                    throw new Error('无效的图片路径');
                }

                // 上传封面图 微信最多支持上传9张图片
                for (const [index, imgPath] of newImagePaths.entries()) {
                    utils.log(`正在上传第${index + 1}张封面图: ${imgPath}`);
                    await weixinOps.uploadCoverImage(page, imgPath);
                    await utils.delay(1000);
                }
            }
            // 填写文章标题
            await weixinOps.setArticleTitle(page, articleData.title);
            // 填写文章描述 
            await weixinOps.setArticleDescription(page, articleData.description);
            // 设置文章标签
            await weixinOps.setArticleTags(page, articleData.tags);
            // 设置文章创作声明
            await weixinOps.setArticleDeclaration(page);
            // 保存为草稿
            await weixinOps.saveAsDraft(page);
            // 预览文章
            if (articleData.preview_wxname) {
                await weixinOps.previewArticle(page, articleData.preview_wxname);
            }
            utils.log('文章发布完成');
            await page.close();
            utils.log('页面已关闭');
            return true;

        } catch (error) {
            utils.log(`发布文章失败: ${error.message}`, true);
            if (page) await page.close().catch(() => { });
            return false;
        }
    }
};

/**
 * 健康检查接口
 */
app.get('/health', async (req, res) => {
    try {
        const loginStatus = await weixinOps.checkLogin();
        res.json({
            status: loginStatus ? 'ok' : 'error',
            message: loginStatus ? '登录状态正常' : '需要重新登录'
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * 发布文章接口
 */
app.post('/publish', async (req, res) => {
    try {
        // 先检查登录状态
        const loginStatus = await weixinOps.checkLogin();
        if (!loginStatus) {
            const qrcodeUrl = await weixinOps.handleLogin();
            if (!qrcodeUrl) {
                return res.status(500).json({ success: false, message: '获取登录二维码失败' });
            }
            return res.status(401).json({
                success: false,
                message: '请使用手机扫描二维码登录',
                qrcodeUrl
            });
        }

        // 发布文章
        const result = await Promise.race([
            weixinOps.publishArticle(req.body),
            new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), CONFIG.publishTimeout))
        ]);

        if (!result) {
            throw new Error('发布失败');
        }

        // 直接返回成功响应，不再进行额外的登录检查
        return res.json({ success: true, message: '发布成功' });

    } catch (error) {
        res.status(error.message === '请求超时' ? 504 : 500).json({
            success: false,
            message: error.message
        });
    }
});

// 启动服务器
(async () => {
    try {
        await browserManager.init();

        app.listen(CONFIG.port, () => {
            const os = require('os');
            const interfaces = os.networkInterfaces();
            const addresses = [];

            for (let iface of Object.values(interfaces)) {
                for (let addr of iface) {
                    if (addr.family === 'IPv4' && !addr.internal) {
                        addresses.push(addr.address);
                    }
                }
            }

            utils.log(`服务已启动在端口 ${CONFIG.port}`);
            addresses.forEach(ip => {
                utils.log(`访问地址：http://${ip}:${CONFIG.port}`);
            });
            utils.log(`访问地址：http://localhost:${CONFIG.port}`);
        });

        // 初始检查登录状态
        const isLoggedIn = await weixinOps.checkLogin();
        if (!isLoggedIn) {
            const qrcodeUrl = await weixinOps.handleLogin();
            utils.log(`等待扫码登录...\n${qrcodeUrl}`);
        }
    } catch (error) {
        utils.log(`服务启动失败: ${error.message}`, true);
        await browserManager.cleanup();
        process.exit(1);
    }
})();
