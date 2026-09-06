import assert from 'node:assert/strict';
import test from 'node:test';
import { pasteAsOneLine, pasteNeedsReview, terminalInputFits, visiblePaste } from '../src/lib/terminal-paste.ts';

test('guarded paste reviews every non-empty paste', () => {
	assert.equal(pasteNeedsReview('echo one\necho two\n', 0), true);
	assert.equal(pasteNeedsReview('echo one\recho two', 0), true);
	assert.equal(pasteNeedsReview('echo one', 0), true);
	assert.equal(pasteNeedsReview('  \r\n', 2), false);
});

test('paste as one line replaces every C0 and DEL run with one space', () => {
	assert.equal(pasteAsOneLine('\u001b[31mecho\tone\r\necho\u0000two\u007f'), '[31mecho one echo two');
});

test('paste preview distinguishes literal escapes and exposes invisible controls', () => {
	assert.equal(
		visiblePaste('\\x1b\u001b\nx\u200b\u202e\ufeff'),
		'\\\\x1b\\x1b\\x0a\nx\\u200b\\u202e\\ufeff',
	);
});

test('terminal input preflight matches the server byte and serialized-frame limits', () => {
	assert.equal(terminalInputFits('🙂'.repeat(8192)), true);
	assert.equal(terminalInputFits('🙂'.repeat(8193)), false);
	assert.equal(terminalInputFits('\\'.repeat(32750)), true);
	assert.equal(terminalInputFits('\\'.repeat(32768)), false);
});
