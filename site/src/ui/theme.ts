export type Theme = "light" | "dark";

export function currentTheme(): Theme {
	return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/* Elements with their own color transitions would otherwise fade at
   different speeds while the surfaces switch instantly, which reads as flicker. */
function switchTheme(next: Theme): void {
	const root = document.documentElement;
	root.classList.add("theme-switching");
	root.dataset.theme = next;
	requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
}

export function toggleTheme(): void {
	const next: Theme = currentTheme() === "dark" ? "light" : "dark";
	switchTheme(next);
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
		if (!stored) switchTheme(e.matches ? "dark" : "light");
	});
}
