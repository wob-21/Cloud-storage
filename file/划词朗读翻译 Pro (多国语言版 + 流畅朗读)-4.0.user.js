// ==UserScript==
// @name         划词朗读翻译 Pro（多国语言版 + 流畅朗读）
// @namespace    https://wobshare.us.kg
// @connect      wobys.dpdns.org
// @author       wob
// @version      4.0
// @description  ✅【多国语言版】集成上百种语言的检测规则。划词后自动识别并朗读。若电脑缺少语音包则提示。Ctrl+空格 切换开关。
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
    if (cachedVoices.length) voiceReady = true;
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

    const text = window.getSelection().toString().trim();
    if (!text || text.length > 300) {
        removeTooltip();
        document.removeEventListener('mousemove', strictMouseLeaveCheck);
        selectionBox = null;
        return;
    }

    const range = window.getSelection().getRangeAt(0);
    const rect = range.getBoundingClientRect();
    selectionBox = rect;

    const sourceLang = detectLanguage(text);
    const speechSuccess = speakViaBrowser(text, sourceLang);
    fetchTranslation(text, sourceLang, rect, speechSuccess);
    
    document.addEventListener('mousemove', strictMouseLeaveCheck);
  }

  document.addEventListener('mouseup', handleMouseUp);
  
  /**
   * 终极版语言检测函数 - 全面覆盖官方列表
   * @param {string} text - The text to detect.
   * @returns {string} - The language code.
   */
  function detectLanguage(text) {
    // 优先级 1: 拥有独立且完全不同文字系统的语言
    if (/[\uAC00-\uD7AF]/.test(text)) return 'ko'; // Korean
    if (/[\u3040-\u30FF]/.test(text)) return 'ja'; // Japanese
    if (/[\u4E00-\u9FA5]/.test(text)) return 'zh'; // Chinese
    if (/[\u0E00-\u0E7F]/.test(text)) return 'th'; // Thai
    if (/[\u0400-\u04FF]/.test(text)) return 'ru'; // Cyrillic (covers ru, uk, bg, be, sr, mk, kk, mn, ba...)
    if (/[\u0600-\u06FF]/.test(text)) return 'ar'; // Arabic (covers ar, fa, ps, ur, sd, yi...)
    if (/[\u0590-\u05FF]/.test(text)) return 'he'; // Hebrew
    if (/[\u0370-\u03FF]/.test(text)) return 'el'; // Greek
    if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Devanagari (covers hi, ne, mr)
    if (/[\u10A0-\u10FF]/.test(text)) return 'ka'; // Georgian
    if (/[\u0530-\u058F]/.test(text)) return 'hy'; // Armenian
    if (/[\u1780-\u17FF]/.test(text)) return 'km'; // Khmer
    if (/[\u0E80-\u0EFF]/.test(text)) return 'lo'; // Lao
    if (/[\u1000-\u109F]/.test(text)) return 'my'; // Burmese
    if (/[\u0980-\u09FF]/.test(text)) return 'bn'; // Bengali
    if (/[\u0A80-\u0AFF]/.test(text)) return 'gu'; // Gujarati
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
    if (/[\u0A00-\u0A7F]/.test(text)) return 'pa'; // Gurmukhi (Punjabi)
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kn'; // Kannada
    if (/[\u0D00-\u0D7F]/.test(text)) return 'ml'; // Malayalam
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te'; // Telugu (Not in list, but good practice)
    if (/[\u0D80-\u0DFF]/.test(text)) return 'si'; // Sinhala
    if (/[\u1200-\u137F]/.test(text)) return 'am'; // Amharic
    
    // 优先级 2: 使用拉丁字母，但有非常独特变音符号的语言
    if (/[àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳýỵỷỹ]/.test(text)) return 'vi'; // Vietnamese
    if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return 'tr'; // Turkish / Azerbaijani (az)
    if (/[ĄĆĘŁŃÓŚŹŻąęćłńóśźż]/.test(text)) return 'pl'; // Polish
    if (/[ďťľčňřšžĎŤĽČŇŘŠŽ]/.test(text)) return 'cs'; // Czech / Slovak (sk)
    if (/[đšžćčĐŠŽĆČ]/.test(text)) return 'hr'; // Croatian / Bosnian (bs)
    if (/[āēīūļķņģšžč]/.test(text)) return 'lv'; // Latvian
    if (/[ėįšųūž]/.test(text)) return 'lt'; // Lithuanian
    if (/[őűŐŰ]/.test(text)) return 'hu'; // Hungarian
    if (/[ăâîșț]/.test(text)) return 'ro'; // Romanian
    
    // 优先级 3: 较常见的欧洲变音符号
    if (/[äöüßÄÖÜẞ]/.test(text)) return 'de'; // German
    if (/[æøåÆØÅ]/.test(text)) return 'da'; // Danish / Norwegian (no)
    if (/[àâçéèêëîïôûùüÿñæœ]/.test(text)) return 'fr'; // French
    if (/[áéíóúñü]/.test(text)) return 'es'; // Spanish
    if (/[àéíòú]/.test(text)) return 'it'; // Italian

    // 优先级 4: 默认后备方案
    // 对于纯拉丁字母的语言(af, en, id, ms, sw, zu...)，无法准确区分
    // 返回 'en' 作为最安全、最通用的后备选项
    return 'en';
  }


  // --- 语音朗读函数 ---
  function speakViaBrowser(text, langCode) {
    if (!scriptEnabled || !voiceReady || !langCode) return false;
    
    const voice = cachedVoices.find(v => v.lang.startsWith(langCode));
    
    if (!voice) {
        console.warn(`No voice found for language: ${langCode}. Speaking skipped.`);
        return false;
    }
    
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.lang = voice.lang;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
    return true;
  }

  // --- 翻译请求函数 ---
  function fetchTranslation(text, sourceLang, rect, speechSuccess) {
    if (!scriptEnabled) return;
    
    const apiUrl = `https://wobys.dpdns.org/?text=${encodeURIComponent(text)}&source_language=${sourceLang}&target_language=zh&secret=123456`;
    
    GM_xmlhttpRequest({
      method: 'GET',
      url: apiUrl,
      onload: res => {
        try {
          if (res.status !== 200) {
              showTooltip(`🌐 API错误 (Code: ${res.status})\n源语言: ${sourceLang}`, rect);
              return;
          }
          const data = JSON.parse(res.responseText);
          const output = data.text || '无翻译结果';
          
          let title = `📘 ${sourceLang.toUpperCase()} → ZH`;
          if (!speechSuccess) {
              title += " (无语音)";
          }
          
          showTooltip(`${title}:\n${output}`, rect);
        } catch (err) {
          showTooltip('🌐 翻译解析失败', rect);
        }
      },
      onerror: () => {
        showTooltip('🌐 翻译请求失败', rect);
      }
    });
  }

  // --- 翻译卡片及UI管理 ---
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
      showToast('划词朗读翻译 Pro 已开启');
    } else {
      document.removeEventListener('mouseup', handleMouseUp);
      removeTooltip();
      speechSynthesis.cancel();
      document.removeEventListener('mousemove', strictMouseLeaveCheck);
      selectionBox = null;
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      showToast('划词朗读翻译 Pro 已关闭');
    }
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      toggleScriptEnabled();
    }
  });

  showToast('划词朗读翻译 Pro 已开启 (Ctrl + Space 切换)');

})();