import type { Actions } from "../state/actions.ts";
import type { AppState } from "../state/state.ts";
import { el } from "./dom.ts";

export function renderEntryDetail(_state: AppState, _actions: Actions | null): HTMLElement {
	return el("div", { "data-view": "EntryDetail" });
}
