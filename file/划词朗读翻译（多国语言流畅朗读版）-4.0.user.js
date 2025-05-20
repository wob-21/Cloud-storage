// ==UserScript==
// @name         划词朗读翻译（多国语言流畅朗读版）
// @namespace    https://wobshare.us.kg
// @connect      wobys.dpdns.org
// @version      4.0
// @description  使用我自己搭建的 translate API，实现划词后自动朗读且显示悬浮翻译卡片，鼠标一旦移出划词区域，立即关闭翻译卡片并清除划词高亮，更轻、更快、更稳定！支持句子、单词翻译，朗读多国语言，国内外皆可使用！
// @author       wob
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

  function preloadVoices() {
    cachedVoices = speechSynthesis.getVoices();
    if (cachedVoices.length) voiceReady = true;
  }

  speechSynthesis.onvoiceschanged = () => {
    cachedVoices = speechSynthesis.getVoices();
    if (cachedVoices.length) voiceReady = true;
  };

  preloadVoices();

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

  let selectionBox = null;

  document.addEventListener('mouseup', () => {
    const text = window.getSelection().toString().trim();
    if (!text || text.length > 200) return;

    const range = window.getSelection().getRangeAt(0);
    const rect = range.getBoundingClientRect();
    selectionBox = rect;

    speakViaBrowser(text);
    fetchTranslation(text, rect);
    document.addEventListener('mousemove', strictMouseLeaveCheck);
  });

  function speakViaBrowser(text) {
    if (!voiceReady) return;
    const voice = cachedVoices.find(v => v.lang === 'ko-KR') || cachedVoices[0];
    if (!voice) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.lang = voice.lang || 'ko-KR';
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }

  function fetchTranslation(text, rect) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://wobys.dpdns.org/?text=${encodeURIComponent(text)}&source_language=ko&target_language=zh&secret=123456`,
      onload: res => {
        try {
          const data = JSON.parse(res.responseText);
          const output = data.text || '无翻译结果';
          showTooltip(`📘 𝓌𝑜𝒷翻译：\n${output}`, rect);
        } catch (err) {
          showTooltip('🌐 翻译解析失败', rect);
        }
      },
      onerror: () => {
        showTooltip('🌐 翻译请求失败', rect);
      }
    });
  }

  function showTooltip(text, rect) {
    removeTooltip();
    const tip = document.createElement('div');
    tip.className = 'translate-tooltip';
    tip.innerText = text;
    document.body.appendChild(tip);

    tip.style.left = `${rect.left + window.scrollX}px`;
    tip.style.top = `${rect.bottom + window.scrollY + 10}px`;
  }

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
      removeTooltip();
      document.removeEventListener('mousemove', strictMouseLeaveCheck);
      selectionBox = null;
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
    }
  }

  function removeTooltip() {
    const el = document.querySelector('.translate-tooltip');
    if (el) el.remove();
  }
})();
