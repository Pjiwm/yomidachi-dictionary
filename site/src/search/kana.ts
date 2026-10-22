const KATAKANA_OFFSET = 0x60;

export function toHiragana(input: string): string {
	return input.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - KATAKANA_OFFSET));
}

export function toKatakana(input: string): string {
	return input.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + KATAKANA_OFFSET));
}

export function hasKanji(input: string): boolean {
	return /[一-鿿㐀-䶿]/.test(input);
}

export function hasKana(input: string): boolean {
	return /[぀-ゟ゠-ヿ]/.test(input);
}

export function isJapanese(input: string): boolean {
	return hasKanji(input) || hasKana(input);
}

export function kanjiIn(input: string): string[] {
	return [...new Set(input.match(/[一-鿿㐀-䶿]/g) ?? [])];
}
