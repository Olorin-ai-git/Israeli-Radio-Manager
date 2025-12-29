// Service Worker for Push Notifications - Israeli Radio Manager

// Handle push events
self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('Push event but no data')
    return
  }

  let data
  try {
    data = event.data.json()
  } catch (e) {
    data = { title: 'Notification', body: event.data.text() }
  }

  const options = {
    body: data.body || data.message,
    icon: data.icon || '/Logo.png',
    badge: '/Logo.png',
    data: data.data || {},
    requireInteraction: true,
    tag: data.tag || 'radio-notification',
    actions: [
      { action: 'view', title: 'View Dashboard' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    vibrate: [200, 100, 200]
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Israeli Radio Manager', options)
  )
})

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  // Open or focus the dashboard
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i]
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus()
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow('/')
        }
      })
  )
})

// Handle notification close
self.addEventListener('notificationclose', function(event) {
  console.log('Notification closed:', event.notification.tag)
})

// Service worker installation
self.addEventListener('install', function(event) {
  console.log('Service Worker installed')
  self.skipWaiting()
})

// Service worker activation
self.addEventListener('activate', function(event) {
  console.log('Service Worker activated')
  event.waitUntil(clients.claim())
})
