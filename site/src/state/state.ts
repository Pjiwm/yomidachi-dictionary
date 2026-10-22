import type { Route } from "./router.ts";
import type { DictEntry, KanjiEntry, SearchResults } from "../types.ts";

export interface Detail {
	senses: DictEntry[];
	kanji: KanjiEntry[];
}

export interface AppState {
	route: Route;
	query: string;
	results: SearchResults | null;
	loading: boolean;
	detail: Detail | KanjiEntry | null;
	radicalPicker: { selected: string[] } | null;
	error: string | null;
}

export const initialState: AppState = {
	route: { kind: "home" },
	query: "",
	results: null,
	loading: false,
	detail: null,
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
