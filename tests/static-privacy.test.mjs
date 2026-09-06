import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('sensitive browser state cannot fall back to URL serialization', async () => {
	const [app, checker, worker] = await Promise.all([
		readFile(new URL('../src/pages/app/index.astro', import.meta.url), 'utf8'),
		readFile(new URL('../src/pages/check.astro', import.meta.url), 'utf8'),
		readFile(new URL('../public/app/sw.js', import.meta.url), 'utf8'),
	]);
	const commandInput = checker.match(/<textarea\s[^>]*id="command-input"[^>]*>/s)?.[0];

	assert.ok(commandInput);
	assert.doesNotMatch(commandInput, /\sname=/);
	assert.match(app, /<form id="login-form" method="dialog">/);
	assert.ok(app.indexOf("api('/api/health'") < app.indexOf("api('/api/auth/login'"));
	assert.doesNotMatch(app, /\/app\/\?session=/);
	assert.doesNotMatch(worker, /addEventListener\(['"](?:fetch|push)['"]/);
});
