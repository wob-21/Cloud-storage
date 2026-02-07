// ==UserScript==
// @name         视频滑动控制助手
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  左右滑动或方向键控制视频前进后退5秒（左滑后退，右滑前进）
// @author       YourName
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 配置
    const CONFIG = {
        skipSeconds: 5, // 跳转秒数
        swipeThreshold: 50, // 滑动阈值（像素）
        enableKeys: true, // 启用键盘控制
        enableSwipe: true, // 启用手势控制
        showToast: true // 显示操作提示
    };

    // 获取页面中所有视频元素
    function getVideoElements() {
        return document.querySelectorAll('video');
    }

    // 显示操作提示
    function showToast(message, duration = 1500) {
        if (!CONFIG.showToast) return;
        
        // 移除旧的提示
        const oldToast = document.getElementById('video-control-toast');
        if (oldToast) oldToast.remove();
        
        // 创建新的提示
        const toast = document.createElement('div');
        toast.id = 'video-control-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 999999;
            pointer-events: none;
            transition: opacity 0.3s;
            opacity: 1;
        `;
        
        // 添加图标
        const icon = message.includes('后退') ? '⏪' : '⏩';
        toast.textContent = `${icon} ${message}`;
        
        document.body.appendChild(toast);
        
        // 自动隐藏
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // 控制视频跳转
    function skipVideo(video, seconds) {
        if (!video || video.readyState < 2) return;
        
        const targetTime = Math.max(0, video.currentTime + seconds);
        video.currentTime = targetTime;
        
        const message = seconds > 0 ? `前进${CONFIG.skipSeconds}秒` : `后退${CONFIG.skipSeconds}秒`;
        showToast(message);
    }

    // 手势控制 - 修正逻辑：左滑后退，右滑前进
    function setupSwipeControls() {
        if (!CONFIG.enableSwipe) return;
        
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        
        // 触摸开始
        document.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startTime = Date.now();
        }, { passive: true });
        
        // 触摸结束
        document.addEventListener('touchend', function(e) {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const endTime = Date.now();
            
            const diffX = endX - startX;
            const diffY = endY - startY;
            const diffTime = endTime - startTime;
            
            // 判断是否为水平滑动（垂直位移小且时间短）
            if (Math.abs(diffX) > CONFIG.swipeThreshold && 
                Math.abs(diffY) < CONFIG.swipeThreshold * 0.6 &&
                diffTime < 500) {
                
                e.preventDefault();
                
                // 获取当前聚焦的视频
                const videos = getVideoElements();
                const activeVideo = Array.from(videos).find(v => 
                    v === document.activeElement || v.contains(document.activeElement)
                ) || videos[0];
                
                if (activeVideo) {
                    if (diffX < 0) {
                        // 向左滑动（手势向左） - 后退
                        skipVideo(activeVideo, -CONFIG.skipSeconds);
                    } else {
                        // 向右滑动（手势向右） - 前进
                        skipVideo(activeVideo, CONFIG.skipSeconds);
                    }
                }
            }
        }, { passive: false });
        
        // 鼠标拖拽支持
        let mouseDown = false;
        let mouseStartX = 0;
        
        document.addEventListener('mousedown', function(e) {
            if (e.button === 0) { // 左键
                mouseDown = true;
                mouseStartX = e.clientX;
            }
        });
        
        document.addEventListener('mouseup', function(e) {
            if (mouseDown) {
                const diffX = e.clientX - mouseStartX;
                
                if (Math.abs(diffX) > CONFIG.swipeThreshold) {
                    const videos = getVideoElements();
                    const activeVideo = Array.from(videos).find(v => 
                        v === document.activeElement || v.contains(document.activeElement)
                    ) || videos[0];
                    
                    if (activeVideo) {
                        if (diffX < 0) {
                            // 向左拖动 - 后退
                            skipVideo(activeVideo, -CONFIG.skipSeconds);
                        } else {
                            // 向右拖动 - 前进
                            skipVideo(activeVideo, CONFIG.skipSeconds);
                        }
                    }
                }
                
                mouseDown = false;
            }
        });
        
        // 鼠标滚轮水平滚动支持
        document.addEventListener('wheel', function(e) {
            // 检查是否在视频元素上
            const target = e.target;
            const isOnVideo = target.tagName === 'VIDEO' || target.closest('video');
            
            if (isOnVideo && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                // 水平滚动，且滚动量大于垂直滚动
                e.preventDefault();
                
                const videos = getVideoElements();
                const activeVideo = target.tagName === 'VIDEO' ? target : target.closest('video');
                
                if (activeVideo) {
                    if (e.deltaX > 0) {
                        // 向右滚动滚轮 - 前进
                        skipVideo(activeVideo, CONFIG.skipSeconds);
                    } else {
                        // 向左滚动滚轮 - 后退
                        skipVideo(activeVideo, -CONFIG.skipSeconds);
                    }
                }
            }
        }, { passive: false });
    }

    // 键盘控制
    function setupKeyboardControls() {
        if (!CONFIG.enableKeys) return;
        
        document.addEventListener('keydown', function(e) {
            // 防止与默认快捷键冲突
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' || 
                e.target.isContentEditable) {
                return;
            }
            
            const videos = getVideoElements();
            if (videos.length === 0) return;
            
            // 获取当前播放的视频
            const activeVideo = Array.from(videos).find(v => !v.paused) || 
                               Array.from(videos).find(v => v === document.activeElement) || 
                               videos[0];
            
            if (!activeVideo) return;
            
            // 左右方向键控制
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                skipVideo(activeVideo, -CONFIG.skipSeconds);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                skipVideo(activeVideo, CONFIG.skipSeconds);
            }
            // 添加 A/D 键控制
            else if (e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                skipVideo(activeVideo, -CONFIG.skipSeconds);
            } else if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                skipVideo(activeVideo, CONFIG.skipSeconds);
            }
        });
    }

    // 添加快捷键提示
    function addHelpIndicator() {
        const style = document.createElement('style');
        style.textContent = `
            .video-control-help {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 12px;
                z-index: 99999;
                font-family: Arial, sans-serif;
                display: none;
                backdrop-filter: blur(4px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                max-width: 250px;
                line-height: 1.5;
            }
            
            .video-control-help.show {
                display: block;
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .video-control-help h4 {
                margin: 0 0 8px 0;
                font-size: 13px;
                font-weight: bold;
                color: #4fc3f7;
            }
            
            .video-control-help ul {
                margin: 0;
                padding-left: 18px;
            }
            
            .video-control-help li {
                margin: 4px 0;
            }
            
            video:hover ~ .video-control-help,
            video:focus ~ .video-control-help {
                display: block;
            }
        `;
        document.head.appendChild(style);
        
        // 创建帮助面板
        const helpPanel = document.createElement('div');
        helpPanel.className = 'video-control-help';
        helpPanel.innerHTML = `
            <h4>视频控制助手</h4>
            <ul>
                <li>← 左方向键 / A键：后退${CONFIG.skipSeconds}秒</li>
                <li>→ 右方向键 / D键：前进${CONFIG.skipSeconds}秒</li>
                <li>鼠标左滑 / 触摸左滑：后退${CONFIG.skipSeconds}秒</li>
                <li>鼠标右滑 / 触摸右滑：前进${CONFIG.skipSeconds}秒</li>
            </ul>
        `;
        document.body.appendChild(helpPanel);
        
        // 点击显示/隐藏帮助
        let showHelp = false;
        const toggleHelp = document.createElement('div');
        toggleHelp.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 100000;
            font-size: 20px;
            user-select: none;
            backdrop-filter: blur(4px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        toggleHelp.textContent = '?';
        toggleHelp.title = '显示/隐藏控制说明';
        document.body.appendChild(toggleHelp);
        
        toggleHelp.addEventListener('click', () => {
            showHelp = !showHelp;
            if (showHelp) {
                helpPanel.classList.add('show');
            } else {
                helpPanel.classList.remove('show');
            }
        });
    }

    // 初始化
    function init() {
        console.log('视频滑动控制助手已加载 (v1.1)');
        console.log('控制逻辑：向左滑动 = 后退，向右滑动 = 前进');
        
        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setupSwipeControls();
                setupKeyboardControls();
                addHelpIndicator();
            });
        } else {
            setupSwipeControls();
            setupKeyboardControls();
            addHelpIndicator();
        }
        
        // 监听动态加载的视频
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length) {
                    const videos = getVideoElements();
                    if (videos.length > 0) {
                        console.log(`检测到 ${videos.length} 个视频元素`);
                    }
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 启动脚本
    init();

})();