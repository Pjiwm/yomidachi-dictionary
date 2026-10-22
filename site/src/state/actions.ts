import { type DictRepository, KANJI_LIMIT, KANJI_STRIP } from "../db/repository.ts";
import { hasWildcard, parseQuery } from "../search/query.ts";
import { resolveFilter, type ResolvedFilter } from "../search/filters.ts";
import type { Route } from "./router.ts";
import { parseHash, routeQuery } from "./router.ts";
import type { Store } from "./state.ts";
import { openDraft } from "../ui/RadicalPicker.ts";
import type { SearchResults } from "../types.ts";

/* Each result row the list shows costs about one round trip, so start small. */
const RESULT_PAGE = 25;
/* Below this a lookup feels instant; showing a skeleton would only flash. */
const SKELETON_DELAY_MS = 180;

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
			void this.search(query, RESULT_PAGE);
		}
		if (route.kind === "word" && !(previous.kind === "word" && previous.sequence === route.sequence)) {
			void this.loadWord(route.sequence);
		} else if (route.kind === "kanji" && !(previous.kind === "kanji" && previous.character === route.character)) {
			void this.loadKanji(route.character);
		} else if (route.kind === "home" || route.kind === "search") {
			this.store.update({ detail: null });
		}
	}

	async showMoreResults(): Promise<void> {
		const { query, resultLimit } = this.store.current;
		await this.search(query, resultLimit + RESULT_PAGE, true);
	}

	private async search(query: string, limit: number, keepResults = false): Promise<void> {
		const token = ++this.searchToken;
		this.store.update({ query, resultLimit: limit, kanjiExpanded: keepResults && this.store.current.kanjiExpanded });
		if (!query.trim()) {
			this.store.update({ results: null, searching: false });
			return;
		}
		this.store.update({ error: null });
		const skeleton = setTimeout(() => {
			if (token === this.searchToken) this.store.update({ searching: true });
		}, SKELETON_DELAY_MS);
		try {
			const results = await this.runSearch(query, limit);
			if (token !== this.searchToken) return;
			this.store.update({ results, searching: false });
		} catch (err) {
			if (token !== this.searchToken) return;
			console.error(err);
			this.store.update({ results: { words: [], kanji: [] }, searching: false });
		} finally {
			clearTimeout(skeleton);
		}
	}

	private async runSearch(query: string, limit: number): Promise<SearchResults> {
		const { text, chips } = parseQuery(query);
		const resolved = chips.map(resolveFilter).filter((f): f is ResolvedFilter => f !== null);
		const kanjiOnly = resolved.some((f) => f.kind === "kanjiOnly");
		const filters = resolved.filter((f) => f.kind !== "kanjiOnly");

		const kanjiLimit = kanjiOnly || this.store.current.kanjiExpanded ? KANJI_LIMIT : KANJI_STRIP;
		let results: SearchResults;
		if (filters.length > 0 || hasWildcard(text)) {
			results = await this.repository.advancedSearch(text, filters, limit, kanjiLimit);
		} else {
			const [words, kanji] = await Promise.all([
				kanjiOnly ? Promise.resolve([]) : this.repository.search(text, limit),
				this.repository.kanjiForText(text, kanjiLimit),
			]);
			results = { words, kanji };
		}
		return kanjiOnly ? { words: [], kanji: results.kanji } : results;
	}

	/* The collapsed strip only fetched its own rows; expanding fetches the rest. */
	private async loadAllKanji(): Promise<void> {
		const { query, results } = this.store.current;
		if (!results || results.kanji.length < KANJI_STRIP) return;
		const { text, chips } = parseQuery(query);
		const filters = chips.map(resolveFilter).filter((f): f is ResolvedFilter => f !== null && f.kind !== "kanjiOnly");
		const kanji = await this.repository.advancedKanji(text, filters, KANJI_LIMIT).catch(() => results.kanji);
		const current = this.store.current;
		if (current.query === query && current.results) this.store.update({ results: { ...current.results, kanji } });
	}

	private async loadWord(sequence: number): Promise<void> {
		const token = ++this.detailToken;
		const skeleton = this.delayedDetailSkeleton(token);
		const senses = await this.repository.wordDetails(sequence).catch(() => []);
		const kanji = senses.length ? await this.repository.kanjiForWord(senses[0].term).catch(() => []) : [];
		clearTimeout(skeleton);
		if (token !== this.detailToken) return;
		this.store.update({
			detail: senses.length ? { kind: "word", senses, kanji } : { kind: "missing" },
			detailLoading: false,
		});
	}

	private async loadKanji(character: string): Promise<void> {
		const token = ++this.detailToken;
		const skeleton = this.delayedDetailSkeleton(token);
		const entry = await this.repository.kanji(character).catch(() => null);
		clearTimeout(skeleton);
		if (token !== this.detailToken) return;
		this.store.update({ detail: entry ? { kind: "kanji", entry } : { kind: "missing" }, detailLoading: false });
	}

	private delayedDetailSkeleton(token: number): ReturnType<typeof setTimeout> {
		return setTimeout(() => {
			if (token === this.detailToken) this.store.update({ detailLoading: true });
		}, SKELETON_DELAY_MS);
	}

	async openRadicalPicker(initialQuery: string): Promise<void> {
		if (this.store.current.radicalPicker) return;
		openDraft(initialQuery);
		const radicals = await this.repository.radicals().catch(() => []);
		this.store.update({ radicalPicker: { radicals, selected: [], available: [], kanji: [], total: 0, justOpened: true, kanjiFocus: false } });
	}

	closeRadicalPicker(): void {
		this.store.update({ radicalPicker: null });
	}

	toggleKanjiFocus(): void {
		const picker = this.store.current.radicalPicker;
		if (picker) this.store.update({ radicalPicker: { ...picker, kanjiFocus: !picker.kanjiFocus, justOpened: false } });
	}

	async toggleRadical(radical: string): Promise<void> {
		const picker = this.store.current.radicalPicker;
		if (!picker) return;
		const selected = picker.selected.includes(radical)
			? picker.selected.filter((r) => r !== radical)
			: [...picker.selected, radical];
		await this.selectRadicals(selected);
	}

	async clearRadicals(): Promise<void> {
		await this.selectRadicals([]);
	}

	private async selectRadicals(selected: string[]): Promise<void> {
		const picker = this.store.current.radicalPicker;
		if (!picker) return;
		this.store.update({ radicalPicker: { ...picker, selected, justOpened: false } });
		const result = await this.repository.kanjiByRadicals(selected).catch(() => ({ kanji: [], total: 0, available: [] }));
		const current = this.store.current.radicalPicker;
		if (!current || current.selected !== selected) return;
		this.store.update({ radicalPicker: { ...current, ...result } });
	}

	toggleKanjiExpanded(): void {
		const expanded = !this.store.current.kanjiExpanded;
		this.store.update({ kanjiExpanded: expanded });
		if (expanded) void this.loadAllKanji();
	}

	async followReference(term: string): Promise<Route | null> {
		const entry = await this.repository.resolveReference(term).catch(() => null);
		return entry ? { kind: "word", sequence: entry.sequence, query: this.store.current.query } : null;
	}
}
