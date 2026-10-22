import { describe, expect, it } from "vitest";
import { highLowPattern, parseDownsteps, pitchType, splitMora } from "../pitch.ts";

describe("splitMora", () => {
	it("keeps small kana with the kana before them", () => {
		expect(splitMora("きょう")).toEqual(["きょ", "う"]);
		expect(splitMora("シャツ")).toEqual(["シャ", "ツ"]);
	});
	it("treats long vowels and sokuon as their own mora", () => {
		expect(splitMora("がっこう")).toEqual(["が", "っ", "こ", "う"]);
	});
});

describe("pitchType", () => {
	it("classifies by downstep position", () => {
		expect(pitchType(3, 0)).toBe("heiban");
		expect(pitchType(3, 1)).toBe("atamadaka");
		expect(pitchType(3, 2)).toBe("nakadaka");
		expect(pitchType(3, 3)).toBe("odaka");
	});
});

describe("highLowPattern", () => {
	it("heiban is low then high", () => {
		expect(highLowPattern(3, 0)).toEqual([false, true, true]);
	});
	it("atamadaka is high then low", () => {
		expect(highLowPattern(3, 1)).toEqual([true, false, false]);
	});
	it("nakadaka rises then falls at the downstep", () => {
		expect(highLowPattern(4, 2)).toEqual([false, true, false, false]);
	});
});

describe("parseDownsteps", () => {
	it("reads the comma-separated column and drops junk", () => {
		expect(parseDownsteps("0,2")).toEqual([0, 2]);
		expect(parseDownsteps(" 1 , x")).toEqual([1]);
	});
});
