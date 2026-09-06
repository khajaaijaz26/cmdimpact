import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const setupScript = resolve('scripts/setup.mjs');

test('runner setup accepts only a secure exact browser origin and an explicit workspace', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-setup-'));
	try {
		await execute(process.execPath, [setupScript, '--origin', 'https://app.example.test', '--workspace', 'projects'], { cwd: directory });
		const environment = await readFile(join(directory, '.env'), 'utf8');
		assert.match(environment, /NODE_ENV="production"/);
		assert.match(environment, /TERMINAL_ALLOWED_ORIGINS="https:\/\/app\.example\.test"/);
		assert.match(environment, /TERMINAL_WORKSPACE=".*\/projects"/);
		await execute(process.execPath, [setupScript, '--origin', 'http://127.42.10.9:4321'], { cwd: directory });
		assert.match(await readFile(join(directory, '.env'), 'utf8'), /TERMINAL_ALLOWED_ORIGINS="http:\/\/127\.42\.10\.9:4321"/);
		await assert.rejects(
			execute(process.execPath, [setupScript, '--origin', 'http://public.example.test'], { cwd: directory }),
			/HTTPS/,
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
