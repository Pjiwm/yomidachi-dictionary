/* Tiny element builder so views stay readable without a framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: Record<string, string> = {},
	children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	for (const [key, value] of Object.entries(attrs)) {
		node.setAttribute(key, value);
	}
	node.append(...children);
	return node;
}

export function replaceChildren(target: HTMLElement, ...children: (Node | string)[]): void {
	target.replaceChildren(...children);
}
