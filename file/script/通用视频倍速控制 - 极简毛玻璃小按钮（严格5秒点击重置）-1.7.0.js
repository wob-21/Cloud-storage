// ==UserScript==
// @name         通用视频倍速控制 - 极简毛玻璃小按钮（严格5秒点击重置）
// @namespace    https://github.com/
// @version      1.7.0
// @description  极小毛玻璃速度按钮，5秒无点击强制收起+贴边，仅点击主按钮可重新显示
// @author       Grok-assisted
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ================== 可自定义部分 ==================
    const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 6, 8, 10, 12, 16];
    const DEFAULT_SPEED = 1.0;
    const MIN_SPEED = 0.1;
    const MAX_SPEED = 20;
    const AUTO_HIDE_DELAY = 5000; // 毫秒

    const KEYMAP = {
        slower:    'NumpadDivide',
        faster:    'NumpadMultiply',
        reset:     'Numpad0',
        '0.5':     'Digit1',
        '1':       'Digit2',
        '1.5':     'Digit3',
        '2':       'Digit4',
        '3':       'Digit5',
        '4':       'Digit6',
        '8':       'Digit7',
        '16':      'Digit8',
    };
    // ================================================

    let currentSpeed = DEFAULT_SPEED;
    let videoElements = new Set();
    let container = null;
    let btn = null;
    let panel = null;
    let hideTimer = null;
    let isExpanded = false;

    GM_addStyle(`
        #video-speed-mini {
            position: fixed;
            top: 24px;
            right: 8px;
            z-index: 999999;
            transition: right 0.28s ease;
            pointer-events: auto;
        }

        #video-speed-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(20, 20, 30, 0.38);
            backdrop-filter: blur(12px) saturate(180%);
            -webkit-backdrop-filter: blur(12px) saturate(180%);
            color: rgba(240, 255, 245, 0.92);
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            border: 1px solid rgba(200, 220, 255, 0.14);
            box-shadow: 0 2px 10px rgba(0,0,0,0.35);
        }

        #video-speed-btn:hover {
            background: rgba(30, 30, 45, 0.55);
        }

        #video-speed-mini.auto-hide {
            right: -26px; /* 只露出约1/4 ~ 1/3 */
        }

        #video-speed-panel {
            position: absolute;
            top: 48px;
            right: -6px;
            background: rgba(20, 20, 30, 0.65);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            color: white;
            padding: 6px 10px;
            border-radius: 8px;
            display: none;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            border: 1px solid rgba(180, 200, 255, 0.12);
            box-shadow: 0 4px 18px rgba(0,0,0,0.45);
            font-size: 13px;
        }

        #video-speed-panel button,
        .speed-display {
            background: rgba(255,255,255,0.09);
            color: white;
            border: none;
            padding: 5px 9px;
            border-radius: 5px;
            cursor: pointer;
            min-width: 32px;
            text-align: center;
        }

        #video-speed-panel button:hover,
        .speed-display:hover {
            background: rgba(255,255,255,0.18);
        }

        .speed-display {
            min-width: 44px;
            font-weight: bold;
            color: #7ff;
        }
    `);

    function createUI() {
        if (container) return;

        container = document.createElement('div');
        container.id = 'video-speed-mini';

        btn = document.createElement('div');
        btn.id = 'video-speed-btn';
        btn.textContent = currentSpeed.toFixed(1);

        panel = document.createElement('div');
        panel.id = 'video-speed-panel';

        const slower = document.createElement('button');
        slower.textContent = '–';

        const display = document.createElement('span');
        display.className = 'speed-display';
        display.textContent = currentSpeed.toFixed(2).replace(/\.?0+$/, '') + '×';

        display.addEventListener('click', e => {
            e.stopPropagation();
            const val = prompt(`请输入倍速（建议 ${MIN_SPEED}～${MAX_SPEED}）`, currentSpeed.toFixed(2));
            if (!val) return;
            const num = parseFloat(val);
            if (!isNaN(num) && num > 0) {
                setSpeed(Math.max(MIN_SPEED, Math.min(MAX_SPEED, num)));
            }
            resetHideTimer(); // 自定义输入也算一次“点击操作”
        });

        const faster = document.createElement('button');
        faster.textContent = '+';

        const reset = document.createElement('button');
        reset.textContent = '1×';

        panel.append(slower, display, faster, reset);

        container.append(btn, panel);
        document.body.appendChild(container);

        // 主按钮：点击 → 展开/收起 + 拉回位置 + 重置计时
        btn.addEventListener('click', () => {
            isExpanded = !isExpanded;
            panel.style.display = isExpanded ? 'flex' : 'none';
            container.classList.remove('auto-hide');
            resetHideTimer();
        });

        // 面板上的任何点击都重置计时器
        panel.addEventListener('click', resetHideTimer);

        slower.onclick = () => { changeSpeed(-1); };
        faster.onclick = () => { changeSpeed(+1); };
        reset.onclick  = () => { setSpeed(1.0); };
    }

    function updateDisplay() {
        if (btn) btn.textContent = currentSpeed.toFixed(1);
        if (panel && panel.querySelector) {
            const disp = panel.querySelector('.speed-display');
            if (disp) disp.textContent = currentSpeed.toFixed(2).replace(/\.?0+$/, '') + '×';
        }
    }

    function setSpeed(speed) {
        currentSpeed = Number(speed.toFixed(2));
        updateDisplay();

        document.querySelectorAll('video').forEach(v => {
            if (v.src || v.currentSrc) {
                v.playbackRate = currentSpeed;
                videoElements.add(v);
            }
        });
    }

    function getNextIndex(curr) {
        let idx = SPEED_STEPS.indexOf(curr);
        if (idx === -1) {
            idx = SPEED_STEPS.reduce((best, val, i) =>
                Math.abs(val - curr) < Math.abs(SPEED_STEPS[best] - curr) ? i : best, 0);
        }
        return idx;
    }

    function changeSpeed(dir) {
        let idx = getNextIndex(currentSpeed);
        idx = (idx + dir + SPEED_STEPS.length) % SPEED_STEPS.length;
        setSpeed(SPEED_STEPS[idx]);
    }

    function resetHideTimer() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (!container.classList.contains('auto-hide')) {
                container.classList.add('auto-hide');
            }
            // 强制收起面板
            if (isExpanded) {
                isExpanded = false;
                panel.style.display = 'none';
            }
        }, AUTO_HIDE_DELAY);
    }

    // ================== 初始化 ==================

    createUI();
    setSpeed(DEFAULT_SPEED);
    resetHideTimer();

    const observer = new MutationObserver(() => {
        document.querySelectorAll('video').forEach(v => {
            if ((v.src || v.currentSrc) && !videoElements.has(v)) {
                v.playbackRate = currentSpeed;
                videoElements.add(v);
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 键盘操作不重置计时器（符合“只有点击才出现”的严格要求）
    document.addEventListener('keydown', e => {
        if (e.target.matches('input, textarea, [contenteditable]')) return;

        const key = e.code;
        if (key === KEYMAP.slower)       { e.preventDefault(); changeSpeed(-1); }
        else if (key === KEYMAP.faster)   { e.preventDefault(); changeSpeed(+1); }
        else if (key === KEYMAP.reset)    { e.preventDefault(); setSpeed(1.0);   }
        else {
            for (let [str, k] of Object.entries(KEYMAP)) {
                if (k === key && !isNaN(parseFloat(str))) {
                    e.preventDefault();
                    setSpeed(parseFloat(str));
                    break;
                }
            }
        }
    }, true);

})();