import type { Actions } from "../state/actions.ts";
import { navigate } from "../state/router.ts";
import type { AppState } from "../state/state.ts";
import { el } from "./dom.ts";
import { icon } from "./icons.ts";

export function renderSearchBar(state: AppState, actions: Actions | null, size: "large" | "compact"): HTMLElement {
	const input = el("input", {
		type: "search",
		name: "q",
		value: state.query,
		placeholder: "Japanese or English, e.g. 食べる, たべる, eat",
		autocomplete: "off",
		autocapitalize: "off",
		spellcheck: "false",
		"aria-label": "Search the dictionary",
		class: size === "large" ? "search-input text-lg pl-12 pr-4 py-3" : "search-input text-sm pl-10 pr-3 py-1.5",
	});
	if (!actions) input.disabled = true;
	if (size === "large") input.autofocus = true;

	const form = el("form", { role: "search", class: "relative" }, [
		el("span", { class: `absolute inset-y-0 flex items-center text-muted pointer-events-none ${size === "large" ? "left-4" : "left-3"}` }, [
			icon("search", size === "large" ? 20 : 16),
		]),
		input,
	]);
	form.addEventListener("submit", (e) => {
		e.preventDefault();
		const query = input.value.trim();
		navigate(query ? { kind: "search", query } : { kind: "home" });
	});
	return form;
}
