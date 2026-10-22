import { describe, expect, it } from "vitest";
import { parseQuery, toLikePattern } from "../query.ts";

describe("parseQuery", () => {
	it("separates free text from filter chips", () => {
		expect(parseQuery("green pos:noun not:jlpt:n5")).toEqual({
			text: "green",
			chips: [
				{ prefix: "pos", value: "noun", negated: false },
				{ prefix: "jlpt", value: "n5", negated: true },
			],
		});
	});
	it("leaves unknown prefixes as text", () => {
		expect(parseQuery("foo:bar")).toEqual({ text: "foo:bar", chips: [] });
	});
	it("handles chips without text", () => {
		expect(parseQuery("  is:common ")).toEqual({
			text: "",
			chips: [{ prefix: "is", value: "common", negated: false }],
		});
	});
});

describe("toLikePattern", () => {
	it("maps both wildcard widths", () => {
		expect(toLikePattern("食＊る?")).toBe("食%る_");
	});
});
