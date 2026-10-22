import type { FilterChip } from "./query.ts";

export interface FilterOption {
	key: string;
	label: string;
	codes: string[];
}

/* How a filter is applied: pos codes against senses.pos, frequency against
   the common flag, pitch against the computed pitch type, jlpt against
   words.jlpt_level, kanji against the kanji table, kanjiOnly hides words. */
export type FilterKind = "pos" | "frequency" | "pitch" | "jlpt" | "kanji" | "kanjiOnly";

export interface ResolvedFilter {
	prefix: string;
	negated: boolean;
	codes: string[];
	kind: FilterKind;
}

export const FILTER_PREFIXES = ["pos", "is", "topic", "dialect", "jlpt", "grade", "strokes", "pitch"] as const;
export type FilterPrefix = (typeof FILTER_PREFIXES)[number];

const GODAN = ["v5b", "v5g", "v5k", "v5m", "v5n", "v5r", "v5s", "v5t", "v5u", "v5aru", "v5k-s", "v5u-s", "v5r-i"];
const ICHIDAN = ["v1", "v1-s"];
const SURU = ["vs", "vs-s", "vs-i", "vs-c"];
const DIALECT_CODES = ["ksb", "ktb", "kyb", "osb", "kyu", "thb", "hob", "tsb", "tsug", "nab", "rkb", "bra"];

export const POS_FILTERS: FilterOption[] = [
	{ key: "verb", label: "verb", codes: [...ICHIDAN, ...GODAN, ...SURU, "vk", "vz", "vn", "vr", "v-unspec"] },
	{ key: "ichidan", label: "ichidan", codes: ICHIDAN },
	{ key: "godan", label: "godan", codes: GODAN },
	{ key: "suru", label: "suru", codes: SURU },
	{ key: "kuru", label: "kuru", codes: ["vk"] },
	{ key: "transitive", label: "transitive", codes: ["vt"] },
	{ key: "intransitive", label: "intransitive", codes: ["vi"] },
	{ key: "noun", label: "noun", codes: ["n", "n-adv", "n-t", "n-pref", "n-suf"] },
	{ key: "proper_noun", label: "proper noun", codes: ["n-pr"] },
	{ key: "i_adjective", label: "i-adjective", codes: ["adj-i", "adj-ix"] },
	{ key: "na_adjective", label: "na-adjective", codes: ["adj-na"] },
	{
		key: "adjective",
		label: "adjective",
		codes: ["adj-i", "adj-ix", "adj-na", "adj-no", "adj-pn", "adj-t", "adj-f", "adj-kari", "adj-ku", "adj-nari", "adj-shiku"],
	},
	{ key: "adverb", label: "adverb", codes: ["adv", "adv-to"] },
	{ key: "expression", label: "expression", codes: ["exp"] },
	{ key: "counter", label: "counter", codes: ["ctr"] },
	{ key: "particle", label: "particle", codes: ["prt"] },
	{ key: "suffix", label: "suffix", codes: ["suf"] },
	{ key: "prefix", label: "prefix", codes: ["pref"] },
	{ key: "pronoun", label: "pronoun", codes: ["pn"] },
	{ key: "conjunction", label: "conjunction", codes: ["conj"] },
	{ key: "interjection", label: "interjection", codes: ["int"] },
	{ key: "auxiliary", label: "auxiliary", codes: ["aux", "aux-v", "aux-adj"] },
	{ key: "numeric", label: "numeric", codes: ["num"] },
	{ key: "copula", label: "copula", codes: ["cop"] },
];

export const IS_FILTERS: FilterOption[] = [
	{ key: "common", label: "common", codes: [] },
	{ key: "kanji", label: "kanji only", codes: [] },
	{ key: "kana", label: "usually kana", codes: ["uk"] },
	{ key: "archaic", label: "archaic", codes: ["arch", "dated", "obs"] },
	{ key: "slang", label: "slang", codes: ["sl", "col"] },
	{ key: "formal", label: "formal", codes: ["form", "litf"] },
	{ key: "honorific", label: "honorific", codes: ["hon"] },
	{ key: "humble", label: "humble", codes: ["hum"] },
	{ key: "polite", label: "polite", codes: ["pol"] },
	{ key: "vulgar", label: "vulgar", codes: ["vulg", "X"] },
	{ key: "dialect", label: "dialect", codes: DIALECT_CODES },
	{ key: "onomatopoeia", label: "onomatopoeia", codes: ["on-mim"] },
	{ key: "idiomatic", label: "idiomatic", codes: ["id"] },
	{ key: "abbreviation", label: "abbreviation", codes: ["abbr"] },
	{ key: "rare", label: "rare", codes: ["rare"] },
	{ key: "proverb", label: "proverb", codes: ["proverb"] },
	{ key: "yojijukugo", label: "yojijukugo", codes: ["yoji"] },
	{ key: "obsolete", label: "obsolete", codes: ["obs"] },
];

const TOPICS: [string, string, string][] = [
	["agriculture", "agriculture", "agric"], ["anatomy", "anatomy", "anat"], ["archeology", "archeology", "archeol"],
	["architecture", "architecture", "archit"], ["art", "art", "art"], ["astronomy", "astronomy", "astron"],
	["audiovisual", "audiovisual", "audvid"], ["aviation", "aviation", "aviat"], ["baseball", "baseball", "baseb"],
	["biochemistry", "biochemistry", "biochem"], ["biology", "biology", "biol"], ["botany", "botany", "bot"],
	["boxing", "boxing", "boxing"], ["buddhism", "buddhism", "Buddh"], ["business", "business", "bus"],
	["card_games", "card games", "cards"], ["chemistry", "chemistry", "chem"], ["chinese_mythology", "chinese mythology", "chmyth"],
	["christianity", "christianity", "Christn"], ["civil_engineering", "civil engineering", "civeng"], ["clothing", "clothing", "cloth"],
	["computing", "computing", "comp"], ["crystallography", "crystallography", "cryst"], ["dentistry", "dentistry", "dent"],
	["ecology", "ecology", "ecol"], ["economics", "economics", "econ"], ["electricity", "electricity", "elec"],
	["electronics", "electronics", "electr"], ["entomology", "entomology", "ent"], ["figure_skating", "figure skating", "figskt"],
	["film", "film", "film"], ["finance", "finance", "finc"], ["fishing", "fishing", "fish"], ["food", "food", "food"],
	["gardening", "gardening", "gardn"], ["genetics", "genetics", "genet"], ["geography", "geography", "geogr"],
	["geology", "geology", "geol"], ["geometry", "geometry", "geom"], ["go", "go", "go"], ["golf", "golf", "golf"],
	["grammar", "grammar", "gramm"], ["greek_mythology", "greek mythology", "grmyth"], ["hanafuda", "hanafuda", "hanaf"],
	["horse_racing", "horse racing", "horse"], ["internet", "internet", "internet"], ["japanese_mythology", "japanese mythology", "jpmyth"],
	["kabuki", "kabuki", "kabuki"], ["law", "law", "law"], ["linguistics", "linguistics", "ling"], ["logic", "logic", "logic"],
	["martial_arts", "martial arts", "MA"], ["mahjong", "mahjong", "mahj"], ["manga", "manga", "manga"],
	["mathematics", "mathematics", "math"], ["mechanical_engineering", "mechanical engineering", "mech"],
	["medicine", "medicine", "med"], ["meteorology", "meteorology", "met"], ["military", "military", "mil"],
	["mineralogy", "mineralogy", "min"], ["mining", "mining", "mining"], ["motorsport", "motorsport", "motor"],
	["music", "music", "music"], ["noh", "noh", "noh"], ["ornithology", "ornithology", "ornith"],
	["paleontology", "paleontology", "paleo"], ["pathology", "pathology", "pathol"], ["pharmacology", "pharmacology", "pharm"],
	["philosophy", "philosophy", "phil"], ["photography", "photography", "photo"], ["physics", "physics", "physics"],
	["physiology", "physiology", "physiol"], ["politics", "politics", "politics"], ["printing", "printing", "print"],
	["professional_wrestling", "professional wrestling", "prowres"], ["psychiatry", "psychiatry", "psy"],
	["psychology", "psychology", "psych"], ["railway", "railway", "rail"], ["roman_mythology", "roman mythology", "rommyth"],
	["shinto", "shinto", "Shinto"], ["shogi", "shogi", "shogi"], ["skiing", "skiing", "ski"], ["sports", "sports", "sports"],
	["statistics", "statistics", "stat"], ["stock_market", "stock market", "stockm"], ["sumo", "sumo", "sumo"],
	["surgery", "surgery", "surg"], ["telecommunications", "telecommunications", "telec"], ["television", "television", "tv"],
	["veterinary", "veterinary", "vet"], ["video_games", "video games", "vidg"], ["zoology", "zoology", "zool"],
];
export const TOPIC_FILTERS: FilterOption[] = TOPICS.map(([key, label, code]) => ({ key, label, codes: [code] }));

const DIALECTS: [string, string][] = [
	["kansai", "ksb"], ["kantou", "ktb"], ["kyoto", "kyb"], ["osaka", "osb"], ["kyuushuu", "kyu"], ["touhoku", "thb"],
	["hokkaido", "hob"], ["tosa", "tsb"], ["tsugaru", "tsug"], ["nagano", "nab"], ["ryuukyuu", "rkb"], ["brazilian", "bra"],
];
export const DIALECT_FILTERS: FilterOption[] = DIALECTS.map(([key, code]) => ({ key, label: key, codes: [code] }));

export const JLPT_FILTERS: FilterOption[] = [5, 4, 3, 2, 1].map((n) => ({ key: `n${n}`, label: `N${n}`, codes: [String(n)] }));

export const PITCH_FILTERS: FilterOption[] = ["heiban", "atamadaka", "nakadaka", "odaka"].map((key) => ({
	key,
	label: key,
	codes: [key],
}));

export const GRADE_FILTERS: FilterOption[] = [
	{ key: "joyo", label: "Jōyō", codes: ["1", "2", "3", "4", "5", "6", "8"] },
	{ key: "jinmeiyo", label: "Jinmeiyō", codes: ["9", "10"] },
	...[1, 2, 3, 4, 5, 6, 8, 9, 10].map((n) => ({ key: `grade_${n}`, label: `Grade ${n}`, codes: [String(n)] })),
];

export function filtersForPrefix(prefix: string): FilterOption[] {
	switch (prefix) {
		case "pos":
			return POS_FILTERS;
		case "is":
			return IS_FILTERS;
		case "topic":
			return TOPIC_FILTERS;
		case "dialect":
			return DIALECT_FILTERS;
		case "jlpt":
			return JLPT_FILTERS;
		case "grade":
			return GRADE_FILTERS;
		case "pitch":
			return PITCH_FILTERS;
		default:
			return [];
	}
}

/* "n3-n1", "3-6" or "8" into the covered codes; empty when not numeric. */
export function expandRange(value: string): string[] {
	const bounds = value.split("-").map((part) => Number.parseInt(part.replace(/^n/i, ""), 10));
	if (bounds.some(Number.isNaN) || bounds.length > 2) return [];
	const [lo, hi] = bounds.length === 2 ? [Math.min(...bounds), Math.max(...bounds)] : [bounds[0], bounds[0]];
	return Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i));
}

const KANJI_PREFIXES = new Set(["grade", "strokes"]);

export function resolveFilter(chip: FilterChip): ResolvedFilter | null {
	const base = { prefix: chip.prefix, negated: chip.negated };
	const preset = filtersForPrefix(chip.prefix).find((f) => f.key === chip.value.toLowerCase());
	if (chip.prefix === "jlpt") {
		const codes = preset?.codes ?? expandRange(chip.value);
		return codes.length ? { ...base, codes, kind: "jlpt" } : null;
	}
	if (KANJI_PREFIXES.has(chip.prefix)) {
		const codes = preset?.codes ?? expandRange(chip.value);
		return codes.length ? { ...base, codes, kind: "kanji" } : null;
	}
	if (!preset) return null;
	if (chip.prefix === "pitch") return { ...base, codes: preset.codes, kind: "pitch" };
	if (chip.prefix === "is" && chip.value === "common") return { ...base, codes: [], kind: "frequency" };
	if (chip.prefix === "is" && chip.value === "kanji") return { ...base, codes: [], kind: "kanjiOnly" };
	return { ...base, codes: preset.codes, kind: "pos" };
}
