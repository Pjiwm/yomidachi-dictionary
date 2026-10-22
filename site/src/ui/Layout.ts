import type { Actions } from "../state/actions.ts";
import type { AppState } from "../state/state.ts";
import { el } from "./dom.ts";
import { renderEntryDetail } from "./EntryDetail.ts";
import { renderFooter } from "./Footer.ts";
import { renderResultsList } from "./ResultsList.ts";
import { renderSearchBar } from "./SearchBar.ts";

export function renderLayout(state: AppState, actions: Actions | null): HTMLElement {
	const header = el("header", { class: "border-b border-border-subtle px-4 py-3 flex items-center gap-4" }, [
		el("a", { href: "#/", class: "font-semibold tracking-tight text-primary" }, ["Yomidachi"]),
		el("span", { class: "text-muted text-sm" }, ["Dictionary"]),
	]);
	const main = el("main", { class: "flex-1 min-h-0 flex flex-col" }, [
		renderSearchBar(state, actions),
		el("div", { class: "flex-1 min-h-0 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" }, [
			renderResultsList(state, actions),
			renderEntryDetail(state, actions),
		]),
	]);
	return el("div", { class: "h-dvh flex flex-col" }, [header, main, renderFooter(state, actions)]);
}
