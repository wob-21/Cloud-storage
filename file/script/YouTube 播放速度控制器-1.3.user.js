// ==UserScript==
// @name         YouTube 播放速度控制器
// @namespace    https://wobshare.us.kg
// @author       wob
// @version      1.3
// @description  在YouTube播放器左下角添加一个可收缩、支持键盘输入的播放速度控制器（0.1-16倍），修复了输入无响应问题。
// @match        https://www.youtube.com/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    let speedControllerContainer = null;
    let lastVideoElement = null;

    function createSpeedControllerUI(video) {
        // --- 1. 创建主容器 ---
        const container = document.createElement('div');
        container.id = 'custom-speed-controller';
        container.style.position = 'absolute';
        container.style.bottom = '15px';
        container.style.left = '15px';
        container.style.zIndex = '9999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column-reverse'; // 修改：让总开关在下面
        container.style.alignItems = 'flex-start';

        // --- 2. 创建控制面板 (默认隐藏) ---
        const controlsPanel = document.createElement('div');
        controlsPanel.style.display = 'none';
        controlsPanel.style.flexDirection = 'row';
        controlsPanel.style.alignItems = 'center';
        controlsPanel.style.gap = '5px';
        controlsPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        controlsPanel.style.padding = '5px';
        controlsPanel.style.borderRadius = '5px';
        controlsPanel.style.marginBottom = '5px';

        // --- 3. 创建总开关 (收缩/展开) 按钮 ---
        const toggleButton = document.createElement('button');
        toggleButton.textContent = '速度';
        toggleButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        toggleButton.style.color = 'white';
        toggleButton.style.border = 'none';
        toggleButton.style.padding = '5px 10px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.borderRadius = '5px';
        toggleButton.style.fontSize = '12px';
        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = controlsPanel.style.display === 'none';
            controlsPanel.style.display = isHidden ? 'flex' : 'none';
        });

        // --- 4. 创建具体的控制按钮和输入框 ---
        const createButton = (text) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.style.backgroundColor = '#333';
            button.style.color = 'white';
            button.style.border = '1px solid #555';
            button.style.padding = '2px 6px';
            button.style.cursor = 'pointer';
            button.style.fontSize = '14px';
            button.style.fontWeight = 'bold';
            return button;
        };

        const speedInput = document.createElement('input');
        speedInput.type = 'text'; // 使用 text 类型以更好地控制显示格式
        speedInput.style.width = '45px';
        speedInput.style.backgroundColor = '#222';
        speedInput.style.color = 'white';
        speedInput.style.border = '1px solid #555';
        speedInput.style.borderRadius = '3px';
        speedInput.style.textAlign = 'center';
        speedInput.style.fontSize = '12px';
        speedInput.style.padding = '4px 2px';

        const decreaseButton = createButton('−');
        const increaseButton = createButton('+');

        // --- 5. 核心逻辑：绑定事件 ---

        // 统一的设置速度函数
        const setSpeed = (value) => {
            let newSpeed = parseFloat(value);
            if (!isNaN(newSpeed)) {
                newSpeed = Math.max(0.1, Math.min(16.0, newSpeed));
                video.playbackRate = newSpeed;
                speedInput.value = newSpeed.toFixed(1); // 立即反馈校正后的值
            } else {
                 // 如果输入无效，则恢复显示当前速度
                 speedInput.value = video.playbackRate.toFixed(1);
            }
        };

        // 【修复】监听键盘的 'keydown' 事件，而不是 'change'
        speedInput.addEventListener('keydown', (e) => {
            e.stopPropagation(); // 关键：阻止事件冒泡被YouTube捕获
            if (e.key === 'Enter') {
                e.preventDefault(); // 阻止回车键的默认行为（如提交表单）
                setSpeed(e.target.value);
                speedInput.blur(); // 设置后让输入框失去焦点
            }
        });

        // 【修复】当输入框失去焦点时（例如点击页面其他地方），也设置速度
        speedInput.addEventListener('blur', (e) => {
            e.stopPropagation();
            setSpeed(e.target.value);
        });

        // 【改进】点击输入框时，自动全选内容，方便修改
        speedInput.addEventListener('click', (e) => {
            e.stopPropagation();
            speedInput.select();
        });


        decreaseButton.addEventListener('click', (e) => {
            e.stopPropagation();
            video.playbackRate = Math.max(parseFloat((video.playbackRate - 0.1).toFixed(1)), 0.1);
        });

        increaseButton.addEventListener('click', (e) => {
            e.stopPropagation();
            video.playbackRate = Math.min(parseFloat((video.playbackRate + 0.1).toFixed(1)), 16.0);
        });

        // 当视频播放速率真正改变时，更新输入框的显示
        const updateSpeedDisplay = () => {
             // 只有当输入框不处于激活状态时才更新，避免覆盖用户正在输入的内容
            if (document.activeElement !== speedInput) {
                speedInput.value = video.playbackRate.toFixed(1);
            }
        };
        video.addEventListener('ratechange', updateSpeedDisplay);

        // --- 6. 组装UI ---
        controlsPanel.appendChild(decreaseButton);
        controlsPanel.appendChild(speedInput);
        controlsPanel.appendChild(increaseButton);

        container.appendChild(controlsPanel);
        container.appendChild(toggleButton);

        updateSpeedDisplay(); // 初始化显示
        return container;
    }

    // 主函数，定时检测页面状态
    function main() {
        if (!window.location.pathname.startsWith('/watch')) return;
        const video = document.querySelector('video');
        const player = document.getElementById('movie_player');

        if (!video || !player) {
            if (speedControllerContainer) {
                speedControllerContainer.remove();
                speedControllerContainer = null;
                lastVideoElement = null;
            }
            return;
        }

        if (video !== lastVideoElement) {
            if (speedControllerContainer) speedControllerContainer.remove();
            speedControllerContainer = createSpeedControllerUI(video);
            player.appendChild(speedControllerContainer);
            lastVideoElement = video;
        }
    }

    setInterval(main, 1000);
})();