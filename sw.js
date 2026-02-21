const CACHE_NAME = 'cedvel-v2';
const LOCAL_ASSETS = [
    './cedvel.html',
    './herkes.html',
    './firestore_manager.js',
    './site.webmanifest',
    './favicon.png'
];

self.addEventListener('install', (event) => {
    // Tətbiq yükləndikdə əsas faylları yaddaşa (cache) atırıq
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(LOCAL_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    // Köhnə cache-ləri silirik
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Yalnız GET sorğularını yaddaşa alırıq
    if (event.request.method !== 'GET') return;

    // Firebase sorğularını yaddaşda (cache) saxlamırıq
    if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebase')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Əgər cache-də varsa, onu qaytar
            if (cachedResponse) {
                // Arxa planda yeniləmək olar, ancaq hələki birbaşa qaytarırıq.
                return cachedResponse;
            }

            // Cache-də yoxdursa, şəbəkədən yüklə və cache-ə əlavə et (məs: Tailwind, Fontlar)
            return fetch(event.request).then((networkResponse) => {
                // Etibarlı cavab deyilsə, onu qaytar (cache-ləmə)
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                    return networkResponse;
                }

                // Cavabı klonlayıb cache-ə yazırıq
                const clonedResponse = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clonedResponse);
                });

                return networkResponse;
            }).catch(() => {
                // Şəbəkə yoxdursa və cache-də də yoxdursa - fərdi səhifə qaytarmaq olar
                // Hələ ki heç nə etmirik
            });
        })
    );
});
