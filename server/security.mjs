import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE_VERSION = 1;

function digest(value) {
	return createHash('sha256').update(value, 'utf8').digest();
}

function sameDigest(left, right) {
	return timingSafeEqual(digest(left), digest(right));
}

function sign(value, key) {
	return createHmac('sha256', key).update(value, 'utf8').digest('base64url');
}

export function parseCookies(header = '') {
	const cookies = new Map();
	for (const part of header.split(';')) {
		const separator = part.indexOf('=');
		if (separator < 1) continue;
		const name = part.slice(0, separator).trim();
		const value = part.slice(separator + 1).trim();
		if (name) cookies.set(name, value);
	}
	return cookies;
}

export function parseAllowedOrigins(value, fallback = [
	'http://localhost:4321',
	'http://127.0.0.1:4321',
	'http://localhost:8787',
	'http://127.0.0.1:8787',
]) {
	const candidates = value ? value.split(',') : fallback;
	const origins = new Set();
	for (const candidate of candidates) {
		const trimmed = candidate.trim();
		if (!trimmed) continue;
		const url = new URL(trimmed);
		if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
			throw new Error(`Invalid allowed origin: ${trimmed}`);
		}
		origins.add(url.origin);
	}
	if (!origins.size) throw new Error('At least one allowed origin is required.');
	return origins;
}

export function originAllowed(origin, allowedOrigins) {
	if (!origin) return false;
	try {
		return allowedOrigins.has(new URL(origin).origin) && new URL(origin).origin === origin;
	} catch {
		return false;
	}
}

export function createAuthenticator(accessToken, options = {}) {
	if (typeof accessToken !== 'string' || accessToken.length < 20) {
		throw new Error('TERMINAL_ACCESS_TOKEN must contain at least 20 characters.');
	}

	const secure = options.secure ?? false;
	const maxAgeSeconds = options.maxAgeSeconds ?? 12 * 60 * 60;
	const cookieName = options.cookieName ?? (secure ? '__Host-cmdimpact_session' : 'cmdimpact_session');
	const expectedTokenDigest = digest(accessToken);
	const signingKey = createHash('sha256').update('cmdimpact-cookie-v1\0').update(accessToken).digest();

	function verifyAccessToken(candidate) {
		if (typeof candidate !== 'string' || Buffer.byteLength(candidate, 'utf8') > 4096) return false;
		return timingSafeEqual(digest(candidate), expectedTokenDigest);
	}

	function issueCookie(now = Date.now()) {
		const payload = Buffer.from(JSON.stringify({
			v: COOKIE_VERSION,
			exp: Math.floor(now / 1000) + maxAgeSeconds,
			n: randomBytes(16).toString('base64url'),
		})).toString('base64url');
		const value = `${payload}.${sign(payload, signingKey)}`;
		return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
	}

	function clearCookie() {
		return `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
	}

	function verifyCookie(header, now = Date.now()) {
		const value = parseCookies(header).get(cookieName);
		if (!value || value.length > 1024) return false;
		const separator = value.lastIndexOf('.');
		if (separator < 1) return false;
		const payload = value.slice(0, separator);
		const signature = value.slice(separator + 1);
		if (!sameDigest(signature, sign(payload, signingKey))) return false;
		try {
			const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
			return decoded.v === COOKIE_VERSION && Number.isInteger(decoded.exp) && decoded.exp >= Math.floor(now / 1000);
		} catch {
			return false;
		}
	}

	return { cookieName, verifyAccessToken, issueCookie, clearCookie, verifyCookie };
}

export class LoginLimiter {
	constructor({ attempts = 5, windowMs = 10 * 60_000, maxEntries = 1000 } = {}) {
		this.attempts = attempts;
		this.windowMs = windowMs;
		this.maxEntries = maxEntries;
		this.failures = new Map();
	}

	allow(key, now = Date.now()) {
		const entry = this.failures.get(key);
		if (!entry || now - entry.startedAt >= this.windowMs) {
			this.failures.delete(key);
			return true;
		}
		return entry.count < this.attempts;
	}

	recordFailure(key, now = Date.now()) {
		const entry = this.failures.get(key);
		if (!entry || now - entry.startedAt >= this.windowMs) this.failures.set(key, { count: 1, startedAt: now });
		else entry.count += 1;
		if (this.failures.size > this.maxEntries) this.failures.delete(this.failures.keys().next().value);
	}

	reset(key) {
		this.failures.delete(key);
	}
}
