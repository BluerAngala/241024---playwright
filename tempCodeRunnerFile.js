const {
    chromium
} = require('playwright');
const fs = require('fs');
const path = require('path');


// 引入 express
const express = require('express');
const app = express();

// 设置端口
const port = process.env.PORT || 3000;


// 设置延迟 1 秒再执行，默认 1 秒，异步执行
const delay = (ms = 1000) => new Promise(resolve => setTimeout(resolve, ms));



app.use(express.json());

/**
 * 自定义错误类
 */
class PublishError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'PublishError';
        this.code = code;
    }
}

/**
 * Express路由处理函数 - 处理文章发布请求
 */
app.post('/publish', async (req, res) => {
    const articleData = req.body;
    try {
        // 验证请求数据
        if (!articleData || !articleData.title || !articleData.description || !articleData.imagePath) {
            throw new PublishError('请求参数不完整', 'INVALID_PARAMS');
        }

        console.log('开始处理文章数据', articleData);
        const result = await publishArticle(articleData);
        
        res.status(200).json({
            success: true,
            message: '文章发布成功',
            data: result
        });
    } catch (error) {
        console.error('发布失败:', error);
        const errorResponse = {
            success: false,
            message: error.message || '文章发布失败',
            code: error.code || 'UNKNOWN_ERROR'
        };

        // 根据错误类型设置不同的状态码
        const statusCode = {
            'INVALID_PARAMS': 400,
            'LOGIN_FAILED': 401,
            'UPLOAD_FAILED': 500,
            'NETWORK_ERROR': 503
        }[error.code] || 500;

        res.status(statusCode).json(errorResponse);
    }
});

app.listen(port, () => {
    const address = `http://${require('os').hostname()}:${port}`;
    console.log(`API服务已启动，访问地址为：${address}`);
});

/**
 * 发布文章到微信公众号
 * @throws {PublishError} 发布过程中的各种错误
 */
async function publishArticle(articleData) {
    try {
        const { title, description, imagePath, tags } = articleData;
        
        // 1. 图片处理
        let newImagePath = imagePath;
        if (imagePath.includes('http')) {
            try {
                const response = await fetch(imagePath);
                if (!response.ok) {
                    throw new PublishError('图片下载失败', 'DOWNLOAD_FAILED');
                }
                const imageBuffer = await response.arrayBuffer();
                newImagePath = path.resolve(__dirname, 'images', `${Date.now()}.png`);

                // 确保目录存在
                if (!fs.existsSync(path.dirname(newImagePath))) {
                    fs.mkdirSync(path.dirname(newImagePath), { recursive: true });
                }

                fs.writeFileSync(newImagePath, Buffer.from(imageBuffer));
                console.log('图片已保存到:', newImagePath);
            } catch (error) {
                throw new PublishError(`图片处理失败: ${error.message}`, 'IMAGE_PROCESS_FAILED');
            }
        }

        // 2. 浏览器启动
        const browser = await chromium.launch({
            headless: false,
        }).catch(() => {
            throw new PublishError('浏览器启动失败', 'BROWSER_LAUNCH_FAILED');
        });

        try {
            const context = await browser.newContext();
            const page = await context.newPage();
            
            // 3. 登录处理
            const storageStatePath = path.resolve(__dirname, 'storageState.json');
            
            try {
                if (fs.existsSync(storageStatePath)) {
                    console.log('加载已保存的登录信息...');
                    await context.addCookies(JSON.parse(fs.readFileSync(storageStatePath, 'utf8')).cookies);
                } else {
                    console.log('需要重新登录...');
                    await page.goto('https://mp.weixin.qq.com/');
                    
                    try {
                        await page.waitForSelector('.weui-desktop_name', { timeout: 60000 });
                    } catch (error) {
                        throw new PublishError('登录超时，请重试', 'LOGIN_TIMEOUT');
                    }

                    const storageState = await context.storageState();
                    fs.writeFileSync(storageStatePath, JSON.stringify(storageState));
                }
            } catch (error) {
                throw new PublishError(`登录失败: ${error.message}`, 'LOGIN_FAILED');
            }

            // 4. 文章发布流程
            try {
                await page.goto('https://mp.weixin.qq.com');
                await delay(1000);

                // 验证登录状态
                const isLoggedIn = await page.locator('.weui-desktop_name').isVisible();
                if (!isLoggedIn) {
                    throw new PublishError('登录状态已失效，请重新登录', 'LOGIN_EXPIRED');
                }

                // ... 其他发布操作保持不变 ...

                // 5. 文件上传
                try {
                    const fileInputSelector = '[id^="rt_rt_"] > input[type="file"]';
                    const fileInput = await page1.waitForSelector(fileInputSelector, {
                        state: 'attached',
                        timeout: 10000
                    });
                    await fileInput.setInputFiles(newImagePath);
                } catch (error) {
                    throw new PublishError('文件上传失败', 'UPLOAD_FAILED');
                }

                // 6. 保存操作
                try {
                    await page1.getByRole('button', { name: '保存为草稿' }).click();
                    await delay(1000);
                } catch (error) {
                    throw new PublishError('保存草稿失败', 'SAVE_FAILED');
                }

                return {
                    status: 'success',
                    title: title,
                    timestamp: new Date().toISOString()
                };

            } catch (error) {
                throw new PublishError(`发布操作失败: ${error.message}`, error.code || 'PUBLISH_FAILED');
            }

        } finally {
            // 确保浏览器关闭
            await browser.close().catch(console.error);
        }

    } catch (error) {
        // 重新抛出错误，保持错误链
        throw error instanceof PublishError ? error : new PublishError(error.message, 'UNKNOWN_ERROR');
    }
}
