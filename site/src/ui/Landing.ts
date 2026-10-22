import {
	DIALECT_FILTERS,
	type FilterOption,
	GRADE_FILTERS,
	IS_FILTERS,
	JLPT_FILTERS,
	PITCH_FILTERS,
	POS_FILTERS,
	TOPIC_FILTERS,
} from "../search/filters.ts";
import type { AppState } from "../state/state.ts";
import { animatedDetails, button, el, insertIntoSearch } from "./dom.ts";
import { icon } from "./icons.ts";

interface FilterGroup {
	title: string;
	prefix: string;
	options: FilterOption[];
	note?: string;
}

const GROUPS: FilterGroup[] = [
	{ title: "Part of speech", prefix: "pos", options: POS_FILTERS },
	{ title: "Properties", prefix: "is", options: IS_FILTERS },
	{ title: "JLPT level", prefix: "jlpt", options: JLPT_FILTERS, note: "Ranges work too: jlpt:n3-n1" },
	{ title: "Pitch accent", prefix: "pitch", options: PITCH_FILTERS },
	{ title: "Topic", prefix: "topic", options: TOPIC_FILTERS },
	{ title: "Dialect", prefix: "dialect", options: DIALECT_FILTERS },
	{ title: "Kanji grade", prefix: "grade", options: GRADE_FILTERS, note: "Ranges work too: grade:1-3" },
	{ title: "Kanji strokes", prefix: "strokes", options: [], note: "Any number or range: strokes:8, strokes:3-5" },
];

/* The handful most people reach for; everything else sits behind "All filters". */
const QUICK: [string, string][] = [
	["pos:verb", "verb"],
	["pos:noun", "noun"],
	["pos:adjective", "adjective"],
	["pos:expression", "expression"],
	["is:common", "common"],
	["is:kanji", "kanji only"],
	["jlpt:n5", "N5"],
	["jlpt:n4", "N4"],
	["jlpt:n3", "N3"],
	["jlpt:n2", "N2"],
	["jlpt:n1", "N1"],
	["pitch:heiban", "heiban"],
	["grade:joyo", "jōyō kanji"],
];

const SYNTAX: [string, string][] = [
	["not:", "in front of any filter negates it: not:jlpt:n5"],
	["*", "matches any run of characters: 食*る"],
	["?", "matches exactly one character: 食べ?"],
];

function format(n: number): string {
	return n.toLocaleString("en-US");
}

function code(text: string): HTMLElement {
	return el("code", { class: "font-mono text-sm text-primary bg-surface-sunken px-1.5 py-0.5 rounded" }, [text]);
}

function chipButton(token: string, label: string): HTMLElement {
	return button({ class: "chip hover:border-accent hover:text-accent transition-colors", title: token }, [label], () => insertIntoSearch(token, true));
}

function group(g: FilterGroup): HTMLElement {
	const chips = g.options.map((o) => chipButton(`${g.prefix}:${o.key}`, o.label));
	return animatedDetails(
		{ class: "group border-b border-border-subtle" },
		el("summary", { class: "flex items-center justify-between py-2 cursor-pointer list-none text-sm text-primary" }, [
			el("span", {}, [g.title, " ", el("span", { class: "text-muted" }, [`${g.prefix}:`])]),
			el("span", { class: "text-muted transition-transform duration-300 group-open:rotate-180" }, [icon("chevronDown", 14)]),
		]),
		el("div", {}, [
			el("div", { class: "pb-3 flex flex-wrap gap-1.5" }, chips),
			g.note ? el("p", { class: "text-muted text-xs pb-3" }, [g.note]) : null,
		]),
	);
}

export function renderLanding(state: AppState): HTMLElement {
	const meta = state.meta;
	const inside = meta
		? `${format(meta.words)} words and ${format(meta.kanji)} kanji, with pitch accent, JLPT levels and frequency ranks. Data as of ${meta.builtAt}.`
		: "Words and kanji with pitch accent, JLPT levels and frequency ranks.";

	return el("section", { class: "w-full max-w-4xl" }, [
		el("p", { class: "text-secondary text-sm leading-relaxed" }, [
			`${inside} Type Japanese in kanji or kana, or an English word. Filters go after the text, like `,
			code("eat pos:verb jlpt:n5"),
			", or click one:",
		]),
		el("div", { class: "flex flex-wrap gap-1.5 mt-3" }, QUICK.map(([token, label]) => chipButton(token, label))),
		animatedDetails(
			{ class: "group mt-4" },
			el("summary", { class: "inline-flex items-center gap-1 cursor-pointer list-none text-sm text-muted hover:text-secondary" }, [
				"All filters and syntax",
				el("span", { class: "transition-transform duration-300 group-open:rotate-180" }, [icon("chevronDown", 14)]),
			]),
			el("div", {}, [
				el("div", { class: "mt-2 border-t border-border-subtle" }, GROUPS.map((g) => group(g))),
				el("dl", { class: "grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm mt-4" }, SYNTAX.flatMap(([syntax, help]) => [
					el("dt", {}, [code(syntax)]),
					el("dd", { class: "text-secondary" }, [help]),
				])),
			]),
		),
	]);
}
