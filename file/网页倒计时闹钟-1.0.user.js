// ==UserScript==
// @name         网页倒计时闹钟
// @namespace    https://wobshare.us.kg/
// @author       𝓌𝑜𝒷
// @version      1.0
// @description  一个简单的倒计时闹钟，支持自定义在线铃声和收缩/展开功能
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('Tampermonkey Countdown Alarm: Script loaded and starting execution.');

    // 更新为新的铃声URL,这里可以替换为自己喜欢的【铃声/歌曲】的URL
    const ALARM_SOUND_URL = 'https://gcore.jsdelivr.net/gh/wob-21/Cloud-storage@main/music/nz.mp3';

    let countdownInterval;
    let totalSeconds = 0;
    let alarmAudio = null;
    let isCollapsed = false;

    // --- 创建 UI 元素 ---

    const container = document.createElement('div');
    container.id = 'tampermonkey-countdown-alarm';
    container.style.cssText = `
        position: fixed !important;
        bottom: 10px !important;
        right: 10px !important;
        background: rgba(255, 255, 255, 0.95) !important;
        border: 1px solid #ccc !important;
        padding: 15px !important;
        z-index: 999999 !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
        width: 250px !important;
        text-align: center !important;
        transition: all 0.3s ease-in-out !important;
    `;

    const title = document.createElement('h3');
    title.textContent = '⏰网页倒计时闹钟';
    title.style.cssText = `
        margin-top: 0 !important;
        margin-bottom: 15px !important;
        color: #333 !important;
        cursor: pointer !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
    `;

    const collapseToggleIcon = document.createElement('span');
    collapseToggleIcon.textContent = ' ▼';
    collapseToggleIcon.style.cssText = `
        margin-left: 8px !important;
        font-size: 0.8em !important;
        line-height: 1 !important;
    `;
    title.appendChild(collapseToggleIcon);

    const inputMin = document.createElement('input');
    inputMin.type = 'number';
    inputMin.placeholder = '分钟';
    inputMin.value = '1';
    inputMin.min = '0';
    inputMin.style.cssText = `
        width: 80px !important;
        padding: 8px !important;
        margin-right: 5px !important;
        border: 1px solid #ddd !important;
        border-radius: 4px !important;
        box-sizing: border-box !important;
        margin-bottom: 10px !important;
    `;

    const inputSec = document.createElement('input');
    inputSec.type = 'number';
    inputSec.placeholder = '秒';
    inputSec.value = '0';
    inputSec.min = '0';
    inputSec.style.cssText = `
        width: 80px !important;
        padding: 8px !important;
        border: 1px solid #ddd !important;
        border-radius: 4px !important;
        box-sizing: border-box !important;
        margin-bottom: 10px !important;
    `;

    const startButton = document.createElement('button');
    startButton.textContent = '开始倒计时';
    startButton.style.cssText = `
        background-color: #4CAF50 !important;
        color: white !important;
        padding: 10px 15px !important;
        border: none !important;
        border-radius: 5px !important;
        cursor: pointer !important;
        margin-top: 5px !important;
        margin-right: 8px !important;
        font-size: 1em !important;
    `;
    startButton.onmouseover = function() { this.style.backgroundColor = '#45a049'; };
    startButton.onmouseout = function() { this.style.backgroundColor = '#4CAF50'; };

    const stopButton = document.createElement('button');
    stopButton.textContent = '停止';
    stopButton.style.cssText = `
        background-color: #f44336 !important;
        color: white !important;
        padding: 10px 15px !important;
        border: none !important;
        border-radius: 5px !important;
        cursor: pointer !important;
        margin-top: 5px !important;
        font-size: 1em !important;
    `;
    stopButton.onmouseover = function() { this.style.backgroundColor = '#da190b'; };
    stopButton.onmouseout = function() { this.style.backgroundColor = '#f44336'; };

    const timeDisplay = document.createElement('p');
    timeDisplay.textContent = '00:00';
    timeDisplay.style.cssText = `
        font-size: 3em !important;
        font-weight: bold !important;
        color: #333 !important;
        margin: 20px 0 !important;
    `;

    const statusMessage = document.createElement('p');
    statusMessage.textContent = '请设置倒计时时长';
    statusMessage.style.cssText = `
        font-size: 0.9em !important;
        color: #666 !important;
        min-height: 1.2em !important;
        margin-top: 10px !important;
    `;

    const collapsibleElements = [
        inputMin,
        inputSec,
        startButton,
        stopButton,
        statusMessage
    ];

    container.appendChild(title);
    container.appendChild(inputMin);
    container.appendChild(inputSec);
    container.appendChild(startButton);
    container.appendChild(stopButton);
    container.appendChild(timeDisplay);
    container.appendChild(statusMessage);

    document.body.appendChild(container);
    console.log('Tampermonkey Countdown Alarm: UI elements appended to body.');

    // --- 核心逻辑函数 ---

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    function startCountdown() {
        console.log('Tampermonkey Countdown Alarm: Start button clicked.');
        stopAlarmAndCountdown();

        const minutes = parseInt(inputMin.value) || 0;
        const seconds = parseInt(inputSec.value) || 0;

        if (minutes < 0 || seconds < 0) {
            statusMessage.textContent = '分钟和秒数不能为负数！';
            timeDisplay.textContent = '00:00';
            console.warn('Tampermonkey Countdown Alarm: Invalid input (negative numbers).');
            return;
        }

        totalSeconds = minutes * 60 + seconds;

        if (totalSeconds <= 0) {
            statusMessage.textContent = '倒计时时长不能为零！';
            timeDisplay.textContent = '00:00';
            console.warn('Tampermonkey Countdown Alarm: Invalid input (zero duration).');
            return;
        }

        statusMessage.textContent = '倒计时进行中...';
        timeDisplay.textContent = formatTime(totalSeconds);

        if (!isCollapsed) {
            toggleCollapse();
        }

        countdownInterval = setInterval(() => {
            totalSeconds--;
            timeDisplay.textContent = formatTime(totalSeconds);

            if (totalSeconds <= 0) {
                clearInterval(countdownInterval);
                statusMessage.textContent = '时间到！闹钟响起！';
                console.log('Tampermonkey Countdown Alarm: Countdown finished. Playing alarm.');
                playAlarm();
            }
        }, 1000);
    }

    function playAlarm() {
        console.log('Tampermonkey Countdown Alarm: Attempting to play alarm.');
        if (alarmAudio) {
            alarmAudio.pause();
            alarmAudio.currentTime = 0;
        }

        alarmAudio = new Audio(ALARM_SOUND_URL);
        alarmAudio.loop = true;
        alarmAudio.volume = 0.7;

        alarmAudio.play().then(() => {
            console.log('Tampermonkey Countdown Alarm: Alarm audio started successfully.');
        }).catch(e => {
            console.error("Tampermonkey Countdown Alarm: Error playing alarm sound:", e);
            statusMessage.textContent = '无法自动播放铃声，请点击页面任意处或检查浏览器设置。';
        });

        let blink = true;
        const blinkInterval = setInterval(() => {
            if (totalSeconds <= 0 && alarmAudio && !alarmAudio.paused) {
                timeDisplay.style.color = blink ? '#ff0000' : '#333';
                blink = !blink;
            } else {
                clearInterval(blinkInterval);
                timeDisplay.style.color = '#333';
            }
        }, 500);

        stopButton.addEventListener('click', () => clearInterval(blinkInterval), { once: true });
    }

    function stopAlarmAndCountdown() {
        console.log('Tampermonkey Countdown Alarm: Stop button clicked / Stopping all processes.');
        clearInterval(countdownInterval);
        if (alarmAudio) {
            alarmAudio.pause();
            alarmAudio.currentTime = 0;
            alarmAudio = null;
        }
        totalSeconds = 0;
        timeDisplay.textContent = '00:00';
        timeDisplay.style.color = '#333';
        statusMessage.textContent = '闹钟已停止。';

        if (isCollapsed) {
            toggleCollapse();
        }
    }

    function toggleCollapse() {
        isCollapsed = !isCollapsed;

        collapsibleElements.forEach(el => {
            el.style.display = isCollapsed ? 'none' : '';
        });

        container.style.padding = isCollapsed ? '10px' : '15px';
        timeDisplay.style.marginTop = isCollapsed ? '0px' : '20px';
        timeDisplay.style.marginBottom = isCollapsed ? '5px' : '20px';

        collapseToggleIcon.textContent = isCollapsed ? ' ▲' : ' ▼';
        console.log('Tampermonkey Countdown Alarm: UI toggled. isCollapsed:', isCollapsed);
    }

    // --- 添加事件监听器 ---
    startButton.addEventListener('click', startCountdown);
    stopButton.addEventListener('click', stopAlarmAndCountdown);
    title.addEventListener('click', toggleCollapse);

    // 初始化显示
    timeDisplay.textContent = formatTime(0);
    console.log('Tampermonkey Countdown Alarm: Script initialization complete.');
})();