// ==UserScript==
// @name         Wallhaven 全自动一键下载
// @namespace    https://wobshare.us.kg
// @version      1.0
// @description  全站增强！在Wallhaven.cc的用户收藏/上传、搜索结果、最新、热门等所有列表页面，实现一键全自动下载当前页所有图片，并带有进度条。
// @author       wob
// @match        https://wallhaven.cc/user/*/uploads*
// @match        https://wallhaven.cc/user/*/favorites*
// @match        https://wallhaven.cc/search*
// @match        https://wallhaven.cc/toplist*
// @match        https://wallhaven.cc/latest*
// @match        https://wallhaven.cc/hot*
// @match        https://wallhaven.cc/random*
// @grant        GM_download
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. 创建UI元素 (主容器, 按钮, 进度条) ---

    // 创建主容器，用于包裹按钮和进度条，便于统一定位
    const mainContainer = document.createElement('div');
    Object.assign(mainContainer.style, {
        position: 'fixed',
        top: '100px',
        left: '20px', // 左上角布局
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column', // 让按钮和进度条垂直排列
        alignItems: 'stretch' // 让子元素宽度一致
    });

    // 创建操作按钮
    const actionButton = document.createElement('button');
    actionButton.textContent = '一键下载本页图片'; // 修改按钮文字，更符合分页逻辑
    Object.assign(actionButton.style, {
        padding: '12px 24px',
        fontSize: '14px',
        backgroundColor: '#2980b9',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        transition: 'background-color 0.3s',
        marginBottom: '5px' // 与下方的进度条留出间距
    });

    // 创建进度条背景
    const progressBarContainer = document.createElement('div');
    Object.assign(progressBarContainer.style, {
        height: '10px',
        backgroundColor: '#e0e0e0',
        borderRadius: '5px',
        overflow: 'hidden', // 确保内部填充条不会溢出圆角
        display: 'none' // 默认隐藏
    });

    // 创建进度条填充部分
    const progressBarFill = document.createElement('div');
    Object.assign(progressBarFill.style, {
        height: '100%',
        width: '0%', // 初始宽度为0
        backgroundColor: '#4CAF50', // 绿色，表示进度
        borderRadius: '5px',
        transition: 'width 0.3s ease-in-out' // 让宽度变化有平滑过渡效果
    });

    // 将元素组装起来并添加到页面
    progressBarContainer.appendChild(progressBarFill);
    mainContainer.appendChild(actionButton);
    mainContainer.appendChild(progressBarContainer);
    document.body.appendChild(mainContainer);


    // --- 2. 按钮点击事件：启动全自动流程 ---
    actionButton.addEventListener('click', runFullAutomation);

    async function runFullAutomation() {
        // 防止重复点击
        actionButton.disabled = true;
        actionButton.style.cursor = 'wait';
        actionButton.style.backgroundColor = '#555';

        // 重置并隐藏进度条（以防上次运行中断）
        progressBarFill.style.width = '0%';
        progressBarContainer.style.display = 'none';

        // --- 步骤 A: 自动滚动 (对于无限滚动页有效，对于分页页则确保加载完当前页) ---
        actionButton.textContent = '1/4: 扫描页面内容...';
        await scrollToBottom();

        // --- 步骤 B: 收集图片链接 ---
        actionButton.textContent = '2/4: 正在收集链接...';
        const imageLinks = document.querySelectorAll('.thumb-listing-page ul li a.preview');

        if (imageLinks.length === 0) {
            actionButton.textContent = '错误：未找到任何图片';
            setTimeout(() => {
                resetButton();
            }, 5000);
            return;
        }

        actionButton.textContent = `3/4: 找到 ${imageLinks.length} 张图片，准备下载...`;
        await new Promise(resolve => setTimeout(resolve, 2000));

        // --- 步骤 C: 循环下载 (并更新进度条) ---
        progressBarContainer.style.display = 'block';

        for (let i = 0; i < imageLinks.length; i++) {
            const link = imageLinks[i];
            const progressPercentage = ((i + 1) / imageLinks.length) * 100;

            actionButton.textContent = `3/4: 下载中 (${i + 1}/${imageLinks.length})...`;
            progressBarFill.style.width = `${progressPercentage}%`;

            try {
                const highResPageUrl = link.href;
                const response = await fetch(highResPageUrl);
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const imageElement = doc.querySelector('#wallpaper');

                if (imageElement) {
                    const imageUrl = imageElement.src;
                    const imageName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
                    GM_download({
                        url: imageUrl,
                        name: imageName,
                        onerror: (err) => console.error(`下载失败: ${imageName}`, err.error),
                        ontimeout: () => console.error(`下载超时: ${imageName}`)
                    });
                }
            } catch (error) {
                console.error(`处理链接 ${link.href} 失败:`, error);
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        // --- 步骤 D: 完成并通知 ---
        actionButton.textContent = '4/4: 下载任务已全部启动！';
        GM_notification({
            title: 'Wallhaven 下载完成',
            text: `本页 ${imageLinks.length} 张图片的下载任务已提交给浏览器。`,
            timeout: 7000
        });

        // 5秒后重置按钮和进度条
        setTimeout(() => {
            resetButton();
        }, 5000);
    }

    // --- 辅助函数 ---

    function scrollToBottom() {
        return new Promise(resolve => {
            let lastHeight = 0;
            // 对于分页页面，这个循环通常只会执行一两次就会结束
            const scrollInterval = setInterval(() => {
                window.scrollTo(0, document.body.scrollHeight);
                const newHeight = document.body.scrollHeight;
                if (newHeight === lastHeight) {
                    clearInterval(scrollInterval);
                    resolve();
                } else {
                    lastHeight = newHeight;
                }
            }, 500); // 缩短间隔，因为分页页面加载快
        });
    }

    function resetButton() {
        actionButton.textContent = '一键下载本页图片';
        actionButton.disabled = false;
        actionButton.style.cursor = 'pointer';
        actionButton.style.backgroundColor = '#2980b9';
        progressBarContainer.style.display = 'none';
        setTimeout(() => {
            progressBarFill.style.width = '0%';
        }, 300);
    }

})();