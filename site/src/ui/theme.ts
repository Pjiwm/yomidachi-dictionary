export type Theme = "light" | "dark";

export function currentTheme(): Theme {
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function toggleTheme(): void {
	const next: Theme = currentTheme() === "dark" ? "light" : "dark";
	document.documentElement.dataset.theme = next;
	try {
		localStorage.setItem("theme", next);
	} catch {
		// Private mode or blocked storage: the choice just doesn't persist.
	}
}

/* Follow the OS while the visitor hasn't picked a theme themselves. */
export function followSystemTheme(): void {
	matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
		let stored: string | null = null;
		try {
			stored = localStorage.getItem("theme");
		} catch {
			// Storage blocked: behave as if nothing was stored.
		}
		if (!stored) document.documentElement.dataset.theme = e.matches ? "dark" : "light";
	});
}
