import { withToken } from "../search/filters.ts";
import { icon } from "./icons.ts";

/* Tiny element builder so views stay readable without a framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: Record<string, string> = {},
	children: (Node | string | null | false)[] = [],
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	for (const [key, value] of Object.entries(attrs)) {
		node.setAttribute(key, value);
	}
	node.append(...children.filter((c): c is Node | string => c !== null && c !== false));
	return node;
}

export function button(
	attrs: Record<string, string>,
	children: (Node | string)[],
	onClick: (event: MouseEvent) => void,
): HTMLButtonElement {
	const node = el("button", { type: "button", ...attrs }, children);
	node.addEventListener("click", onClick);
	return node;
}

export function copyButton(text: string, size = 16): HTMLButtonElement {
	const label = `Copy ${text.length > 40 ? `${text.slice(0, 40)}…` : text}`;
	return button({ class: "icon-button", "aria-label": label, title: "Copy" }, [icon("copy", size)], (e) => {
		e.stopPropagation();
		void navigator.clipboard.writeText(text);
	});
}

/* An in-app link: real navigation for the keyboard, middle-click and screen readers. */
export function link(href: string, attrs: Record<string, string>, children: (Node | string | null | false)[]): HTMLAnchorElement {
	return el("a", { href, ...attrs }, children);
}

/* Japanese text gets its language marked so screen readers switch voice. */
export function ja(tag: "span" | "div" | "h1", attrs: Record<string, string>, children: (Node | string)[]): HTMLElement {
	return el(tag, { ...attrs, lang: "ja" }, children);
}

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/* Native <details> snaps open and shut; this slides the content instead. */
export function animatedDetails(attrs: Record<string, string>, summary: HTMLElement, content: HTMLElement): HTMLDetailsElement {
	const details = el("details", attrs, [summary, content]);
	content.style.overflow = "hidden";
	let animation: Animation | null = null;

	summary.addEventListener("click", (e) => {
		e.preventDefault();
		if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
			details.open = !details.open;
			return;
		}
		animation?.cancel();
		if (details.open) {
			animation = content.animate([{ height: `${content.offsetHeight}px` }, { height: "0px" }], { duration: 220, easing: EASE });
			animation.onfinish = () => {
				details.open = false;
				animation = null;
			};
		} else {
			details.open = true;
			animation = content.animate([{ height: "0px" }, { height: `${content.scrollHeight}px` }], { duration: 260, easing: EASE });
			animation.onfinish = () => {
				animation = null;
			};
		}
	});
	return details;
}

/* A placeholder block the size of the text it stands in for. */
export function bone(width: string, height = "0.75rem", extra = ""): HTMLElement {
	return el("div", { class: `rounded bg-primary/8 ${extra}`, style: `width: ${width}; height: ${height}` });
}

/* A pulsing group of bones; aria-busy so screen readers skip the shapes. */
export function skeleton(children: HTMLElement[], extra = ""): HTMLElement {
	return el("div", { class: `animate-pulse ${extra}`, "aria-busy": "true" }, children);
}

/* Appends to the search field without submitting, so chips and the radical
   picker compose a query the visitor sends when ready. */
export function insertIntoSearch(text: string, asToken: boolean): void {
	const input = document.querySelector<HTMLInputElement>('input[data-draft="q"]');
	if (!input) return;
	input.value = asToken ? withToken(input.value, text) : input.value + text;
	input.focus();
}

/* A tag chip that adds its filter to the search field when clicked. */
export function filterChip(label: string, token: string, extra = "chip"): HTMLElement {
	return button(
		{ class: `${extra} hover:border-accent hover:text-accent transition-colors`, title: token },
		[label],
		() => insertIntoSearch(token, true),
	);
}
