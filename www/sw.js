const CACHE_NAME = 'resolver-v1.8'; // Updated version to force a refresh
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './js/lucide.js',
  './icon.png',
  './fonts/Inter-Regular.woff2',
  './fonts/Inter-SemiBold.woff2',
  './fonts/Orbitron-Bold.ttf',
  './fonts/Orbitron-Black.ttf',
  './fonts/Inter-ExtraBold.woff2'
];

// 1. Install: Force waiting service worker to become active immediately
self.addEventListener('install', (e) => {
  self.skipWaiting(); // <--- CRITICAL FIX: Forces new SW to take over right away
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use catch so a single missing file doesn't break the whole install
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.error("Cache add failed", err));
    })
  );
});

// 2. Activate: Clean up old caches and claim clients immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim()) // <--- CRITICAL FIX: Controls open pages without reload
  );
});

// 3. Fetch: Network First, Fallback to Cache
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // Exclude API calls or data URIs
  if (url.pathname.includes('/sdapi/') || url.protocol === 'data:') {
    return; 
  }

  e.respondWith(
    // Try Network first
    fetch(e.request)
      .then((response) => {
        // If valid network response, update the cache with this fresh version
        if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // If Network fails (offline), fall back to Cache
        return caches.match(e.request);
      })
  );
});