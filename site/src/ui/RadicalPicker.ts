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
		el("div", { class: "w-9 h-9 rounded-md flex items-center justify-center bg-surface-sunken text-muted text-xs font-semibold tabular-nums", title: `${strokes} strokes` }, [String(strokes)]),
		...radicals.map((r) => {
			const selected = picker.selected.includes(r.radical);
			const disabled = picker.selected.length > 0 && !selected && !available.has(r.radical);
			const tile = button(
				{
					class: `w-9 h-9 rounded-md text-lg flex items-center justify-center transition-colors ${
						selected ? "bg-accent text-white" : disabled ? "text-muted opacity-30 cursor-default" : "text-primary hover:bg-surface-sunken"
					}`,
					"aria-pressed": String(selected),
				},
				[r.radical],
				() => void actions.toggleRadical(r.radical),
			);
			tile.disabled = disabled;
			return tile;
		}),
	]);
	return el("div", { class: "flex flex-wrap gap-1.5 content-start overflow-y-auto min-h-0 md:w-1/2 md:border-r md:border-border-subtle md:pr-3 max-h-[40vh] md:max-h-[50vh]" }, tiles);
}

function matches(picker: RadicalPicker, actions: Actions): HTMLElement {
	const summary =
		picker.selected.length === 0
			? "Pick one or more radicals to find a kanji."
			: picker.total > picker.kanji.length
				? `${picker.total} kanji, showing the first ${picker.kanji.length}. Click one to add it to your search.`
				: `${picker.total} kanji. Click one to add it to your search.`;
	return el("div", { class: "flex flex-col min-h-0 md:w-1/2 max-h-[40vh] md:max-h-[50vh]" }, [
		el("div", { class: "flex items-center justify-between gap-2 mb-2 text-muted text-xs" }, [
			el("span", {}, [summary]),
			picker.selected.length
				? button({ class: "chip hover:border-accent hover:text-accent shrink-0" }, ["Clear"], () => void actions.clearRadicals())
				: null,
		]),
		el("div", { class: "flex flex-wrap gap-1.5 overflow-y-auto min-h-0" }, picker.kanji.map((k) =>
			button(
				{ class: "w-9 h-9 rounded-md text-lg flex items-center justify-center text-primary hover:bg-surface-sunken transition-colors", title: k.meanings },
				[k.character],
				() => insertIntoSearch(k.character, false),
			),
		)),
	]);
}

export function renderRadicalPicker(state: AppState, actions: Actions | null): HTMLElement | null {
	const picker = state.radicalPicker;
	if (!picker || !actions) return null;
	return el("section", { class: "mt-2 p-3 rounded-lg border border-border-default bg-surface-elevated", "aria-label": "Kanji by radical" }, [
		el("div", { class: "flex items-center justify-between mb-2" }, [
			el("h2", { class: "section-label" }, ["Kanji by radical"]),
			button({ class: "icon-button", "aria-label": "Close radical picker" }, [icon("x", 16)], () => actions.closeRadicalPicker()),
		]),
		el("div", { class: "flex flex-col md:flex-row gap-3 min-h-0" }, [radicalGrid(picker, actions), matches(picker, actions)]),
	]);
}
