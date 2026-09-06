function isLoopback(hostname: string): boolean {
	const host = hostname.toLowerCase();
	const octets = host.split('.');
	const ipv4Loopback = octets.length === 4 && octets[0] === '127' && octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
	return host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || host === '::1' || ipv4Loopback;
}

export function normalizeRunnerOrigin(value: string): string {
	const input = value.trim();
	if (!/^[a-z][a-z\d+.-]*:\/\//i.test(input)) throw new Error('Enter a complete runner origin, such as https://runner.example.com.');
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		throw new Error('Enter a complete runner origin, such as https://runner.example.com.');
	}

	if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Runner URLs must use HTTPS. HTTP is allowed only on this device.');
	if (url.username || url.password) throw new Error('Runner URLs cannot include a username or password.');
	const suffix = input.slice(input.indexOf('://') + 3).match(/[/?#\\].*$/)?.[0];
	if (suffix && suffix !== '/') throw new Error('Enter only the runner origin, without a path, query, or fragment.');
	if (url.pathname !== '/' || url.search || url.hash) throw new Error('Enter only the runner origin, without a path, query, or fragment.');
	if (url.protocol === 'http:' && !isLoopback(url.hostname)) throw new Error('Remote runners must use HTTPS. HTTP is allowed only for loopback addresses.');
	return url.origin;
}

export function defaultRunnerOrigin(savedOrigin: string | null, dashboardOrigin: string): string {
	if (savedOrigin) {
		try { return normalizeRunnerOrigin(savedOrigin); } catch { /* Fall through to a safe local default. */ }
	}
	try {
		const origin = normalizeRunnerOrigin(dashboardOrigin);
		return isLoopback(new URL(origin).hostname) ? origin : '';
	} catch {
		return '';
	}
}

export function isRunnerHealth(value: unknown): value is { ok: true; service: 'cmdimpact-terminal'; version: 1 } {
	if (typeof value !== 'object' || value === null) return false;
	const health = value as { ok?: unknown; service?: unknown; version?: unknown };
	return health.ok === true && health.service === 'cmdimpact-terminal' && health.version === 1;
}
