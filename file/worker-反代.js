/**
 * NotionNext 全能加速 Worker (终极融合版)
 *
 * 新增功能:
 * - 为 /proxy/ 功能加入了强大的 HTML 内容重写引擎。
 * - 增加了域名白名单，目前仅允许代理 Notion 相关网站，防止滥用。
 */

const NOTION_API_HOST = 'https://www.notion.so';

const IMAGE_SITES = {
  'notion-img': 'https://img.notionusercontent.com',
  'notion-file': 'https://file.notion.so',
  'notion-static': 'https://secure.notion-static.com'
};

// ==========================================================
//  ↓↓↓  新增：代理白名单  ↓↓↓
// ==========================================================
const ALLOWED_PROXY_DOMAINS = [
  'notion.so',
  'notion.site',
  'img.notionusercontent.com',
  'file.notion.so',
  // 你未来可以在这里添加更多你想通过 /proxy/ 代理的域名
  // 例如：'wikipedia.org'
];
// ==========================================================
//  ↑↑↑  新增结束  ↑↑↑
// ==========================================================

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event));
});

async function handleRequest(request, event) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const prefix = pathname.split('/')[1];

  // 路由 1: 图片、文件专用路由 (这些路由不受白名单限制)
  if (IMAGE_SITES[prefix]) {
    const targetDomain = IMAGE_SITES[prefix];
    const targetPath = pathname.substring(prefix.length + 2);
    const targetUrl = targetDomain + '/' + targetPath + url.search + url.hash;
    return proxyAndCache(request, targetUrl, event, false); // false 表示不检查白名单
  }
  
  // 路由 2: 通用代理路由 (受白名单限制)
  if (prefix === 'proxy') {
    const subpath = pathname.substring('/proxy/'.length);
    if (!subpath || subpath === '/') {
      return new Response(getProxyLandingPage(url.origin), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    const targetUrl = subpath + url.search + url.hash;
    if (targetUrl.startsWith('http')) {
      // 传递 true，表示需要检查白名单
      return proxyAndCache(request, targetUrl, event, true); 
    }
    return new Response('❌ /proxy/ 后必须是完整的 http/https 网址', { status: 400 });
  }

  // 路由 3: Notion API 路由 (不受白名单限制)
  if (prefix === 'api') {
    const targetUrl = NOTION_API_HOST + pathname + url.search + url.hash;
    return proxyRequest(request, targetUrl);
  }

  // 路由 4: 根路径重定向
  if (pathname === '/' || pathname === '') {
     return Response.redirect("https://wobshare.us.kg/", 302);
  }

  // 兜底路由: 其他所有请求
  const defaultTargetUrl = NOTION_API_HOST + pathname + url.search + url.hash;
  return proxyRequest(request, defaultTargetUrl);
}

// ==========================================================
//  ↓↓↓  核心升级：proxyAndCache 函数  ↓↓↓
// ==========================================================
// 带缓存和 HTML 重写功能的代理函数
async function proxyAndCache(request, targetUrlString, event, checkWhitelist) {
    const cache = caches.default;
    const cacheKey = new Request(request.url, request);
    let response = await cache.match(cacheKey);

    if (!response) {
        // 植入白名单检查
        if (checkWhitelist) {
            const targetUrl = new URL(targetUrlString);
            const isAllowed = ALLOWED_PROXY_DOMAINS.some(domain =>
                targetUrl.hostname === domain || targetUrl.hostname.endsWith('.' + domain)
            );
            if (!isAllowed) {
                return new Response(`⛔️ 禁止代理此域名: ${targetUrl.hostname}。此代理仅限白名单网站使用。`, { status: 403 });
            }
        }

        const originalResponse = await proxyRequest(request, targetUrlString, true); // true 表示可能需要重写HTML
        if (request.method === 'GET' && originalResponse.ok) {
            const cacheableResponse = new Response(originalResponse.body, originalResponse);
            cacheableResponse.headers.set('Cache-Control', 'public, max-age=604800');
            event.waitUntil(cache.put(cacheKey, cacheableResponse.clone()));
            return cacheableResponse;
        }
        return originalResponse;
    }
    return response;
}
// ==========================================================
//  ↑↑↑  升级结束  ↑↑↑
// ==========================================================


// ==========================================================
//  ↓↓↓  核心升级：proxyRequest 函数  ↓↓↓
// ==========================================================
// 基础代理函数，增加了 HTML 重写能力
async function proxyRequest(request, targetUrlString, rewriteHtml = false) {
    try {
        const url = new URL(request.url);
        const targetUrl = new URL(targetUrlString);

        const modifiedRequest = new Request(targetUrl.toString(), {
            body: request.body,
            headers: request.headers,
            method: request.method,
            redirect: 'follow'
        });
        
        let response = await fetch(modifiedRequest);
        const contentType = response.headers.get('Content-Type') || '';

        // 如果需要，执行 HTML 重写
        if (rewriteHtml && contentType.includes('text/html')) {
            const text = await response.text();
            const base = targetUrl.origin;
            const proxyPrefix = url.origin + '/proxy/';

            const rewritten = text.replace(/(href|src)=["']((?!https?:)[^"']+)["']/g, (match, attr, path) => {
                let fullUrl;
                try {
                    if (path.startsWith('//')) {
                        fullUrl = targetUrl.protocol + path;
                    } else if (path.startsWith('/')) {
                        fullUrl = base + path;
                    } else {
                        fullUrl = new URL(path, targetUrl.toString()).toString();
                    }
                    return `${attr}="${proxyPrefix}${fullUrl}"`;
                } catch (e) {
                    return match; // 如果路径解析失败，返回原始匹配
                }
            });
            response = new Response(rewritten, response);
        }

        const modifiedResponse = new Response(response.body, response);
        modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
        modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        modifiedResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        modifiedResponse.headers.delete('Content-Security-Policy');
        modifiedResponse.headers.delete('X-Content-Security-Policy');
        return modifiedResponse;
    } catch (e) {
        return new Response(`❌ 代理请求失败: ${e.message}`, { status: 502 });
    }
}
// ==========================================================
//  ↑↑↑  升级结束  ↑↑↑
// ==========================================================


// [门户页面] - 此函数无需修改
function getProxyLandingPage(origin) {
  const wobshareUrl = "https://wobshare.us.kg/";

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>代理服务门户</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-color: #0072ff; /* 鲜艳的蓝色 */
            --secondary-color: #00e472; /* 活力的绿色 */
            
            --light-bg: #f0f4f8;
            --light-card-bg: #ffffff;
            --light-text: #2c3e50;
            --light-subtle-text: #7f8c8d;
            --light-card-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
            --light-card-border: #e8e8e8;

            --dark-bg: #1a1a2e;
            --dark-card-bg: #16213e;
            --dark-text: #e0e0e0;
            --dark-subtle-text: #a7a9be;
            --dark-card-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            --dark-card-border: #0f3460;
        }
        body {
            --bg: var(--light-bg);
            --card-bg: var(--light-card-bg);
            --text: var(--light-text);
            --subtle-text: var(--light-subtle-text);
            --card-shadow: var(--light-card-shadow);
            --card-border: var(--light-card-border);
            
            font-family: 'Noto Sans SC', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background-color: var(--bg);
            color: var(--text);
            padding: 20px;
            box-sizing: border-box;
            transition: background-color 0.3s ease, color 0.3s ease;
        }
        body.dark-mode {
            --bg: var(--dark-bg);
            --card-bg: var(--dark-card-bg);
            --text: var(--dark-text);
            --subtle-text: var(--dark-subtle-text);
            --card-shadow: var(--dark-card-shadow);
            --card-border: var(--dark-card-border);
        }
        @keyframes pulse-glow {
            0% { box-shadow: 0 0 8px rgba(0, 114, 255, 0.5); }
            50% { box-shadow: 0 0 30px rgba(0, 228, 114, 0.8); }
            100% { box-shadow: 0 0 8px rgba(0, 114, 255, 0.5); }
        }
        #theme-toggle {
            position: absolute;
            top: 25px;
            right: 25px;
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--subtle-text);
            transition: color 0.3s, background-color 0.3s;
        }
        #theme-toggle:hover {
            background-color: rgba(127, 140, 140, 0.1);
        }
        #theme-toggle svg {
            width: 24px;
            height: 24px;
        }
        .main-container {
            display: flex;
            flex-direction: column;
            gap: 30px;
            width: 100%;
            max-width: 700px;
        }
        .card {
            background-color: var(--card-bg);
            padding: 30px 40px;
            border-radius: 16px;
            box-shadow: var(--card-shadow);
            text-align: center;
            border: 1px solid var(--card-border);
            transition: all 0.3s ease;
        }
        .card:hover {
            transform: translateY(-5px);
        }
        h1, h2 { margin: 0 0 15px 0; font-weight: 700; }
        h1 {
          font-size: 2.5rem;
          background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        h2 { color: var(--text); font-size: 1.5rem; }
        p { color: var(--subtle-text); margin: 0 0 25px 0; line-height: 1.7; }
        .special-button {
            display: inline-block;
            padding: 18px 40px;
            border-radius: 50px;
            background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
            color: white;
            text-decoration: none;
            font-size: 1.2rem;
            font-weight: 700;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            animation: pulse-glow 4s infinite ease-in-out;
        }
        .special-button:hover { transform: scale(1.05); box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3); }
        .input-group {
            display: flex;
            border-radius: 8px;
            overflow: hidden;
            margin-top: 10px;
            border: 1px solid transparent;
            transition: border-color 0.3s;
        }
        .input-group:focus-within {
             border-color: var(--primary-color);
        }
        #url-input {
            flex-grow: 1;
            border: 1px solid var(--card-border);
            border-right: none;
            padding: 15px;
            font-size: 16px;
            outline: none;
            background-color: var(--bg);
            color: var(--text);
            border-radius: 8px 0 0 8px;
            transition: background-color 0.3s;
        }
        #proxy-button {
            border: none;
            background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
            color: white;
            padding: 0 25px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            border-radius: 0 8px 8px 0;
            transition: filter 0.3s ease;
        }
        #proxy-button:hover {
            filter: brightness(1.2);
        }
    </style>
</head>
<body>
    <button id="theme-toggle" aria-label="切换主题"></button>

    <div class="main-container">
        <div class="card">
            <h1>⭐ 核心服务</h1>
            <p>点击下方按钮，直接访问 Wobshare 的精彩世界。</p>
            <a href="${wobshareUrl}" class="special-button">🚀 进入 Wobshare</a>
        </div>
        <div class="card">
            <h2>🛠️ 通用代理工具</h2>
            <p>需要访问其他网站？在此处输入完整 URL 即可。</p>
            <div class="input-group">
                <input type="text" id="url-input" placeholder="https://www.notion.so/" onkeydown="handleEnter(event)">
                <button id="proxy-button" onclick="proxyUrl()">代理访问</button>
            </div>
        </div>
    </div>
    <script>
        const themeToggle = document.getElementById('theme-toggle');
        const body = document.body;
        
        const sunIcon = \`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>\`;
        const moonIcon = \`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>\`;

        function setTheme(theme) {
            if (theme === 'dark') {
                body.classList.add('dark-mode');
                themeToggle.innerHTML = sunIcon;
                localStorage.setItem('theme', 'dark');
            } else {
                body.classList.remove('dark-mode');
                themeToggle.innerHTML = moonIcon;
                localStorage.setItem('theme', 'light');
            }
        }

        themeToggle.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('theme') === 'dark' ? 'light' : 'dark';
            setTheme(currentTheme);
        });
        
        // 页面加载时，应用已保存的主题
        const savedTheme = localStorage.getItem('theme') || 'light';
        setTheme(savedTheme);

        // 通用代理的 JS
        const urlInput = document.getElementById('url-input');
        function proxyUrl() {
            let targetUrl = urlInput.value.trim();
            if (!targetUrl) { return; }
            if (!targetUrl.startsWith('http')) { targetUrl = 'https://' + targetUrl; }
            window.location.href = \`\${window.location.origin}/proxy/\${targetUrl}\`;
        }
        function handleEnter(event) {
            if (event.key === 'Enter') { proxyUrl(); }
        }
    </script>
</body>
</html>
`;
}