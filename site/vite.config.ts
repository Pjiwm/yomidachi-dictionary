import { existsSync, readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/* Counts for the landing page, written by scripts/prepare_site_db.py next to
   the database. Baked in at build time so the page never re-renders for them. */
const metaPath = new URL("./public/db/meta.json", import.meta.url);
const dictionaryMeta = existsSync(metaPath) ? readFileSync(metaPath, "utf8") : "null";

// VITE_BASE is "/" on the custom domain and "/<repo>/" on the project page.
export default defineConfig({
	base: process.env.VITE_BASE ?? "/",
	plugins: [tailwindcss()],
	define: { __DICTIONARY_META__: dictionaryMeta },
	// Vite's static server honours Range requests but does not advertise it.
	server: { headers: { "Accept-Ranges": "bytes" } },
});
