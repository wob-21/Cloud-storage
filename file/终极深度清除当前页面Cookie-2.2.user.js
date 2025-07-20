// ==UserScript==
// @name         终极深度清除 (左下角)
// @name:en      Ultimate Deep Clear (Bottom-Left)
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  [高级用户版] 在左下角添加按钮，深度清除Cookie(含主域)、LocalStorage、SessionStorage、IndexedDB、Cache API，并注销Service Worker，强制刷新。明确告知Service Worker缓存需手动清理。
// @description:en [Advanced User Edition] Adds a button in the bottom-left to deeply clear Cookies (incl. parent domains), LocalStorage, SessionStorage, IndexedDB, Cache API, and unregister Service Workers, then force reload. Explicitly notes that Service Worker caches require manual clearing.
// @author       AI Assistant & Your Name
// @match        *://*/*
// @grant        GM.cookie
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // 注意：本脚本的能力边界
    // 1. 可以清除：当前域名及其所有父级域名的 Cookie、LocalStorage、SessionStorage、IndexedDB、Cache API。
    // 2. 可以注销：Service Worker 注册信息。
    // 3. 无法清除：Service Worker 的持久化缓存。这是浏览器的安全限制，任何脚本都无法做到。
    //    如遇顽固缓存（常见于 PWA 应用如 Twitter, Gmail），请按 F12 -> Application -> Clear site data 手动操作。

    // 1. 定义按钮样式
    GM_addStyle(`
        #ultimate-clear-btn {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 2147483647;
            background-color: #8e44ad;
            color: white;
            border: 2px solid #9b59b6;
            border-radius: 8px;
            padding: 10px 15px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            cursor: pointer;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            opacity: 0.9;
            transition: all 0.3s ease;
            text-align: center;
        }
        #ultimate-clear-btn:hover {
            opacity: 1;
            background-color: #9b59b6;
            transform: scale

(1.05);
        }
        #ultimate-clear-btn .small-text {
            font-size: 10px;
            display: block;
            opacity: 0.8;
            margin-top: 2px;
        }
    `);

    // 2. 创建按钮
    const clearButton = document.createElement('button');
    clearButton.id = 'ultimate-clear-btn';
    clearButton.innerHTML = '终极清除<span class="small-text">Cookie/存储</span>';
    document.body.appendChild(clearButton);

    // 3. 深度清除Cookie的函数
    async function deepClearCookies() {
        const domain = window.location.hostname;
        const domainParts = domain.split('.').reverse();
        const domainsToClear = new Set([domain, '.' + domain]);

        // 生成所有可能的父域名和子域名
        if (domainParts.length > 1) {
            let parentDomain = domainParts[1] + '.' + domainParts[0];
            for (let i = 2; i < domainParts.length; i++) {
                domainsToClear.add(parentDomain);
                domainsToClear.add('.' + parentDomain);
                parentDomain = domainParts[i] + '.' + parentDomain;
            }
        }
        const subDomains = [`www.${domain}`, `sub.${domain}`, `app.${domain}`];
        subDomains.forEach(sub => domainsToClear.add(sub));

        let totalCleared = 0;
        try {
            for (const d of domainsToClear) {
                const cookies = await GM.cookie.list({ domain: d });
                for (const cookie of cookies) {
                    await GM.cookie.delete({ name: cookie.name, domain: cookie.domain, path: cookie.path });
                    totalCleared++;
                }
            }
            return totalCleared;
        } catch (error) {
            console.error('深度清除Cookie时出错:', error);
            alert('清除Cookie时发生错误，请查看控制台。');
            return -1;
        }
    }

    // 4. 清除IndexedDB
    async function clearIndexedDB() {
        try {
            const databases = await indexedDB.databases();
            for (const db of databases) {
                indexedDB.deleteDatabase(db.name);
            }
            return databases.length;
        } catch (error) {
            console.error('清除IndexedDB时出错:', error);
            return -1;
        }
    }

    // 5. 清除Cache API
    async function clearCacheStorage() {
        try {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
            }
            return cacheNames.length;
        } catch (error) {
            console.error('清除Cache Storage时出错:', error);
            return -1;
        }
    }

    // 6. 注销Service Worker
    async function unregisterServiceWorkers() {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
            return registrations.length;
        } catch (error) {
            console.error('注销Service Worker时出错:', error);
            return -1;
        }
    }

    // 7. 按钮点击事件
    clearButton.addEventListener('click', async (event) => {
        event.stopPropagation();

        const message = `请选择清理范围：\n\n1. 深度清除Cookie\n2. 清理Cookie + LocalStorage\n3. 清理Cookie + Local/Session Storage\n4. 清理所有（Cookie + Local/Session Storage + IndexedDB + Cache API + SW注销）\n\n提醒：脚本无法清理Service Worker的持久化缓存，如仍有问题需手动清理（F12 -> Application -> Clear site data）。`;
        const choice = prompt(message, "4");

        if (choice === null) return;

        let clearLocalStorage = false;
        let clearSessionStorage = false;
        let clearIndexedDBFlag = false;
        let clearCacheStorageFlag = false;

        switch(choice.trim()) {
            case '1': break;
            case '2': clearLocalStorage = true; break;
            case '3': clearLocalStorage = true; clearSessionStorage = true; break;
            case '4':
                clearLocalStorage = true;
                clearSessionStorage = true;
                clearIndexedDBFlag = true;
                clearCacheStorageFlag = true;
                break;
            default: alert('输入无效，操作取消。'); return;
        }

        const report = [];
        const clearedCookieCount = await deepClearCookies();
        if (clearedCookieCount >= 0) {
            report.push(`✅ ${clearedCookieCount} 个Cookie已清除。`);
        } else {
            report.push(`❌ 清除Cookie失败。`);
        }

        if (clearLocalStorage) {
            localStorage.clear();
            report.push('✅ LocalStorage已清空。');
        }
        if (clearSessionStorage) {
            sessionStorage.clear();
            report.push('✅ SessionStorage已清空。');
        }
        if (clearIndexedDBFlag) {
            const clearedDBCount = await clearIndexedDB();
            report.push(clearedDBCount >= 0 ? `✅ ${clearedDBCount} 个IndexedDB数据库已清除。` : `❌ 清除IndexedDB失败。`);
        }
        if (clearCacheStorageFlag) {
            const clearedCacheCount = await clearCacheStorage();
            report.push(clearedCacheCount >= 0 ? `✅ ${clearedCacheCount} 个Cache Storage已清除。` : `❌ 清除Cache Storage失败。`);
            const unregisteredSWCount = await unregisterServiceWorkers();
            report.push(unregisteredSWCount >= 0 ? `✅ ${unregisteredSWCount} 个Service Worker已注销。` : `❌ 注销Service Worker失败。`);
        }

        alert("清理报告：\n" + report.join('\n') + "\n\n页面即将强制刷新...");
        window.location.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
    });
})();