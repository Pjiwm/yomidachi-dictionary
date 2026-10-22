import type { Actions } from "../state/actions.ts";
import type { AppState, RadicalPicker } from "../state/state.ts";
import type { Radical } from "../types.ts";
import { button, el, insertIntoSearch } from "./dom.ts";
import { icon } from "./icons.ts";

function groupByStrokes(radicals: Radical[]): [number, Radical[]][] {
	const groups = new Map<number, Radical[]>();
	for (const r of radicals) groups.set(r.strokes, [...(groups.get(r.strokes) ?? []), r]);
	return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

function radicalGrid(picker: RadicalPicker, actions: Actions): HTMLElement {
	const available = new Set(picker.available);
	const tiles = groupByStrokes(picker.radicals).flatMap(([strokes, radicals]) => [
		el("div", { class: "w-11 h-11 md:w-9 md:h-9 rounded-md flex items-center justify-center bg-surface-sunken text-muted text-xs font-semibold tabular-nums", title: `${strokes} strokes`, "aria-label": `${strokes} strokes` }, [String(strokes)]),
		...radicals.map((r) => {
			const selected = picker.selected.includes(r.radical);
			const disabled = picker.selected.length > 0 && !selected && !available.has(r.radical);
			const tile = button(
				{
					class: `w-11 h-11 md:w-9 md:h-9 rounded-md text-lg flex items-center justify-center transition-colors ${
						selected ? "bg-accent text-white" : disabled ? "text-muted opacity-30 cursor-default" : "text-primary hover:bg-surface-sunken"
					}`,
					"aria-pressed": String(selected),
				},
				[r.radical],
				() => void actions.toggleRadical(r.radical),
			);
			tile.disabled = disabled;
			tile.lang = "ja";
			return tile;
		}),
	]);
	return el("div", { class: "flex flex-wrap gap-1.5 content-start overflow-y-auto overscroll-contain min-h-0 flex-1 md:flex-none md:w-1/2 md:border-r md:border-border-subtle md:pr-3 md:max-h-[50vh]", role: "group", "aria-label": "Radicals", "data-scroll": "radicals" }, tiles);
}

function matches(picker: RadicalPicker, actions: Actions): HTMLElement {
	const summary =
		picker.selected.length === 0
			? "Pick one or more radicals to find a kanji."
			: picker.total > picker.kanji.length
				? `${picker.total} kanji, showing the first ${picker.kanji.length}. Click one to add it to your search.`
				: `${picker.total} kanji. Click one to add it to your search.`;
	// On a phone this sits above the grid as a short strip, so picks stay visible while scrolling radicals.
	return el("div", { class: "flex flex-col min-h-0 shrink-0 md:w-1/2 md:max-h-[50vh]" }, [
		el("div", { class: "flex items-center justify-between gap-2 mb-2 text-muted text-xs" }, [
			el("span", { role: "status", "aria-live": "polite" }, [summary]),
			picker.selected.length
				? button({ class: "chip hover:border-accent hover:text-accent shrink-0" }, ["Clear"], () => void actions.clearRadicals())
				: null,
		]),
		el("div", { class: "flex md:flex-wrap gap-1.5 overflow-x-auto md:overflow-x-visible md:overflow-y-auto overscroll-contain min-h-0 pb-1", role: "group", "aria-label": "Matching kanji", "data-scroll": "radical-matches" }, picker.kanji.map((k) => {
			const tile = button(
				{ class: "shrink-0 w-11 h-11 md:w-9 md:h-9 rounded-md text-lg flex items-center justify-center text-primary hover:bg-surface-sunken transition-colors", title: k.meanings, "aria-label": `Add ${k.character}, ${k.meanings}` },
				[k.character],
				() => insertIntoSearch(k.character, false),
			);
			tile.lang = "ja";
			return tile;
		})),
	]);
}

export function renderRadicalPicker(state: AppState, actions: Actions | null): HTMLElement | null {
	const picker = state.radicalPicker;
	if (!picker || !actions) return null;
	// A popover under the field on wide screens, a bottom sheet on phones.
	const panel = el("section", {
		class: `z-20 p-3 border border-border-default bg-surface-elevated shadow-lg flex flex-col
			fixed inset-x-0 bottom-0 rounded-t-xl h-[70dvh]
			md:absolute md:inset-x-0 md:top-full md:bottom-auto md:mt-2 md:rounded-lg md:h-auto md:block
			${picker.justOpened ? "animate-pop-in" : ""}`,
		role: "dialog",
		"aria-label": "Kanji by radical",
	}, [
		el("div", { class: "flex items-center justify-between mb-2" }, [
			el("h2", { class: "section-label" }, ["Kanji by radical"]),
			button({ class: "icon-button", "aria-label": "Close radical picker" }, [icon("x", 16)], () => actions.closeRadicalPicker()),
		]),
		el("div", { class: "flex flex-col-reverse md:flex-row gap-3 min-h-0 flex-1" }, [radicalGrid(picker, actions), matches(picker, actions)]),
	]);
	panel.addEventListener("keydown", (e) => {
		if (e.key === "Escape") actions.closeRadicalPicker();
	});
	return panel;
}
