import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultRunnerOrigin, isRunnerHealth, normalizeRunnerOrigin } from '../src/lib/runner-url.ts';

test('runner origins allow HTTPS and local HTTP', () => {
	assert.equal(normalizeRunnerOrigin(' https://Runner.Example.com/ '), 'https://runner.example.com');
	assert.equal(normalizeRunnerOrigin('http://localhost:8787'), 'http://localhost:8787');
	assert.equal(normalizeRunnerOrigin('http://127.0.0.1:4321/'), 'http://127.0.0.1:4321');
	assert.equal(normalizeRunnerOrigin('http://[::1]:8787'), 'http://[::1]:8787');
});

test('runner origins reject insecure remote or non-origin URLs', () => {
	for (const value of [
		'http://runner.example.com',
		'http://127.example.com',
		'https://runner.example.com/api',
		'https://runner.example.com/api/..',
		'https://runner.example.com?token=no',
		'https://user:secret@runner.example.com',
		'https:runner.example.com',
		'ws://runner.example.com',
	]) assert.throws(() => normalizeRunnerOrigin(value));
});

test('runner defaults require an explicit saved origin outside loopback', () => {
	assert.equal(defaultRunnerOrigin(null, 'https://cmdimpact.vercel.app'), '');
	assert.equal(defaultRunnerOrigin(null, 'http://localhost:4321'), 'http://localhost:4321');
	assert.equal(defaultRunnerOrigin(null, 'https://localhost:4321'), 'https://localhost:4321');
	assert.equal(defaultRunnerOrigin('https://runner.example.com', 'https://cmdimpact.vercel.app'), 'https://runner.example.com');
	assert.equal(defaultRunnerOrigin('not a URL', 'https://cmdimpact.vercel.app'), '');
});

test('runner health requires the exact unauthenticated service marker', () => {
	assert.equal(isRunnerHealth({ ok: true, service: 'cmdimpact-terminal', version: 1 }), true);
	assert.equal(isRunnerHealth({ ok: true, service: 'cmdimpact-terminal', version: 2 }), false);
	assert.equal(isRunnerHealth({ authenticated: false, shells: [] }), false);
	assert.equal(isRunnerHealth('<html>not a runner</html>'), false);
});
