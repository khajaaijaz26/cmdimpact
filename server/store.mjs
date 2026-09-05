import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const STATES = new Set(['running', 'detached', 'exited']);
const MAX_EXITED_RECORDS = 100;

function validRecord(value) {
	return value && typeof value === 'object' && typeof value.id === 'string' && typeof value.name === 'string' && STATES.has(value.state);
}

function recordTime(record) {
	const timestamp = Date.parse(record.exitedAt || record.createdAt);
	return Number.isFinite(timestamp) ? timestamp : 0;
}

export class SessionStore {
	constructor(filePath) {
		this.filePath = filePath;
		this.records = new Map();
		this.writeQueue = Promise.resolve();
		this.directoryReady = null;
	}

	prepareDirectory() {
		if (!this.directoryReady) {
			const directory = dirname(this.filePath);
			this.directoryReady = mkdir(directory, { recursive: true, mode: 0o700 })
				.then(() => chmod(directory, 0o700));
		}
		return this.directoryReady;
	}

	async load(now = Date.now()) {
		await this.prepareDirectory();
		let parsed;
		try {
			await chmod(this.filePath, 0o600);
			parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
		} catch (error) {
			if (error?.code === 'ENOENT') return;
			throw new Error(`Unable to read terminal session metadata: ${error.message}`);
		}
		if (!Array.isArray(parsed)) throw new Error('Terminal session metadata must be an array.');
		for (const item of parsed) {
			if (!validRecord(item)) continue;
			const record = structuredClone(item);
			if (record.state === 'running' || record.state === 'detached') {
				record.state = 'exited';
				record.exitedAt = new Date(now).toISOString();
				record.exitReason = 'server-restarted';
			}
			this.records.set(record.id, record);
		}
		this.pruneExited();
		await this.persist();
	}

	list() {
		return [...this.records.values()]
			.map((record) => structuredClone(record))
			.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
	}

	get(id) {
		const record = this.records.get(id);
		return record ? structuredClone(record) : undefined;
	}

	async put(record) {
		this.records.set(record.id, structuredClone(record));
		this.pruneExited();
		await this.persist();
		return this.get(record.id);
	}

	pruneExited() {
		const expired = [...this.records.values()]
			.filter((record) => record.state === 'exited')
			.sort((left, right) => recordTime(right) - recordTime(left))
			.slice(MAX_EXITED_RECORDS);
		for (const record of expired) this.records.delete(record.id);
	}

	async remove(id) {
		const removed = this.records.delete(id);
		if (removed) await this.persist();
		return removed;
	}

	async persist() {
		const snapshot = JSON.stringify(this.list(), null, 2);
		const write = this.writeQueue.then(async () => {
			await this.prepareDirectory();
			const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
			await writeFile(temporary, `${snapshot}\n`, { encoding: 'utf8', mode: 0o600 });
			await rename(temporary, this.filePath);
		});
		this.writeQueue = write.catch(() => {});
		return write;
	}
}
