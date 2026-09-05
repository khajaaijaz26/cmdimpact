import assert from 'node:assert/strict';
import test from 'node:test';
import { pasteAsOneLine, pasteNeedsReview, terminalInputFits } from '../src/lib/terminal-paste.ts';

test('guarded paste reviews line breaks even without analyzer findings', () => {
	assert.equal(pasteNeedsReview('echo one\necho two\n', 0), true);
	assert.equal(pasteNeedsReview('echo one\recho two', 0), true);
	assert.equal(pasteNeedsReview('echo one', 0), false);
});

test('paste as one line replaces every C0 and DEL run with one space', () => {
	assert.equal(pasteAsOneLine('\u001b[31mecho\tone\r\necho\u0000two\u007f'), '[31mecho one echo two');
});

test('terminal input preflight matches the server byte and serialized-frame limits', () => {
	assert.equal(terminalInputFits('🙂'.repeat(8192)), true);
	assert.equal(terminalInputFits('🙂'.repeat(8193)), false);
	assert.equal(terminalInputFits('\\'.repeat(32750)), true);
	assert.equal(terminalInputFits('\\'.repeat(32768)), false);
});
