import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import WebSocket from 'ws';
import { createTerminalService } from '../server/index.mjs';

function fakePty() {
	const terminals = [];
	return {
		terminals,
		spawn() {
			const terminal = {
				data: () => {}, exit: () => {},
				onData(handler) { this.data = handler; },
				onExit(handler) { this.exit = handler; },
				write() {}, resize() {}, kill() { queueMicrotask(() => this.exit({ exitCode: 0 })); },
			};
			terminals.push(terminal);
			return terminal;
		},
	};
}

function malformedHttpStatus(port) {
	return new Promise((resolve, reject) => {
		const request = httpRequest({ host: '127.0.0.1', port, path: 'http://%' }, (response) => {
			response.resume();
			response.on('end', () => resolve(response.statusCode));
		});
		request.on('error', reject);
		request.end();
	});
}

function malformedUpgradeStatus(port) {
	return new Promise((resolve, reject) => {
		const socket = createConnection({ host: '127.0.0.1', port });
		let response = '';
		socket.setTimeout(2000, () => socket.destroy(new Error('Upgrade response timed out.')));
		socket.on('connect', () => socket.write([
			'GET http://% HTTP/1.1',
			'Host: localhost',
			'Connection: Upgrade',
			'Upgrade: websocket',
			'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
			'Sec-WebSocket-Version: 13',
			'Origin: http://localhost:4321',
			'', '',
		].join('\r\n')));
		socket.on('data', (chunk) => { response += chunk; });
		socket.on('error', reject);
		socket.on('close', () => resolve(Number(response.match(/^HTTP\/1\.1 (\d{3})/)?.[1])));
	});
}

function waitFor(socket, type) {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 2000);
		const listener = (raw) => {
			const message = JSON.parse(raw.toString());
			if (message.type !== type) return;
			clearTimeout(timeout);
			socket.off('message', listener);
			resolve(message);
		};
		socket.on('message', listener);
	});
}

test('HTTP login, session creation, and authenticated WebSocket attach work together', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-http-'));
	const origin = 'http://localhost:4321';
	const pty = fakePty();
	const service = await createTerminalService({
		environment: {
			NODE_ENV: 'test',
			TERMINAL_ACCESS_TOKEN: 'integration-test-owner-token',
			TERMINAL_ALLOWED_ORIGINS: origin,
			TERMINAL_HOST: '127.0.0.1',
			TERMINAL_PORT: '0',
			TERMINAL_WORKSPACE: join(directory, 'workspace'),
			TERMINAL_STATE_FILE: join(directory, 'sessions.json'),
			SystemRoot: process.env.SystemRoot,
			WINDIR: process.env.WINDIR,
			PATH: process.env.PATH,
		},
		ptyModule: pty,
	});
	let socket;
	try {
		const address = await service.start();
		const base = `http://127.0.0.1:${address.port}`;
		for (let attempt = 0; attempt < 5; attempt += 1) {
			const rejected = await fetch(`${base}/api/auth/login`, {
				method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: 'wrong-integration-token' }),
			});
			assert.equal(rejected.status, 401);
		}
		const login = await fetch(`${base}/api/auth/login`, {
			method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
			body: JSON.stringify({ token: 'integration-test-owner-token' }),
		});
		assert.equal(login.status, 200);
		const cookie = login.headers.get('set-cookie').split(';', 1)[0];
		const malformedSocket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, { headers: { Origin: origin, Cookie: cookie } });
		malformedSocket.on('error', () => {});
		await new Promise((resolveOpen, reject) => {
			malformedSocket.once('open', resolveOpen);
			malformedSocket.once('error', reject);
		});
		const malformedClosed = new Promise((resolveClose) => malformedSocket.once('close', resolveClose));
		malformedSocket._socket.write(Buffer.from([0x81, 0x02, 0x7b, 0x7d]));
		await malformedClosed;
		assert.equal((await fetch(`${base}/api/health`)).status, 200);

		const created = await fetch(`${base}/api/sessions`, {
			method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Integration shell' }),
		});
		assert.equal(created.status, 201);
		const { session } = await created.json();

		socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, { headers: { Origin: origin, Cookie: cookie } });
		await new Promise((resolveOpen, reject) => {
			socket.once('open', resolveOpen);
			socket.once('error', reject);
		});
		const readyPromise = waitFor(socket, 'ready');
		socket.send(JSON.stringify({ type: 'attach', sessionId: session.id }));
		const ready = await readyPromise;
		assert.equal(ready.session.id, session.id);
		assert.equal(ready.writable, true);

		const outputPromise = waitFor(socket, 'output');
		pty.terminals[0].data('terminal output\r\n');
		assert.equal((await outputPromise).data, 'terminal output\r\n');

		const unauthenticatedLogout = await fetch(`${base}/api/auth/logout`, {
			method: 'POST', headers: { Origin: origin },
		});
		assert.equal(unauthenticatedLogout.status, 401);
		assert.equal(socket.readyState, WebSocket.OPEN);

		const closed = new Promise((resolveClose) => socket.once('close', resolveClose));
		const logout = await fetch(`${base}/api/auth/logout`, {
			method: 'POST', headers: { Origin: origin, Cookie: cookie },
		});
		assert.equal(logout.status, 200);
		await closed;
	} finally {
		if (socket?.readyState === WebSocket.OPEN) socket.close();
		await service.stop();
		await rm(directory, { recursive: true, force: true });
	}
});

test('malformed HTTP and WebSocket request targets return 400 without crashing the service', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-url-'));
	const service = await createTerminalService({
		environment: {
			NODE_ENV: 'test',
			TERMINAL_ACCESS_TOKEN: 'integration-test-owner-token',
			TERMINAL_ALLOWED_ORIGINS: 'http://localhost:4321',
			TERMINAL_HOST: '127.0.0.1',
			TERMINAL_PORT: '0',
			TERMINAL_WORKSPACE: join(directory, 'workspace'),
			TERMINAL_STATE_FILE: join(directory, 'sessions.json'),
			SystemRoot: process.env.SystemRoot,
			WINDIR: process.env.WINDIR,
			PATH: process.env.PATH,
		},
		ptyModule: fakePty(),
	});
	try {
		const address = await service.start();
		assert.equal(await malformedHttpStatus(address.port), 400);
		assert.equal(await malformedUpgradeStatus(address.port), 400);
		assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/health`)).status, 200);
	} finally {
		await service.stop();
		await rm(directory, { recursive: true, force: true });
	}
});

test('a shutdown failure still closes the HTTP listener', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-shutdown-'));
	const service = await createTerminalService({
		environment: {
			NODE_ENV: 'test',
			TERMINAL_ACCESS_TOKEN: 'integration-test-owner-token',
			TERMINAL_ALLOWED_ORIGINS: 'http://localhost:4321',
			TERMINAL_HOST: '127.0.0.1',
			TERMINAL_PORT: '0',
			TERMINAL_WORKSPACE: join(directory, 'workspace'),
			TERMINAL_STATE_FILE: join(directory, 'sessions.json'),
			SystemRoot: process.env.SystemRoot,
			WINDIR: process.env.WINDIR,
			PATH: process.env.PATH,
		},
		ptyModule: fakePty(),
	});
	try {
		await service.start();
		service.manager.shutdown = async () => { throw new Error('shutdown failed'); };
		await assert.rejects(service.stop(), /shutdown failed/);
		assert.equal(service.server.listening, false);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
