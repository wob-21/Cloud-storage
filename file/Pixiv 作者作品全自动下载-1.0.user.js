// ==UserScript==
// @name         Pixiv 作者作品全自动下载
// @namespace    https://wobshare.us.kg
// @version      1.0
// @description  【终极版】在Pixiv作者页，通过官方API，一次性获取作者所有作品ID，再通过作品API获取原图链接，实现真正的一键下载。告别翻页、稳定高效！
// @author       wob
// @match        https://www.pixiv.net/users/*
// @connect      www.pixiv.net
// @connect      i.pximg.net
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- 1. UI创建部分 (保持不变) ---
    const mainContainer = document.createElement('div');
    Object.assign(mainContainer.style, { position: 'fixed', top: '80px', left: '20px', zIndex: '9999', display: 'flex', flexDirection: 'column', alignItems: 'stretch' });
    const actionButton = document.createElement('button');
    actionButton.textContent = '下载该作者全部作品';
    Object.assign(actionButton.style, { padding: '12px 24px', fontSize: '14px', backgroundColor: '#0096fa', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'background-color 0.3s', marginBottom: '5px' });
    const progressBarContainer = document.createElement('div');
    Object.assign(progressBarContainer.style, { height: '10px', backgroundColor: '#e0e0e0', borderRadius: '5px', overflow: 'hidden', display: 'none' });
    const progressBarFill = document.createElement('div');
    Object.assign(progressBarFill.style, { height: '100%', width: '0%', backgroundColor: '#00d368', borderRadius: '5px', transition: 'width 0.3s ease-in-out' });
    progressBarContainer.appendChild(progressBarFill);
    mainContainer.appendChild(actionButton);
    mainContainer.appendChild(progressBarContainer);

    if (window.location.href.match(/\/users\/\d+/)) {
        document.body.appendChild(mainContainer);
    } else {
        return;
    }

    // --- 2. 核心下载逻辑 (全新API版本) ---
    actionButton.addEventListener('click', runApiBasedAutomation);

    async function runApiBasedAutomation() {
        actionButton.disabled = true;
        actionButton.style.cursor = 'wait';
        actionButton.style.backgroundColor = '#555';
        progressBarFill.style.width = '0%';
        progressBarContainer.style.display = 'none';

        // --- 阶段一: 从URL获取作者ID，调用API获取所有作品ID ---
        actionButton.textContent = '1/4: 正在获取作品列表...';
        const match = window.location.href.match(/\/users\/(\d+)/);
        if (!match) {
            actionButton.textContent = '错误: 无法获取作者ID';
            setTimeout(resetButton, 5000);
            return;
        }
        const userId = match[1];
        const profileApiUrl = `https://www.pixiv.net/ajax/user/${userId}/profile/all`;

        let allArtworkIds = [];
        try {
            const apiResponse = await getJson(profileApiUrl);
            const illusts = apiResponse.body.illusts || {};
            const manga = apiResponse.body.manga || {};
            allArtworkIds = [...Object.keys(illusts), ...Object.keys(manga)];
        } catch (error) {
            actionButton.textContent = '错误: 获取作品列表失败';
            console.error('Profile API request failed:', error);
            setTimeout(resetButton, 5000);
            return;
        }

        if (allArtworkIds.length === 0) {
            actionButton.textContent = '该作者没有公开作品';
            setTimeout(resetButton, 5000);
            return;
        }

        // --- 阶段二: 准备下载 ---
        actionButton.textContent = `2/4: 找到 ${allArtworkIds.length} 个作品，准备下载...`;
        await sleep(2000);
        progressBarContainer.style.display = 'block';

        let totalImagesToDownload = 0;

        // --- 阶段三: 【核心改动】循环处理每个作品ID，调用作品API获取信息 ---
        for (let i = 0; i < allArtworkIds.length; i++) {
            const illustId = allArtworkIds[i];
            const progressPercentage = ((i + 1) / allArtworkIds.length) * 100;
            actionButton.textContent = `3/4: 下载中 (${i + 1}/${allArtworkIds.length})...`;
            progressBarFill.style.width = `${progressPercentage}%`;

            try {
                // 直接调用作品信息API，不再请求HTML
                const illustApiUrl = `https://www.pixiv.net/ajax/illust/${illustId}`;
                const response = await getJson(illustApiUrl);

                if (response.error) {
                    console.error(`获取作品 ${illustId} 信息失败:`, response.message);
                    continue; // 跳过这个错误的作品
                }

                const illustData = response.body;
                const userName = illustData.userName;
                const illustTitle = illustData.title.replace(/[\\/:*?"<>|]/g, '');
                const pageCount = illustData.pageCount;

                for (let p = 0; p < pageCount; p++) {
                    // 从作品API的 "urls" 对象中获取原图链接
                    const imageUrl = illustData.urls.original.replace('_p0', `_p${p}`);
                    const fileExtension = imageUrl.substring(imageUrl.lastIndexOf('.'));
                    const imageName = `[${userName}] ${illustTitle} (id${illustId})_p${p}${fileExtension}`;

                    GM_download({
                        url: imageUrl,
                        name: imageName,
                        headers: { 'Referer': 'https://www.pixiv.net/' },
                        onerror: (err) => console.error(`下载失败: ${imageName}`, err),
                        ontimeout: () => console.error(`下载超时: ${imageName}`),
                    });
                    totalImagesToDownload++;
                    await sleep(200); // 轻微延时，对服务器友好
                }
            } catch (error) {
                console.error(`处理作品 ${illustId} 时发生意外错误:`, error);
            }
        }

        // --- 阶段四: 完成通知 ---
        actionButton.textContent = `4/4: ${totalImagesToDownload} 个下载任务已启动！`;
        GM_notification({
            title: 'Pixiv 作者作品下载完成',
            text: `来自 ${allArtworkIds.length} 个作品的 ${totalImagesToDownload} 张原图已全部提交下载。`,
            timeout: 8000
        });

        setTimeout(resetButton, 5000);
    }

    // 辅助函数：使用 GM_xmlhttpRequest 获取并解析JSON
    function getJson(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                responseType: "json", // 直接要求返回JSON对象
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.response);
                    } else {
                        reject(new Error(`HTTP error! status: ${response.status}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    function resetButton() {
        actionButton.textContent = '下载该作者全部作品';
        actionButton.disabled = false;
        actionButton.style.cursor = 'pointer';
        actionButton.style.backgroundColor = '#0096fa';
        progressBarContainer.style.display = 'none';
        setTimeout(() => { progressBarFill.style.width = '0%'; }, 300);
    }
})();