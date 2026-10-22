import type { AppState } from "../state/state.ts";
import { el } from "./dom.ts";

export function renderPitchDiagram(_state: AppState): HTMLElement {
	return el("div", { "data-view": "PitchDiagram" });
}
