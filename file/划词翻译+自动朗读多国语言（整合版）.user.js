// ==UserScript==
// @name         划词翻译+自动朗读多国语言（整合版）
// @namespace    https://wobshare.us.kg
// @connect      wobys.dpdns.org
// @connect      dict.youdao.com
// @author       𝓌𝑜𝒷
// @version      5.0
// @description  ♻【全语言支持】根据wobs-translate官网语言列表，最大化集成上百种语言检测。智能分流：纯英文单词走有道词典，其他所有语言和句子走wobs-translate。✨实现划词后自动检测语言并朗读原文，显示翻译卡片。按 "Ctrl+空格" 【关闭/开启】脚本。
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
  let scriptEnabled = true;

  // --- 语音预加载 ---
  function preloadVoices() {
    cachedVoices = speechSynthesis.getVoices();
    if (cachedVoices.length) {
      voiceReady = true;
    }
  }
  speechSynthesis.onvoiceschanged = preloadVoices;
  preloadVoices();

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
        pointer-events: none;
    }
    .userscript-toast.show {
        opacity: 1;
    }
  `);

  let selectionBox = null;

  // --- 主鼠标抬起事件处理函数 ---
  function handleMouseUp() {
    if (!scriptEnabled) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (!text || text.length > 500) { // 稍微放宽长度
      removeTooltip();
      document.removeEventListener('mousemove', strictMouseLeaveCheck);
      selectionBox = null;
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    selectionBox = rect;

    const isLikelyEnglishWord = /^[a-zA-Z'-]+$/.test(text) && text.length <= 30;
    const sourceLang = detectLanguage(text);
    
    speakViaBrowser(text, sourceLang);

    if (isLikelyEnglishWord) {
      fetchYoudaoTranslation(text, rect);
    } else {
      fetchWobTranslation(text, sourceLang, rect);
    }

    document.removeEventListener('mousemove', strictMouseLeaveCheck);
    document.addEventListener('mousemove', strictMouseLeaveCheck);
  }

  document.addEventListener('mouseup', handleMouseUp);

  /**
   * 增强版语言检测函数，根据API支持的语言列表扩展
   * @param {string} text - 需要检测的文本
   * @returns {string} - 语言代码
   */
  function detectLanguage(text) {
    // 按字符集独特性排序检测
    if (/[가-힣]/.test(text)) return 'ko'; // 韩语
    if (/[\u3040-\u30ff]/.test(text)) return 'ja'; // 日语 (平假名/片假名)
    if (/[\u4e00-\u9fa5]/.test(text)) return 'zh'; // 中文
    if (/[а-яА-Я]/.test(text)) return 'ru'; // 俄语 (覆盖西里尔字母系)
    if (/[\u0600-\u06FF]/.test(text)) return 'ar'; // 阿拉伯语
    if (/[\u0E00-\u0E7F]/.test(text)) return 'th'; // 泰语
    if (/[\u0370-\u03FF]/.test(text)) return 'el'; // 希腊语
    if (/[\u0590-\u05FF]/.test(text)) return 'he'; // 希伯来语
    if (/[\u0900-\u097F]/.test(text)) return 'hi'; // 印地语 (天城文)
    if (/[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳýỵỷỹ]/.test(text)) return 'vi'; // 越南语
    if (/[\u10A0-\u10FF]/.test(text)) return 'ka'; // 格鲁吉亚语
    if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return 'tr'; // 土耳其语
    if (/[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]/.test(text)) return 'lt'; // 立陶宛语
    if (/[āčēģīķļņōŗšūž]/.test(text)) return 'lv'; // 拉脱维亚语
    if (/[ąćęłńóśźż]/.test(text)) return 'pl'; // 波兰语
    if (/[ăâîșț]/.test(text)) return 'ro'; // 罗马尼亚语
    if (/[äöüß]/.test(text)) return 'de'; // 德语
    if (/[àâçéèêëîïôûùüÿñæœ]/.test(text)) return 'fr'; // 法语
    // 默认返回英语，适用于大多数拉丁字母语言
    return 'en';
  }

  // --- 智能语音朗读函数 ---
  function speakViaBrowser(text, langCode) {
    if (!scriptEnabled || !voiceReady || !langCode) return;

    const voice = cachedVoices.find(v => v.lang.startsWith(langCode));
    
    if (!voice) {
      console.warn(`No voice found for language: ${langCode}. Speaking skipped.`);
      return;
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.lang = voice.lang;
    utter.rate = 1.0;
    utter.pitch = 1.0;

    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }

  // --- wob 翻译请求函数 ---
  function fetchWobTranslation(text, sourceLang, rect) {
    if (!scriptEnabled) return;
    
    const apiUrl = `https://wobys.dpdns.org/?text=${encodeURIComponent(text)}&source_language=${sourceLang}&target_language=zh&secret=123456`;
    
    GM_xmlhttpRequest({
      method: 'GET',
      url: apiUrl,
      onload: res => {
        try {
          if (res.status !== 200) {
            showTooltip(`🌐 wobs-API 错误 (Code: ${res.status})\nAPI可能不支持语言: ${sourceLang}`, rect);
            return;
          }
          const data = JSON.parse(res.responseText);
          const translatedText = data.text ? data.text.trim() : '无翻译结果';
          showTooltip(`🌐 ${sourceLang.toUpperCase()} → ZH:\n${translatedText}`, rect);
        } catch (err) {
          showTooltip('🌐 翻译解析失败', rect);
        }
      },
      onerror: (err) => {
        showTooltip('🌐 翻译请求失败', rect);
      }
    });
  }

  // --- 有道词典翻译请求函数 ---
  function fetchYoudaoTranslation(word, rect) {
    if (!scriptEnabled) return;
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://dict.youdao.com/jsonapi?xmlVersion=5.1&jsonversion=2&q=${encodeURIComponent(word)}`,
      onload: res => {
        try {
          if (res.status !== 200) {
            showTooltip(`📘 有道API错误 (Code: ${res.status})`, rect);
            return;
          }
          const data = JSON.parse(res.responseText);
          let output = '无释义';

          if (data.ec && data.ec.word && data.ec.word[0].trs) {
            output = data.ec.word[0].trs.map(tr => `· ${tr.tr[0].l.i[0]}`).join('\n');
          } else if (data.fanyi && data.fanyi.tran) {
            output = data.fanyi.tran;
          }
          showTooltip('📘 有道词典 (EN → ZH):\n' + output, rect);
        } catch (err) {
          showTooltip('📘 有道解析失败', rect);
        }
      },
      onerror: (err) => {
        showTooltip('📘 有道请求失败', rect);
      }
    });
  }

  // --- UI & 工具函数 ---
  function showTooltip(text, rect) {
    if (!scriptEnabled) return;
    removeTooltip();
    const tip = document.createElement('div');
    tip.className = 'translate-tooltip';
    tip.innerText = text;
    document.body.appendChild(tip);
    
    setTimeout(() => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let tooltipLeft = rect.left + window.scrollX;
        let tooltipTop = rect.bottom + window.scrollY + 10;
        const tipWidth = tip.offsetWidth;
        const tipHeight = tip.offsetHeight;

        if (tooltipLeft + tipWidth > viewportWidth + window.scrollX - 20) {
          tooltipLeft = viewportWidth + window.scrollX - tipWidth - 20;
        }
        if (tooltipLeft < window.scrollX + 10) {
          tooltipLeft = window.scrollX + 10;
        }
        if (tooltipTop + tipHeight > viewportHeight + window.scrollY - 20) {
          tooltipTop = rect.top + window.scrollY - tipHeight - 10;
        }
        if (tooltipTop < window.scrollY + 10) {
          tooltipTop = window.scrollY + 10;
        }
        
        tip.style.left = `${tooltipLeft}px`;
        tip.style.top = `${tooltipTop}px`;
    }, 0);
  }

  function removeTooltip() {
    const el = document.querySelector('.translate-tooltip');
    if (el) el.remove();
  }

  function strictMouseLeaveCheck(e) {
    if (!selectionBox) return;
    const { left, right, top, bottom } = selectionBox;
    const buffer = 5;
    const inArea =
      e.clientX >= left - buffer &&
      e.clientX <= right + buffer &&
      e.clientY >= top - buffer &&
      e.clientY <= bottom + buffer;

    if (!inArea) {
      removeTooltip();
      document.removeEventListener('mousemove', strictMouseLeaveCheck);
      selectionBox = null;
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
    }
  }
  
  function showToast(message) {
    let toast = document.querySelector('.userscript-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'userscript-toast';
      document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.add('show');
    if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
    toast.hideTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  function toggleScriptEnabled() {
    scriptEnabled = !scriptEnabled;

    if (scriptEnabled) {
      document.addEventListener('mouseup', handleMouseUp);
      showToast('划词朗读翻译已开启');
    } else {
      document.removeEventListener('mouseup', handleMouseUp);
      removeTooltip();
      speechSynthesis.cancel();
      document.removeEventListener('mousemove', strictMouseLeaveCheck);
      selectionBox = null;
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      showToast('划词朗读翻译已关闭');
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      toggleScriptEnabled();
    }
  });

  showToast('划词朗读翻译已开启 (Ctrl+Space 切换)');

})();