// ==UserScript==
// @name         Bilibili 手机网页端手势控制 (强力版)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  手机浏览器访问Bilibili网页版，全屏或非全屏下左右滑动实现快进/后退5秒，修复图层遮挡问题
// @author       You
// @match        *://*.bilibili.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置区域 ---
    const CONFIG = {
        seekTime: 5,            // 每次调整几秒
        minSwipeDist: 40,       // 最小滑动触发距离(像素)
        maxVerticalDev: 80,     // 允许的最大垂直偏差(防止下滑误触)
        toastDuration: 1000     // 提示框显示时间(毫秒)
    };

    // 状态变量
    let startX = 0;
    let startY = 0;
    let isTouchingVideoArea = false;
    let toastBox = null;
    let hideTimer = null;

    // 1. 创建提示框 UI
    function initToast() {
        if (document.getElementById('bili-mobile-gesture-toast')) return;
        toastBox = document.createElement('div');
        toastBox.id = 'bili-mobile-gesture-toast';
        Object.assign(toastBox.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            zIndex: '999999',
            pointerEvents: 'none', // 关键：让点击穿透提示框
            opacity: '0',
            transition: 'opacity 0.2s',
            textAlign: 'center'
        });
        document.body.appendChild(toastBox);
    }

    function showToast(text) {
        if (!toastBox) initToast();
        toastBox.innerText = text;
        toastBox.style.opacity = '1';
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            toastBox.style.opacity = '0';
        }, CONFIG.toastDuration);
    }

    // 2. 核心逻辑：检测触摸是否在视频范围内
    // 这解决了“图层遮挡”问题
    function isTouchInVideoRect(x, y, video) {
        if (!video) return false;
        const rect = video.getBoundingClientRect();
        // 稍微放宽一点判定范围，增加容错
        return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        );
    }

    // 3. 全局触摸开始
    document.addEventListener('touchstart', (e) => {
        const video = document.querySelector('video');
        if (!video) return;

        // 获取第一个触点
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        // 关键判定：只有当触摸点在视频区域内时，才标记为有效手势开始
        if (isTouchInVideoRect(startX, startY, video)) {
            isTouchingVideoArea = true;
            // 注意：这里不要 preventDefault，否则无法点击暂停/播放
        } else {
            isTouchingVideoArea = false;
        }
    }, { passive: true }); // passive: true 优化滚动性能

    // 4. 全局触摸结束
    document.addEventListener('touchend', (e) => {
        if (!isTouchingVideoArea) return; // 如果开始点不在视频上，忽略

        const video = document.querySelector('video');
        if (!video) return;

        const touch = e.changedTouches[0];
        const endX = touch.clientX;
        const endY = touch.clientY;

        const diffX = endX - startX;
        const diffY = endY - startY;

        // 计算是否符合滑动条件
        // 条件1: 水平滑动距离足够长
        // 条件2: 垂直滑动距离足够短 (防止想下滑看评论时误触)
        if (Math.abs(diffX) > CONFIG.minSwipeDist && Math.abs(diffY) < CONFIG.maxVerticalDev) {

            // 只有当视频没有被锁定时（可选逻辑，目前强制执行）
            if (diffX > 0) {
                // 右滑 -> 前进
                video.currentTime += CONFIG.seekTime;
                showToast(`快进 +${CONFIG.seekTime}s`);
            } else {
                // 左滑 -> 后退
                video.currentTime -= CONFIG.seekTime;
                showToast(`后退 -${CONFIG.seekTime}s`);
            }
        }

        // 重置状态
        isTouchingVideoArea = false;
    }, { passive: true });

    // 初始化提示框
    initToast();
    console.log('Bilibili 强力手势脚本 V2.0 已加载');

})();