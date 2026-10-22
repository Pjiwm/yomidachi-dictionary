import { highLowPattern, parseDownsteps, pitchType, splitMora } from "../search/pitch.ts";
import { el } from "./dom.ts";

function pattern(reading: string, downstep: number): HTMLElement {
	const mora = splitMora(reading);
	const high = highLowPattern(mora.length, downstep);
	const cells = mora.map((m, i) => {
		const step = i > 0 && high[i - 1] !== high[i];
		return el("span", { class: `pitch-mora ${high[i] ? "pitch-high" : "pitch-low"} ${step ? "pitch-step" : ""}` }, [m]);
	});
	const label = `${reading}, pitch accent ${downstep}, ${pitchType(mora.length, downstep)}`;
	return el("span", { class: "inline-flex items-stretch", role: "img", "aria-label": label, lang: "ja" }, [
		...cells,
		downstep === mora.length ? el("span", { class: "pitch-tail" }) : null,
		el("span", { class: "text-muted text-xs ml-1.5 self-center" }, [`[${downstep}]`]),
	]);
}

/* One diagram per downstep in the comma-separated pitch_accent column. */
export function renderPitchDiagram(reading: string, pitchAccent: string): HTMLElement {
	return el(
		"div",
		{ class: "flex flex-wrap gap-x-4 gap-y-2.5" },
		parseDownsteps(pitchAccent).map((d) => pattern(reading, d)),
	);
}
