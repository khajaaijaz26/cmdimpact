import assert from 'node:assert/strict';
import * as pty from 'node-pty';
import { fixedShells } from '../server/index.mjs';

const shell = fixedShells('linux', '/workspace', process.env, { uid: 10002, gid: 10002 }).bash;
assert.ok(shell, 'The container must provide the fixed Bash runner.');

const terminal = pty.spawn(shell.file, shell.args, {
	name: 'xterm-256color', cols: 100, rows: 30, cwd: '/workspace', env: shell.env,
});
let output = '';
terminal.onData((data) => { output += data; });

const probe = `
printf '__UID__=%s\n' "$(id -u)"
printf '__GID__=%s\n' "$(id -g)"
grep -E '^(Groups|CapInh|CapPrm|CapEff|CapAmb|NoNewPrivs):' /proc/self/status
if env | grep -q '^TERMINAL_ACCESS_TOKEN='; then echo '__TOKEN__=present'; else echo '__TOKEN__=absent'; fi
if [ -r /app/.data ]; then echo '__STATE__=readable'; else echo '__STATE__=denied'; fi
if [ -r /proc/1/environ ]; then echo '__PID1_ENV__=readable'; else echo '__PID1_ENV__=denied'; fi
if [ -r "/proc/$PPID/environ" ]; then echo '__PARENT_ENV__=readable'; else echo '__PARENT_ENV__=denied'; fi
if kill -0 1 2>/dev/null; then echo '__PID1_SIGNAL__=allowed'; else echo '__PID1_SIGNAL__=denied'; fi
if touch /workspace/.cmdimpact-probe && rm /workspace/.cmdimpact-probe; then echo '__WORKSPACE__=writable'; fi
echo '__PROBE__=done'
`;
const encoded = Buffer.from(probe).toString('base64');
terminal.write(`eval "$(printf '%s' '${encoded}' | base64 -d)"; exit\n`);

await new Promise((resolve, reject) => {
	const timer = setTimeout(() => {
		terminal.kill();
		reject(new Error('Container PTY probe timed out.'));
	}, 5000);
	terminal.onExit(() => {
		clearTimeout(timer);
		resolve();
	});
});

assert.match(output, /__UID__=10002/);
assert.match(output, /__GID__=10002/);
assert.match(output, /^Groups:\s*$/m);
for (const capability of ['CapInh', 'CapPrm', 'CapEff', 'CapAmb']) {
	assert.match(output, new RegExp(`^${capability}:\\s*0{16}$`, 'm'));
}
assert.match(output, /^NoNewPrivs:\s*1$/m);
assert.match(output, /__TOKEN__=absent/);
assert.match(output, /__STATE__=denied/);
assert.match(output, /__PID1_ENV__=denied/);
assert.match(output, /__PARENT_ENV__=denied/);
assert.match(output, /__PID1_SIGNAL__=denied/);
assert.match(output, /__WORKSPACE__=writable/);
assert.match(output, /__PROBE__=done/);

console.log('Container PTY isolation verified.');
