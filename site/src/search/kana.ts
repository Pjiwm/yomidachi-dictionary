export function toHiragana(input: string): string {
	return input;
}

export function toKatakana(input: string): string {
	return input;
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
