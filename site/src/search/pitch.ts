export type PitchType = "heiban" | "atamadaka" | "nakadaka" | "odaka";

/* Small kana that merge with the kana before them into one mora. */
const COMBINING_SMALL_KANA = new Set("ゃゅょぁぃぅぇぉャュョァィゥェォ");

export function splitMora(reading: string): string[] {
	const mora: string[] = [];
	for (const char of reading) {
		if (COMBINING_SMALL_KANA.has(char) && mora.length > 0) {
			mora[mora.length - 1] += char;
		} else {
			mora.push(char);
		}
	}
	return mora;
}

/* Downstep 0: low first mora then high. 1: high first mora then low.
   Otherwise high from the second mora up to the downstep, then low. */
export function highLowPattern(moraCount: number, downstep: number): boolean[] {
	return Array.from({ length: moraCount }, (_, i) => {
		if (downstep === 0) return i > 0;
		if (downstep === 1) return i === 0;
		return i > 0 && i < downstep;
	});
}

export function pitchType(moraCount: number, downstep: number): PitchType {
	if (downstep === 0) return "heiban";
	if (downstep === 1) return "atamadaka";
	if (downstep === moraCount) return "odaka";
	return "nakadaka";
}

/* The database stores downsteps as a comma-separated list, e.g. "0,2". */
export function parseDownsteps(pitchAccent: string): number[] {
	return pitchAccent
		.split(",")
		.map((s) => Number.parseInt(s.trim(), 10))
		.filter((n) => Number.isInteger(n) && n >= 0);
}
