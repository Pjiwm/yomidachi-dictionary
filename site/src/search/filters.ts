import type { FilterChip } from "./query.ts";

export interface FilterOption {
	key: string;
	label: string;
	codes: string[];
}

export type FilterKind = "pos" | "frequency" | "pitch" | "kanji" | "jlpt";

export interface ResolvedFilter {
	prefix: string;
	negated: boolean;
	codes: string[];
	kind: FilterKind;
}

export const FILTER_PREFIXES = [
	"pos",
	"is",
	"topic",
	"dialect",
	"jlpt",
	"grade",
	"strokes",
	"pitch",
] as const;

export function filtersForPrefix(_prefix: string): FilterOption[] {
	return [];
}

export function resolveFilter(_chip: FilterChip): ResolvedFilter | null {
	return null;
}
