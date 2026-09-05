import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { SessionManager } from '../server/session-manager.mjs';
import { SessionStore } from '../server/store.mjs';

function fakePty() {
	const terminals = [];
	return {
		terminals,
		spawn() {
			const terminal = {
				pid: 1234 + terminals.length,
				alive: true,
				killed: false,
				signals: [],
				writes: [],
				dataHandler: () => {},
				exitHandler: () => {},
				onData(handler) { this.dataHandler = handler; },
				onExit(handler) { this.exitHandler = handler; },
				write(data) { this.writes.push(data); },
				resize(cols, rows) { this.size = { cols, rows }; },
				kill(signal) {
					this.killed = true;
					this.signals.push(signal);
					queueMicrotask(() => this.exitHandler({ exitCode: 0 }));
				},
				emitData(data) { this.dataHandler(data); },
				emitExit(event = { exitCode: 0 }) { this.alive = false; this.exitHandler(event); },
			};
			terminals.push(terminal);
			return terminal;
		},
	};
}

function fakeClient() {
	return {
		writable: false,
		maxBufferedBytes: 1024 * 1024,
		messages: [],
		closed: false,
		isOpen() { return !this.closed; },
		bufferedBytes() { return 0; },
		send(message) { this.messages.push(message); },
		close() { this.closed = true; },
	};
}

function deferred() {
	let resolve;
	const promise = new Promise((done) => { resolve = done; });
	return { promise, resolve };
}

test('a live PTY survives browser disconnect and replays bounded memory output', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-session-'));
	try {
		let now = 1_700_000_000_000;
		const store = new SessionStore(join(directory, 'sessions.json'));
		const pty = fakePty();
		const manager = new SessionManager({
			pty,
			store,
			shells: { test: { file: 'fixed-shell', args: [], env: { TERM: 'xterm-256color' } } },
			workspace: join(directory, 'workspace'),
			now: () => now,
			platform: 'win32',
			limits: { maxBacklogBytes: 1024, idleTimeoutMs: 60_000, hardTimeoutMs: 600_000 },
		});
		await manager.initialize();
		const session = await manager.create({ name: 'Work', shell: 'test' });
		const first = fakeClient();
		await manager.attach(session.id, first);
		pty.terminals[0].emitData('hello from the shell\r\n');
		await manager.detach(session.id, first);
		assert.equal(pty.terminals[0].killed, false);
		assert.equal(manager.get(session.id).state, 'detached');

		now += 1_000;
		const second = fakeClient();
		await manager.attach(session.id, second);
		assert.equal(second.messages.some((message) => message.type === 'ready'), true);
		assert.equal(second.messages.some((message) => message.type === 'output' && message.replay && message.data.includes('hello')), true);
		manager.write(session.id, second, 'pwd\r');
		assert.deepEqual(pty.terminals[0].writes, ['pwd\r']);

		await manager.stop(session.id);
		assert.equal(pty.terminals[0].killed, true);
		assert.equal(manager.get(session.id).state, 'exited');
		const persisted = JSON.parse(await readFile(join(directory, 'sessions.json'), 'utf8'));
		assert.equal(persisted[0].state, 'exited');
		assert.equal(JSON.stringify(persisted).includes('hello from the shell'), false);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('Linux stop empties the PTY session across process groups before completing', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-stop-'));
	try {
		const store = new SessionStore(join(directory, 'sessions.json'));
		const pty = fakePty();
		const signals = [];
		const members = new Set();
		const workerPid = 9001;
		const manager = new SessionManager({
			pty,
			store,
			shells: { test: { file: 'fixed-shell', args: [], env: {} } },
			workspace: join(directory, 'workspace'),
			platform: 'linux',
			listSessionProcesses: async () => [...members],
			killProcess(pid, signal) {
				signals.push([pid, signal]);
				if (pid === pty.terminals[0].pid && signal === 'SIGTERM') {
					members.delete(pid);
					queueMicrotask(() => pty.terminals[0].emitExit({ exitCode: 143, signal: 15 }));
				}
				if (pid === workerPid && signal === 'SIGKILL') members.delete(pid);
			},
			limits: { maxSessions: 1, stopGraceMs: 5 },
		});
		await manager.initialize();
		const session = await manager.create({ shell: 'test' });
		members.add(pty.terminals[0].pid);
		members.add(workerPid);
		const stopping = manager.stop(session.id);
		assert.equal(manager.sessions.has(session.id), true);
		assert.equal(manager.get(session.id).state, 'running');
		await stopping;
		assert.equal(signals.some(([pid, signal]) => pid === pty.terminals[0].pid && signal === 'SIGTERM'), true);
		assert.equal(signals.some(([pid, signal]) => pid === workerPid && signal === 'SIGTERM'), true);
		assert.equal(signals.some(([pid, signal]) => pid === workerPid && signal === 'SIGKILL'), true);
		assert.equal(members.size, 0);
		assert.equal(manager.sessions.has(session.id), false);
		assert.equal(manager.get(session.id).state, 'exited');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('natural Linux shell exit drains surviving PTY session members before finalizing', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-natural-exit-'));
	try {
		const store = new SessionStore(join(directory, 'sessions.json'));
		const pty = fakePty();
		const members = new Set();
		const signals = [];
		const workerPid = 9002;
		const manager = new SessionManager({
			pty,
			store,
			shells: { test: { file: 'fixed-shell', args: [], env: {} } },
			workspace: join(directory, 'workspace'),
			platform: 'linux',
			listSessionProcesses: async () => [...members],
			killProcess(pid, signal) {
				signals.push([pid, signal]);
				if (pid === workerPid && signal === 'SIGKILL') members.delete(pid);
			},
			limits: { stopGraceMs: 5 },
		});
		await manager.initialize();
		const session = await manager.create({ shell: 'test' });
		const runtime = manager.sessions.get(session.id);
		members.add(workerPid);
		pty.terminals[0].emitExit({ exitCode: 0 });

		assert.equal(manager.sessions.has(session.id), true);
		await runtime.exitPromise;
		assert.equal(signals.some(([pid, signal]) => pid === workerPid && signal === 'SIGTERM'), true);
		assert.equal(signals.some(([pid, signal]) => pid === workerPid && signal === 'SIGKILL'), true);
		assert.equal(members.size, 0);
		assert.equal(manager.sessions.has(session.id), false);
		assert.equal(manager.get(session.id).state, 'exited');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('attach persists before ready and replays output produced during persistence once', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-attach-order-'));
	try {
		const store = new SessionStore(join(directory, 'sessions.json'));
		const originalPut = store.put.bind(store);
		let delay;
		store.put = async (record) => {
			const current = delay;
			if (current) {
				delay = undefined;
				current.started.resolve();
				await current.release.promise;
			}
			return originalPut(record);
		};
		const pty = fakePty();
		const manager = new SessionManager({
			pty,
			store,
			shells: { test: { file: 'fixed-shell', args: [], env: {} } },
			workspace: join(directory, 'workspace'),
			platform: 'win32',
		});
		await manager.initialize();
		const session = await manager.create({ shell: 'test' });

		const client = fakeClient();
		const firstDelay = { started: deferred(), release: deferred() };
		delay = firstDelay;
		const attaching = manager.attach(session.id, client);
		await firstDelay.started.promise;
		pty.terminals[0].emitData('while metadata is pending\r\n');
		assert.deepEqual(client.messages, []);
		firstDelay.release.resolve();
		await attaching;
		assert.deepEqual(client.messages.map(({ type }) => type), ['ready', 'output']);
		assert.equal(client.messages[1].replay, true);

		const closedClient = fakeClient();
		const closedDelay = { started: deferred(), release: deferred() };
		delay = closedDelay;
		const closedAttach = manager.attach(session.id, closedClient);
		await closedDelay.started.promise;
		closedClient.closed = true;
		closedDelay.release.resolve();
		await assert.rejects(closedAttach, (error) => error.code === 'connection-closed');
		assert.equal(manager.sessions.get(session.id).clients.has(closedClient), false);

		const exitedClient = fakeClient();
		const exitedDelay = { started: deferred(), release: deferred() };
		delay = exitedDelay;
		const exitedAttach = manager.attach(session.id, exitedClient);
		await exitedDelay.started.promise;
		pty.terminals[0].emitExit({ exitCode: 0 });
		exitedDelay.release.resolve();
		await assert.rejects(exitedAttach, (error) => error.code === 'not-live');
		assert.deepEqual(exitedClient.messages, []);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('metadata cannot claim a PTY survived a server restart', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-store-'));
	try {
		const file = join(directory, 'sessions.json');
		const first = new SessionStore(file);
		await first.put({ id: 'session', name: 'Old shell', shell: 'bash', state: 'detached', createdAt: new Date(0).toISOString() });
		const second = new SessionStore(file);
		await second.load(10_000);
		assert.equal(second.get('session').state, 'exited');
		assert.equal(second.get('session').exitReason, 'server-restarted');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('normal writes retain every live record and only the newest 100 exited records', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-retention-'));
	try {
		const file = join(directory, 'sessions.json');
		const store = new SessionStore(file);
		await store.put({ id: 'running', name: 'Running', state: 'running', createdAt: new Date(0).toISOString() });
		await store.put({ id: 'detached', name: 'Detached', state: 'detached', createdAt: new Date(0).toISOString() });
		for (let index = 0; index < 105; index += 1) {
			await store.put({
				id: `exited-${index}`,
				name: `Exited ${index}`,
				state: 'exited',
				createdAt: new Date(index).toISOString(),
				exitedAt: new Date(index).toISOString(),
			});
		}

		const records = store.list();
		assert.equal(records.filter(({ state }) => state === 'exited').length, 100);
		assert.equal(records.some(({ id }) => id === 'exited-0'), false);
		assert.equal(records.some(({ id }) => id === 'exited-104'), true);
		assert.equal(records.some(({ id }) => id === 'running'), true);
		assert.equal(records.some(({ id }) => id === 'detached'), true);
		assert.equal(JSON.parse(await readFile(file, 'utf8')).length, 102);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('startup load applies exited retention after converting every stale live record', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-load-retention-'));
	try {
		const file = join(directory, 'sessions.json');
		const records = Array.from({ length: 1001 }, (_, index) => ({
			id: `exited-${index}`,
			name: `Exited ${index}`,
			state: 'exited',
			createdAt: new Date(index).toISOString(),
			exitedAt: new Date(index).toISOString(),
		}));
		records.push({ id: 'stale-live', name: 'Stale live', state: 'running', createdAt: new Date(0).toISOString() });
		await writeFile(file, JSON.stringify(records));

		const store = new SessionStore(file);
		await store.load(1_000_000);
		assert.equal(store.list().length, 100);
		assert.equal(store.get('stale-live').state, 'exited');
		assert.equal(store.get('stale-live').exitReason, 'server-restarted');
		assert.equal(store.get('exited-0'), undefined);
		assert.equal(JSON.parse(await readFile(file, 'utf8')).length, 100);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('a failed metadata write does not poison later queued writes', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-store-recovery-'));
	try {
		const file = join(directory, 'sessions.json');
		const store = new SessionStore(file);
		const prepareDirectory = store.prepareDirectory.bind(store);
		let failOnce = true;
		store.prepareDirectory = async () => {
			if (failOnce) {
				failOnce = false;
				throw new Error('transient write failure');
			}
			return prepareDirectory();
		};
		await assert.rejects(
			store.put({ id: 'first', name: 'First', state: 'exited', createdAt: new Date(0).toISOString() }),
			/transient write failure/,
		);
		await store.put({ id: 'second', name: 'Second', state: 'exited', createdAt: new Date(1).toISOString() });
		const persisted = JSON.parse(await readFile(file, 'utf8'));
		assert.deepEqual(persisted.map(({ id }) => id).sort(), ['first', 'second']);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test('a failed initial metadata write terminates and rolls back the spawned PTY', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'cmdimpact-create-rollback-'));
	try {
		const records = new Map();
		let failOnce = true;
		const store = {
			list: () => [...records.values()].map((record) => structuredClone(record)),
			get: (id) => records.has(id) ? structuredClone(records.get(id)) : undefined,
			async put(record) {
				records.set(record.id, structuredClone(record));
				if (failOnce) {
					failOnce = false;
					throw new Error('metadata unavailable');
				}
				return structuredClone(record);
			},
			async remove(id) { return records.delete(id); },
		};
		const pty = fakePty();
		const signals = [];
		const manager = new SessionManager({
			pty,
			store,
			shells: { test: { file: 'fixed-shell', args: [], env: {} } },
			workspace: join(directory, 'workspace'),
			platform: 'linux',
			listSessionProcesses: async (sessionId) => pty.terminals
				.filter((terminal) => terminal.alive && terminal.pid === sessionId)
				.map((terminal) => terminal.pid),
			killProcess(pid, signal) {
				signals.push([pid, signal]);
				if (signal === 'SIGKILL') {
					const terminal = pty.terminals.find((candidate) => candidate.pid === pid);
					queueMicrotask(() => terminal.emitExit({ exitCode: 137, signal: 9 }));
				}
			},
			limits: { maxSessions: 1, stopGraceMs: 5 },
		});
		await manager.initialize();
		await assert.rejects(manager.create({ shell: 'test' }), /metadata unavailable/);
		assert.equal(signals.some(([pid, signal]) => pid === pty.terminals[0].pid && signal === 'SIGTERM'), true);
		assert.equal(signals.some(([pid, signal]) => pid === pty.terminals[0].pid && signal === 'SIGKILL'), true);
		assert.equal(pty.terminals[0].alive, false);
		assert.equal(manager.sessions.size, 0);
		assert.equal(records.size, 0);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
