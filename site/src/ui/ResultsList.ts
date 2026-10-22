import type { Actions } from "../state/actions.ts";
import { navigate } from "../state/router.ts";
import type { AppState } from "../state/state.ts";
import type { KanjiEntry, WordSummary } from "../types.ts";
import { button, el } from "./dom.ts";
import { icon } from "./icons.ts";

const COLLAPSED_KANJI = 3;

function firstReadings(readings: string, n = 2): string {
	return readings.split(" ").filter(Boolean).slice(0, n).join("、 ");
}

function kanjiRow(k: KanjiEntry, query: string, selected: boolean): HTMLElement {
	const readings = [firstReadings(k.readingsKun), firstReadings(k.readingsOn)].filter(Boolean).join(" · ");
	return button(
		{ class: `w-full text-left px-4 py-2 border-b border-border-subtle hover:bg-surface-sunken transition-colors ${selected ? "bg-accent-bg" : ""}` },
		[
			el("div", { class: "flex items-baseline gap-2" }, [
				el("span", { class: "text-primary text-lg font-medium" }, [k.character]),
				el("span", { class: "text-muted text-sm truncate" }, [readings]),
			]),
			el("div", { class: "text-secondary text-xs truncate" }, [k.meanings]),
		],
		() => navigate({ kind: "kanji", character: k.character, query }),
	);
}

function wordRow(w: WordSummary, query: string, selected: boolean): HTMLElement {
	return button(
		{ class: `w-full text-left px-4 py-2 border-b border-border-subtle hover:bg-surface-sunken transition-colors ${selected ? "bg-accent-bg" : ""}` },
		[
			el("div", { class: "flex items-baseline gap-2 min-w-0" }, [
				el("span", { class: "text-primary text-lg font-medium truncate" }, [w.term]),
				w.reading !== w.term ? el("span", { class: "text-muted text-sm" }, [w.reading]) : null,
				w.common ? el("span", { class: "border border-common text-common text-[10px] font-medium shrink-0 px-1.5 rounded" }, ["common"]) : null,
			]),
			el("div", { class: "text-secondary text-xs truncate" }, [w.gloss]),
		],
		() => navigate({ kind: "word", sequence: w.sequence, query }),
	);
}

export function renderResultsList(state: AppState, actions: Actions | null): HTMLElement {
	const empty = (text: string) => el("div", { class: "flex-1 flex items-center justify-center text-muted text-sm p-6" }, [text]);
	if (state.searching) return empty("Searching…");
	if (!state.results) return empty("Type a word above to search.");

	const { words, kanji } = state.results;
	if (words.length === 0 && kanji.length === 0) return empty("No results.");

	const route = state.route;
	const selectedSequence = route.kind === "word" ? route.sequence : null;
	const selectedKanji = route.kind === "kanji" ? route.character : null;
	const shownKanji = state.kanjiExpanded ? kanji : kanji.slice(0, COLLAPSED_KANJI);

	const rows: HTMLElement[] = shownKanji.map((k) => kanjiRow(k, state.query, k.character === selectedKanji));
	if (kanji.length > COLLAPSED_KANJI) {
		rows.push(
			button(
				{ class: "w-full flex items-center justify-center gap-1 px-4 py-1.5 border-b border-border-subtle text-[11px] text-muted hover:text-secondary" },
				[
					state.kanjiExpanded ? "Fewer kanji" : `All ${kanji.length} kanji`,
					icon("chevronDown", 11),
				],
				() => actions?.toggleKanjiExpanded(),
			),
		);
	}
	rows.push(...words.map((w) => wordRow(w, state.query, w.sequence === selectedSequence)));

	return el("div", { class: "flex-1 min-h-0 overflow-y-auto" }, rows);
}
