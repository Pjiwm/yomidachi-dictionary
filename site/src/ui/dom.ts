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
	return button({ class: "icon-button", "aria-label": "Copy", title: "Copy" }, [icon("copy", size)], (e) => {
		e.stopPropagation();
		void navigator.clipboard.writeText(text);
	});
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
