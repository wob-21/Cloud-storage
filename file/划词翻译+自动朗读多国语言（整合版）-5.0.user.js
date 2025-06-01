// ==UserScript==
// @name         划词翻译+自动朗读多国语言（整合版）
// @namespace    https://wobshare.us.kg
// @connect      wobys.dpdns.org
// @connect      dict.youdao.com
// @author       𝓌𝑜𝒷
// @version      5.0
// @description  ♻整合了有道的API和我的translate API接口，根据划词内容智能选择翻译API：纯英文单词使用有道词典API（英译中），其他所有情况（句子、非英文单词）则使用我搭建的translate API。✨实现划词后自动朗读并显示悬浮翻译卡片，鼠标一旦移出划词区域，立即关闭翻译卡片并清除划词高亮，不想使用该脚本时按 "Ctrl+空格"快捷键 【关闭/开启】该脚本，更轻、更快、更稳定！国内外皆可使用！
// @match        *://*/*
// @exclude      *://www.google.com/search*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  let voiceReady = false;
  let cachedVoices = [];
  let scriptEnabled = true; // 脚本的启用状态，默认为开启

  // --- 语音预加载 ---
  function preloadVoices() {
    cachedVoices = speechSynthesis.getVoices();
    if (cachedVoices.length) {
      voiceReady = true;
      // console.log('Voices preloaded:', cachedVoices); // For debugging
    }
  }

  speechSynthesis.onvoiceschanged = () => {
    cachedVoices = speechSynthesis.getVoices();
    if (cachedVoices.length) {
      voiceReady = true;
      // console.log('Voices changed and loaded:', cachedVoices); // For debugging
    }
  };

  preloadVoices(); // 首次加载脚本时尝试预加载

  // --- CSS 样式 ---
  GM_addStyle(`
    .translate-tooltip {
      position: absolute;
      background: linear-gradient(135deg, #4A90E2, #007AFF);
      color: #fff;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 15px;
      max-width: 360px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      white-space: pre-line;
      font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial;
      pointer-events: auto;
      z-index: 9999;
    }
    /* 提示消息样式 */
    .userscript-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: rgba(0, 0, 0, 0.75);
        color: white;
        padding: 10px 15px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
        pointer-events: none; /* 确保不影响页面交互 */
    }
    .userscript-toast.show {
        opacity: 1;
    }
  `);

  let selectionBox = null; // 用于存储选区位置信息

  // --- 主鼠标抬起事件处理函数 ---
  function handleMouseUp() {
    if (!scriptEnabled) return; // 如果脚本被禁用，则直接返回

    const selection = window.getSelection();
    const text = selection.toString().trim();

    // 检查文本有效性和长度限制
    // 限制在 200 个字符内，避免过长文本导致 API 请求问题或朗读卡顿
    if (!text || text.length > 200) {
      // 如果选区无效或过长，移除可能存在的翻译卡片和监听
      removeTooltip();
      document.removeEventListener('mousemove', strictMouseLeaveCheck);
      selectionBox = null;
      // 不清空选择，因为可能是用户误操作或选择过长
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    selectionBox = rect; // 记录选区位置

    // 判断是纯英文单词，还是其他（句子、非英文单词）
    // 纯英文单词定义：不包含空格，长度适中（例如 30个字符以内），且只包含英文字母、连字符或撇号
    const isLikelyEnglishWord = text.length <= 30 && /^[a-zA-Z'-]+$/.test(text);

    speakViaBrowser(text); // 朗读

    if (isLikelyEnglishWord) {
      fetchYoudaoTranslation(text, rect); // 英文单词使用有道翻译
    } else {
      fetchWobTranslation(text, rect); // 其他情况（句子、非英文单词）使用 wob 翻译
    }

    // 每次划词后都重新添加鼠标移动监听器，确保每次都能正确触发离开检测
    document.removeEventListener('mousemove', strictMouseLeaveCheck); // 先移除旧的，防止重复添加
    document.addEventListener('mousemove', strictMouseLeaveCheck); // 添加新的
  }

  // 初始时添加 mouseup 监听器
  document.addEventListener('mouseup', handleMouseUp);

  // --- 语音朗读函数 ---
  function speakViaBrowser(text) {
    if (!scriptEnabled) return; // 如果脚本被禁用，不执行朗读
    if (!voiceReady) {
      console.warn('Speech voices not ready or loaded yet.'); // For debugging
      return; // 检查语音是否准备好
    }

    // 尝试查找语音，如果没有则使用第一种可用语音
    const voice = cachedVoices.find(v => v.lang.startsWith('ko-KR')) || cachedVoices[0];
    if (!voice) {
      console.warn('No suitable Korean voice found. Using first available voice if any.'); // For debugging
      return; // 如果没有可用语音，则返回
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.lang = voice.lang || 'ko-KR'; // 设置朗读语言，优先使用选择的语音语言，否则默认ko-KR
    utter.rate = 1.0; // 朗读速度，可根据需要调整
    utter.pitch = 1.0; // 朗读音高，可根据需要调整

    speechSynthesis.cancel(); // 取消当前所有朗读
    speechSynthesis.speak(utter); // 开始朗读
  }

  // --- wob 翻译请求函数 (用于句子翻译及非英文单词) ---
  function fetchWobTranslation(text, rect) {
    if (!scriptEnabled) return; // 如果脚本被禁用，不执行翻译请求
    GM_xmlhttpRequest({
      method: 'GET',
      // 根据用户反馈，wobys.dpdns.org API需要明确指定 source_language 和 target_language。
      // 由于无法准确检测划词文本的源语言，这里统一设置为 ko 到 zh
      url: `https://wobys.dpdns.org/?text=${encodeURIComponent(text)}&source_language=ko&target_language=zh&secret=123456`,
      onload: res => {
        try {
          // 检查HTTP状态码，非200的响应也可能是API问题
          if (res.status !== 200) {
            console.error('Wob API returned non-200 status:', res.status, res.statusText, res.responseText);
            showTooltip(`🌐 wob翻译失败 (错误码: ${res.status})`, rect);
            return;
          }

          const data = JSON.parse(res.responseText);
          // 假设 wobys.dpdns.org 的响应结构中翻译结果在 data.text
          const output = data.text && data.text.trim() !== '' ? data.text : '无翻译结果';
          showTooltip(`📘 𝓌𝑜𝒷翻译：\n${output}`, rect); // 显示翻译结果
        } catch (err) {
          console.error('Wob Translation Parse Error:', err, 'Response:', res.responseText); // 详细错误信息
          showTooltip('🌐 wob翻译解析失败', rect); // 解析失败提示
        }
      },
      onerror: (err) => {
        // err object often contains details like status, statusText, finalUrl, etc.
        console.error('Wob Translation Request Failed:', err); // 详细错误信息
        let errorMessage = '🌐 wob翻译请求失败';
        // 常见的 BLOCKED_BY_CLIENT 错误通常导致 status 为 0
        if (err && err.status === 0) {
            errorMessage = '🌐 wob翻译请求被客户端阻止或网络问题！\n请检查防火墙、杀毒软件或网络设置。';
        } else if (err && err.status) {
            errorMessage += ` (Status: ${err.status})`;
        } else if (err && err.message) {
            errorMessage += ` (${err.message})`;
        }
        showTooltip(errorMessage, rect); // 请求失败提示
      }
    });
  }

  // --- 有道词典翻译请求函数 (用于英文单词翻译) ---
  function fetchYoudaoTranslation(word, rect) {
    if (!scriptEnabled) return; // 如果脚本被禁用，不执行翻译请求
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://dict.youdao.com/jsonapi?xmlVersion=5.1&jsonversion=2&q=${encodeURIComponent(word)}`,
      onload: res => {
        try {
          if (res.status !== 200) {
            console.error('Youdao API returned non-200 status:', res.status, res.statusText, res.responseText);
            showTooltip(`📘 有道翻译失败 (错误码: ${res.status})`, rect);
            return;
          }

          const data = JSON.parse(res.responseText);
          let output = '';

          const ec = data.ec; // 有道词典的解释数据
          if (ec && ec.word && ec.word[0] && ec.word[0].trs) {
            const trs = ec.word[0].trs; // 词语的翻译列表
            // 提取翻译并格式化，只取第一个可能的翻译项
            output = trs.map(tr => `· ${tr.tr[0].l.i[0]}`).join('\n');
          } else if (data.fanyi && data.fanyi.tran) { // 尝试获取简单翻译
            output = data.fanyi.tran;
          } else if (data.web_trans && data.web_trans.web_translation && data.web_trans.web_translation.length > 0) {
            // 尝试获取网络释义
            output = data.web_trans.web_translation[0].trans;
          }

          if (!output || output.trim() === '') output = '无翻译结果';
          showTooltip('📘 有道词典：\n' + output, rect); // 显示翻译结果
        } catch (err) {
          console.error('Youdao Translation Parse Error:', err, 'Response:', res.responseText); // 详细错误信息
          showTooltip('📘 有道解析失败', rect); // 解析失败提示
        }
      },
      onerror: (err) => {
        console.error('Youdao Translation Request Failed:', err); // 详细错误信息
        let errorMessage = '📘 有道请求失败';
        if (err && err.status === 0) {
            errorMessage = '📘 有道请求被客户端阻止或网络问题！\n请检查防火墙、杀毒软件或网络设置。';
        } else if (err && err.status) {
            errorMessage += ` (Status: ${err.status})`;
        } else if (err && err.message) {
            errorMessage += ` (${err.message})`;
        }
        showTooltip(errorMessage, rect); // 请求失败提示
      }
    });
  }

  // --- 翻译卡片管理 ---
  function showTooltip(text, rect) {
    if (!scriptEnabled) return; // 如果脚本被禁用，不显示卡片
    removeTooltip(); // 先移除旧的卡片
    const tip = document.createElement('div');
    tip.className = 'translate-tooltip';
    tip.innerText = text;
    document.body.appendChild(tip);

    // 设置卡片位置
    // 确保卡片不会超出可视区域
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    let tooltipLeft = rect.left + window.scrollX;
    let tooltipTop = rect.bottom + window.scrollY + 10;

    // 简单调整，避免超出右侧边界
    if (tooltipLeft + tip.offsetWidth > viewportWidth + window.scrollX - 20) {
      tooltipLeft = viewportWidth + window.scrollX - tip.offsetWidth - 20;
      if (tooltipLeft < 0) tooltipLeft = 10; // 防止负值
    }

    // 简单调整，避免超出底部边界，如果超出则显示在选区上方
    if (tooltipTop + tip.offsetHeight > viewportHeight + window.scrollY - 20) {
      tooltipTop = rect.top + window.scrollY - tip.offsetHeight - 10;
      if (tooltipTop < 0) tooltipTop = 10; // 防止负值
    }


    tip.style.left = `${tooltipLeft}px`;
    tip.style.top = `${tooltipTop}px`;
  }

  // 严格的鼠标移出检测
  function strictMouseLeaveCheck(e) {
    if (!selectionBox) return; // 如果没有选区，则返回
    const { left, right, top, bottom } = selectionBox;
    const buffer = 5; // 增加一个小的缓冲区域
    // 判断鼠标是否在选区范围内（包括缓冲区域）
    const inArea =
      e.pageX >= left + window.scrollX - buffer &&
      e.pageX <= right + window.scrollX + buffer &&
      e.pageY >= top + window.scrollY - buffer &&
      e.pageY <= bottom + window.scrollY + buffer;

    if (!inArea) {
      removeTooltip(); // 移除翻译卡片
      document.removeEventListener('mousemove', strictMouseLeaveCheck); // 移除鼠标移动监听
      selectionBox = null; // 清空选区位置信息
      if (window.getSelection) {
        window.getSelection().removeAllRanges(); // 清空选中文本（若不想清空选中的文本，可注释此行。多行注释：Ctrl+/ 或 Ctrl+K ）
      }
    }
  }

  function removeTooltip() {
    const el = document.querySelector('.translate-tooltip');
    if (el) el.remove(); // 移除翻译卡片DOM元素
  }

  // --- 提示消息函数 ---
  function showToast(message) {
    let toast = document.querySelector('.userscript-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'userscript-toast';
      document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.add('show'); // 显示提示
    // 清除任何旧的隐藏计时器
    if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
    toast.hideTimeout = setTimeout(() => {
      toast.classList.remove('show'); // 2秒后隐藏提示
    }, 2000);
  }

  // --- 脚本启用/禁用切换逻辑 ---
  function toggleScriptEnabled() {
    scriptEnabled = !scriptEnabled; // 切换状态

    if (scriptEnabled) {
      // 脚本开启时
      document.addEventListener('mouseup', handleMouseUp); // 添加 mouseup 监听
      showToast('划词朗读翻译 Pro 已开启');
    } else {
      // 脚本关闭时
      document.removeEventListener('mouseup', handleMouseUp); // 移除 mouseup 监听
      removeTooltip(); // 移除当前显示的翻译卡片
      speechSynthesis.cancel(); // 停止所有正在进行的朗读
      document.removeEventListener('mousemove', strictMouseLeaveCheck); // 移除鼠标移出检测
      selectionBox = null; // 清空选区信息
      if (window.getSelection) {
        window.getSelection().removeAllRanges(); // 清空选中文本
      }
      showToast('划词朗读翻译 Pro 已关闭');
    }
  }

  // --- 键盘事件监听器，用于检测 Ctrl + Space ---
  document.addEventListener('keydown', (e) => {
    // 检查是否按下了 Ctrl 键和空格键 (e.code === 'Space' 兼容性更好)
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault(); // 阻止浏览器默认的 Ctrl+Space 行为 (例如某些系统的输入法切换)
      toggleScriptEnabled(); // 切换脚本状态
    }
  });

  // 脚本加载完成后，显示初始提示
  showToast('划词朗读翻译 Pro 已开启 (Ctrl + Space 切换)');

})();