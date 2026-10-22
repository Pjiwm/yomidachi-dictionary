import { describe, expect, it } from "vitest";
import { expandRange, resolveFilter } from "../filters.ts";

describe("expandRange", () => {
	it("expands ranges in either direction and strips the n", () => {
		expect(expandRange("n3-n1")).toEqual(["1", "2", "3"]);
		expect(expandRange("3-6")).toEqual(["3", "4", "5", "6"]);
		expect(expandRange("8")).toEqual(["8"]);
	});
	it("rejects non-numeric input", () => {
		expect(expandRange("joyo")).toEqual([]);
	});
});

describe("resolveFilter", () => {
	it("maps a pos preset to its codes", () => {
		expect(resolveFilter({ prefix: "pos", value: "ichidan", negated: false })).toEqual({
			prefix: "pos",
			negated: false,
			codes: ["v1", "v1-s"],
			kind: "pos",
		});
	});
	it("marks common as a frequency filter", () => {
		expect(resolveFilter({ prefix: "is", value: "common", negated: true })?.kind).toBe("frequency");
	});
	it("accepts preset or range for kanji prefixes", () => {
		expect(resolveFilter({ prefix: "grade", value: "joyo", negated: false })?.codes).toHaveLength(7);
		expect(resolveFilter({ prefix: "strokes", value: "3-5", negated: false })).toEqual({
			prefix: "strokes",
			negated: false,
			codes: ["3", "4", "5"],
			kind: "kanji",
		});
	});
	it("returns null for unknown values", () => {
		expect(resolveFilter({ prefix: "pos", value: "nope", negated: false })).toBeNull();
	});
});
