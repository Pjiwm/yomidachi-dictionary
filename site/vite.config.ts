import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// VITE_BASE is "/" on the custom domain and "/<repo>/" on the project page.
export default defineConfig({
	base: process.env.VITE_BASE ?? "/",
	plugins: [tailwindcss()],
	// Vite's static server honours Range requests but does not advertise it.
	server: { headers: { "Accept-Ranges": "bytes" } },
});
