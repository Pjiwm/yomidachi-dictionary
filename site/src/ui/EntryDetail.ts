import type { Actions } from "../state/actions.ts";
import { navigate } from "../state/router.ts";
import type { AppState, WordDetail } from "../state/state.ts";
import { tokenForCode } from "../search/filters.ts";
import { formatPos, posCodes, posLabel } from "../search/pos.ts";
import type { DictEntry, KanjiEntry } from "../types.ts";
import { bone, button, copyButton, el, filterChip, skeleton } from "./dom.ts";
import { icon } from "./icons.ts";
import { renderKanjiDetail } from "./KanjiDetail.ts";
import { renderPitchDiagram } from "./PitchDiagram.ts";

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const k = key(item);
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}

export function backBar(query: string): HTMLElement {
	return el("div", { class: "md:hidden sticky top-0 z-10 flex items-center border-b border-border-subtle bg-surface" }, [
		button({ class: "icon-button", "aria-label": "Back to results" }, [icon("back", 24)], () =>
			navigate(query ? { kind: "search", query } : { kind: "home" }),
		),
		el("span", { class: "font-medium" }, ["Results"]),
	]);
}

function section(title: string, children: (Node | string | null)[]): HTMLElement {
	return el("section", { class: "border-t border-border-subtle pt-4 mt-4" }, [
		el("h2", { class: "section-label mb-3" }, [title]),
		...children,
	]);
}

function senseRow(sense: DictEntry, index: number, actions: Actions | null): HTMLElement {
	const references = sense.references.length
		? el("div", { class: "text-muted text-xs mt-1 flex flex-wrap items-center gap-x-1" }, [
				"See also",
				...sense.references.map((ref, i) =>
					el("span", {}, [
						button({ class: "text-accent hover:underline" }, [ref], () => {
							void actions?.followReference(ref).then((route) => route && navigate(route));
						}),
						i < sense.references.length - 1 ? "," : "",
					]),
				),
			])
		: null;
	const posLabels = formatPos(sense.pos).join("、");
	return el("div", { class: "flex gap-2 items-start py-2" }, [
		el("span", { class: "text-accent text-sm font-semibold shrink-0 w-6 text-right mt-0.5" }, [`${index + 1}.`]),
		el("div", { class: "flex-1 min-w-0" }, [
			el("div", { class: "flex items-center gap-1" }, [
				el("span", { class: "text-primary text-sm" }, [sense.translation]),
				copyButton(sense.translation, 14),
			]),
			posLabels ? el("div", { class: "text-muted text-xs mt-0.5" }, [posLabels]) : null,
			references,
		]),
	]);
}

function kanjiRow(k: KanjiEntry, query: string): HTMLElement {
	const line = [k.strokeCount && `${k.strokeCount} strokes`, k.jlptLevel && `JLPT N${k.jlptLevel}`, k.grade && `Grade ${k.grade}`]
		.filter(Boolean)
		.join(" · ");
	return el("div", { class: "mb-5 flex gap-4 items-start" }, [
		button({ class: "text-5xl text-primary font-semibold shrink-0 w-16 text-center hover:text-accent transition-colors" }, [k.character], () =>
			navigate({ kind: "kanji", character: k.character, query }),
		),
		el("div", { class: "flex-1 min-w-0" }, [
			el("div", { class: "text-primary text-sm font-medium" }, [k.meanings]),
			line ? el("div", { class: "text-muted text-xs mt-1.5" }, [line]) : null,
			k.readingsKun ? el("div", { class: "text-sm mt-1.5" }, [el("span", { class: "text-muted" }, ["Kun: "]), el("span", { class: "text-secondary" }, [k.readingsKun.split(" ").join("、 ")])]) : null,
			k.readingsOn ? el("div", { class: "text-sm mt-0.5" }, [el("span", { class: "text-muted" }, ["On: "]), el("span", { class: "text-secondary" }, [k.readingsOn.split(" ").join("、 ")])]) : null,
		]),
	]);
}

function wordDetail(detail: WordDetail, query: string, actions: Actions | null): HTMLElement {
	const primary = detail.senses[0];
	const senses = uniqueBy(detail.senses, (s) => s.translation);
	const otherForms = uniqueBy(
		detail.senses.filter((s) => s.term !== primary.term || s.reading !== primary.reading),
		(s) => `${s.term}|${s.reading}`,
	);
	const copyAll = () => {
		const translations = senses.map((s) => s.translation).join("; ");
		void navigator.clipboard.writeText(`${primary.term}【${primary.reading}】/ ${translations}`);
	};

	return el("article", { class: "p-6" }, [
		el("div", { class: "flex justify-between items-start gap-4" }, [
			el("div", {}, [
				el("div", { class: "flex items-center gap-2" }, [
					el("h1", { class: "text-4xl text-primary font-semibold" }, [primary.term]),
					copyButton(primary.term),
				]),
				el("div", { class: "flex items-center gap-2 mt-1 text-lg" }, [
					primary.pitchAccent
						? renderPitchDiagram(primary.reading, primary.pitchAccent)
						: el("span", { class: "text-muted" }, [primary.reading]),
					copyButton(primary.reading),
				]),
			]),
			button({ class: "flex items-center gap-1.5 px-3 py-2 border border-border-default rounded-lg text-muted hover:text-accent hover:border-accent transition-colors text-sm shrink-0" }, [icon("copy", 16), "Copy entry"], copyAll),
		]),
		el("div", { class: "flex gap-2 mt-3 flex-wrap" }, [
			primary.frequency > 0 ? filterChip("common", "is:common", query, "chip border-common text-common") : null,
			primary.jlptLevel ? filterChip(`JLPT N${primary.jlptLevel}`, `jlpt:n${primary.jlptLevel}`, query) : null,
			...posCodes(primary.pos).map((code) => {
				const label = posLabel(code);
				const token = tokenForCode(code);
				if (!label) return null;
				return token ? filterChip(label, token, query, "chip-filled") : el("span", { class: "chip-filled" }, [label]);
			}),
		]),
		section("Meanings", senses.map((s, i) => senseRow(s, i, actions))),
		otherForms.length
			? section("Other forms", otherForms.map((f) => el("div", { class: "text-primary text-sm mb-1" }, [f.term, " ", el("span", { class: "text-muted" }, [`【${f.reading}】`])])))
			: null,
		detail.kanji.length ? section("Kanji", detail.kanji.map((k) => kanjiRow(k, query))) : null,
	]);
}

export function renderDetail(state: AppState, actions: Actions | null): HTMLElement {
	const centered = (text: string) => el("div", { class: "flex-1 flex items-center justify-center text-muted text-sm p-6" }, [text]);
	let body: HTMLElement;
	if (state.detailLoading) {
		// Same shape as an entry: headword, reading, chips, then numbered meanings.
		body = skeleton(
			[
				bone("9rem", "2.25rem", "mb-3"),
				bone("5rem", "1.125rem", "mb-4"),
				el("div", { class: "flex gap-2 mb-8" }, [bone("4rem", "1.25rem"), bone("5rem", "1.25rem")]),
				...["70%", "55%", "80%", "45%"].map((w) =>
					el("div", { class: "flex gap-3 items-center mb-4" }, [bone("1rem", "0.875rem"), bone(w, "0.875rem")]),
				),
			],
			"p-6",
		);
	}
	else if (!state.detail) body = centered("Select a word to see its entry.");
	else if (state.detail.kind === "missing") body = centered("Not found.");
	else if (state.detail.kind === "kanji") body = renderKanjiDetail(state.detail.entry, state.query);
	else body = wordDetail(state.detail, state.query, actions);

	return el("div", { class: "flex-1 min-h-0 overflow-y-auto flex flex-col" }, [
		state.route.kind !== "search" ? backBar(state.query) : null,
		body,
	]);
}
