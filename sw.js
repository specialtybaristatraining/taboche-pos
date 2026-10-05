const CACHE_NAME = 'taboche-site-v15';
const assetsToCache = [
  '/',
  '/styles.css',
  '/script.js',
  '/theme.js',
  '/manifest.webmanifest',
  '/offline.html',
  '/loyalty/loyalty.html',
  '/loyalty/loyalty.css',
  '/loyalty/loyalty.js',
  '/404.html',
  '/success.html',
  '/captions.vtt',
  '/images/logo.png',
  '/images/apple-touch-icon.png',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.all(assetsToCache.map(async asset => {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('Failed to cache asset during install:', asset, err);
        }
      }));
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

function fromNetwork(request, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject('timeout'), timeout);
    fetch(request).then(response => {
      clearTimeout(timer);
      if (!response) return reject('no-response');
      resolve(response);
    }, reject);
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    // Navigation request: try network first, fallback to cache, then offline page
    event.respondWith(
      fromNetwork(req, 6000).then(networkResponse => {
        if (!networkResponse.ok) return networkResponse;
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(req, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => caches.match(req).then(cacheResp => cacheResp || caches.match('/offline.html')))
    );
    return;
  }

  // For other requests: stale-while-revalidate for static assets, then network fallback.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(req).then(cacheResp => {
        const fetchPromise = fetch(req).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => null);

        if (cacheResp) {
          // Serve stale content while updating cache in the background.
          fetchPromise.catch(() => {});
          return cacheResp;
        }

        return fetchPromise.then(networkResponse => {
          if (networkResponse) return networkResponse;
          if (req.destination === 'image') return cache.match('/images/logo.png');
          return cache.match('/offline.html');
        });
      });
    })
  );
});

self.addEventListener('push', event => {
  let data = { title: 'Taboche Offer', body: 'Check our latest specialty drinks and seasonal deals.' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { /* use default notification */ }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'images/logo.png',
      badge: 'images/logo.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  const targetUrl = target.origin === self.location.origin ? target.href : self.location.origin + '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
