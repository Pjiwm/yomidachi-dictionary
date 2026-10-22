import type { DictRepository } from "../db/repository.ts";
import { hasWildcard, parseQuery } from "../search/query.ts";
import { resolveFilter, type ResolvedFilter } from "../search/filters.ts";
import type { Route } from "./router.ts";
import { parseHash, routeQuery } from "./router.ts";
import type { Store } from "./state.ts";
import type { SearchResults } from "../types.ts";

const RESULT_LIMIT = 50;

/* Translates route changes into repository calls and store updates. A
   search or detail load that finishes after a newer one started is dropped. */
export class Actions {
	private searchToken = 0;
	private detailToken = 0;

	constructor(
		private readonly store: Store,
		private readonly repository: DictRepository,
	) {}

	async onRoute(hash: string): Promise<void> {
		const route = parseHash(hash);
		const previous = this.store.current.route;
		this.store.update({ route });

		const query = routeQuery(route);
		if (query !== this.store.current.query || this.store.current.results === null) {
			void this.search(query);
		}
		if (route.kind === "word" && !(previous.kind === "word" && previous.sequence === route.sequence)) {
			void this.loadWord(route.sequence);
		} else if (route.kind === "kanji" && !(previous.kind === "kanji" && previous.character === route.character)) {
			void this.loadKanji(route.character);
		} else if (route.kind === "home" || route.kind === "search") {
			this.store.update({ detail: null });
		}
	}

	private async search(query: string): Promise<void> {
		const token = ++this.searchToken;
		this.store.update({ query, kanjiExpanded: false });
		if (!query.trim()) {
			this.store.update({ results: null, searching: false });
			return;
		}
		this.store.update({ searching: true, error: null });
		try {
			const results = await this.runSearch(query);
			if (token !== this.searchToken) return;
			this.store.update({ results, searching: false });
		} catch (err) {
			if (token !== this.searchToken) return;
			console.error(err);
			this.store.update({ results: { words: [], kanji: [] }, searching: false });
		}
	}

	private async runSearch(query: string): Promise<SearchResults> {
		const { text, chips } = parseQuery(query);
		const resolved = chips.map(resolveFilter).filter((f): f is ResolvedFilter => f !== null);
		const kanjiOnly = resolved.some((f) => f.kind === "kanjiOnly");
		const filters = resolved.filter((f) => f.kind !== "kanjiOnly");

		let results: SearchResults;
		if (filters.length > 0 || hasWildcard(text)) {
			results = await this.repository.advancedSearch(text, filters, RESULT_LIMIT);
		} else {
			const [words, kanji] = await Promise.all([
				kanjiOnly ? Promise.resolve([]) : this.repository.search(text, RESULT_LIMIT),
				this.repository.kanjiForText(text),
			]);
			results = { words, kanji };
		}
		return kanjiOnly ? { words: [], kanji: results.kanji } : results;
	}

	private async loadWord(sequence: number): Promise<void> {
		const token = ++this.detailToken;
		this.store.update({ detailLoading: true });
		const senses = await this.repository.wordDetails(sequence).catch(() => []);
		const kanji = senses.length ? await this.repository.kanjiForWord(senses[0].term).catch(() => []) : [];
		if (token !== this.detailToken) return;
		this.store.update({
			detail: senses.length ? { kind: "word", senses, kanji } : { kind: "missing" },
			detailLoading: false,
		});
	}

	private async loadKanji(character: string): Promise<void> {
		const token = ++this.detailToken;
		this.store.update({ detailLoading: true });
		const entry = await this.repository.kanji(character).catch(() => null);
		if (token !== this.detailToken) return;
		this.store.update({ detail: entry ? { kind: "kanji", entry } : { kind: "missing" }, detailLoading: false });
	}

	toggleKanjiExpanded(): void {
		this.store.update({ kanjiExpanded: !this.store.current.kanjiExpanded });
	}

	async followReference(term: string): Promise<Route | null> {
		const entry = await this.repository.resolveReference(term).catch(() => null);
		return entry ? { kind: "word", sequence: entry.sequence, query: this.store.current.query } : null;
	}
}
