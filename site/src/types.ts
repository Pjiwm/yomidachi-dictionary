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
	words: DictEntry[];
	kanji: KanjiEntry[];
}

export interface RadicalSearchResult {
	kanji: KanjiEntry[];
	available: string[];
}
