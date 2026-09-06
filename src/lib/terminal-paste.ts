const encoder = new TextEncoder();
const invisibleFormat = /\p{Cf}/u;

export function pasteNeedsReview(text: string, findingCount: number): boolean {
	void findingCount;
	return text.trim().length > 0;
}

export function pasteAsOneLine(text: string): string {
	return text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
}

export function visiblePaste(text: string): string {
	const characters = Array.from(text);
	let preview = '';
	for (let index = 0; index < characters.length; index += 1) {
		const character = characters[index];
		const code = character.codePointAt(0)!;
		if (code === 10) preview += '\\x0a\n';
		else if (code === 13) preview += '\\x0d' + (characters[index + 1] === '\n' ? '' : '\n');
		else if (character === '\\') preview += '\\\\';
		else if (code < 32 || (code >= 127 && code <= 159) || invisibleFormat.test(character)) {
			preview += code <= 255
				? '\\x' + code.toString(16).padStart(2, '0')
				: code <= 0xffff
					? '\\u' + code.toString(16).padStart(4, '0')
					: '\\u{' + code.toString(16) + '}';
		} else preview += character;
	}
	return preview;
}

export function terminalInputFits(text: string): boolean {
	if (encoder.encode(text).byteLength > 32 * 1024) return false;
	return encoder.encode(JSON.stringify({ type: 'input', data: text })).byteLength <= 64 * 1024;
}
