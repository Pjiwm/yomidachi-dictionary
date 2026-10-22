import type { Route } from "./router.ts";
import type { DictEntry, KanjiEntry, Radical, SearchResults } from "../types.ts";

export interface WordDetail {
	kind: "word";
	senses: DictEntry[];
	kanji: KanjiEntry[];
}

export interface KanjiDetail {
	kind: "kanji";
	entry: KanjiEntry;
}

export type Detail = WordDetail | KanjiDetail | { kind: "missing" };

export interface RadicalPicker {
	radicals: Radical[];
	selected: string[];
	available: string[];
	kanji: KanjiEntry[];
	total: number;
	/* True only for the render right after opening, so the pop-in plays once. */
	justOpened: boolean;
	/* Phones only: the kanji panel takes the larger share of the sheet. */
	kanjiFocus: boolean;
}

/* Written by scripts/prepare_site_db.py next to the database chunks. */
export interface DictionaryMeta {
	words: number;
	kanji: number;
	pitchWords: number;
	jlptWords: number;
	rankedWords: number;
	builtAt: string;
}

export interface AppState {
	route: Route;
	meta: DictionaryMeta | null;
	query: string;
	results: SearchResults | null;
	/* How many words the current search asked for; "Show more" raises it. */
	resultLimit: number;
	searching: boolean;
	kanjiExpanded: boolean;
	detail: Detail | null;
	detailLoading: boolean;
	radicalPicker: RadicalPicker | null;
	error: string | null;
}

export const initialState: AppState = {
	route: { kind: "home" },
	meta: __DICTIONARY_META__,
	query: "",
	results: null,
	resultLimit: 25,
	searching: false,
	kanjiExpanded: false,
	detail: null,
	detailLoading: false,
	radicalPicker: null,
	error: null,
};

type Listener = (state: AppState) => void;

export class Store {
	private state = initialState;
	private readonly listeners: Listener[] = [];

	get current(): AppState {
		return this.state;
	}

	update(patch: Partial<AppState>): void {
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener(this.state);
	}

	subscribe(listener: Listener): void {
		this.listeners.push(listener);
	}
}
