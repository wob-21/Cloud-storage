// ==UserScript==
// @name         划词翻译朗读
// @namespace    https://wobshare.us.kg
// @version      1.0
// @description  推荐国内使用！使用有道词典API接口翻译，仅保留划词翻译+朗读+鼠标移出关闭功能，轻量快速稳定！仅支持单词翻译，不支持句子翻译。
// @author       wob
// @match        *://*/*
// @exclude      *://www.google.com/search*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      dict.youdao.com
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
    fetchYoudao(text, rect);
    document.addEventListener('mousemove', strictMouseLeaveCheck);
  });

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
