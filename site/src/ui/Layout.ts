import type { Actions } from "../state/actions.ts";
import type { AppState } from "../state/state.ts";
import { button, el } from "./dom.ts";
import { renderDetail } from "./EntryDetail.ts";
import { renderFooter } from "./Footer.ts";
import { icon } from "./icons.ts";
import { renderLanding } from "./Landing.ts";
import { logo } from "./Logo.ts";
import { renderRadicalPicker } from "./RadicalPicker.ts";
import { renderResultsList } from "./ResultsList.ts";
import { renderSearchBar } from "./SearchBar.ts";
import { currentTheme, toggleTheme } from "./theme.ts";

function themeButton(): HTMLButtonElement {
	const dark = currentTheme() === "dark";
	return button(
		{ class: "icon-button", "aria-label": dark ? "Switch to light theme" : "Switch to dark theme" },
		[icon(dark ? "sun" : "moon", 18)],
		(e) => {
			toggleTheme();
			(e.currentTarget as HTMLButtonElement).replaceWith(themeButton());
		},
	);
}

function wordmark(size: "large" | "small"): HTMLElement {
	const classes = size === "large" ? "text-4xl font-semibold tracking-tight" : "font-semibold tracking-tight";
	const mark = el("span", { class: "self-center" }, [logo(size === "large" ? 40 : 22)]);
	return el("a", { href: "#/", class: `${classes} text-primary flex items-baseline gap-2 shrink-0`, "aria-label": "Yomidachi Dictionary, home" }, [
		mark,
		el("span", {}, ["Yomidachi"]),
		el("span", { class: `text-muted font-normal ${size === "large" ? "text-xl" : "text-sm"}` }, ["Dictionary"]),
	]);
}

function skipLink(): HTMLElement {
	return el("a", { href: "#main", class: "sr-only-focusable" }, ["Skip to content"]);
}

/* Screen readers hear how many results came back without leaving the search field. */
function resultsAnnouncer(state: AppState): HTMLElement {
	let text = "";
	if (state.results && !state.searching) {
		const { words, kanji } = state.results;
		text = words.length + kanji.length === 0 ? "No results" : `${words.length} words and ${kanji.length} kanji`;
	}
	return el("div", { class: "sr-only", "aria-live": "polite", role: "status" }, [text]);
}

function errorBanner(message: string): HTMLElement {
	return el("div", { class: "border-b border-accent bg-accent-bg text-accent text-sm px-4 py-2 flex gap-3" }, [
		el("span", { class: "flex-1" }, [message]),
		el("a", { href: location.href, class: "underline" }, ["Reload"]),
	]);
}

/* Which pane a phone showed last, so only an actual switch animates, not every re-render. */
let lastPane: "list" | "detail" | null = null;

export function renderLayout(state: AppState, actions: Actions | null): HTMLElement {
	if (state.route.kind === "home") {
		lastPane = null;
		const searchBar = renderSearchBar(state, actions, "large");
		return el("div", { class: "min-h-dvh flex flex-col" }, [
			skipLink(),
			el("header", { class: "px-4 py-2 flex justify-end" }, [themeButton()]),
			state.error ? errorBanner(state.error) : null,
			el("main", { id: "main", class: "flex-1 flex flex-col items-center px-4 pt-[5vh] pb-12 gap-6" }, [
				el("h1", { class: "contents" }, [wordmark("large")]),
				el("div", { class: "relative w-full max-w-4xl" }, [searchBar]),
				renderLanding(state),
			]),
			renderFooter(state, actions),
			renderRadicalPicker(state, actions),
		]);
	}

	const showingDetail = state.route.kind !== "search";
	const pane = showingDetail ? "detail" : "list";
	const switched = lastPane !== null && lastPane !== pane;
	lastPane = pane;
	const listMotion = switched && !showingDetail ? "animate-pane-in-left" : "";
	const detailMotion = switched && showingDetail ? "animate-pane-in-right" : "";
	const searchBar = renderSearchBar(state, actions, "compact");
	return el("div", { class: "h-dvh flex flex-col" }, [
		skipLink(),
		// Phones: wordmark and theme on one row, the search bar full width below. Wider: one row.
		el("header", { class: "border-b border-border-subtle px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2" }, [
			wordmark("small"),
			el("div", { class: "ml-auto sm:order-3" }, [themeButton()]),
			el("div", { class: "relative basis-full sm:basis-auto sm:flex-1 sm:max-w-3xl sm:order-2" }, [searchBar]),
		]),
		state.error ? errorBanner(state.error) : null,
		resultsAnnouncer(state),
		el("main", { id: "main", class: "flex-1 min-h-0 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" }, [
			el("div", { class: `min-h-0 border-r border-border-subtle ${showingDetail ? "hidden md:flex" : "flex"} flex-col ${listMotion}` }, [
				renderResultsList(state, actions),
			]),
			el("div", { class: `min-h-0 ${showingDetail ? "flex" : "hidden md:flex"} flex-col ${detailMotion}` }, [
				renderDetail(state, actions),
			]),
		]),
		renderRadicalPicker(state, actions),
	]);
}
