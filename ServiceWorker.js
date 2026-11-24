const cacheName = {{{ JSON.stringify(COMPANY_NAME + "-" + PRODUCT_NAME + "-" + PRODUCT_VERSION) }}};
const contentToCache = [
  "Build/{{{ LOADER_FILENAME }}}",
  "Build/{{{ FRAMEWORK_FILENAME }}}",
#if USE_THREADS
  "Build/{{{ WORKER_FILENAME }}}",
#endif
#if USE_WASM
  "Build/{{{ CODE_FILENAME }}}",
#endif
#if MEMORY_FILENAME
  "Build/{{{ MEMORY_FILENAME }}}",
#endif
#if SYMBOLS_FILENAME
  "Build/{{{ SYMBOLS_FILENAME }}}",
#endif
  "Build/{{{ DATA_FILENAME }}}",
  "TemplateData/favicon.ico",
  "TemplateData/icon200.png",
  "TemplateData/style.css",
  "TemplateData/unity-logo-dark.png"
];

// 安裝新版本時：預先下載並快取所有核心資源
self.addEventListener('install', function (e) {
  console.log('[Service Worker] Install version:', cacheName);
  self.skipWaiting(); // 強制新 SW 立即進入啟動流程
  e.waitUntil((async function () {
    const cache = await caches.open(cacheName);
    await cache.addAll(contentToCache);
  })());
});

// 啟用新版本時：刪除所有舊版本的快取空間
self.addEventListener('activate', function (e) {
  console.log('[Service Worker] Activate version:', cacheName);
  e.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(
      keys.map(function (key) {
        if (key !== cacheName) {
          console.log('[Service Worker] Deleting old cache:', key);
          return caches.delete(key);
        }
      })
    );
    await self.clients.claim();
  })());
});

// 攔截請求：優先直接回傳本地 Cache Storage，完全不重新下載
self.addEventListener('fetch', function (e) {
  // index.html 永遠走網路確認最新狀態，避免卡在舊版入口頁
  if (e.request.mode === 'navigate' || e.request.url.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request).catch(function () {
        return caches.match(e.request);
      })
    );
    return;
  }

  e.respondWith((async function () {
    // 忽略 ?v= 查詢參數比對快取，確保命中 contentToCache
    const cachedResponse = await caches.match(e.request, { ignoreSearch: true });
    if (cachedResponse) {
      return cachedResponse;
    }

    const response = await fetch(e.request);
    // 僅快取同源且成功的 GET 請求
    if (e.request.method === 'GET' && response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(e.request, response.clone());
    }
    return response;
  })());
});