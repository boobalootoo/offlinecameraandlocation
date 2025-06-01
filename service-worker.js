// Define the cache name, incrementing it for new versions to ensure updates
const CACHE_NAME = 'camera-app-v4'; // Incremented cache version

// Define the path for your GitHub Pages repository
// This MUST match your repository name (e.g., /locationfetcher/)
const REPO_PATH = '/locationfetcher/';

// List of URLs to cache during installation
// These paths are now relative to the service worker's scope (e.g., /locationfetcher/)
const urlsToCache = [
    REPO_PATH, // Caches the root of your GitHub Pages project (index.html)
    REPO_PATH + 'index.html',
    REPO_PATH + 'manifest.json',
    REPO_PATH + 'tailwind.min.css' // Path to your locally hosted Tailwind CSS
];

// Install event: Fired when the service worker is installed
self.addEventListener('install', (event) => {
    // waitUntil ensures the service worker isn't activated until the caching is complete
    event.waitUntil(
        caches.open(CACHE_NAME) // Open the named cache
            .then((cache) => {
                console.log('Service Worker: Caching app shell');
                // Add all specified URLs to the cache
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate event: Fired when the service worker is activated
self.addEventListener('activate', (event) => {
    // waitUntil ensures activation is complete before handling fetches
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            // Iterate over all cache names
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // If a cache name is different from the current CACHE_NAME, delete it
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event: Fired for every network request made by the page
self.addEventListener('fetch', (event) => {
    // Respond with content from cache if available, otherwise fetch from network
    event.respondWith(
        caches.match(event.request) // Try to find the request in the cache
            .then((response) => {
                // If a cached response is found, return it
                if (response) {
                    console.log('Service Worker: Serving from cache', event.request.url);
                    return response;
                }
                // If not in cache, fetch from the network
                console.log('Service Worker: Fetching from network', event.request.url);
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // Clone the response because it's a stream and can only be consumed once
                        const responseToCache = networkResponse.clone();

                        // Open the cache and put the new network response in it
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch(() => {
                        // This catch handles network errors, meaning the user is offline
                        // or the resource is unavailable.
                        // For a camera app, it's important to still load the UI.
                        // We return a simple offline response if the main files aren't cached.
                        console.log('Service Worker: Network request failed for', event.request.url);
                        // If it's a navigation request and not in cache, return a fallback HTML
                        if (event.request.mode === 'navigate') {
                            return new Response('<h1>Offline</h1><p>You are offline and this page is not cached.</p>', {
                                headers: { 'Content-Type': 'text/html' }
                            });
                        }
                        // For other requests (like images that aren't cached), just return an empty response
                        return new Response('');
                    });
            })
    );
});
