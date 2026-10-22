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
	it("maps a preset to one tag", () => {
		expect(resolveFilter({ prefix: "pos", value: "ichidan", negated: false })).toEqual({
			prefix: "pos",
			negated: false,
			codes: ["v1", "v1-s"],
			tags: ["pos:ichidan"],
			kind: "tags",
		});
	});
	it("marks kanji-only as a result scope", () => {
		expect(resolveFilter({ prefix: "is", value: "kanji", negated: false })?.kind).toBe("kanjiOnly");
	});
	it("expands jlpt ranges into one tag per level", () => {
		expect(resolveFilter({ prefix: "jlpt", value: "n3-n2", negated: true })).toEqual({
			prefix: "jlpt",
			negated: true,
			codes: ["2", "3"],
			tags: ["jlpt:n2", "jlpt:n3"],
			kind: "kanji",
		});
	});
	it("uses the preset tag for a grade preset and per-grade tags for a range", () => {
		expect(resolveFilter({ prefix: "grade", value: "joyo", negated: false })?.tags).toEqual(["grade:joyo"]);
		expect(resolveFilter({ prefix: "grade", value: "1-2", negated: false })?.tags).toEqual(["grade:grade_1", "grade:grade_2"]);
	});
	it("accepts freeform strokes", () => {
		expect(resolveFilter({ prefix: "strokes", value: "3-5", negated: false })?.tags).toEqual(["strokes:3", "strokes:4", "strokes:5"]);
	});
	it("returns null for unknown values", () => {
		expect(resolveFilter({ prefix: "pos", value: "nope", negated: false })).toBeNull();
	});
});
