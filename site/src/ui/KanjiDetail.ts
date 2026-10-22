import type { KanjiEntry } from "../types.ts";
import { button, copyButton, el } from "./dom.ts";
import { icon } from "./icons.ts";

function readings(title: string, value: string): HTMLElement | null {
	if (!value) return null;
	return el("section", { class: "border-t border-border-subtle pt-4 mt-5" }, [
		el("h2", { class: "section-label mb-2" }, [title]),
		el("div", { class: "text-primary text-sm leading-relaxed" }, [value.split(" ").join("、 ")]),
	]);
}

export function renderKanjiDetail(k: KanjiEntry): HTMLElement {
	const copyAll = () => {
		const parts = [k.character, k.readingsKun && `訓: ${k.readingsKun}`, k.readingsOn && `音: ${k.readingsOn}`, k.meanings];
		void navigator.clipboard.writeText(parts.filter(Boolean).join(" / "));
	};
	return el("article", { class: "p-6" }, [
		el("div", { class: "flex justify-between items-start gap-4 mb-2" }, [
			el("div", { class: "flex items-center gap-3" }, [
				el("h1", { class: "text-7xl text-primary font-light leading-none" }, [k.character]),
				copyButton(k.character),
			]),
			button({ class: "flex items-center gap-1.5 px-3 py-2 border border-border-default rounded-lg text-muted hover:text-accent hover:border-accent transition-colors text-sm shrink-0" }, [icon("copy", 16), "Copy entry"], copyAll),
		]),
		el("div", { class: "text-secondary text-base leading-relaxed mb-4" }, [k.meanings]),
		el("div", { class: "flex gap-2 flex-wrap" }, [
			k.strokeCount ? el("span", { class: "chip" }, [`${k.strokeCount} strokes`]) : null,
			k.jlptLevel ? el("span", { class: "chip" }, [`JLPT N${k.jlptLevel}`]) : null,
			k.grade ? el("span", { class: "chip" }, [`Grade ${k.grade}`]) : null,
		]),
		readings("Kunyomi", k.readingsKun),
		readings("Onyomi", k.readingsOn),
	]);
}
