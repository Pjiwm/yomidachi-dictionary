import { FILTER_PREFIXES } from "./filters.ts";

export interface FilterChip {
	prefix: string;
	value: string;
	negated: boolean;
}

export interface ParsedQuery {
	text: string;
	chips: FilterChip[];
}

const CHIP_PATTERN = new RegExp(`^(not:)?(${FILTER_PREFIXES.join("|")}):(.+)$`, "i");

/* "green pos:noun not:jlpt:n5" becomes text "green" plus two chips. */
export function parseQuery(input: string): ParsedQuery {
	const words: string[] = [];
	const chips: FilterChip[] = [];
	for (const word of input.trim().split(/\s+/)) {
		const match = word.match(CHIP_PATTERN);
		if (!match) {
			words.push(word);
			continue;
		}
		chips.push({ negated: match[1] !== undefined, prefix: match[2].toLowerCase(), value: match[3] });
	}
	return { text: words.join(" "), chips };
}

export function hasWildcard(text: string): boolean {
	return /[*?＊？]/.test(text);
}

/* Full-width and ASCII wildcards to SQL LIKE wildcards. */
export function toLikePattern(text: string): string {
	return text.replace(/[*＊]/g, "%").replace(/[?？]/g, "_");
}
