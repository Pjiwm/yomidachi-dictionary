import type { Actions } from "../state/actions.ts";
import { navigate } from "../state/router.ts";
import type { AppState } from "../state/state.ts";
import { button, el } from "./dom.ts";
import { icon } from "./icons.ts";

export function renderSearchBar(state: AppState, actions: Actions | null, size: "large" | "compact"): HTMLElement {
	const input = el("input", {
		type: "text",
		name: "q",
		inputmode: "search",
		enterkeyhint: "search",
		value: state.query,
		placeholder: "Japanese or English, e.g. 食べる, たべる, eat",
		autocomplete: "off",
		autocapitalize: "off",
		spellcheck: "false",
		"aria-label": "Search the dictionary",
		class: size === "large" ? "search-input text-lg pl-12 pr-24 py-3" : "search-input text-base pl-10 pr-20 py-2",
	});
	if (size === "large" && matchMedia("(hover: hover)").matches) input.autofocus = true;

	const radicals = button(
		{
			class: `absolute inset-y-0 right-0 flex items-center justify-center min-w-11 text-muted hover:text-primary transition-colors ${state.radicalPicker ? "text-accent" : ""}`,
			"aria-label": "Find kanji by radical",
			title: "Find kanji by radical",
			"aria-expanded": String(Boolean(state.radicalPicker)),
		},
		[el("span", { class: `font-medium leading-none ${size === "large" ? "text-lg" : "text-base"}` }, ["部"])],
		() => (state.radicalPicker ? actions?.closeRadicalPicker() : void actions?.openRadicalPicker()),
	);
	const clear = button(
		{ class: "absolute inset-y-0 right-11 flex items-center justify-center min-w-10 text-muted hover:text-primary transition-colors", "aria-label": "Clear search" },
		[icon("x", size === "large" ? 18 : 16)],
		() => {
			input.value = "";
			input.focus();
			syncClear();
		},
	);
	const form = el("form", { role: "search", class: "relative" }, [
		el("button", { type: "submit", "aria-label": "Search", class: `absolute inset-y-0 left-0 flex items-center justify-center text-muted hover:text-primary transition-colors ${size === "large" ? "w-12" : "w-10"}` }, [
			icon("search", size === "large" ? 20 : 16),
		]),
		input,
		clear,
		radicals,
	]);
	const syncClear = () => clear.classList.toggle("hidden", input.value === "");
	input.addEventListener("input", syncClear);
	form.addEventListener("submit", (e) => {
		e.preventDefault();
		const query = input.value.trim();
		navigate(query ? { kind: "search", query } : { kind: "home" });
	});
	syncClear();
	return form;
}
