// ==UserScript==
// @name         YouTube 播放速度控制器
// @namespace    https://wobshare.us.kg
// @author       wob
// @version      1.0
// @description  在YouTube播放器左下角添加了一个可收缩、支持键盘输入的播放速度控制器（0.1-16倍速）。可使用 Alt+C 快捷键显示/隐藏面板。
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
        container.style.flexDirection = 'column-reverse';
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
        // 【新增】给按钮一个唯一的ID，方便快捷键查找
        toggleButton.id = 'speed-controller-toggle-button';
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
        speedInput.type = 'text';
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
        const setSpeed = (value) => {
            let newSpeed = parseFloat(value);
            if (!isNaN(newSpeed)) {
                newSpeed = Math.max(0.1, Math.min(16.0, newSpeed));
                video.playbackRate = newSpeed;
                speedInput.value = newSpeed.toFixed(1);
            } else {
                 speedInput.value = video.playbackRate.toFixed(1);
            }
        };

        speedInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                setSpeed(e.target.value);
                speedInput.blur();
            }
        });

        speedInput.addEventListener('blur', (e) => {
            e.stopPropagation();
            setSpeed(e.target.value);
        });

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

        const updateSpeedDisplay = () => {
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

        updateSpeedDisplay();
        return container;
    }

    // --- 定时器主函数 ---
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

    // --- 【新功能】添加全局快捷键监听 ---
    document.addEventListener('keydown', function(e) {
        // 检查是否按下了 Alt + C
        // e.code 对于不区分大小写的按键更可靠
        if (e.altKey && e.code === 'KeyC') {
            // 阻止浏览器或网页的其他默认行为
            e.preventDefault();
            e.stopPropagation();

            // 查找我们的“速度”按钮
            const toggleBtn = document.getElementById('speed-controller-toggle-button');

            // 如果按钮存在于页面上，就模拟一次点击
            if (toggleBtn) {
                toggleBtn.click();
            }
        }
    });

})();