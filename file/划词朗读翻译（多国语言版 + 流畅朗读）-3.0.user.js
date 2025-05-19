// ==UserScript==
// @name        划词朗读翻译（多国语言版 + 流畅朗读）
// @namespace    https://wobshare.us.kg
// @version     3.0
// @description [只支持在国外使用，因为使用的是Google的API，国内无法响应] | 划词后朗读韩语并在鼠标停留区域时显示翻译卡片（翻译为中文），鼠标离开划词范围立即关闭悬浮翻译并清除划词缓存，单词、句子都能翻译。划词翻译的句子不要太长，太长的话可能无法翻译！
// @author      wob (modified by You)
// @match       *://*/*
// @exclude     *://www.google.com/search*
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @connect     dict.iciba.com
// @connect     translate.googleapis.com
// ==/UserScript==

(function () {
  'use strict';

  // ✅ 提前预加载语音，解决后续朗读卡顿问题
  let voiceReady = false;
  let cachedVoices = [];
  function preloadVoices() {
    cachedVoices = speechSynthesis.getVoices();
    if (cachedVoices.length) voiceReady = true;
  }
  speechSynthesis.onvoiceschanged = () => {
    cachedVoices = speechSynthesis.getVoices();
    if (cachedVoices.length) voiceReady = true;
  };
  preloadVoices();

  // ✅ 样式注入
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
    }
    #translate-tooltip-0 { z-index: 9999; }
    #translate-tooltip-1 { z-index: 9998; }
  `);

  let selectionBox = null;

  document.addEventListener('mouseup', () => {
    const text = window.getSelection().toString().trim();
    if (!text || text.length > 200) return;

    const range = window.getSelection().getRangeAt(0);
    const rect = range.getBoundingClientRect();
    selectionBox = rect;

    speakViaBrowser(text); //朗读划词内容
    fetchIciba(text, rect, () => fetchGoogleWithTimeout(text, rect)); //翻译划词内容（中文）

    document.addEventListener('mousemove', strictMouseLeaveCheck);
  });

  // ✅ 浏览器语音朗读
  function speakViaBrowser(text) {
    if (!voiceReady) return;
    const voice = cachedVoices.find(v => v.lang === 'ko-KR') || cachedVoices.find(v => v.lang.startsWith('ko')) || cachedVoices[0];
    if (!voice) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.lang = voice?.lang || 'ko-KR';
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }

  // ✅ iciba 翻译
  function fetchIciba(word, rect, callback) {
    if (!/^[a-zA-Z\s]+$/.test(word)) {
      callback?.();
      return;
    }
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://dict.iciba.com/dictionary/word/suggestion?word=${encodeURIComponent(word)}&nums=1`,
      onload: res => {
        try {
          const data = JSON.parse(res.responseText);
          const defs = data.message?.[0]?.paraphrase || '无翻译结果';
          showTooltip('📘 iciba词典：\n' + defs, rect, 0, callback);
        } catch {
          showTooltip('📘 iciba解析失败', rect, 0, callback);
        }
      },
      onerror: () => showTooltip('📘 iciba请求失败', rect, 0, callback)
    });
  }

  // ✅ Google 翻译
  function fetchGoogleWithTimeout(word, rect) {
    let responded = false;

    const timeout = setTimeout(() => {
      if (!responded) {
        responded = true;
        showTooltip('🌍 Google请求超时', rect, 1);
      }
    }, 5000);

    GM_xmlhttpRequest({
      method: 'GET',
      // sl=auto (自动检测源语言), tl=zh-CN (翻译成简体中文)
      url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`,
      onload: res => {
        if (responded) return;
        responded = true;
        clearTimeout(timeout);
        try {
          const result = JSON.parse(res.responseText);
          const translated = result[0][0][0];
          showTooltip('🌍 Google翻译：\n' + translated, rect, 1);
        } catch {
          showTooltip('🌍 Google解析失败', rect, 1);
        }
      },
      onerror: () => {
        if (!responded) {
          responded = true;
          clearTimeout(timeout);
          showTooltip('🌍 Google请求失败', rect, 1);
        }
      }
    });
  }

  // ✅ 显示卡片，支持上下动态定位
  function showTooltip(text, rect, index, callback = null) {
    const id = `translate-tooltip-${index}`;
    removeTooltip(id);

    const tip = document.createElement('div');
    tip.className = 'translate-tooltip';
    tip.id = id;
    tip.innerText = text;
    document.body.appendChild(tip);

    // 初始定位
    tip.style.left = `${rect.left + window.scrollX}px`;
    tip.style.top = `${rect.bottom + window.scrollY + 10}px`;

    // 动态定位第二个卡片
    setTimeout(() => {
      if (index === 0) {
        tip.dataset.height = tip.offsetHeight;
        callback?.();
      }
      if (index === 1) {
        const prev = document.getElementById('translate-tooltip-0');
        const prevHeight = prev ? prev.offsetHeight : 0;
        const offset = rect.bottom + window.scrollY + 10 + prevHeight + 10;
        tip.style.top = `${offset}px`;
      }
    }, 10);
  }

  // ✅ 鼠标一旦离开划词区域 → 移除卡片并清除划词缓存
  function strictMouseLeaveCheck(e) {
    if (!selectionBox) return;
    const { left, right, top, bottom } = selectionBox;
    const buffer = 5;
    const inArea =
      e.pageX >= left + window.scrollX - buffer &&
      e.pageX <= right + window.scrollX + buffer &&
      e.pageY >= top + window.scrollY - buffer &&
      e.pageY <= bottom + window.scrollY + buffer;

    if (!inArea) {
      removeTooltip('translate-tooltip-0');
      removeTooltip('translate-tooltip-1');
      document.removeEventListener('mousemove', strictMouseLeaveCheck);

      // ✅ 清除划词缓存
      selectionBox = null;
      if (window.getSelection) {
        window.getSelection().removeAllRanges(); // 取消选中高亮
      }
    }
  }

  function removeTooltip(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

})();