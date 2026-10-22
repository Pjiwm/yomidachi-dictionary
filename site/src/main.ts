import { DictRepository } from "./db/repository.ts";
import { openDatabase } from "./db/worker.ts";
import { Store } from "./state/state.ts";
import { renderLayout } from "./ui/Layout.ts";

const root = document.getElementById("app");
if (!root) throw new Error("missing #app");

const store = new Store();
store.subscribe((state) => root.replaceChildren(renderLayout(state)));
store.update({});

openDatabase()
	.then((db) => {
		const repository = new DictRepository(db);
		void repository;
	})
	.catch((err: unknown) => {
		store.update({ error: `Could not open the dictionary: ${String(err)}` });
	});
