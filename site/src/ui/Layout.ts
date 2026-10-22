import { withToken } from "../search/filters.ts";
import type { Actions } from "../state/actions.ts";
import type { AppState } from "../state/state.ts";
import { button, el } from "./dom.ts";
import { renderDetail } from "./EntryDetail.ts";
import { renderFooter } from "./Footer.ts";
import { icon } from "./icons.ts";
import { renderLanding } from "./Landing.ts";
import { logo } from "./Logo.ts";
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
	return el("a", { href: "#/", class: `${classes} text-primary flex items-baseline gap-2` }, [
		mark,
		"Yomidachi",
		el("span", { class: `text-muted font-normal ${size === "large" ? "text-xl" : "text-sm"}` }, ["Dictionary"]),
	]);
}

function errorBanner(message: string): HTMLElement {
	return el("div", { class: "border-b border-accent bg-accent-bg text-accent text-sm px-4 py-2 flex gap-3" }, [
		el("span", { class: "flex-1" }, [message]),
		el("a", { href: location.href, class: "underline" }, ["Reload"]),
	]);
}

export function renderLayout(state: AppState, actions: Actions | null): HTMLElement {
	if (state.route.kind === "home") {
		const searchBar = renderSearchBar(state, actions, "large");
		const input = searchBar.querySelector("input");
		const insertToken = (token: string) => {
			if (!input) return;
			input.value = withToken(input.value, token);
			input.focus();
		};
		return el("div", { class: "min-h-dvh flex flex-col" }, [
			el("header", { class: "px-4 py-2 flex justify-end" }, [themeButton()]),
			state.error ? errorBanner(state.error) : null,
			el("main", { class: "flex-1 flex flex-col items-center px-4 pt-[5vh] pb-12 gap-6" }, [
				wordmark("large"),
				el("div", { class: "w-full max-w-4xl" }, [searchBar]),
				renderLanding(state, insertToken),
			]),
			renderFooter(state, actions),
		]);
	}

	const showingDetail = state.route.kind !== "search";
	return el("div", { class: "h-dvh flex flex-col" }, [
		el("header", { class: "border-b border-border-subtle px-4 py-2 flex items-center gap-4" }, [
			wordmark("small"),
			el("div", { class: "flex-1 max-w-3xl" }, [renderSearchBar(state, actions, "compact")]),
			el("div", { class: "ml-auto" }, [themeButton()]),
		]),
		state.error ? errorBanner(state.error) : null,
		el("main", { class: "flex-1 min-h-0 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" }, [
			el("div", { class: `min-h-0 border-r border-border-subtle ${showingDetail ? "hidden md:flex" : "flex"} flex-col` }, [
				renderResultsList(state, actions),
			]),
			el("div", { class: `min-h-0 ${showingDetail ? "flex" : "hidden md:flex"} flex-col` }, [
				renderDetail(state, actions),
			]),
		]),
	]);
}
