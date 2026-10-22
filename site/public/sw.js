/* App-shell cache only. The database chunks are never cached here: they are
   served by Range requests, which a cache would answer wrongly, and the
   browser's own HTTP cache already handles them. */
const CACHE = "yomidachi-shell-v1";
const BASE = new URL(self.registration.scope).pathname;

self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.add(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== "GET" || url.origin !== location.origin) return;
	if (url.pathname.startsWith(`${BASE}db/`)) return;

	if (event.request.mode === "navigate") {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					const copy = response.clone();
					caches.open(CACHE).then((cache) => cache.put(BASE, copy));
					return response;
				})
				.catch(() => caches.match(BASE)),
		);
		return;
	}

	// Hashed build assets and icons never change under the same URL.
	event.respondWith(
		caches.match(event.request).then(
			(cached) =>
				cached ??
				fetch(event.request).then((response) => {
					if (response.ok) {
						const copy = response.clone();
						caches.open(CACHE).then((cache) => cache.put(event.request, copy));
					}
					return response;
				}),
		),
	);
});
