import FILTERS from "./filters.json";
import type { FilterChip } from "./query.ts";

/* filters.json is shared with scripts/prepare_site_db.py, which turns each
   option into a "prefix:key" tag per word so filtering is an index lookup. */
export interface FilterOption {
	key: string;
	label: string;
	codes: string[];
}

export const FILTER_PREFIXES = ["pos", "is", "topic", "dialect", "jlpt", "grade", "strokes", "pitch"] as const;
export type FilterPrefix = (typeof FILTER_PREFIXES)[number];

/* How a filter is applied: tags against tag_index, kanji against the kanji
   table (grade, strokes, jlpt also narrow the kanji panel), kanjiOnly hides words. */
export type FilterKind = "tags" | "kanji" | "kanjiOnly";

export interface ResolvedFilter {
	prefix: string;
	negated: boolean;
	tags: string[];
	codes: string[];
	kind: FilterKind;
}

const TABLES = FILTERS as Record<string, FilterOption[]>;

export const POS_FILTERS = TABLES.pos;
export const IS_FILTERS = TABLES.is;
export const TOPIC_FILTERS = TABLES.topic;
export const DIALECT_FILTERS = TABLES.dialect;
export const JLPT_FILTERS = TABLES.jlpt;
export const PITCH_FILTERS = TABLES.pitch;
export const GRADE_FILTERS = TABLES.grade;

export function filtersForPrefix(prefix: string): FilterOption[] {
	return TABLES[prefix] ?? [];
}

/* "n3-n1", "3-6" or "8" into the covered values; empty when not numeric. */
export function expandRange(value: string): string[] {
	const bounds = value.split("-").map((part) => Number.parseInt(part.replace(/^n/i, ""), 10));
	if (bounds.some(Number.isNaN) || bounds.length > 2) return [];
	const [lo, hi] = bounds.length === 2 ? [Math.min(...bounds), Math.max(...bounds)] : [bounds[0], bounds[0]];
	return Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i));
}

export function resolveFilter(chip: FilterChip): ResolvedFilter | null {
	const value = chip.value.toLowerCase();
	const base = { prefix: chip.prefix, negated: chip.negated };
	const preset = filtersForPrefix(chip.prefix).find((f) => f.key === value);

	switch (chip.prefix) {
		case "jlpt": {
			const codes = preset?.codes ?? expandRange(value);
			return codes.length ? { ...base, codes, tags: codes.map((c) => `jlpt:n${c}`), kind: "kanji" } : null;
		}
		case "grade": {
			const codes = preset?.codes ?? expandRange(value);
			if (!codes.length) return null;
			const tags = preset ? [`grade:${preset.key}`] : codes.map((c) => `grade:grade_${c}`);
			return { ...base, codes, tags, kind: "kanji" };
		}
		case "strokes": {
			const codes = expandRange(value);
			return codes.length ? { ...base, codes, tags: codes.map((c) => `strokes:${c}`), kind: "kanji" } : null;
		}
		case "is":
			if (value === "kanji") return { ...base, codes: [], tags: [], kind: "kanjiOnly" };
			break;
	}
	if (!preset) return null;
	return { ...base, codes: preset.codes, tags: [`${chip.prefix}:${preset.key}`], kind: "tags" };
}
