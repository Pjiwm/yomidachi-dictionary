export interface FilterChip {
	prefix: string;
	value: string;
	negated: boolean;
}

export interface ParsedQuery {
	text: string;
	chips: FilterChip[];
}

export function parseQuery(input: string): ParsedQuery {
	return { text: input.trim(), chips: [] };
}
