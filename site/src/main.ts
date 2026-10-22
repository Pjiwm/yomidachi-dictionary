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

store.subscribe((state) => root.replaceChildren(renderLayout(state, actions)));
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
		if (import.meta.env.DEV) {
			Object.assign(window, { dict: repository, stats: () => db.worker.getStats() });
		}
	})
	.catch((err: unknown) => {
		store.update({ error: `Could not open the dictionary: ${String(err)}` });
	});
