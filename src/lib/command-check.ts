export const commandCategories = [
	'install',
	'download',
	'delete',
	'overwrite',
	'elevation',
	'network',
	'secret',
	'other',
] as const;

export type CommandCategory = (typeof commandCategories)[number];
export type CommandShell = 'bash' | 'powershell' | 'mixed' | 'unknown';
export type CommandRisk = 'none' | 'review' | 'high';
export type FindingCode =
	| 'package-install'
	| 'download'
	| 'delete'
	| 'recursive-delete'
	| 'overwrite'
	| 'elevation'
	| 'network'
	| 'literal-secret'
	| 'remote-execution'
	| 'permission-change'
	| 'process-or-service-change'
	| 'system-change'
	| 'inline-or-encoded-execution'
	| 'source-control-change'
	| 'deployment-change'
	| 'database-change'
	| 'dangerous-container'
	| 'command-review';

export type CommandFinding = {
	code: FindingCode;
	category: CommandCategory;
	severity: Exclude<CommandRisk, 'none'>;
	title: string;
	detail: string;
	evidence: string;
	line: number;
};

export type CommandAction = {
	command: string;
	evidence: string;
	line: number;
	categories: CommandCategory[];
};

export type CommandReport = {
	shell: CommandShell;
	risk: CommandRisk;
	truncated: boolean;
	actions: CommandAction[];
	findings: CommandFinding[];
};

const MAX_INPUT_LENGTH = 50_000;
const EVIDENCE_LENGTH = 180;

const INSTALL_PATTERN = new RegExp(
	[
		String.raw`\b(?:npm|pnpm|bun)\s+(?:i|install|add|ci)\b`,
		String.raw`\byarn\s+(?:add|install)\b`,
		String.raw`\b(?:pip3?|pipx)\s+install\b`,
		String.raw`\b(?:apt(?:-get)?|apk|dnf|yum|zypper|brew|port|choco|scoop|winget)\s+install\b`,
		String.raw`\b(?:cargo|gem|go)\s+install\b`,
		String.raw`\bcomposer\s+(?:install|require)\b`,
		String.raw`\bdotnet\s+(?:tool|workload)\s+install\b`,
		String.raw`\buv\s+(?:add|sync)\b`,
		String.raw`\bInstall-(?:Module|Package|Script)\b`,
		String.raw`\b(?:npx|bunx)\b|\bpnpm\s+dlx\b`,
	].join('|'),
	'i',
);
const DOWNLOAD_PATTERN =
	/\b(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|iwr|irm)\b|\bgit\s+clone\b|\b(?:docker|podman)\s+pull\b/i;
const NETWORK_PATTERN =
	/\b(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|iwr|irm|ssh|scp|sftp|ftp|telnet|Test-NetConnection)\b|\bgit\s+(?:clone|fetch|pull|push)\b|\b(?:docker|podman)\s+(?:pull|push)\b/i;
const SECRET_NAME = String.raw`(?:[a-z_][a-z0-9_-]{0,63})?(?:api[_-]?key|token|secret|password|passwd|credentials?|private[_-]?key|access[_-]?key)(?:[a-z0-9_-]{0,32})`;
const SECRET_ASSIGNMENT_QUOTED = new RegExp(
	String.raw`(?:export\s+)?(?:\$(?:env:)?)?(${SECRET_NAME})\s*=\s*(["'])(.*?)\2`,
	'i',
);
const SECRET_ASSIGNMENT_UNQUOTED = new RegExp(
	String.raw`(?:export\s+)?(?:\$(?:env:)?)?(${SECRET_NAME})\s*=\s*([^\s;|]+)`,
	'i',
);
const SECRET_OPTION_QUOTED = new RegExp(
	String.raw`(--?(?:api[-_]?key|token|secret|password|passwd)|-(?:ApiKey|Token|Secret|Password))\s*(?:=\s*|\s+)(["'])(.*?)\2`,
	'i',
);
const SECRET_OPTION_UNQUOTED = new RegExp(
	String.raw`(--?(?:api[-_]?key|token|secret|password|passwd)|-(?:ApiKey|Token|Secret|Password))\s*(?:=\s*|\s+)([^\s;|]+)`,
	'i',
);
const KNOWN_SECRET_PATTERN =
	/\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{16,})\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/i;

function detectShell(source: string): CommandShell {
	const powershell = [
		/\$(?:env:)?[A-Za-z_]/i,
		/\b(?:Get|Set|Remove|Invoke|Start|New|Copy|Move|Install|Out|Write|Clear)-[A-Za-z]+\b/i,
		/-(?:LiteralPath|Recurse|Force|OutFile|Verb)\b/i,
	].filter((pattern) => pattern.test(source)).length;
	const bash = [
		/^\s*#!\s*\/.*\b(?:ba|z|fi)?sh\b/m,
		/\b(?:sudo|doas|apt-get|chmod|chown|grep|sed)\b/,
		/(?:^|\s)(?:export\s+|rm\s+-)/m,
		/\$\([^)]*\)/,
	].filter((pattern) => pattern.test(source)).length;

	if (powershell && bash) return 'mixed';
	if (powershell) return 'powershell';
	if (bash) return 'bash';
	return 'unknown';
}

function stripComment(line: string): string {
	let quote = '';
	for (let index = 0; index < line.length; index += 1) {
		const character = line[index];
		if (quote) {
			if ((character === '\\' || character === '`') && quote === '"') index += 1;
			else if (character === quote) quote = '';
			continue;
		}
		if (character === '"' || character === "'") quote = character;
		else if (character === '#' && (index === 0 || /\s/.test(line[index - 1] ?? ''))) return line.slice(0, index);
	}
	return line;
}

function splitCommands(line: string): string[] {
	const commands: string[] = [];
	let current = '';
	let quote = '';

	for (let index = 0; index < line.length; index += 1) {
		const character = line[index];
		if (quote) {
			current += character;
			if ((character === '\\' || character === '`') && quote === '"' && index + 1 < line.length) {
				current += line[index + 1];
				index += 1;
			} else if (character === quote) quote = '';
			continue;
		}
		if (character === '"' || character === "'") {
			quote = character;
			current += character;
			continue;
		}

		const pair = line.slice(index, index + 2);
		if (character === ';' || character === '|' || pair === '&&' || pair === '||') {
			if (current.trim()) commands.push(current.trim());
			current = '';
			if (pair === '&&' || pair === '||') index += 1;
			continue;
		}
		current += character;
	}

	if (current.trim()) commands.push(current.trim());
	return commands;
}

function stripQuotedText(value: string): string {
	let result = '';
	let quote = '';
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (quote) {
			if ((character === '\\' || character === '`') && quote === '"' && index + 1 < value.length) index += 1;
			else if (character === quote) quote = '';
			result += ' ';
		} else if (character === '"' || character === "'") {
			quote = character;
			result += ' ';
		} else result += character;
	}
	return result;
}

function stripLeadingAssignments(value: string): string {
	return value.replace(/^(?:(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+)\s+)+/, '');
}

function commandName(command: string): string {
	let value = command.trim().replace(/^&\s*/, '');
	value = stripLeadingAssignments(value);
	value = value.replace(/^(?:(?:sudo|doas|gsudo|command)\s+)+/i, '');
	value = stripLeadingAssignments(value);
	return value.match(/^[^\s(){}]+/)?.[0]?.replace(/^['"]|['"]$/g, '') ?? 'command';
}

function placeholder(value: string): boolean {
	const normalized = value.trim().replace(/^['"]|['"]$/g, '');
	return (
		!normalized ||
		/^\$|^%[^%]+%$|^<[^>]+>$/.test(normalized) ||
		/^(?:x+|\*+|\.{3}|redacted)$/i.test(normalized) ||
		/(?:your[_-]|replace|change[_-]?me|example|placeholder|secrets\.)/i.test(normalized)
	);
}

function literalSecret(command: string): string | undefined {
	for (const pattern of [SECRET_ASSIGNMENT_QUOTED, SECRET_ASSIGNMENT_UNQUOTED]) {
		const match = command.match(pattern);
		if (match && !placeholder(match[3] ?? match[2] ?? '')) return match[1];
	}
	for (const pattern of [SECRET_OPTION_QUOTED, SECRET_OPTION_UNQUOTED]) {
		const match = command.match(pattern);
		if (match && !placeholder(match[3] ?? match[2] ?? '')) return match[1];
	}
	const authorization = command.match(/\bAuthorization\s*:\s*(?:Bearer|Basic)\s+([^\s"']+)/i);
	if (authorization && !placeholder(authorization[1])) return 'authorization header';
	if (KNOWN_SECRET_PATTERN.test(command)) return 'credential-shaped value';
	if (/https?:\/\/[^\s/:]+:[^\s/@]+@/i.test(command)) return 'URL password';
	return undefined;
}

function redactEvidence(command: string): string {
	let evidence = command;
	const quotedAssignment = new RegExp(
		String.raw`((?:export\s+)?(?:\$(?:env:)?)?${SECRET_NAME}\s*=\s*)(["'])(.*?)\2`,
		'gi',
	);
	const unquotedAssignment = new RegExp(
		String.raw`((?:export\s+)?(?:\$(?:env:)?)?${SECRET_NAME}\s*=\s*)([^\s;|]+)`,
		'gi',
	);
	const quotedOption = new RegExp(
		String.raw`((?:--?(?:api[-_]?key|token|secret|password|passwd)|-(?:ApiKey|Token|Secret|Password))\s*(?:=\s*|\s+))(["'])(.*?)\2`,
		'gi',
	);
	const unquotedOption = new RegExp(
		String.raw`((?:--?(?:api[-_]?key|token|secret|password|passwd)|-(?:ApiKey|Token|Secret|Password))\s*(?:=\s*|\s+))([^\s;|]+)`,
		'gi',
	);

	evidence = evidence
		.replace(quotedAssignment, (_match, prefix: string, quote: string) => `${prefix}${quote}[redacted]${quote}`)
		.replace(unquotedAssignment, '$1[redacted]')
		.replace(quotedOption, (_match, prefix: string, quote: string) => `${prefix}${quote}[redacted]${quote}`)
		.replace(unquotedOption, '$1[redacted]')
		.replace(/((?:Bearer|Basic)\s+)[A-Za-z0-9._~+/=-]{6,}/gi, '$1[redacted]')
		.replace(/(https?:\/\/[^\s/:]+:)[^\s/@]+@/gi, '$1[redacted]@')
		.replace(/\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{16,})\b/gi, '[redacted credential]')
		.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/gi, '[redacted private-key header]')
		.replace(/\s+/g, ' ')
		.trim();
	return evidence.length > EVIDENCE_LENGTH ? `${evidence.slice(0, EVIDENCE_LENGTH - 1)}…` : evidence;
}

function inspectCommand(command: string, line: number): CommandFinding[] {
	const evidence = redactEvidence(command);
	const findings: CommandFinding[] = [];
	const executable = commandName(command).toLowerCase();
	const textOnly = ['echo', 'printf', 'write-output', 'write-host', 'grep', 'rg', 'findstr', 'select-string'].includes(executable);
	const unquotedSource = stripQuotedText(command);
	const patternSource = textOnly ? executable : unquotedSource;
	const add = (
		code: FindingCode,
		category: CommandCategory,
		severity: Exclude<CommandRisk, 'none'>,
		title: string,
		detail: string,
	) => findings.push({ code, category, severity, title, detail, evidence, line });

	if (INSTALL_PATTERN.test(patternSource)) {
		add('package-install', 'install', 'review', 'Package installation', 'This appears to install or run a package. Review its source, name, version, and installation scope.');
	}
	if (DOWNLOAD_PATTERN.test(patternSource)) {
		add('download', 'download', 'review', 'Remote download', 'This can retrieve data or code from a remote location. Confirm the source before running it.');
	}

	const findDelete = executable === 'find' && /(?:^|\s)-delete(?:\s|$)/i.test(command);
	const deletes = ['rm', 'rmdir', 'unlink', 'shred', 'del', 'erase', 'rd', 'remove-item', 'ri'].includes(executable) || /^git\s+clean\b/i.test(command) || findDelete;
	if (deletes) {
		const forceful = /\brm\s+-[a-z]*[rf]|\brm\s+--(?:recursive|force)|\bRemove-Item\b[^\r\n]*(?:-Recurse|-Force)|\b(?:rmdir|rd)\s+\/s\b|\bgit\s+clean\b[^\r\n]*-[a-z]*f|\bshred\b/i.test(command) || findDelete;
		add(
			forceful ? 'recursive-delete' : 'delete',
			'delete',
			forceful ? 'high' : 'review',
			forceful ? 'Forceful deletion' : 'File deletion',
			forceful
				? 'This appears able to recursively or forcibly delete data. Verify the fully resolved target and recovery plan.'
				: 'This may delete files or directories. Confirm the target before running it.',
		);
	}

	const redirects = /(^|[^>])>(?![>&=])\s*[^\s]/.test(unquotedSource);
	const writes =
		['set-content', 'clear-content', 'out-file', 'truncate', 'tee'].includes(executable) ||
		redirects ||
		/\bsed\s+[^\r\n]*-[a-z]*i\b|\bgit\s+reset\s+--hard\b|\bgit\s+(?:checkout\s+--|restore\b)|\b(?:Copy-Item|Move-Item)\b[^\r\n]*-Force\b/i.test(patternSource);
	if (writes) {
		const high = /\bgit\s+reset\s+--hard\b/i.test(command);
		const appends = (executable === 'tee' && /(?:^|\s)-(?:[a-z]*a[a-z]*|-[a-z-]*append)(?:\s|$)/i.test(command)) || (executable === 'out-file' && /(?:^|\s)-Append\b/i.test(command));
		add(
			'overwrite',
			'overwrite',
			high ? 'high' : 'review',
			appends ? 'File content will be appended' : 'Existing data may change',
			appends
				? 'This may add content to an existing file. Confirm the destination and the data being added.'
				: 'This may replace or rewrite existing file contents. Confirm the destination and preserve anything needed.',
		);
	}

	if (/^(?:chmod|chown|chgrp|icacls|takeown|set-acl)\b/i.test(executable)) {
		add('permission-change', 'overwrite', 'review', 'Permissions or ownership may change', 'This can change who may read, modify, or execute files. Confirm the target and intended access.');
	}

	if (/^(?:kill|pkill|killall|taskkill|stop-process|systemctl|service|sc(?:\.exe)?|launchctl|schtasks|crontab)\b/i.test(executable)) {
		add('process-or-service-change', 'overwrite', 'review', 'Process or service operation', 'This may stop, restart, configure, or schedule a process. Check the exact target and scope.');
	}

	if (/^(?:mount|umount|mkfs(?:\.[a-z0-9]+)?|fdisk|parted|diskpart|reg(?:\.exe)?|set-executionpolicy|ufw|iptables|nft|firewall-cmd)\b/i.test(executable)) {
		add('system-change', 'elevation', 'high', 'System configuration may change', 'This can affect disks, startup policy, the registry, mounts, or network security for the machine.');
	}

	const encodedExecution =
		/\b(?:pwsh|powershell)(?:\.exe)?\b[^\r\n]*(?:-(?:e|enc|encodedcommand)\b)/i.test(patternSource) ||
		/\b(?:eval|Invoke-Expression)\b/i.test(patternSource) ||
		/\bbase64\b[^|;\r\n]*(?:-d|--decode)[^|;\r\n]*\|/i.test(patternSource);
	const inlineExecution =
		/^(?:node|deno|bun|python3?|ruby|perl|php)\b[^\r\n]*(?:\s-(?:e|c)\s)/i.test(patternSource) ||
		/^(?:bash|sh|zsh|pwsh|powershell)(?:\.exe)?\b[^\r\n]*\s-(?:c|command)\b/i.test(patternSource);
	if (encodedExecution || inlineExecution) {
		add(
			'inline-or-encoded-execution',
			'other',
			encodedExecution ? 'high' : 'review',
			encodedExecution ? 'Hidden or dynamic code may run' : 'Inline code will run',
			encodedExecution
				? 'Decoded, evaluated, or encoded instructions are harder to inspect. Decode and review them before execution.'
				: 'This passes code directly to an interpreter. Read the complete code and confirm its inputs and working directory.',
		);
	}

	if (/^git\s+(?:add|commit|merge|rebase|reset|restore|checkout|clean|push|tag)\b|^gh\s+(?:pr\s+merge|release\s+(?:create|delete))\b/i.test(patternSource)) {
		const high = /^git\s+push\b[^\r\n]*(?:--force|-f\b)|^git\s+(?:reset\s+--hard|clean\b[^\r\n]*-[a-z]*f)/i.test(patternSource);
		add(
			'source-control-change',
			high ? 'overwrite' : 'network',
			high ? 'high' : 'review',
			high ? 'Git history or untracked files may be replaced' : 'Source-control state may change',
			high ? 'This can discard work or rewrite shared history. Verify the repository, branch, and recovery point.' : 'This may stage, publish, merge, or rewrite project state. Confirm the repository and branch.',
		);
	}

	const deployment = /^(?:vercel|netlify|wrangler|firebase|flyctl|fly|railway|render|surge)\b[^\r\n]*(?:deploy|--prod|\bup\b)|^kubectl\s+(?:apply|create|delete|replace|patch|rollout)\b|^helm\s+(?:install|upgrade|uninstall|rollback)\b|^(?:terraform|tofu|pulumi)\s+(?:apply|destroy|up|refresh)\b/i.test(patternSource);
	if (deployment) {
		const high = /\b(?:destroy|delete|uninstall)\b/i.test(patternSource);
		add('deployment-change', 'network', high ? 'high' : 'review', high ? 'Remote resources may be removed' : 'Remote deployment may change', 'This may alter a live environment, spend money, publish code, or affect users. Confirm the account, project, and target environment.');
	}

	if (!textOnly && /\b(?:DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE|DELETE\s+FROM|UPDATE\s+[^\s;]+\s+SET)\b/i.test(command)) {
		add('database-change', /\b(?:DROP|TRUNCATE|DELETE)\b/i.test(command) ? 'delete' : 'overwrite', 'high', 'Database data may change', 'This appears able to delete or modify database records or schema. Verify the database, transaction, backup, and WHERE clause.');
	}

	if (/^(?:docker|podman)\s+run\b[^\r\n]*(?:--privileged|--pid[= ]host|--network[= ]host|(?:-v|--volume)\s+(?:\/|[A-Za-z]:\\):|docker\.sock)|^kubectl\s+exec\b/i.test(patternSource)) {
		add('dangerous-container', 'elevation', 'high', 'Container may reach powerful host or cluster access', 'Privileged execution, broad mounts, host namespaces, Docker sockets, or cluster exec can cross the expected isolation boundary.');
	}

	const withoutAssignments = stripLeadingAssignments(command.trim().replace(/^&\s*/, ''));
	if (/^(?:sudo|doas|gsudo|runas)\b|\bsu\s+-c\b|\bStart-Process\b[^\r\n]*-Verb\s+RunAs\b/i.test(withoutAssignments)) {
		add('elevation', 'elevation', 'high', 'Administrator access requested', 'This requests administrator or root access and may change the whole system, not just this project.');
	}
	if (NETWORK_PATTERN.test(patternSource)) {
		add('network', 'network', 'review', 'Network access', 'This may contact a remote system or transfer data over a network. Verify the destination and intended direction.');
	} else if (/https?:\/\//i.test(patternSource)) {
		add('network', 'network', 'review', 'Remote address present', 'This contains a remote address. Whether it is contacted depends on the invoked program.');
	}

	const secret = literalSecret(command);
	if (secret) {
		add('literal-secret', 'secret', 'high', 'Possible password or token in command', `A value associated with ${secret} appears directly in the command. It could be exposed through shell history, logs, or process details.`);
	}

	if (!findings.length) {
		add('command-review', 'other', 'review', 'Command requires human review', 'No known high-risk indicator matched. CmdImpact cannot simulate every program or prove this command is safe; confirm its purpose, arguments, and current directory.');
	}

	return findings;
}

export function analyzeCommand(input: string): CommandReport {
	const truncated = input.length > MAX_INPUT_LENGTH;
	const source = input.slice(0, MAX_INPUT_LENGTH);
	const findings: CommandFinding[] = [];
	const actions: CommandAction[] = [];
	const seen = new Set<string>();

	const addFindings = (items: CommandFinding[]) => {
		for (const finding of items) {
			const key = `${finding.code}:${finding.line}:${finding.evidence}`;
			if (!seen.has(key)) {
				seen.add(key);
				findings.push(finding);
			}
		}
	};

	for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
		if (/^\s*```/.test(rawLine)) continue;
		const line = stripComment(rawLine).trim();
		if (!line) continue;

		const lineExecutable = commandName(line).toLowerCase();
		const executesQuotedCommand =
			(['bash', 'sh', 'zsh'].includes(lineExecutable) && /(?:^|\s)-c(?:\s|$)/i.test(line)) ||
			(['pwsh', 'powershell'].includes(lineExecutable) && /(?:^|\s)-(?:c|command)(?:\s|$)/i.test(line));
		const remoteSource = executesQuotedCommand ? line : stripQuotedText(line);
		const remoteExecution =
			/(?:\b(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b)[^|]*\|\s*(?:bash|sh|zsh|pwsh|powershell|iex|Invoke-Expression)\b/i.test(remoteSource) ||
			/\b(?:iex|Invoke-Expression)\b[^\r\n]{0,240}\b(?:Invoke-WebRequest|Invoke-RestMethod|iwr|irm)\b/i.test(remoteSource);
		if (remoteExecution) {
			addFindings([
				{
					code: 'remote-execution',
					category: 'network',
					severity: 'high',
					title: 'Downloaded code may run immediately',
					detail: 'This appears to download code and run it immediately. Save and inspect the code before choosing to run it.',
					evidence: redactEvidence(line),
					line: index + 1,
				},
			]);
		}

		for (const command of splitCommands(line)) {
			const commandFindings = inspectCommand(command, index + 1);
			addFindings(commandFindings);
			actions.push({
				command: commandName(command),
				evidence: redactEvidence(command),
				line: index + 1,
				categories: [...new Set(commandFindings.map((finding) => finding.category))],
			});
		}
	}

	const risk: CommandRisk = findings.some((finding) => finding.severity === 'high')
		? 'high'
		: findings.length
			? 'review'
			: 'none';
	return { shell: detectShell(source), risk, truncated, actions, findings };
}
