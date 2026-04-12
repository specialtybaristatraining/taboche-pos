const CACHE_NAME = 'taboche-pos-v2'; // Incremented version
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/logo.png',
  '/images/logo-print.png',
  '/images/qr.jpeg',
  // Add CSS and JS if they become external files
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching essential files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );
});

// Fetch event - network first with cache fallback for dynamic content
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Skip cross-origin requests
  if (requestUrl.origin !== location.origin) {
    return;
  }

  // For HTML pages - network first, then cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh copy
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, serve cached version
          return caches.match(event.request);
        })
    );
    return;
  }

  // For images and static assets - cache first, then network
  if (event.request.destination === 'image' ||
      event.request.url.includes('/images/')) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache, fetch from network
          return fetch(event.request).then(response => {
            // Cache the new image
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return response;
          });
        })
        .catch(() => {
          // Return a fallback image if available
          return caches.match('/images/placeholder.jpg');
        })
    );
    return;
  }

  // For everything else - cache first, then network (stale-while-revalidate)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // Update cache with fresh response
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
            return networkResponse;
          })
          .catch(error => {
            console.log('[SW] Fetch failed:', error);
            // Return cached response even if stale
            return cachedResponse;
          });

        // Return cached response immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      })
  );
});

// Background sync for offline orders
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  const cache = await caches.open('pending-orders');
  const requests = await cache.keys();

  for (const request of requests) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.delete(request);
        console.log('[SW] Synced order successfully');
      }
    } catch (error) {
      console.log('[SW] Failed to sync order:', error);
    }
  }
}

// Push notification support
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: '/images/logo-192.png',
    badge: '/images/logo-96.png',
    vibrate: [200, 100, 200],
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification('Taboche POS', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});