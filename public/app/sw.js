self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const candidate = event.notification.data?.sessionId;
	const sessionId = typeof candidate === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : '';
	const target = new URL('/app/', self.location.origin);
	if (sessionId) target.hash = 'session=' + encodeURIComponent(sessionId);

	event.waitUntil((async () => {
		const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
		const existing = windows.find((client) => {
			const url = new URL(client.url);
			return url.origin === self.location.origin && url.pathname === '/app/';
		});
		if (existing) {
			if (sessionId) existing.postMessage({ type: 'cmdimpact:open-session', sessionId });
			await existing.focus();
			return;
		}
		await self.clients.openWindow(target.href);
	})());
});
