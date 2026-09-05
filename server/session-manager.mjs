import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { cleanSessionName, ProtocolError } from './protocol.mjs';

function iso(now = Date.now()) {
	return new Date(now).toISOString();
}

function defaultName(now = Date.now()) {
	return `Terminal ${new Date(now).toLocaleString('en', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function send(client, message) {
	if (!client.isOpen()) return false;
	if (client.bufferedBytes() > client.maxBufferedBytes) {
		client.close(1013, 'Client is too slow');
		return false;
	}
	client.send(message);
	return true;
}

async function settlesWithin(promise, timeoutMs) {
	let timer;
	return Promise.race([
		promise.then(() => true),
		new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
	]).finally(() => clearTimeout(timer));
}

async function linuxSessionProcesses(sessionId) {
	const processes = await Promise.all((await readdir('/proc', { withFileTypes: true })).map(async (entry) => {
		if (!/^\d+$/.test(entry.name)) return undefined;
		try {
			const stat = await readFile(`/proc/${entry.name}/stat`, 'utf8');
			const commandEnd = stat.lastIndexOf(')');
			if (commandEnd < 0) return undefined;
			const fields = stat.slice(commandEnd + 1).trim().split(/\s+/);
			return Number(fields[3]) === sessionId ? Number(entry.name) : undefined;
		} catch (error) {
			if (error?.code === 'ENOENT' || error?.code === 'ESRCH') return undefined;
			throw error;
		}
	}));
	return processes.filter(Number.isInteger).sort((left, right) => right - left);
}

export class SessionManager {
	constructor({ pty, store, shells, workspace, limits = {}, now = Date.now, platform = process.platform, killProcess = process.kill, listSessionProcesses = linuxSessionProcesses, onError = console.error }) {
		this.pty = pty;
		this.store = store;
		this.shells = shells;
		this.workspace = workspace;
		this.now = now;
		this.platform = platform;
		this.killProcess = killProcess;
		this.listSessionProcesses = listSessionProcesses;
		this.onError = onError;
		this.sessions = new Map();
		this.maxSessions = limits.maxSessions ?? 4;
		this.maxBacklogBytes = limits.maxBacklogBytes ?? 256 * 1024;
		this.maxOutputBytesPerSecond = limits.maxOutputBytesPerSecond ?? 1024 * 1024;
		this.maxInputBytesPerSecond = limits.maxInputBytesPerSecond ?? 128 * 1024;
		this.idleTimeoutMs = limits.idleTimeoutMs ?? 30 * 60_000;
		this.hardTimeoutMs = limits.hardTimeoutMs ?? 8 * 60 * 60_000;
		this.stopGraceMs = limits.stopGraceMs ?? 2_000;
	}

	async initialize() {
		await mkdir(this.workspace, { recursive: true });
	}

	availableShells() {
		return Object.keys(this.shells);
	}

	async create({ name, shell, cols = 100, rows = 30 } = {}) {
		if (this.sessions.size >= this.maxSessions) throw new ProtocolError('session-limit', 'The live session limit has been reached.');
		const selectedShell = shell ?? Object.keys(this.shells)[0];
		const definition = this.shells[selectedShell];
		if (!definition) throw new ProtocolError('invalid-shell', 'That shell is not available.');
		if (!Number.isInteger(cols) || cols < 20 || cols > 400 || !Number.isInteger(rows) || rows < 5 || rows > 200) {
			throw new ProtocolError('invalid-size', 'Terminal size is outside the supported range.');
		}

		const id = randomUUID();
		const createdAt = this.now();
		const meta = {
			id,
			name: cleanSessionName(name) ?? defaultName(createdAt),
			shell: selectedShell,
			state: 'running',
			createdAt: iso(createdAt),
			lastAttachedAt: null,
			detachedAt: null,
			exitedAt: null,
			exitCode: null,
			exitReason: null,
		};

		let terminal;
		try {
			terminal = this.pty.spawn(definition.file, definition.args, {
				name: 'xterm-256color', cols, rows, cwd: this.workspace, env: definition.env,
			});
		} catch (error) {
			throw new ProtocolError('shell-start-failed', `Unable to start ${selectedShell}: ${error.message}`);
		}

		let resolveExit;
		let rejectExit;
		let resolveOsExit;
		const osExitPromise = new Promise((resolve) => { resolveOsExit = resolve; });
		const exitPromise = new Promise((resolve, reject) => {
			resolveExit = resolve;
			rejectExit = reject;
		});
		// Natural exits may have no caller awaiting them; the onExit handler logs failures.
		exitPromise.catch(() => {});
		const runtime = {
			meta,
			terminal,
			clients: new Set(),
			controller: null,
			backlog: [],
			backlogBytes: 0,
			outputWindowStarted: createdAt,
			outputWindowBytes: 0,
			inputWindowStarted: createdAt,
			inputWindowBytes: 0,
			finished: false,
			osExited: false,
			exitPromise,
			osExitPromise,
			resolveExit,
			rejectExit,
			resolveOsExit,
			finishPromise: null,
			stopPromise: null,
			terminationPromise: null,
		};
		this.sessions.set(id, runtime);

		terminal.onData((data) => this.handleOutput(runtime, data));
		terminal.onExit(({ exitCode, signal }) => {
			runtime.osExited = true;
			resolveOsExit();
			(this.platform === 'linux' ? this.terminateLinuxSession(runtime) : Promise.resolve())
				.then(() => this.finish(runtime, exitCode, signal ? `signal-${signal}` : 'shell-exited'))
				.then(resolveExit)
				.catch((error) => {
					this.onError(error);
					rejectExit(error);
				});
		});
		try {
			await this.store.put(meta);
		} catch (error) {
			try { await this.stop(id, 'start-failed'); }
			catch (cleanupError) { this.onError(cleanupError); }
			this.sessions.delete(id);
			try { await this.store.remove(id); }
			catch (cleanupError) { this.onError(cleanupError); }
			throw error;
		}
		return this.describe(runtime);
	}

	describe(runtime) {
		return { ...structuredClone(runtime.meta), clients: runtime.clients.size, writable: Boolean(runtime.controller) };
	}

	list() {
		return this.store.list().map((record) => {
			const runtime = this.sessions.get(record.id);
			return runtime ? this.describe(runtime) : { ...record, clients: 0, writable: false };
		});
	}

	get(id) {
		const runtime = this.sessions.get(id);
		if (runtime) return this.describe(runtime);
		const record = this.store.get(id);
		return record ? { ...record, clients: 0, writable: false } : undefined;
	}

	async rename(id, name) {
		const clean = cleanSessionName(name);
		if (!clean) throw new ProtocolError('invalid-name', 'A session name is required.');
		const runtime = this.sessions.get(id);
		const record = runtime?.meta ?? this.store.get(id);
		if (!record) throw new ProtocolError('not-found', 'Session not found.');
		record.name = clean;
		if (runtime) runtime.meta = record;
		await this.store.put(record);
		return runtime ? this.describe(runtime) : { ...record, clients: 0, writable: false };
	}

	async attach(id, client, { takeover = false } = {}) {
		const runtime = this.sessions.get(id);
		if (!runtime || runtime.finished || runtime.osExited) throw new ProtocolError('not-live', 'This terminal is no longer running.');
		const now = this.now();
		runtime.meta.state = 'running';
		runtime.meta.lastAttachedAt = iso(now);
		runtime.meta.detachedAt = null;
		await this.store.put(runtime.meta);
		if (!client.isOpen()) throw new ProtocolError('connection-closed', 'The connection closed before attachment completed.');
		if (runtime.finished || runtime.osExited || this.sessions.get(id) !== runtime) throw new ProtocolError('not-live', 'This terminal is no longer running.');

		runtime.clients.add(client);
		if (!runtime.controller || takeover) this.setController(runtime, client, false);
		else client.writable = false;
		send(client, { type: 'ready', protocol: 1, session: this.describe(runtime), writable: client.writable });
		for (const data of runtime.backlog) send(client, { type: 'output', data, replay: true });
	}

	setController(runtime, client, notifyController = true) {
		if (runtime.controller && runtime.controller !== client) {
			runtime.controller.writable = false;
			send(runtime.controller, { type: 'control', writable: false, reason: 'taken-over' });
		}
		runtime.controller = client;
		client.writable = true;
		if (notifyController) send(client, { type: 'control', writable: true });
	}

	takeControl(id, client) {
		const runtime = this.requireLive(id);
		if (!runtime.clients.has(client)) throw new ProtocolError('not-attached', 'Attach before requesting control.');
		this.setController(runtime, client);
	}

	write(id, client, data) {
		const runtime = this.requireLive(id);
		if (runtime.controller !== client || !client.writable) throw new ProtocolError('read-only', 'This connection does not control the terminal.');
		const now = this.now();
		if (now - runtime.inputWindowStarted >= 1000) {
			runtime.inputWindowStarted = now;
			runtime.inputWindowBytes = 0;
		}
		runtime.inputWindowBytes += Buffer.byteLength(data, 'utf8');
		if (runtime.inputWindowBytes > this.maxInputBytesPerSecond) throw new ProtocolError('input-rate', 'Terminal input rate is too high.', 1009);
		runtime.terminal.write(data);
	}

	resize(id, client, cols, rows) {
		const runtime = this.requireLive(id);
		if (runtime.controller !== client || !client.writable) throw new ProtocolError('read-only', 'This connection does not control the terminal.');
		runtime.terminal.resize(cols, rows);
	}

	async detach(id, client) {
		const runtime = this.sessions.get(id);
		if (!runtime) return;
		runtime.clients.delete(client);
		if (runtime.controller === client) runtime.controller = null;
		if (!runtime.clients.size) {
			const now = this.now();
			runtime.meta.state = 'detached';
			runtime.meta.detachedAt = iso(now);
			await this.store.put(runtime.meta);
		}
	}

	handleOutput(runtime, data) {
		if (runtime.finished || typeof data !== 'string' || !data) return;
		const now = this.now();
		if (now - runtime.outputWindowStarted >= 1000) {
			runtime.outputWindowStarted = now;
			runtime.outputWindowBytes = 0;
		}
		const bytes = Buffer.byteLength(data, 'utf8');
		runtime.outputWindowBytes += bytes;
		if (runtime.outputWindowBytes > this.maxOutputBytesPerSecond) {
			this.broadcast(runtime, { type: 'error', code: 'output-rate', message: 'The session was stopped after exceeding its output limit.' });
			this.stop(runtime.meta.id, 'output-limit').catch(this.onError);
			return;
		}

		for (let index = 0; index < data.length; index += 12_000) {
			const chunk = data.slice(index, index + 12_000);
			this.appendBacklog(runtime, chunk, Buffer.byteLength(chunk, 'utf8'));
			this.broadcast(runtime, { type: 'output', data: chunk });
		}
	}

	appendBacklog(runtime, data, bytes) {
		if (bytes >= this.maxBacklogBytes) {
			const clipped = Buffer.from(data, 'utf8').subarray(-this.maxBacklogBytes).toString('utf8');
			runtime.backlog = [clipped];
			runtime.backlogBytes = Buffer.byteLength(clipped, 'utf8');
			return;
		}
		runtime.backlog.push(data);
		runtime.backlogBytes += bytes;
		while (runtime.backlogBytes > this.maxBacklogBytes && runtime.backlog.length > 1) {
			const removed = runtime.backlog.shift();
			runtime.backlogBytes -= Buffer.byteLength(removed, 'utf8');
		}
	}

	broadcast(runtime, message) {
		for (const client of runtime.clients) send(client, message);
	}

	requireLive(id) {
		const runtime = this.sessions.get(id);
		if (!runtime || runtime.finished || runtime.osExited) throw new ProtocolError('not-live', 'This terminal is no longer running.');
		return runtime;
	}

	async stop(id, reason = 'stopped') {
		const runtime = this.sessions.get(id);
		if (!runtime || runtime.finished) return false;
		if (runtime.stopPromise) return runtime.stopPromise;
		runtime.stopReason = reason;
		runtime.stopPromise = (async () => {
			if (this.platform === 'linux') {
				await this.terminateLinuxSession(runtime);
			} else {
				this.signal(runtime, 'SIGTERM');
				if (!await settlesWithin(runtime.osExitPromise, this.stopGraceMs)) {
					this.signal(runtime, 'SIGKILL');
					if (!await settlesWithin(runtime.osExitPromise, this.stopGraceMs)) {
						throw new ProtocolError('stop-timeout', 'The terminal did not exit after SIGKILL.', 1011);
					}
				}
			}
			await runtime.exitPromise;
			return true;
		})().finally(() => { runtime.stopPromise = null; });
		return runtime.stopPromise;
	}

	terminateLinuxSession(runtime) {
		if (runtime.terminationPromise) return runtime.terminationPromise;
		const termination = (async () => {
			if (!await this.signalLinuxSession(runtime, 'SIGTERM') && !await this.signalLinuxSession(runtime, 'SIGKILL')) {
				throw new ProtocolError('stop-timeout', 'The PTY session still has live processes after SIGKILL.', 1011);
			}
		})();
		runtime.terminationPromise = termination;
		termination.catch(() => {
			if (runtime.terminationPromise === termination) runtime.terminationPromise = null;
		});
		return termination;
	}

	async signalLinuxSession(runtime, signal) {
		const deadline = Date.now() + this.stopGraceMs;
		while (true) {
			const processes = await this.listSessionProcesses(runtime.terminal.pid);
			if (!processes.length && !runtime.osExited) runtime.terminal.kill(signal);
			for (const pid of processes) {
				try { this.killProcess(pid, signal); }
				catch (error) { if (error?.code !== 'ESRCH') throw error; }
			}
			if (runtime.osExited && processes.length === 0) return true;
			const remaining = deadline - Date.now();
			if (remaining <= 0) return false;
			await new Promise((resolve) => setTimeout(resolve, Math.min(25, remaining)));
		}
	}

	signal(runtime, signal) {
		if (this.platform === 'win32') {
			runtime.terminal.kill();
			return;
		}
		try {
			this.killProcess(-runtime.terminal.pid, signal);
		} catch (error) {
			if (error?.code === 'ESRCH') return;
			runtime.terminal.kill(signal);
		}
	}

	finish(runtime, exitCode, fallbackReason) {
		if (runtime.finishPromise) return runtime.finishPromise;
		runtime.finishPromise = (async () => {
			if (runtime.finished) return;
			runtime.finished = true;
			runtime.meta.state = 'exited';
			runtime.meta.exitedAt = iso(this.now());
			runtime.meta.exitCode = Number.isInteger(exitCode) ? exitCode : null;
			runtime.meta.exitReason = runtime.stopReason ?? fallbackReason;
			const persistence = this.store.put(runtime.meta);
			this.sessions.delete(runtime.meta.id);
			this.broadcast(runtime, { type: 'exit', exitCode: runtime.meta.exitCode, reason: runtime.meta.exitReason });
			for (const client of runtime.clients) client.close(1000, 'Terminal exited');
			await persistence;
		})();
		return runtime.finishPromise;
	}

	async destroy(id) {
		const runtime = this.sessions.get(id);
		if (runtime) await this.stop(id, 'deleted');
		return this.store.remove(id);
	}

	async sweep(now = this.now()) {
		for (const runtime of [...this.sessions.values()]) {
			const age = now - Date.parse(runtime.meta.createdAt);
			const detachedFor = runtime.meta.detachedAt ? now - Date.parse(runtime.meta.detachedAt) : 0;
			if (age >= this.hardTimeoutMs) await this.stop(runtime.meta.id, 'hard-timeout');
			else if (!runtime.clients.size && detachedFor >= this.idleTimeoutMs) await this.stop(runtime.meta.id, 'idle-timeout');
		}
	}

	async shutdown() {
		await Promise.all([...this.sessions.keys()].map((id) => this.stop(id, 'server-shutdown')));
	}
}
