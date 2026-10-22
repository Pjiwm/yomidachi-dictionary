import type { Actions } from "../state/actions.ts";
import { formatRoute } from "../state/router.ts";
import type { AppState } from "../state/state.ts";
import type { KanjiEntry, WordSummary } from "../types.ts";
import { bone, button, el, ja, link, skeleton } from "./dom.ts";
import { icon } from "./icons.ts";

import { KANJI_STRIP } from "../db/repository.ts";

/* Two rows of tiles at the default width before "Show all" is needed. */
const COLLAPSED_KANJI = KANJI_STRIP;

function firstMeaning(meanings: string): string {
	return meanings.split(",")[0].trim();
}

function kanjiTile(k: KanjiEntry, query: string, selected: boolean): HTMLElement {
	return link(
		formatRoute({ kind: "kanji", character: k.character, query }),
		{
			class: `flex flex-col items-center justify-center gap-0.5 w-[4.25rem] h-[4.25rem] px-1 rounded-lg border transition-colors ${
				selected ? "border-border-strong bg-surface-sunken" : "border-border-subtle hover:bg-surface-sunken"
			}`,
			title: k.meanings,
			"aria-label": `${k.character}, ${k.meanings}`,
			"aria-current": selected ? "page" : "false",
		},
		[
			ja("span", { class: "text-primary text-2xl leading-none" }, [k.character]),
			el("span", { class: "text-muted text-[10px] leading-tight text-center truncate w-full", "aria-hidden": "true" }, [firstMeaning(k.meanings)]),
		],
	);
}

function sectionHeader(title: string, count: number, action: HTMLElement | null): HTMLElement {
	return el("div", { class: "sticky top-0 z-10 bg-surface flex items-center justify-between px-4 pt-3 pb-1.5 border-b border-border-subtle" }, [
		el("h2", { class: "section-label" }, [title, " ", el("span", { class: "tracking-normal" }, [String(count)])]),
		action,
	]);
}

function wordRow(w: WordSummary, query: string, selected: boolean): HTMLElement {
	return link(
		formatRoute({ kind: "word", sequence: w.sequence, query }),
		{
			class: `block w-full min-h-14 px-4 py-2 border-b border-border-subtle hover:bg-surface-sunken transition-colors ${selected ? "bg-surface-sunken" : ""}`,
			"aria-current": selected ? "page" : "false",
		},
		[
			el("div", { class: "flex items-baseline gap-2 min-w-0" }, [
				ja("span", { class: "text-primary text-lg font-medium truncate" }, [w.term]),
				w.reading !== w.term ? ja("span", { class: "text-muted text-sm" }, [w.reading]) : null,
				w.common ? el("span", { class: "border border-common text-common text-[10px] font-medium shrink-0 px-1.5 rounded" }, ["common"]) : null,
			]),
			el("div", { class: "text-secondary text-xs truncate" }, [w.gloss]),
		],
	);
}

export function renderResultsList(state: AppState, actions: Actions | null): HTMLElement {
	const empty = (text: string) => el("div", { class: "flex-1 flex items-center justify-center text-muted text-sm p-6" }, [text]);
	if (state.searching) {
		// Mirrors the list: a section label, then rows of term, reading, common pill and gloss.
		const rows = Array.from({ length: 8 }, (_, i) =>
			el("div", { class: "min-h-14 px-4 py-2 border-b border-border-subtle" }, [
				el("div", { class: "flex items-baseline gap-2 mb-1.5" }, [
					bone(`${2.5 + (i % 3) * 0.75}rem`, "1.375rem"),
					bone(`${2 + (i % 2)}rem`, "0.875rem"),
					i % 3 === 0 ? bone("3rem", "0.875rem", "rounded-sm") : null,
				].filter((n): n is HTMLElement => n !== null)),
				bone(`${45 + ((i * 23) % 40)}%`, "0.75rem"),
			]),
		);
		return skeleton(
			[el("div", { class: "px-4 pt-3 pb-1.5 border-b border-border-subtle" }, [bone("4rem", "0.75rem")]), ...rows],
			"flex-1 min-h-0 overflow-hidden",
		);
	}
	if (!state.results) return empty("Type a word above to search.");

	const { words, kanji } = state.results;
	if (words.length === 0 && kanji.length === 0) return empty("No results.");

	const route = state.route;
	const selectedSequence = route.kind === "word" ? route.sequence : null;
	const selectedKanji = route.kind === "kanji" ? route.character : null;
	const sections: HTMLElement[] = [];

	if (kanji.length) {
		const shown = state.kanjiExpanded ? kanji : kanji.slice(0, COLLAPSED_KANJI);
		const toggle =
			kanji.length >= COLLAPSED_KANJI
				? button(
						{ class: "flex items-center gap-1 min-h-11 px-2 -mr-2 text-xs text-muted hover:text-secondary", "aria-expanded": String(state.kanjiExpanded) },
						[state.kanjiExpanded ? "Show fewer" : kanji.length > COLLAPSED_KANJI ? `All ${kanji.length}` : "Show all", icon("chevronDown", 12)],
						() => actions?.toggleKanjiExpanded(),
					)
				: null;
		if (toggle && state.kanjiExpanded) toggle.querySelector("svg")?.classList.add("rotate-180");
		sections.push(
			sectionHeader("Kanji", kanji.length, toggle),
			el("div", { class: "flex flex-wrap gap-2 px-4 py-3 border-b border-border-subtle" }, shown.map((k) => kanjiTile(k, state.query, k.character === selectedKanji))),
		);
	}

	if (words.length) {
		sections.push(sectionHeader("Words", words.length, null), ...words.map((w) => wordRow(w, state.query, w.sequence === selectedSequence)));
		if (words.length >= state.resultLimit) {
			sections.push(
				button(
					{ class: "w-full min-h-12 text-sm text-muted hover:text-secondary border-b border-border-subtle" },
					["Show more"],
					() => void actions?.showMoreResults(),
				),
			);
		}
	}

	return el("div", { class: "flex-1 min-h-0 overflow-y-auto", role: "region", "aria-label": "Search results", "data-scroll": "results" }, sections);
}
