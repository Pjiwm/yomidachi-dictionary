/* Row shapes the repository returns. Field names follow the database columns. */

export interface DictEntry {
	id: number;
	sequence: number;
	term: string;
	reading: string;
	pos: string;
	frequency: number;
	translation: string;
	jlptLevel: number | null;
	pitchAccent: string | null;
	references: string[];
}

/* One search result per word, served straight from the site's search tables. */
export interface WordSummary {
	sequence: number;
	term: string;
	reading: string;
	gloss: string;
	common: boolean;
}

export interface KanjiEntry {
	character: string;
	strokeCount: number | null;
	grade: number | null;
	jlptLevel: number | null;
	meanings: string;
	readingsOn: string;
	readingsKun: string;
}

export interface Radical {
	radical: string;
	strokes: number;
}

export interface SearchResults {
	words: WordSummary[];
	kanji: KanjiEntry[];
}

export interface RadicalSearchResult {
	/* The first matches by stroke count; `total` counts all of them. */
	kanji: KanjiEntry[];
	total: number;
	available: string[];
}
