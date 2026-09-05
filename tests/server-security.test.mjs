import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAuthenticator, LoginLimiter, originAllowed, parseAllowedOrigins } from '../server/security.mjs';
import { MAX_INPUT_BYTES, parseClientMessage, ProtocolError } from '../server/protocol.mjs';
import { loadConfig } from '../server/index.mjs';

test('owner cookies are signed, expiring, HttpOnly, and tamper evident', () => {
	const auth = createAuthenticator('correct horse battery staple', { secure: true, maxAgeSeconds: 60 });
	assert.equal(auth.verifyAccessToken('correct horse battery staple'), true);
	assert.equal(auth.verifyAccessToken('wrong horse battery staple'), false);

	const setCookie = auth.issueCookie(1_000_000);
	assert.match(setCookie, /HttpOnly/);
	assert.match(setCookie, /SameSite=Strict/);
	assert.match(setCookie, /Secure/);
	const cookie = setCookie.split(';', 1)[0];
	assert.equal(auth.verifyCookie(cookie, 1_030_000), true);
	assert.equal(auth.verifyCookie(cookie, 1_061_000), false);
	assert.equal(auth.verifyCookie(`${cookie}x`, 1_030_000), false);
});

test('origins are exact and login failures are bounded', () => {
	const origins = parseAllowedOrigins('https://app.example.com,http://localhost:4321');
	assert.equal(originAllowed('https://app.example.com', origins), true);
	assert.equal(originAllowed('https://app.example.com.evil.test', origins), false);
	assert.equal(originAllowed(undefined, origins), false);

	const limiter = new LoginLimiter({ attempts: 2, windowMs: 100 });
	assert.equal(limiter.allow('client', 0), true);
	limiter.recordFailure('client', 0);
	limiter.recordFailure('client', 1);
	assert.equal(limiter.allow('client', 2), false);
	assert.equal(limiter.allow('client', 101), true);
});

test('production permits insecure origins only on explicitly enabled local hosts', () => {
	assert.throws(() => loadConfig({
		NODE_ENV: 'production',
		TERMINAL_ALLOWED_ORIGINS: 'http://localhost:4321',
	}), /must use HTTPS/);
	assert.throws(() => loadConfig({
		NODE_ENV: 'production',
		TERMINAL_ALLOWED_ORIGINS: 'http://terminal.example.com',
		TERMINAL_ALLOW_INSECURE_LOCALHOST: 'true',
	}), /must use HTTPS/);
	assert.throws(() => loadConfig({
		NODE_ENV: 'production',
		TERMINAL_ALLOWED_ORIGINS: 'https://terminal.example.com,http://localhost:4321',
		TERMINAL_ALLOW_INSECURE_LOCALHOST: 'true',
	}), /must use HTTPS/);
	assert.throws(() => loadConfig({
		NODE_ENV: 'production',
		TERMINAL_ALLOWED_ORIGINS: 'https://localhost:4321,http://localhost:4321',
		TERMINAL_ALLOW_INSECURE_LOCALHOST: 'true',
	}), /must use HTTPS/);
	assert.equal(loadConfig({
		NODE_ENV: 'production',
		TERMINAL_ALLOWED_ORIGINS: 'http://localhost:4321,http://127.0.0.1:4321',
		TERMINAL_ALLOW_INSECURE_LOCALHOST: 'true',
	}).secureCookie, false);
});

test('configuration can read the owner token from a secret file', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-secret-'));
	try {
		const file = join(directory, 'owner-token');
		await writeFile(file, 'owner-secret-file-token\n');
		const config = loadConfig({
			NODE_ENV: 'test',
			TERMINAL_ACCESS_TOKEN_FILE: file,
			TERMINAL_PTY_UID: '10002',
			TERMINAL_PTY_GID: '10002',
		});
		assert.equal(config.accessToken, 'owner-secret-file-token');
		assert.deepEqual(config.ptyIdentity, { uid: 10002, gid: 10002 });
		assert.throws(() => loadConfig({ NODE_ENV: 'test', TERMINAL_PTY_UID: '10002' }), /must be set together/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('terminal protocol accepts only bounded, typed control messages', () => {
	const id = '15d29680-7474-4a4e-99d4-c390869efcad';
	assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'attach', sessionId: id, takeover: true })), {
		type: 'attach', sessionId: id, takeover: true,
	});
	assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'resize', cols: 120, rows: 32 })), {
		type: 'resize', cols: 120, rows: 32,
	});
	assert.throws(() => parseClientMessage(Buffer.from('{}'), true), ProtocolError);
	assert.throws(
		() => parseClientMessage(JSON.stringify({ type: 'input', data: 'x'.repeat(MAX_INPUT_BYTES + 1) })),
		(error) => error instanceof ProtocolError && error.code === 'input-too-large',
	);
});
