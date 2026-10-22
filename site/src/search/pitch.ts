export type PitchType = "heiban" | "atamadaka" | "nakadaka" | "odaka";

export function splitMora(reading: string): string[] {
	return [...reading];
}

export function pitchType(_moraCount: number, _downstep: number): PitchType {
	return "heiban";
}
