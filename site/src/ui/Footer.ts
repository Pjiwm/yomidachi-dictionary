import type { Actions } from "../state/actions.ts";
import type { AppState } from "../state/state.ts";
import { el } from "./dom.ts";

const SOURCES: [string, string, string][] = [
	["JMdict, KANJIDIC2 and RADKFILE", "https://www.edrdg.org/", "EDRDG, CC BY-SA 3.0"],
	["JLPT lists", "https://www.tanos.co.uk/jlpt/", "Jonathan Waller, CC BY"],
	["Pitch accent", "https://clrd.ninjal.ac.jp/unidic/", "UniDic, NINJAL, BSD 3-Clause"],
	["Word frequency", "https://jiten.moe/frequency-dictionaries", "Jiten, CC BY-SA 4.0"],
];

function link(text: string, href: string): HTMLElement {
	return el("a", { href, class: "underline hover:text-accent", rel: "noopener", target: "_blank" }, [text]);
}

export function renderFooter(_state: AppState, _actions: Actions | null): HTMLElement {
	return el("footer", { class: "border-t border-border-subtle px-4 py-6 text-muted text-xs leading-relaxed" }, [
		el("div", { class: "max-w-2xl mx-auto space-y-2" }, [
			el("p", {}, [
				"Dictionary data: ",
				...SOURCES.flatMap(([name, href, credit], i) => [
					link(name, href),
					` (${credit})`,
					i < SOURCES.length - 1 ? " · " : ".",
				]),
			]),
			el("p", {}, [
				"The database is a derivative work under CC BY-SA. Site source on ",
				link("GitHub", "https://github.com/Pjiwm/vocabulizer-dictionary-cli"),
				", MIT licensed. The Yomidachi name is not covered by that license.",
			]),
		]),
	]);
}
