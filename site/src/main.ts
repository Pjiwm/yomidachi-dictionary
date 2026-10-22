import { DictRepository } from "./db/repository.ts";
import { openDatabase } from "./db/worker.ts";
import { Actions } from "./state/actions.ts";
import { Store } from "./state/state.ts";
import { renderLayout } from "./ui/Layout.ts";
import { followSystemTheme } from "./ui/theme.ts";

const root = document.getElementById("app");
if (!root) throw new Error("missing #app");

const store = new Store();
let actions: Actions | null = null;

const narrowScreen = matchMedia("(max-width: 767px)");
let lastDetail: unknown = null;

/* Every update rebuilds the DOM, so unsent text in the search field and the
   scroll position of each pane have to survive the swap. */
store.subscribe((state) => {
	const previous = root.querySelector<HTMLInputElement>("input[name=q]");
	const draft = previous && document.activeElement === previous ? { value: previous.value, cursor: previous.selectionStart } : null;
	const scrolls = new Map<string, number>();
	for (const pane of root.querySelectorAll<HTMLElement>("[data-scroll]")) {
		scrolls.set(pane.dataset.scroll ?? "", pane.scrollTop);
	}
	root.replaceChildren(renderLayout(state, actions));
	for (const pane of root.querySelectorAll<HTMLElement>("[data-scroll]")) {
		pane.scrollTop = scrolls.get(pane.dataset.scroll ?? "") ?? 0;
	}

	if (draft) {
		const input = root.querySelector<HTMLInputElement>("input[name=q]");
		if (input) {
			input.value = draft.value;
			input.focus();
			input.setSelectionRange(draft.cursor, draft.cursor);
		}
	}

	// On a phone the entry replaces the list, so focus follows it; on a desktop the list stays put.
	const detailArrived = state.detail && state.detail !== lastDetail && !draft;
	lastDetail = state.detail;
	if (detailArrived && narrowScreen.matches) {
		root.querySelector<HTMLElement>("[data-detail-heading]")?.focus({ preventScroll: true });
	}
});
store.update({});
followSystemTheme();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
	});
}


openDatabase()
	.then((db) => {
		const repository = new DictRepository(db);
		actions = new Actions(store, repository);
		window.addEventListener("hashchange", () => void actions?.onRoute(location.hash));
		void actions.onRoute(location.hash);
		void repository.warmUp();
		if (import.meta.env.DEV) {
			Object.assign(window, { dict: repository, stats: () => db.worker.getStats() });
		}
	})
	.catch((err: unknown) => {
		store.update({ error: `Could not open the dictionary: ${String(err)}` });
	});
