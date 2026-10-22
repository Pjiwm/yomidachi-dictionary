import type { Actions } from "../state/actions.ts";
import { navigate } from "../state/router.ts";
import type { AppState, RadicalPicker } from "../state/state.ts";
import type { Radical } from "../types.ts";
import { button, el } from "./dom.ts";
import { icon } from "./icons.ts";

/* The query being composed in the picker. It starts from whatever the search
   field holds when the picker opens, grows as kanji are tapped, and is handed
   back to the search field on close. Module state, not store state, because a
   keystroke should not re-render the whole app. */
let draft = "";

function groupByStrokes(radicals: Radical[]): [number, Radical[]][] {
	const groups = new Map<number, Radical[]>();
	for (const r of radicals) groups.set(r.strokes, [...(groups.get(r.strokes) ?? []), r]);
	return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

const TILE = "w-10 h-10 md:w-9 md:h-9 rounded-md text-lg flex items-center justify-center transition-colors";

function radicalGrid(picker: RadicalPicker, actions: Actions, isTouch: boolean): HTMLElement {
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
	// Phones: the grid shrinks to a strip while the kanji panel has focus.
	const height = isTouch ? (picker.kanjiFocus ? "max-h-[16dvh]" : "max-h-[42dvh]") : "md:max-h-[60vh]";
	return el(
		"div",
		{ class: `overflow-y-auto overscroll-contain min-h-0 md:w-1/2 md:border-r md:border-border-subtle md:pr-3 ${height}`, role: "group", "aria-label": "Radicals", "data-scroll": "radicals" },
		[el("div", { class: "flex flex-wrap gap-1.5 content-start" }, tiles)],
	);
}

function kanjiPanel(picker: RadicalPicker, actions: Actions, isTouch: boolean, insert: (kanji: string) => void): HTMLElement {
	const summary =
		picker.selected.length === 0
			? "Pick one or more radicals to find a kanji."
			: picker.total > picker.kanji.length
				? `${picker.total} kanji, showing the first ${picker.kanji.length}.`
				: `${picker.total} kanji.`;
	const height = isTouch ? (picker.kanjiFocus ? "max-h-[56dvh]" : "max-h-[30dvh]") : "md:max-h-[60vh]";
	return el("div", { class: `overflow-y-auto overscroll-contain min-h-0 md:w-1/2 ${height}`, "data-scroll": "radical-matches" }, [
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
				() => insert(k.character),
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

export function openDraft(initial: string): void {
	draft = initial;
}

export function renderRadicalPicker(state: AppState, actions: Actions | null): HTMLElement | null {
	const picker = state.radicalPicker;
	if (!picker || !actions) return null;
	const isTouch = !matchMedia("(min-width: 768px)").matches;

	const submit = () => {
		const query = draft.trim();
		actions.closeRadicalPicker();
		navigate(query ? { kind: "search", query } : { kind: "home" });
	};
	const close = () => {
		// The composed query goes back to the search field so nothing picked is lost.
		const field = document.querySelector<HTMLInputElement>('input[data-draft="q"]');
		if (field) field.value = draft;
		actions.closeRadicalPicker();
	};

	const queryInput = el("input", {
		type: "text",
		value: draft,
		"data-draft": "radical",
		placeholder: "Type here or tap kanji below",
		autocomplete: "off",
		enterkeyhint: "search",
		"aria-label": "Search query",
		class: "flex-1 min-w-0 bg-transparent outline-none text-primary text-sm",
	});
	queryInput.addEventListener("input", () => {
		draft = queryInput.value;
	});
	queryInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			submit();
		}
	});
	const insert = (kanji: string) => {
		draft += kanji;
		queryInput.value = draft;
		// Keep typing and picking together on desktop; on a phone focusing would raise the keyboard over the sheet.
		if (!isTouch) queryInput.focus();
	};
	const queryField = el("div", { class: "flex items-center gap-2 mb-3 px-3 h-10 rounded-lg bg-surface border border-border-default focus-within:border-accent" }, [
		el("span", { class: "text-muted shrink-0" }, [icon("search", 14)]),
		queryInput,
		button({ class: "text-xs text-muted hover:text-accent shrink-0" }, ["Search"], submit),
	]);

	const flip = isTouch
		? button(
				{ class: "md:hidden shrink-0 w-full flex items-center justify-center gap-2 h-11 rounded-lg border border-border-default text-secondary text-sm", "aria-pressed": String(picker.kanjiFocus) },
				[icon("flip", 16), picker.kanjiFocus ? "Show more radicals" : "Show more kanji"],
				() => actions.toggleKanjiFocus(),
			)
		: null;

	const panels = el("div", { class: "flex flex-col md:flex-row gap-2 md:gap-3 min-h-0" }, [
		radicalGrid(picker, actions, isTouch),
		flip,
		kanjiPanel(picker, actions, isTouch, insert),
	]);
	arrowNavigation(panels);

	const card = el("div", {
		class: `bg-surface-elevated shadow-xl p-4 md:p-5 w-full md:max-w-2xl md:mx-4 md:rounded-xl rounded-t-xl ${picker.justOpened ? "animate-pop-in" : ""}`,
		role: "dialog",
		"aria-modal": "true",
		"aria-label": "Kanji by radical",
	}, [
		el("div", { class: "flex items-center justify-between mb-3" }, [
			el("h2", { class: "text-primary text-lg font-semibold" }, ["Kanji by radical"]),
			button({ class: "icon-button", "aria-label": "Close" }, [icon("x", 20)], close),
		]),
		queryField,
		panels,
	]);
	card.addEventListener("click", (e) => e.stopPropagation());
	card.addEventListener("keydown", (e) => {
		if (e.key === "Escape") close();
	});

	// Desktop: centred modal over a dimmed page. Phones: bottom sheet.
	const overlay = el("div", { class: "fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/35 backdrop-blur-[2px]" }, [card]);
	overlay.addEventListener("click", close);
	return overlay;
}
