import type { AppState } from "../state/state.ts";
import { el } from "./dom.ts";

export function renderRadicalPicker(_state: AppState): HTMLElement {
	return el("div", { "data-view": "RadicalPicker" });
}
