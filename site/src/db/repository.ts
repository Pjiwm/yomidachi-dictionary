import type { DbWorker } from "./worker.ts";
import type { ResolvedFilter } from "../search/filters.ts";
import type {
	DictEntry,
	KanjiEntry,
	Radical,
	RadicalSearchResult,
	SearchResults,
} from "../types.ts";

/* The only module that contains SQL. */
export class DictRepository {
	constructor(private readonly db: DbWorker) {}

	async search(_text: string, _limit: number): Promise<DictEntry[]> {
		return [];
	}

	async advancedSearch(
		_text: string,
		_filters: ResolvedFilter[],
		_limit: number,
	): Promise<SearchResults> {
		return { words: [], kanji: [] };
	}

	async wordDetails(_sequence: number): Promise<DictEntry[]> {
		return [];
	}

	async kanjiForWord(_term: string): Promise<KanjiEntry[]> {
		return [];
	}

	async kanji(_character: string): Promise<KanjiEntry | null> {
		return null;
	}

	async kanjiByReading(_reading: string, _limit: number): Promise<KanjiEntry[]> {
		return [];
	}

	async kanjiByRadicals(_radicals: string[]): Promise<RadicalSearchResult> {
		return { kanji: [], available: [] };
	}

	async radicals(): Promise<Radical[]> {
		return [];
	}

	async resolveReference(_term: string): Promise<DictEntry | null> {
		return null;
	}
}
