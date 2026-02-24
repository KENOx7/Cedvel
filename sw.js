// ============================================================
// SERVICE WORKER - 758/ITS
// Strategy:
//   - App shell (HTML, JS): Network-first, cache as fallback
//   - CDN assets (Tailwind, Icons): Cache-first, long-lived
//   - Firebase: NEVER cache, always live
//   - Offline fallback: serve cached HTML if network fails
// ============================================================

const CACHE_NAME = 'cedvel-its-v5';  // bump version to force fresh install

// App shell files - cached at install time
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './firestore_manager.js',
    './favicon.png',
];

// CDN assets that are safe to cache long-term
const CDN_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/@phosphor-icons/web',
];

// URLs that must NEVER be served from cache
const NEVER_CACHE_PATTERNS = [
    'firestore.googleapis.com',
    'firebase',
    'googleapis.com',
    'gstatic.com/firebasejs',
];

// ---- Install: pre-cache the app shell ----
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await Promise.allSettled(
                [...PRECACHE_ASSETS, ...CDN_ASSETS].map(url =>
                    cache.add(url).catch(err => console.warn(`[SW] Pre-cache failed: ${url}`, err))
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// ---- Activate: delete ALL old caches ----
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME).map(name => {
                    console.log(`[SW] Deleting old cache: ${name}`);
                    return caches.delete(name);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ---- Fetch: Smart routing ----
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    if (event.request.method !== 'GET') return;
    if (NEVER_CACHE_PATTERNS.some(p => url.includes(p))) return;
    if (!url.startsWith('http')) return;

    event.respondWith(handleFetch(event.request));
});

async function handleFetch(request) {
    const url = request.url;
    const cache = await caches.open(CACHE_NAME);

    // For CDN assets: cache-first
    const isCDN = CDN_ASSETS.some(cdn => url.startsWith(cdn) || url.includes('cdn.tailwindcss') || url.includes('unpkg.com'));
    if (isCDN) {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
            const response = await fetch(request);
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        } catch {
            return cached || new Response('CDN unavailable offline', { status: 503 });
        }
    }

    // For app shell: Network-first, fallback to cache
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch {
        const cached = await cache.match(request);
        if (cached) return cached;

        if (request.mode === 'navigate') {
            const indexFallback = await cache.match('./index.html') || await cache.match('/758ITS/main/index.html');
            if (indexFallback) return indexFallback;
        }

        return new Response('Offline - keşdə məlumat tapılmadı', {
            status: 503,
            statusText: 'Service Unavailable',
        });
    }
}