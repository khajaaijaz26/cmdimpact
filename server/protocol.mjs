export const PROTOCOL_VERSION = 1;
export const MAX_FRAME_BYTES = 64 * 1024;
export const MAX_INPUT_BYTES = 32 * 1024;
export const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProtocolError extends Error {
	constructor(code, message, closeCode = 1008) {
		super(message);
		this.name = 'ProtocolError';
		this.code = code;
		this.closeCode = closeCode;
	}
}

function object(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function terminalSize(message) {
	const cols = Number(message.cols);
	const rows = Number(message.rows);
	if (!Number.isInteger(cols) || cols < 20 || cols > 400 || !Number.isInteger(rows) || rows < 5 || rows > 200) {
		throw new ProtocolError('invalid-size', 'Terminal size is outside the supported range.');
	}
	return { cols, rows };
}

export function cleanSessionName(value) {
	if (value === undefined || value === null || value === '') return undefined;
	if (typeof value !== 'string') throw new ProtocolError('invalid-name', 'Session name must be text.');
	const name = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
	if (!name || name.length > 64) throw new ProtocolError('invalid-name', 'Session name must be between 1 and 64 characters.');
	return name;
}

export function parseClientMessage(data, isBinary = false) {
	if (isBinary) throw new ProtocolError('binary-not-supported', 'Binary client frames are not supported.', 1003);
	const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
	if (bytes.byteLength > MAX_FRAME_BYTES) throw new ProtocolError('frame-too-large', 'WebSocket frame is too large.', 1009);

	let message;
	try {
		message = JSON.parse(bytes.toString('utf8'));
	} catch {
		throw new ProtocolError('invalid-json', 'Message must be valid JSON.');
	}
	if (!object(message) || typeof message.type !== 'string') throw new ProtocolError('invalid-message', 'Message type is required.');

	switch (message.type) {
		case 'attach':
			if (typeof message.sessionId !== 'string' || !SESSION_ID_PATTERN.test(message.sessionId)) {
				throw new ProtocolError('invalid-session', 'A valid session ID is required.');
			}
			return { type: 'attach', sessionId: message.sessionId, takeover: message.takeover === true };
		case 'input': {
			if (typeof message.data !== 'string') throw new ProtocolError('invalid-input', 'Terminal input must be text.');
			if (Buffer.byteLength(message.data, 'utf8') > MAX_INPUT_BYTES) {
				throw new ProtocolError('input-too-large', 'Terminal input is too large.', 1009);
			}
			return { type: 'input', data: message.data };
		}
		case 'resize':
			return { type: 'resize', ...terminalSize(message) };
		case 'take-control':
			return { type: 'take-control' };
		case 'detach':
			return { type: 'detach' };
		case 'ping':
			return { type: 'ping', nonce: typeof message.nonce === 'string' ? message.nonce.slice(0, 64) : undefined };
		default:
			throw new ProtocolError('unknown-message', 'Unknown message type.');
	}
}
