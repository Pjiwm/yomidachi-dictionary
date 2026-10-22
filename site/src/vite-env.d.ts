/// <reference types="vite/client" />

import type { DictionaryMeta } from "./state/state.ts";

declare global {
	/* Injected by vite.config.ts from public/db/meta.json. */
	const __DICTIONARY_META__: DictionaryMeta | null;
}
