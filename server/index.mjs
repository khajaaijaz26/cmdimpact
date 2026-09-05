import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as pty from 'node-pty';
import { WebSocketServer } from 'ws';
import { parseAllowedOrigins, originAllowed, createAuthenticator, LoginLimiter } from './security.mjs';
import { MAX_FRAME_BYTES, parseClientMessage, ProtocolError } from './protocol.mjs';
import { SessionStore } from './store.mjs';
import { SessionManager } from './session-manager.mjs';

const MAX_HTTP_BODY_BYTES = 8 * 1024;

function integer(value, fallback, minimum, maximum, name) {
	if (value === undefined || value === '') return fallback;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
	return parsed;
}

function truthy(value) {
	return /^(?:1|true|yes)$/i.test(value ?? '');
}

function accessToken(environment) {
	if (!environment.TERMINAL_ACCESS_TOKEN_FILE) return environment.TERMINAL_ACCESS_TOKEN;
	try {
		return readFileSync(environment.TERMINAL_ACCESS_TOKEN_FILE, 'utf8').trim();
	} catch (error) {
		throw new Error(`Unable to read TERMINAL_ACCESS_TOKEN_FILE: ${error.message}`);
	}
}

function shellEnvironment(platform, shellFile, workspace, source) {
	if (platform === 'win32') {
		const names = ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'USERNAME', 'APPDATA', 'LOCALAPPDATA'];
		return Object.fromEntries([
			...names.flatMap((name) => source[name] ? [[name, source[name]]] : []),
			['TERM', 'xterm-256color'], ['COLORTERM', 'truecolor'],
		]);
	}
	return {
		HOME: workspace,
		XDG_CONFIG_HOME: `${workspace}/.config`,
		XDG_CACHE_HOME: `${workspace}/.cache`,
		NPM_CONFIG_PREFIX: `${workspace}/.local`,
		USER: 'terminal',
		LOGNAME: 'terminal',
		SHELL: shellFile,
		TERM: 'xterm-256color',
		COLORTERM: 'truecolor',
		LANG: source.LANG || 'C.UTF-8',
		PATH: `${workspace}/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
	};
}

export function fixedShells(platform, workspace, environment = process.env, ptyIdentity) {
	if (platform === 'win32') {
		const systemRoot = environment.SystemRoot || environment.WINDIR || 'C:\\Windows';
		const powershell = resolve(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
		const cmd = resolve(systemRoot, 'System32', 'cmd.exe');
		const definitions = {};
		if (existsSync(powershell)) definitions.powershell = { file: powershell, args: ['-NoLogo', '-NoProfile'], env: shellEnvironment(platform, powershell, workspace, environment) };
		const pwsh = environment.ProgramFiles ? resolve(environment.ProgramFiles, 'PowerShell', '7', 'pwsh.exe') : '';
		if (pwsh && existsSync(pwsh)) definitions.pwsh = { file: pwsh, args: ['-NoLogo', '-NoProfile'], env: shellEnvironment(platform, pwsh, workspace, environment) };
		if (existsSync(cmd)) definitions.cmd = { file: cmd, args: [], env: shellEnvironment(platform, cmd, workspace, environment) };
		return definitions;
	}

	const definitions = {};
	const launcher = ptyIdentity ? '/usr/bin/setpriv' : undefined;
	if (launcher && !existsSync(launcher)) throw new Error('The configured PTY identity requires /usr/bin/setpriv.');
	for (const [name, file, args] of [['bash', '/bin/bash', ['--noprofile']], ['sh', '/bin/sh', []]]) {
		if (!existsSync(file)) continue;
		definitions[name] = {
			file: launcher || file,
			args: launcher ? [
				`--reuid=${ptyIdentity.uid}`,
				`--regid=${ptyIdentity.gid}`,
				'--clear-groups',
				'--inh-caps=-all',
				'--ambient-caps=-all',
				'--no-new-privs',
				'--',
				file,
				...args,
			] : args,
			env: shellEnvironment(platform, file, workspace, environment),
		};
	}
	return definitions;
}

export function loadConfig(environment) {
	const production = environment.NODE_ENV === 'production';
	if (production && !environment.TERMINAL_ALLOWED_ORIGINS) throw new Error('TERMINAL_ALLOWED_ORIGINS is required in production.');
	const allowedOrigins = parseAllowedOrigins(environment.TERMINAL_ALLOWED_ORIGINS);
	const insecureOrigins = [...allowedOrigins].filter((origin) => new URL(origin).protocol !== 'https:');
	const localHttpOriginsOnly = [...allowedOrigins].every((origin) => {
		const url = new URL(origin);
		return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
	});
	if (production && insecureOrigins.length && !(truthy(environment.TERMINAL_ALLOW_INSECURE_LOCALHOST) && localHttpOriginsOnly)) {
		throw new Error('Production origins must use HTTPS, or be all loopback HTTP with TERMINAL_ALLOW_INSECURE_LOCALHOST enabled.');
	}
	const ptyUid = integer(environment.TERMINAL_PTY_UID, undefined, 1, 2_147_483_647, 'TERMINAL_PTY_UID');
	const ptyGid = integer(environment.TERMINAL_PTY_GID, undefined, 1, 2_147_483_647, 'TERMINAL_PTY_GID');
	if ((ptyUid === undefined) !== (ptyGid === undefined)) throw new Error('TERMINAL_PTY_UID and TERMINAL_PTY_GID must be set together.');
	const workspace = resolve(environment.TERMINAL_WORKSPACE || 'workspace');
	return {
		production,
		accessToken: accessToken(environment),
		allowedOrigins,
		secureCookie: insecureOrigins.length === 0,
		host: environment.TERMINAL_HOST || (production ? '0.0.0.0' : '127.0.0.1'),
		port: integer(environment.TERMINAL_PORT, 8787, 0, 65535, 'TERMINAL_PORT'),
		workspace,
		stateFile: resolve(environment.TERMINAL_STATE_FILE || '.data/sessions.json'),
		ptyIdentity: ptyUid === undefined ? undefined : { uid: ptyUid, gid: ptyGid },
		trustProxy: truthy(environment.TRUST_PROXY),
		limits: {
			maxSessions: integer(environment.TERMINAL_MAX_SESSIONS, 4, 1, 16, 'TERMINAL_MAX_SESSIONS'),
			idleTimeoutMs: integer(environment.TERMINAL_IDLE_MINUTES, 30, 1, 1440, 'TERMINAL_IDLE_MINUTES') * 60_000,
			hardTimeoutMs: integer(environment.TERMINAL_HARD_HOURS, 8, 1, 168, 'TERMINAL_HARD_HOURS') * 60 * 60_000,
			maxBacklogBytes: 256 * 1024,
			maxOutputBytesPerSecond: 1024 * 1024,
			maxInputBytesPerSecond: 128 * 1024,
		},
		cookieHours: integer(environment.TERMINAL_COOKIE_HOURS, 12, 1, 168, 'TERMINAL_COOKIE_HOURS'),
	};
}

async function readJson(request) {
	const contentType = request.headers['content-type'] || '';
	if (!contentType.toLowerCase().startsWith('application/json')) throw new ProtocolError('content-type', 'Content-Type must be application/json.');
	const declared = Number(request.headers['content-length'] || 0);
	if (declared > MAX_HTTP_BODY_BYTES) throw new ProtocolError('body-too-large', 'Request body is too large.', 1009);
	let body = '';
	for await (const chunk of request) {
		body += chunk;
		if (Buffer.byteLength(body, 'utf8') > MAX_HTTP_BODY_BYTES) throw new ProtocolError('body-too-large', 'Request body is too large.', 1009);
	}
	if (!body) return {};
	let parsed;
	try { parsed = JSON.parse(body); }
	catch { throw new ProtocolError('invalid-json', 'Request body must be valid JSON.'); }
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ProtocolError('invalid-json', 'Request body must be a JSON object.');
	return parsed;
}

function remoteAddress(request, trustProxy) {
	if (trustProxy) {
		const forwarded = request.headers['x-forwarded-for'];
		if (typeof forwarded === 'string' && forwarded.length < 256) return forwarded.split(',')[0].trim();
	}
	return request.socket.remoteAddress || 'unknown';
}

function responseHeaders(request, allowedOrigins) {
	const headers = {
		'Cache-Control': 'no-store',
		'Content-Type': 'application/json; charset=utf-8',
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'no-referrer',
	};
	const origin = request.headers.origin;
	if (originAllowed(origin, allowedOrigins)) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers['Access-Control-Allow-Credentials'] = 'true';
		headers.Vary = 'Origin';
	}
	return headers;
}

function json(request, response, allowedOrigins, status, body, extraHeaders = {}) {
	response.writeHead(status, { ...responseHeaders(request, allowedOrigins), ...extraHeaders });
	response.end(JSON.stringify(body));
}

function rejectUpgrade(socket, status, message) {
	const reason = status === 400 ? 'Bad Request' : status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Service Unavailable';
	const body = JSON.stringify({ error: message });
	socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

export async function createTerminalService({ environment = process.env, ptyModule = pty } = {}) {
	const config = loadConfig(environment);
	const auth = createAuthenticator(config.accessToken, {
		secure: config.secureCookie,
		maxAgeSeconds: config.cookieHours * 60 * 60,
	});
	if (environment === process.env) {
		process.env.TERMINAL_ACCESS_TOKEN = '';
		delete process.env.TERMINAL_ACCESS_TOKEN;
	}
	config.accessToken = undefined;

	const shells = fixedShells(process.platform, config.workspace, environment, config.ptyIdentity);
	if (!Object.keys(shells).length) throw new Error('No supported shell was found.');
	const store = new SessionStore(config.stateFile);
	await store.load();
	const reportBackgroundError = (error) => console.error('Terminal background operation failed:', error?.message || 'unknown error');
	const manager = new SessionManager({
		pty: ptyModule,
		store,
		shells,
		workspace: config.workspace,
		limits: config.limits,
		onError: reportBackgroundError,
	});
	await manager.initialize();
	const loginLimiter = new LoginLimiter();

	const server = createServer(async (request, response) => {
		const origin = request.headers.origin;
		let url;
		try { url = new URL(request.url || '/', 'http://localhost'); }
		catch { return json(request, response, config.allowedOrigins, 400, { error: 'Invalid request URL.' }); }
		if (request.method === 'OPTIONS') {
			if (!originAllowed(origin, config.allowedOrigins)) return json(request, response, config.allowedOrigins, 403, { error: 'Origin not allowed.' });
			response.writeHead(204, {
				...responseHeaders(request, config.allowedOrigins),
				'Access-Control-Allow-Headers': 'Content-Type',
				'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
				'Access-Control-Max-Age': '600',
			});
			return response.end();
		}

		try {
			if (request.method === 'GET' && url.pathname === '/api/health') {
				return json(request, response, config.allowedOrigins, 200, { ok: true, service: 'cmdimpact-terminal', version: 1 });
			}

			if (request.method === 'POST' && url.pathname === '/api/auth/login') {
				if (!originAllowed(origin, config.allowedOrigins)) return json(request, response, config.allowedOrigins, 403, { error: 'Origin not allowed.' });
				const address = remoteAddress(request, config.trustProxy);
				const body = await readJson(request);
				if (!auth.verifyAccessToken(body.token)) {
					if (!loginLimiter.allow(address)) return json(request, response, config.allowedOrigins, 429, { error: 'Too many login attempts. Try again later.' });
					loginLimiter.recordFailure(address);
					return json(request, response, config.allowedOrigins, 401, { error: 'Invalid access token.' });
				}
				loginLimiter.reset(address);
				return json(request, response, config.allowedOrigins, 200, { authenticated: true }, { 'Set-Cookie': auth.issueCookie() });
			}

			if (request.method === 'GET' && ['/api/me', '/api/auth/session'].includes(url.pathname)) {
				const authenticated = auth.verifyCookie(request.headers.cookie || '');
				return json(request, response, config.allowedOrigins, 200, {
					authenticated,
					shells: authenticated ? manager.availableShells() : [],
				});
			}

			if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
				if (!originAllowed(origin, config.allowedOrigins)) return json(request, response, config.allowedOrigins, 403, { error: 'Origin not allowed.' });
				if (!auth.verifyCookie(request.headers.cookie || '')) return json(request, response, config.allowedOrigins, 401, { error: 'Authentication required.' });
				for (const websocket of wss.clients) websocket.close(1008, 'Signed out');
				return json(request, response, config.allowedOrigins, 200, { authenticated: false }, { 'Set-Cookie': auth.clearCookie() });
			}

			if (!auth.verifyCookie(request.headers.cookie || '')) return json(request, response, config.allowedOrigins, 401, { error: 'Authentication required.' });
			if (['POST', 'PATCH', 'DELETE'].includes(request.method || '') && !originAllowed(origin, config.allowedOrigins)) {
				return json(request, response, config.allowedOrigins, 403, { error: 'Origin not allowed.' });
			}

			if (request.method === 'GET' && url.pathname === '/api/sessions') {
				return json(request, response, config.allowedOrigins, 200, { sessions: manager.list(), shells: manager.availableShells() });
			}
			if (request.method === 'POST' && url.pathname === '/api/sessions') {
				const body = await readJson(request);
				const session = await manager.create({ name: body.name, shell: body.shell, cols: body.cols, rows: body.rows });
				return json(request, response, config.allowedOrigins, 201, { session });
			}

			const match = url.pathname.match(/^\/api\/sessions\/([0-9a-f-]+)(?:\/(stop))?$/i);
			if (match) {
				const [, id, action] = match;
				if (request.method === 'GET' && !action) {
					const session = manager.get(id);
					return session ? json(request, response, config.allowedOrigins, 200, { session }) : json(request, response, config.allowedOrigins, 404, { error: 'Session not found.' });
				}
				if (request.method === 'PATCH' && !action) {
					const body = await readJson(request);
					return json(request, response, config.allowedOrigins, 200, { session: await manager.rename(id, body.name) });
				}
				if (request.method === 'POST' && action === 'stop') {
					const stopped = await manager.stop(id);
					return json(request, response, config.allowedOrigins, stopped ? 200 : 404, stopped ? { stopped: true } : { error: 'Live session not found.' });
				}
				if (request.method === 'DELETE' && !action) {
					const removed = await manager.destroy(id);
					return json(request, response, config.allowedOrigins, removed ? 200 : 404, removed ? { deleted: true } : { error: 'Session not found.' });
				}
			}

			return json(request, response, config.allowedOrigins, 404, { error: 'Not found.' });
		} catch (error) {
			if (error instanceof ProtocolError) {
				const status = error.code === 'not-found' ? 404 : error.code === 'session-limit' ? 409 : error.code.includes('too-large') ? 413 : 400;
				return json(request, response, config.allowedOrigins, status, { error: error.message, code: error.code });
			}
			console.error('Terminal request failed:', error?.message || 'unknown error');
			return json(request, response, config.allowedOrigins, 500, { error: 'Internal server error.' });
		}
	});

	const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES, perMessageDeflate: false, clientTracking: true });
	server.on('upgrade', (request, socket, head) => {
		let url;
		try { url = new URL(request.url || '/', 'http://localhost'); }
		catch { return rejectUpgrade(socket, 400, 'Invalid request URL.'); }
		if (url.pathname !== '/ws') return rejectUpgrade(socket, 403, 'Unknown WebSocket endpoint.');
		if (!originAllowed(request.headers.origin, config.allowedOrigins)) return rejectUpgrade(socket, 403, 'Origin not allowed.');
		if (!auth.verifyCookie(request.headers.cookie || '')) return rejectUpgrade(socket, 401, 'Authentication required.');
		if (wss.clients.size >= config.limits.maxSessions * 3) return rejectUpgrade(socket, 503, 'Connection limit reached.');
		wss.handleUpgrade(request, socket, head, (websocket) => wss.emit('connection', websocket, request));
	});

	wss.on('connection', (websocket, request) => {
		websocket.on('error', reportBackgroundError);
		websocket.isAlive = true;
		websocket.authCookie = request.headers.cookie || '';
		let attachedId;
		let pendingAttachedId;
		let queue = Promise.resolve();
		const client = {
			writable: false,
			maxBufferedBytes: 512 * 1024,
			isOpen: () => websocket.readyState === 1,
			bufferedBytes: () => websocket.bufferedAmount,
			send: (message) => websocket.send(JSON.stringify(message)),
			close: (code, reason) => websocket.close(code, reason),
		};
		websocket.send(JSON.stringify({ type: 'hello', protocol: 1, attachWithinMs: 10_000 }));
		const attachTimer = setTimeout(() => websocket.close(1008, 'Attach timeout'), 10_000);

		websocket.on('pong', () => { websocket.isAlive = true; });
		websocket.on('message', (data, isBinary) => {
			queue = queue.then(async () => {
				const message = parseClientMessage(data, isBinary);
				if (!attachedId) {
					if (message.type !== 'attach') throw new ProtocolError('attach-required', 'Attach to a session first.');
					pendingAttachedId = message.sessionId;
					try {
						await manager.attach(message.sessionId, client, { takeover: message.takeover });
						attachedId = message.sessionId;
					} catch (error) {
						await manager.detach(message.sessionId, client).catch(reportBackgroundError);
						throw error;
					} finally {
						pendingAttachedId = undefined;
					}
					clearTimeout(attachTimer);
					return;
				}

				switch (message.type) {
					case 'input': manager.write(attachedId, client, message.data); break;
					case 'resize': manager.resize(attachedId, client, message.cols, message.rows); break;
					case 'take-control': manager.takeControl(attachedId, client); break;
					case 'detach': websocket.close(1000, 'Detached'); break;
					case 'ping': client.send({ type: 'pong', nonce: message.nonce }); break;
					default: throw new ProtocolError('already-attached', 'This connection is already attached.');
				}
			}).catch((error) => {
				const protocolError = error instanceof ProtocolError ? error : new ProtocolError('server-error', 'Terminal operation failed.', 1011);
				if (client.isOpen()) client.send({ type: 'error', code: protocolError.code, message: protocolError.message });
				if (!attachedId || [1003, 1009, 1011].includes(protocolError.closeCode)) websocket.close(protocolError.closeCode, protocolError.message.slice(0, 100));
			});
		});

		websocket.on('close', () => {
			clearTimeout(attachTimer);
			const sessionId = attachedId || pendingAttachedId;
			if (sessionId) manager.detach(sessionId, client).catch(reportBackgroundError);
		});
	});

	const heartbeat = setInterval(() => {
		for (const websocket of wss.clients) {
			if (!auth.verifyCookie(websocket.authCookie || '')) websocket.close(1008, 'Session expired');
			else if (!websocket.isAlive) websocket.terminate();
			else {
				websocket.isAlive = false;
				websocket.ping();
			}
		}
	}, 30_000);
	const sweeper = setInterval(() => manager.sweep().catch(reportBackgroundError), 30_000);
	for (const timer of [heartbeat, sweeper]) timer.unref();

	let stopping;
	async function stop() {
		if (stopping) return stopping;
		stopping = (async () => {
			clearInterval(heartbeat);
			clearInterval(sweeper);
			for (const websocket of wss.clients) websocket.close(1001, 'Server stopping');
			await manager.shutdown();
			await new Promise((resolveClose) => server.close(resolveClose));
		})();
		return stopping;
	}

	return {
		server,
		manager,
		config: { ...config, accessToken: undefined },
		start: () => new Promise((resolveStart, reject) => {
			server.once('error', reject);
			server.listen(config.port, config.host, () => {
				server.off('error', reject);
				resolveStart(server.address());
			});
		}),
		stop,
	};
}

async function main() {
	const service = await createTerminalService();
	const address = await service.start();
	console.log(`CmdImpact terminal service listening on ${typeof address === 'string' ? address : `${address.address}:${address.port}`}`);
	let closing = false;
	const close = async () => {
		if (closing) return;
		closing = true;
		await service.stop();
	};
	process.on('SIGINT', () => close().catch((error) => console.error(`Terminal shutdown failed: ${error.message}`)));
	process.on('SIGTERM', () => close().catch((error) => console.error(`Terminal shutdown failed: ${error.message}`)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error(`Terminal service failed: ${error.message}`);
		process.exitCode = 1;
	});
}
