import type { Actions } from "../state/actions.ts";
import type { AppState, RadicalPicker } from "../state/state.ts";
import type { Radical } from "../types.ts";
import { button, el, insertIntoSearch } from "./dom.ts";
import { icon } from "./icons.ts";

/* The panel DOM is reused across renders: rebuilding it on every tap is what
   made the sheet flash and jump on phones. Only the two panels are redrawn. */
let panel: HTMLElement | null = null;
let panelsHost: HTMLElement | null = null;

function groupByStrokes(radicals: Radical[]): [number, Radical[]][] {
	const groups = new Map<number, Radical[]>();
	for (const r of radicals) groups.set(r.strokes, [...(groups.get(r.strokes) ?? []), r]);
	return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

const TILE = "w-10 h-10 md:w-9 md:h-9 rounded-md text-lg flex items-center justify-center transition-colors";

function radicalGrid(picker: RadicalPicker, actions: Actions): HTMLElement {
	const available = new Set(picker.available);
	const tiles = groupByStrokes(picker.radicals).flatMap(([strokes, radicals]) => [
		el("div", { class: `${TILE} bg-surface-sunken text-muted text-xs font-semibold tabular-nums`, "aria-label": `${strokes} strokes` }, [String(strokes)]),
		...radicals.map((r) => {
			const selected = picker.selected.includes(r.radical);
			const disabled = picker.selected.length > 0 && !selected && !available.has(r.radical);
			const tile = button(
				{
					class: `${TILE} ${selected ? "bg-accent text-white" : disabled ? "text-muted opacity-30 cursor-default" : "text-primary hover:bg-surface-sunken"}`,
					"aria-pressed": String(selected),
					"data-radical": r.radical,
				},
				[r.radical],
				() => void actions.toggleRadical(r.radical),
			);
			tile.disabled = disabled;
			tile.lang = "ja";
			return tile;
		}),
	]);
	// Phones: the grid gives up most of the sheet while the kanji panel has focus.
	const share = picker.kanjiFocus ? "basis-1/4" : "basis-2/3";
	return el(
		"div",
		{ class: `overflow-y-auto overscroll-contain min-h-0 ${share} md:basis-auto md:w-1/2 md:max-h-[55vh] md:border-r md:border-border-subtle md:pr-3`, role: "group", "aria-label": "Radicals", "data-scroll": "radicals" },
		[el("div", { class: "flex flex-wrap gap-1.5 content-start" }, tiles)],
	);
}

function kanjiPanel(picker: RadicalPicker, actions: Actions, isTouch: boolean): HTMLElement {
	const summary =
		picker.selected.length === 0
			? "Pick radicals; tap a kanji to add it to your search."
			: picker.total > picker.kanji.length
				? `${picker.total} kanji, showing the first ${picker.kanji.length}.`
				: `${picker.total} kanji.`;
	const share = picker.kanjiFocus ? "basis-3/4" : "basis-1/3";
	return el("div", { class: `overflow-y-auto overscroll-contain min-h-0 ${share} md:basis-auto md:w-1/2 md:max-h-[55vh]`, "data-scroll": "radical-matches" }, [
		el("div", { class: "flex items-center justify-between gap-2 mb-2 py-1.5 sticky top-0 bg-surface-elevated" }, [
			el("span", { class: "text-muted text-[11px]", role: "status", "aria-live": "polite" }, [summary]),
			picker.selected.length
				? button({ class: "px-3 py-1.5 rounded-md border border-border-default text-secondary text-xs font-medium hover:bg-surface-sunken hover:text-accent shrink-0" }, ["Clear"], () => void actions.clearRadicals())
				: null,
		]),
		el("div", { class: "flex flex-wrap gap-1.5", role: "group", "aria-label": "Matching kanji" }, picker.kanji.map((k) => {
			const tile = button(
				{ class: `${TILE} text-primary hover:bg-accent hover:text-white`, title: k.meanings, "aria-label": `Add ${k.character}, ${k.meanings}` },
				[k.character],
				// Straight into the search field; on a phone without focusing it, so the keyboard stays down.
				() => insertIntoSearch(k.character, false, !isTouch),
			);
			tile.lang = "ja";
			return tile;
		})),
	]);
}

/* Arrow keys walk the enabled radicals, as in the app. */
function arrowNavigation(container: HTMLElement): void {
	container.addEventListener("keydown", (e) => {
		if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
		const buttons = [...container.querySelectorAll<HTMLButtonElement>("[data-radical]:not([disabled])")];
		if (!buttons.length) return;
		e.preventDefault();
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
		buttons[Math.min(Math.max(index + delta, 0), buttons.length - 1)]?.focus();
	});
}

/* A popover under the search field on wide screens, a bottom sheet on phones.
   Neither dims the page: the search field stays visible and editable, because
   that is where tapped kanji go. */
export function renderRadicalPicker(state: AppState, actions: Actions | null): HTMLElement | null {
	const picker = state.radicalPicker;
	if (!picker || !actions) {
		panel = null;
		panelsHost = null;
		return null;
	}
	const isTouch = !matchMedia("(min-width: 768px)").matches;

	const flip = button(
		{ class: "md:hidden shrink-0 w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-border-default text-secondary text-sm", "aria-pressed": String(picker.kanjiFocus) },
		[icon("flip", 16), picker.kanjiFocus ? "More radicals" : "More kanji"],
		() => actions.toggleKanjiFocus(),
	);
	const panels = el("div", { class: "flex flex-col md:flex-row gap-2 md:gap-3 min-h-0 flex-1" }, [
		radicalGrid(picker, actions),
		flip,
		kanjiPanel(picker, actions, isTouch),
	]);

	if (panel && panelsHost) {
		panelsHost.replaceChildren(panels);
		return panel;
	}

	panelsHost = el("div", { class: "flex flex-col min-h-0 flex-1" }, [panels]);
	arrowNavigation(panelsHost);
	panel = el("section", {
		class: `z-40 bg-surface-elevated border border-border-default shadow-xl p-3 flex flex-col
			fixed inset-x-0 bottom-0 h-[62dvh] rounded-t-xl
			md:absolute md:inset-x-0 md:top-full md:bottom-auto md:mt-2 md:h-auto md:rounded-lg
			${picker.justOpened ? "animate-pop-in" : ""}`,
		role: "dialog",
		"aria-label": "Kanji by radical",
	}, [
		el("div", { class: "flex items-center justify-between mb-2 shrink-0" }, [
			el("h2", { class: "section-label" }, ["Kanji by radical"]),
			button({ class: "icon-button", "aria-label": "Close" }, [icon("x", 18)], () => actions.closeRadicalPicker()),
		]),
		panelsHost,
	]);
	panel.addEventListener("keydown", (e) => {
		if (e.key === "Escape") actions.closeRadicalPicker();
	});
	return panel;
}
