import type { Actions } from "../state/actions.ts";
import { navigate } from "../state/router.ts";
import type { AppState } from "../state/state.ts";
import { button, el } from "./dom.ts";
import { icon } from "./icons.ts";

export function renderSearchBar(state: AppState, _actions: Actions | null, size: "large" | "compact"): HTMLElement {
	const input = el("input", {
		type: "text",
		name: "q",
		value: state.query,
		placeholder: "Japanese or English, e.g. 食べる, たべる, eat",
		autocomplete: "off",
		autocapitalize: "off",
		spellcheck: "false",
		"aria-label": "Search the dictionary",
		class: size === "large" ? "search-input text-lg pl-12 pr-12 py-3" : "search-input text-base pl-10 pr-10 py-2",
	});
	if (size === "large") input.autofocus = true;

	const clear = button(
		{ class: `absolute inset-y-0 right-0 flex items-center text-muted hover:text-primary transition-colors ${size === "large" ? "px-4" : "px-3"}`, "aria-label": "Clear search" },
		[icon("x", size === "large" ? 18 : 16)],
		() => {
			input.value = "";
			input.focus();
			syncClear();
		},
	);
	const form = el("form", { role: "search", class: "relative" }, [
		el("span", { class: `absolute inset-y-0 flex items-center text-muted pointer-events-none ${size === "large" ? "left-4" : "left-3"}` }, [
			icon("search", size === "large" ? 20 : 16),
		]),
		input,
		clear,
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
