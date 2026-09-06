import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAuthenticator, isLoopbackHostname, LoginLimiter, originAllowed, parseAllowedOrigins } from '../server/security.mjs';
import { MAX_INPUT_BYTES, parseClientMessage, ProtocolError } from '../server/protocol.mjs';
import { fixedShells, loadConfig } from '../server/index.mjs';

test('owner cookies are signed, expiring, HttpOnly, and tamper evident', () => {
	const auth = createAuthenticator('correct horse battery staple', { secure: true, maxAgeSeconds: 60, sessionTokenSeconds: 60 });
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

	const sessionToken = auth.issueSessionToken(1_000_000);
	assert.equal(auth.verifySessionToken(sessionToken, 1_030_000), true);
	assert.equal(auth.verifySessionToken(sessionToken, 1_061_000), false);
	assert.equal(auth.verifySessionToken(`${sessionToken}x`, 1_030_000), false);
	assert.equal(auth.verifySessionToken('correct horse battery staple', 1_030_000), false);
	assert.equal(auth.verifySessionToken(cookie.split('=', 2)[1], 1_030_000), false);
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

test('loopback detection accepts localhost names, IPv6, and the full IPv4 127/8 range only', () => {
	for (const hostname of ['localhost', 'runner.localhost', '[::1]', '::1', '127.0.0.1', '127.42.10.9']) {
		assert.equal(isLoopbackHostname(hostname), true, hostname);
	}
	for (const hostname of ['localhost.example.com', 'notlocalhost', '126.255.255.255', '128.0.0.1', '127.example.com']) {
		assert.equal(isLoopbackHostname(hostname), false, hostname);
	}
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
	assert.equal(loadConfig({
		NODE_ENV: 'production',
		TERMINAL_ALLOWED_ORIGINS: 'https://terminal.example.com,http://localhost:4321',
		TERMINAL_ALLOW_INSECURE_LOCALHOST: 'true',
	}).secureCookie, true);
	assert.equal(loadConfig({
		NODE_ENV: 'production',
		TERMINAL_ALLOWED_ORIGINS: 'https://localhost:4321,http://localhost:4321',
		TERMINAL_ALLOW_INSECURE_LOCALHOST: 'true',
	}).secureCookie, true);
	assert.equal(loadConfig({
		NODE_ENV: 'production',
		TERMINAL_ALLOWED_ORIGINS: 'http://runner.localhost:4321,http://127.42.10.9:4321,http://[::1]:4321',
		TERMINAL_ALLOW_INSECURE_LOCALHOST: 'true',
	}).secureCookie, false);
	assert.equal(loadConfig({
		NODE_ENV: 'test',
		TERMINAL_ALLOWED_ORIGINS: 'http://terminal.internal:4321',
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

test('terminal lifetime limits are disabled by default and zero remains valid', () => {
	const defaults = loadConfig({ NODE_ENV: 'test' });
	assert.equal(defaults.host, '127.0.0.1');
	assert.equal(defaults.limits.idleTimeoutMs, 0);
	assert.equal(defaults.limits.hardTimeoutMs, 0);
	assert.equal(loadConfig({ NODE_ENV: 'production', TERMINAL_ALLOWED_ORIGINS: 'https://app.example.test' }).host, '127.0.0.1');

	const configured = loadConfig({
		NODE_ENV: 'test',
		TERMINAL_IDLE_MINUTES: '15',
		TERMINAL_HARD_HOURS: '2',
	});
	assert.equal(configured.limits.idleTimeoutMs, 15 * 60_000);
	assert.equal(configured.limits.hardTimeoutMs, 2 * 60 * 60_000);
	assert.doesNotThrow(() => loadConfig({ NODE_ENV: 'test', TERMINAL_IDLE_MINUTES: '0', TERMINAL_HARD_HOURS: '0' }));
});

test('Linux shells use workspace-local tool homes and only forward the SSH agent socket', { skip: process.platform !== 'linux' }, () => {
	const [shell] = Object.values(fixedShells('linux', '/workspace', {
		LANG: 'C.UTF-8',
		SSH_AUTH_SOCK: '/run/user/1000/ssh-agent.socket',
		GITHUB_TOKEN: 'must-not-leak',
		ANTHROPIC_API_KEY: 'must-not-leak',
	}, { uid: 10002, gid: 10002 }));
	assert.equal(shell.env.XDG_DATA_HOME, '/workspace/.local/share');
	assert.equal(shell.env.PIPX_HOME, '/workspace/.local/pipx');
	assert.equal(shell.env.PIPX_BIN_DIR, '/workspace/.local/bin');
	assert.equal(shell.env.SSH_AUTH_SOCK, '/run/user/1000/ssh-agent.socket');
	assert.equal(shell.env.GITHUB_TOKEN, undefined);
	assert.equal(shell.env.ANTHROPIC_API_KEY, undefined);

	const [withoutAgent] = Object.values(fixedShells('linux', '/workspace', {}, { uid: 10002, gid: 10002 }));
	assert.equal(withoutAgent.env.SSH_AUTH_SOCK, undefined);

	const [direct] = Object.values(fixedShells('linux', '/workspace', {
		HOME: '/home/alice',
		PATH: '/home/alice/.local/bin:/usr/bin',
		USER: 'alice',
		GITHUB_TOKEN: 'must-not-leak',
	}));
	assert.equal(direct.env.HOME, '/home/alice');
	assert.equal(direct.env.PATH, '/home/alice/.local/bin:/usr/bin');
	assert.equal(direct.env.USER, 'alice');
	assert.equal(direct.env.GITHUB_TOKEN, undefined);
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
