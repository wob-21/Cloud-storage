// ==UserScript==
// @name         划词翻译 + 自动朗读
// @namespace    https://wobshare.us.kg
// @author       wob
// @version      1.0
// @description  请先到【扩展管理】中打开【开发人员模式】才能正常使用！使用有道词典API接口翻译，仅保留划词翻译+朗读+鼠标移出划词范围则关闭悬浮翻译功能，轻量快速稳定！仅支持英译中、单词翻译，不支持句子翻译。国内外皆可使用！
// @match        *://*/*
// @exclude      *://www.google.com/search*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      dict.youdao.com
// @license     MIT
// ==/UserScript==

(function () {
  'use strict';

  // 语音朗读相关设置
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

  // 初始化时预加载语音
  preloadVoices();

  // 动态注入 CSS 样式
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
  `);

  // 用于存储选中文本的位置，显示翻译框
  let selectionBox = null;

  // 监听用户鼠标选择文本操作
  document.addEventListener('mouseup', () => {
    const text = window.getSelection().toString().trim();
    if (!text || text.length > 200) return;

    const range = window.getSelection().getRangeAt(0);
    const rect = range.getBoundingClientRect();
    selectionBox = rect;

    speakViaBrowser(text);
    fetchYoudao(text, rect);
    document.addEventListener('mousemove', strictMouseLeaveCheck);
  });

  // 通过浏览器的语音合成功能朗读文本
  function speakViaBrowser(text) {
    if (!voiceReady) return;
    const voice = cachedVoices.find(v => v.lang === 'en-US') || cachedVoices[0];
    if (!voice) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.lang = voice.lang || 'en-US';
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }

  // 向翻译API接口发送请求获取翻译结果
  function fetchYoudao(word, rect) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://dict.youdao.com/jsonapi?xmlVersion=5.1&jsonversion=2&q=${encodeURIComponent(word)}`,
      onload: res => {
        try {
          const data = JSON.parse(res.responseText);
          let output = '';

          const ec = data.ec;
          if (ec && ec.word && ec.word[0] && ec.word[0].trs) {
            const trs = ec.word[0].trs;
            output = trs.map(tr => `· ${tr.tr[0].l.i[0]}`).join('\n');
          }

          if (!output) output = '无翻译结果';
          showTooltip('📘 有道词典：\n' + output, rect);
        } catch (err) {
          showTooltip('📘 有道解析失败', rect);
        }
      },
      onerror: () => {
        showTooltip('📘 有道请求失败', rect);
      }
    });
  }

  // 显示翻译结果的工具提示框
  function showTooltip(text, rect) {
    removeTooltip();
    const tip = document.createElement('div');
    tip.className = 'translate-tooltip';
    tip.innerText = text;
    document.body.appendChild(tip);

    tip.style.left = `${rect.left + window.scrollX}px`;
    tip.style.top = `${rect.bottom + window.scrollY + 10}px`;
  }

  // 检查鼠标是否离开了选中的文本区域
  function strictMouseLeaveCheck(e) {
    if (!selectionBox) return;
    const { left, right, top, bottom } = selectionBox;
    const buffer = 5;
    const inArea =
      e.pageX >= left + window.scrollX - buffer &&
      e.pageX <= right + window.scrollX + buffer &&
      e.pageY >= top + window.scrollY - buffer &&
      e.pageY <= bottom + window.scrollY + buffer;

    // 如果鼠标移出选中的区域则移除翻译提示框
    if (!inArea) {
      removeTooltip();

      // 鼠标移出划词范围则清空选中文本，如不想清空选中文本，把这段注释掉就行（多行注释：Ctrl+K 或 Ctrl+Shft+K）
      document.removeEventListener('mousemove', strictMouseLeaveCheck);
      selectionBox = null;
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      } //不想清空选中文本则注释到这里

    }
  }

  // 移除翻译工具提示框
  function removeTooltip() {
    const el = document.querySelector('.translate-tooltip');
    if (el) el.remove();
  }
})();