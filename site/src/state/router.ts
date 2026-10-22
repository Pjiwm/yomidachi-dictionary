export type Route =
	| { kind: "home" }
	| { kind: "search"; query: string }
	| { kind: "word"; sequence: number; query: string | null }
	| { kind: "kanji"; character: string; query: string | null };

export function parseHash(_hash: string): Route {
	return { kind: "home" };
}

export function formatRoute(_route: Route): string {
	return "#/";
}
