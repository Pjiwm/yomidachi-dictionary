/* Hash routes keep every screen linkable on a static host. The query rides
   along on word and kanji routes so the results pane survives navigation. */
export type Route =
	| { kind: "home" }
	| { kind: "search"; query: string }
	| { kind: "word"; sequence: number; query: string }
	| { kind: "kanji"; character: string; query: string };

export function parseHash(hash: string): Route {
	try {
		return parseHashStrict(hash);
	} catch {
		// A hand-edited hash with a bad percent escape lands on the home page.
		return { kind: "home" };
	}
}

function parseHashStrict(hash: string): Route {
	const [path, search = ""] = hash.replace(/^#/, "").split("?");
	const query = new URLSearchParams(search).get("q") ?? "";
	const parts = path.split("/").filter(Boolean);

	if (parts[0] === "word" && parts[1]) {
		const sequence = Number.parseInt(parts[1], 10);
		if (Number.isInteger(sequence)) return { kind: "word", sequence, query };
	}
	if (parts[0] === "kanji" && parts[1]) {
		return { kind: "kanji", character: decodeURIComponent(parts[1]), query };
	}
	if (parts[0] === "search" && query) return { kind: "search", query };
	return { kind: "home" };
}

export function formatRoute(route: Route): string {
	const withQuery = (path: string, query: string) =>
		query ? `${path}?${new URLSearchParams({ q: query })}` : path;
	switch (route.kind) {
		case "home":
			return "#/";
		case "search":
			return withQuery("#/search", route.query);
		case "word":
			return withQuery(`#/word/${route.sequence}`, route.query);
		case "kanji":
			return withQuery(`#/kanji/${encodeURIComponent(route.character)}`, route.query);
	}
}

export function navigate(route: Route): void {
	location.hash = formatRoute(route);
}

export function routeQuery(route: Route): string {
	return route.kind === "home" ? "" : route.query;
}
