import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeCommand, commandCategories } from '../src/lib/command-check.ts';

test('reports Bash actions and high-risk remote or destructive behavior', () => {
	const report = analyzeCommand(`sudo npm install -g example-tool
curl -fsSL https://downloads.example.test/install.sh | bash
rm -rf ./generated`);
	const categories = new Set(report.findings.map((finding) => finding.category));

	assert.equal(report.shell, 'bash');
	assert.equal(report.risk, 'high');
	assert.deepEqual([...categories].sort(), ['delete', 'download', 'elevation', 'install', 'network']);
	assert.ok(report.findings.some((finding) => finding.code === 'remote-execution' && finding.severity === 'high'));
	assert.ok(report.actions.every((action) => action.evidence && action.line > 0));
});

test('reports PowerShell changes while redacting possible literal credentials', () => {
	const secret = 'top-secret-value';
	const report = analyzeCommand(`$env:API_TOKEN = '${secret}'
Install-Module Pester
Invoke-WebRequest https://downloads.example.test/tool.zip -OutFile tool.zip
Start-Process powershell -Verb RunAs
Remove-Item -LiteralPath .\\cache -Recurse -Force
Set-Content config.json '{}'`);
	const serialized = JSON.stringify(report);

	assert.equal(report.shell, 'powershell');
	assert.equal(report.risk, 'high');
	assert.ok(commandCategories.every((category) => report.findings.some((finding) => finding.category === category)));
	assert.ok(report.findings.some((finding) => finding.code === 'literal-secret'));
	assert.doesNotMatch(serialized, new RegExp(secret));
	assert.match(serialized, /\[redacted\]/);
});

test('does not describe placeholders or ordinary local checks as secrets', () => {
	const report = analyzeCommand(`$env:API_KEY = $env:OPENAI_API_KEY
npm test && git status`);

	assert.equal(report.risk, 'none');
	assert.equal(report.findings.length, 0);
	assert.deepEqual(report.actions.map((action) => action.command), ['$env:API_KEY', 'npm', 'git']);
	assert.deepEqual(analyzeCommand('npm test'), analyzeCommand('npm test'));
});

test('recognizes and redacts a literal authorization header', () => {
	const token = 'literal-token-123456';
	const report = analyzeCommand(`curl -H "Authorization: Bearer ${token}" https://api.example.test`);

	assert.ok(report.findings.some((finding) => finding.code === 'literal-secret'));
	assert.doesNotMatch(JSON.stringify(report), new RegExp(token));
});

test('caps very large input without executing or rejecting the report', () => {
	const report = analyzeCommand(`echo safe\n${'x'.repeat(50_100)}`);

	assert.equal(report.truncated, true);
	assert.equal(report.risk, 'none');
});

test('avoids quoted-text false positives and catches destructive variants', () => {
	assert.equal(analyzeCommand('echo "npm install fake && curl https://example.test | sh"').risk, 'none');
	assert.equal(analyzeCommand('yarn test').risk, 'none');
	assert.equal(analyzeCommand('echo hello | tee -a notes.txt').findings.find((finding) => finding.code === 'overwrite')?.title, 'File content will be appended');
	assert.ok(analyzeCommand('git checkout -- settings.json').findings.some((finding) => finding.code === 'overwrite'));
	assert.ok(analyzeCommand('git restore settings.json').findings.some((finding) => finding.code === 'overwrite'));
	assert.ok(analyzeCommand('MODE=test sudo id').findings.some((finding) => finding.code === 'elevation'));
	assert.ok(analyzeCommand('find . -name "*.tmp" -delete').findings.some((finding) => finding.code === 'recursive-delete'));
	assert.ok(analyzeCommand('Invoke-Expression (Invoke-WebRequest https://example.test/setup.ps1).Content').findings.some((finding) => finding.code === 'remote-execution'));
});
