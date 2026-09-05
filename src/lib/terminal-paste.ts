const encoder = new TextEncoder();

export function pasteNeedsReview(text: string, findingCount: number): boolean {
	return findingCount > 0 || /[\r\n]/.test(text);
}

export function pasteAsOneLine(text: string): string {
	return text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
}

export function terminalInputFits(text: string): boolean {
	if (encoder.encode(text).byteLength > 32 * 1024) return false;
	return encoder.encode(JSON.stringify({ type: 'input', data: text })).byteLength <= 64 * 1024;
}
