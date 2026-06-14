const CACHE_NAME = 'wakwak-v7';
const ASSETS = ['/', '/index.html', '/manifest.json'];

const DEFAULT_API = 'http://localhost:3001';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(e.request.url);
  const isNavigation = e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';

  if (isNavigation) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then((response) => {
          if (response?.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', response.clone()));
          }
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(e.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.js')) {
            return Response.error();
          }
          return caches.match('/index.html');
        });
    }),
  );
});

self.addEventListener('message', (e) => {
  const data = e.data || {};
  if (data.type !== 'INCOMING_CALL') return;

  const code = data.code || '';
  const acceptUrl = data.acceptUrl || (code ? `/call/c1?code=${encodeURIComponent(code)}` : '/');
  const role = data.role === 'hearing' ? 'entendant' : 'deaf';

  e.waitUntil(
    self.registration.showNotification(data.title || '📞 Appel entrant — WakWak', {
      body: data.body || `${data.callerName || 'Quelqu\'un'} vous appelle`,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      vibrate: [400, 200, 400, 200, 400, 200, 400],
      tag: `wakwak-call-${code}`,
      renotify: false,
      requireInteraction: true,
      silent: false,
      data: { codeSession: code, acceptUrl, type: 'incoming_call', role },
      actions: code
        ? [{ action: 'join', title: '✅ Rejoindre' }, { action: 'reject', title: '❌ Refuser' }]
        : [],
    }),
  );
});

self.addEventListener('push', (e) => {
  if (!e.data) return;

  let data = {};
  try {
    data = e.data.json();
  } catch {
    data = { body: e.data.text() };
  }

  if (data.type === 'incoming_call') {
    const options = {
      body: `${data.callerName || data.callerPhone} vous appelle`,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      vibrate: [400, 200, 400, 200, 400, 200, 400],
      tag: 'incoming-call',
      renotify: true,
      requireInteraction: true,
      data: {
        code: data.code,
        callerPhone: data.callerPhone,
        targetPhone: data.targetPhone,
        url: data.url || `/?action=accept_call&from=${encodeURIComponent(data.callerPhone || '')}`,
        apiBase: data.apiBase || '/api',
      },
      actions: [
        { action: 'accept', title: '✅ Accepter' },
        { action: 'reject', title: '❌ Refuser' },
      ],
    };

    e.waitUntil(
      self.registration.showNotification('📞 Appel entrant — WakWak', options),
    );
    return;
  }

  const code = data.codeSession || data.code || '';
  e.waitUntil(
    self.registration.showNotification(data.title || '📞 Appel entrant', {
      body: data.body || (code ? `Code : ${code}` : 'Nouvel appel WakWak'),
      data: { codeSession: code, type: data.type || 'incoming_call' },
      actions: code ? [{ action: 'join', title: 'Rejoindre' }] : [],
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};

  if (e.action === 'accept') {
    const url = data.url || `/?action=accept_call&from=${encodeURIComponent(data.callerPhone || '')}`;
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length > 0) {
          clientList[0].focus();
          if ('navigate' in clientList[0]) {
            return clientList[0].navigate(url);
          }
          return undefined;
        }
        return self.clients.openWindow(url);
      }),
    );
    return;
  }

  if (e.action === 'reject') {
    const apiBase = data.apiBase || '/api';
    e.waitUntil(
      fetch(`${apiBase}/calls/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerPhone: data.callerPhone,
          targetPhone: data.targetPhone,
          code: data.code,
        }),
      }),
    );
    return;
  }

  const code = data.codeSession || data.code || '';
  const acceptUrl = data.acceptUrl || '';
  const url = acceptUrl || (code
    ? (data.role === 'entendant'
      ? `/entendant/call/amina?code=${encodeURIComponent(code)}`
      : `/call/c1?code=${encodeURIComponent(code)}`)
    : data.url || '/');

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        if ('navigate' in existing) existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
