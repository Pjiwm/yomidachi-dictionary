import type { DbWorker } from "./worker.ts";
import type { ResolvedFilter } from "../search/filters.ts";
import { hasKana, hasKanji, isJapanese, kanjiIn, toHiragana, toKatakana } from "../search/kana.ts";
import { hasWildcard } from "../search/query.ts";
import type {
	DictEntry,
	KanjiEntry,
	Radical,
	RadicalSearchResult,
	SearchResults,
	WordSummary,
} from "../types.ts";

/* Beyond any code point, so `col >= p AND col < p + END` is a prefix range. */
const PREFIX_END = "\u{10FFFF}";
/* Each kanji row is a random page over HTTP, so the panel fetches only what the
   collapsed strip shows; "Show all" asks again with the full limit. */
export const KANJI_STRIP = 12;
export const KANJI_LIMIT = 100;
const RADICAL_MATCH_LIMIT = 80;

const ENTRY_SELECT = `
	SELECT s.id, s.sequence, s.term, s.reading, s.pos, s.frequency, s.translation,
	       w.jlpt_level, s.pitch_accent
	FROM senses s LEFT JOIN words w ON w.sequence = s.sequence`;

/* Jiten rank first (unranked last), then JMdict's own frequency score. */
const RANK_ORDER = "w.freq_rank IS NULL, w.freq_rank, s.frequency DESC";

const KANJI_SELECT = `
	SELECT character, stroke_count, grade, jlpt_level, meanings, readings_on, readings_kun
	FROM kanji`;

/* word_summary is keyed by (rank, sequence), so the join carries the rank the
   candidates already know and lands directly on the row's page. */
const SUMMARY_SELECT = "SELECT ws.sequence, ws.term, ws.reading, ws.gloss, ws.common FROM top JOIN word_summary ws ON ws.rank = top.rank AND ws.sequence = top.sequence";

function placeholders(n: number): string {
	return Array.from({ length: n }, () => "?").join(", ");
}

/* Wildcards to GLOB syntax; "[" would otherwise start a character class. */
function toGlobPattern(text: string): string {
	return text.replace(/\[/g, "[[]").replace(/[＊]/g, "*").replace(/[？]/g, "?");
}

/* The literal run before the first wildcard, which bounds the index range. */
function literalPrefix(text: string): string {
	return text.split(/[*?＊？]/)[0];
}

interface Candidates {
	sql: string;
	params: unknown[];
	/* Columns of the candidate rows that decide the final order. */
	order: string[];
	/* One row per word already, so no GROUP BY and the LIMIT can stop early. */
	unique: boolean;
}


interface EntryRow {
	id: number;
	sequence: number;
	term: string;
	reading: string;
	pos: string | null;
	frequency: number | null;
	translation: string | null;
	jlpt_level: number | null;
	pitch_accent: string | null;
}

interface SummaryRow {
	sequence: number;
	term: string;
	reading: string;
	gloss: string;
	common: number;
}

interface KanjiRadicalsRow {
	character: string;
	stroke_count: number;
	radicals: string;
}

interface KanjiRow {
	character: string;
	stroke_count: number | null;
	grade: number | null;
	jlpt_level: number | null;
	meanings: string | null;
	readings_on: string | null;
	readings_kun: string | null;
}

function toEntry(row: EntryRow): DictEntry {
	return {
		id: row.id,
		sequence: row.sequence,
		term: row.term,
		reading: row.reading,
		pos: row.pos ?? "",
		frequency: row.frequency ?? 0,
		translation: row.translation ?? "",
		jlptLevel: row.jlpt_level,
		pitchAccent: row.pitch_accent,
		references: [],
	};
}

function toSummary(row: SummaryRow): WordSummary {
	return {
		sequence: row.sequence,
		term: row.term,
		reading: row.reading,
		gloss: row.gloss,
		common: row.common === 1,
	};
}

function toKanji(row: KanjiRow): KanjiEntry {
	return {
		character: row.character,
		strokeCount: row.stroke_count,
		grade: row.grade,
		jlptLevel: row.jlpt_level,
		meanings: row.meanings ?? "",
		readingsOn: row.readings_on ?? "",
		readingsKun: row.readings_kun ?? "",
	};
}

/* JMdict stores a cross-reference as "see:  <term>  <definition>", two-space delimited. */
function parseSeeReference(gloss: string): string | null {
	if (!gloss.startsWith("see:")) return null;
	const rest = gloss.slice(4).trimStart();
	const term = rest.split("  ")[0].trim().replace(/^【|】$/g, "").trim();
	return term || null;
}

/* The only module that contains SQL. Every query is checked against the
   indexes with EXPLAIN QUERY PLAN: over HTTP a table scan is unusable. */
export class DictRepository {
	/* Loaded once when the picker opens: about 250 KB read in one sweep beats
	   a round trip per kanji on every radical toggle. */
	private kanjiRadicals: Promise<{ character: string; strokes: number; radicals: Set<string> }[]> | null = null;

	constructor(private readonly db: DbWorker) {}

	/* Touches the root pages of every search table so the first real lookup
	   skips those round trips. Fired once after the database opens. */
	async warmUp(): Promise<void> {
		await Promise.allSettled([
			this.query("SELECT 1 FROM jp_index WHERE key >= 'あ' LIMIT 1"),
			this.query("SELECT 1 FROM en_index WHERE gloss >= 'm' LIMIT 1"),
			this.query("SELECT 1 FROM tag_index WHERE tag >= 'is:common' LIMIT 1"),
			this.query("SELECT 1 FROM word_summary WHERE rank >= 0 LIMIT 1"),
		]);
	}

	private query<T>(sql: string, ...params: unknown[]): Promise<T[]> {
		// sql.js takes the bindings as one array; Comlink's proxy type also loses the generic.
		return this.db.db.query(sql, params) as Promise<T[]>;
	}

	async search(text: string, limit: number): Promise<WordSummary[]> {
		return isJapanese(text) ? this.searchJapanese(text, limit) : this.searchEnglish(text, limit);
	}

	/* Prefix match on term and reading in both kana scripts, against the
	   jp_index table built by scripts/prepare_site_db.py: key, rank and
	   display columns in one b-tree, so a search reads one contiguous range.
	   Range comparisons instead of LIKE because LIKE skips a BINARY index. */
	private async searchJapanese(text: string, limit: number): Promise<WordSummary[]> {
		const hira = toHiragana(text);
		const kata = toKatakana(text);
		// Kanji-only input has one script form; a second identical range would just double the read.
		const secondRange = hira === kata ? "" : "UNION ALL SELECT * FROM jp_index WHERE key >= ?3 AND key < ?4";
		const rows = await this.query<SummaryRow>(
			`WITH hits AS MATERIALIZED (
			   SELECT * FROM jp_index WHERE key >= ?1 AND key < ?2
			   ${secondRange}
			 )
			 SELECT sequence, term, reading, gloss, common,
			        min(key <> ?1 AND key <> ?3) AS inexact, min(rank) AS rank
			 FROM hits GROUP BY sequence ORDER BY inexact, rank LIMIT ?5`,
			hira,
			hira + PREFIX_END,
			kata,
			kata + PREFIX_END,
			limit,
		);
		return rows.map(toSummary);
	}

	/* Tiered gloss match on en_index: exact (or "to <verb>"), then word-start.
	   One UNION ALL branch per predicate, because SQLite scans the table as
	   soon as two NOCASE predicates are OR'd. Ranking within a word: primary
	   sense first, exact before compound, headline gloss before later
	   nuances, then frequency. Only the winners touch word_summary. */
	private async searchEnglish(text: string, limit: number): Promise<WordSummary[]> {
		const q = text.toLowerCase().replace(/[%_]/g, "");
		if (!q) return [];
		const rows = await this.query<SummaryRow>(
			`WITH hits AS MATERIALIZED (
			   SELECT sequence, sense_rank, 0 AS match_type, position, rank, term, reading, summary, common
			     FROM en_index WHERE gloss = ?1 COLLATE NOCASE
			   UNION ALL SELECT sequence, sense_rank, 0, position, rank, term, reading, summary, common
			     FROM en_index WHERE gloss = ?2 COLLATE NOCASE
			   UNION ALL SELECT sequence, sense_rank, gloss NOT LIKE ?5, position, rank, term, reading, summary, common
			     FROM en_index WHERE gloss LIKE ?3
			   UNION ALL SELECT sequence, sense_rank, gloss NOT LIKE ?6, position, rank, term, reading, summary, common
			     FROM en_index WHERE gloss LIKE ?4
			 )
			 SELECT sequence, term, reading, summary AS gloss, common,
			        min(sense_rank) AS a, min(match_type) AS b, min(position) AS c, min(rank) AS rank
			 FROM hits GROUP BY sequence ORDER BY a, b, c, rank LIMIT ?7`,
			q,
			`to ${q}`,
			`${q} %`,
			`to ${q} %`,
			`${q} (%`,
			`to ${q} (%`,
			limit,
		);
		return rows.map(toSummary);
	}

	/* Filters become EXISTS lookups against tag_index (tag, rank, sequence),
	   one per filter group, so each candidate costs one point read per
	   group. Candidates come from the text hit set, or without text from the
	   narrowest positive filter's tag range, or last from word_summary by rank. */
	async advancedSearch(text: string, filters: ResolvedFilter[], limit: number, kanjiLimit: number): Promise<SearchResults> {
		const [words, kanji] = await Promise.all([
			this.filteredWords(text, filters, limit),
			this.advancedKanji(text, filters, kanjiLimit),
		]);
		return { words, kanji };
	}

	async advancedKanji(text: string, filters: ResolvedFilter[], limit: number): Promise<KanjiEntry[]> {
		const kanjiFilters = filters.filter((f) => f.kind === "kanji");
		return kanjiFilters.length ? this.filteredKanji(text, kanjiFilters, limit) : this.kanjiForText(text, limit);
	}

	private async filteredWords(text: string, filters: ResolvedFilter[], limit: number): Promise<WordSummary[]> {
		const groups = new Map<string, ResolvedFilter[]>();
		for (const f of filters) groups.set(f.prefix, [...(groups.get(f.prefix) ?? []), f]);

		let driver: string | null = null;
		let candidates: Candidates | null;
		if (text) {
			candidates = this.textCandidates(text);
			if (!candidates) return [];
		} else {
			const positive = [...groups.values()]
				.map((g) => g.filter((f) => !f.negated))
				.filter((g) => g.length)
				.sort((a, b) => a.flatMap((f) => f.tags).length - b.flatMap((f) => f.tags).length)[0];
			if (positive) {
				driver = positive[0].prefix;
				const tags = positive.flatMap((f) => f.tags);
				candidates = {
					sql: `SELECT sequence, rank FROM tag_index WHERE tag IN (${placeholders(tags.length)})`,
					params: tags,
					order: ["rank"],
					unique: tags.length === 1,
				};
			} else {
				candidates = { sql: "SELECT sequence, rank FROM word_summary", params: [], order: ["rank"], unique: true };
			}
		}

		const clauses: string[] = [];
		const params: unknown[] = [...candidates.params];
		for (const [prefix, group] of groups) {
			const positive = prefix === driver ? [] : group.filter((f) => !f.negated).flatMap((f) => f.tags);
			const negative = group.filter((f) => f.negated).flatMap((f) => f.tags);
			for (const [tags, keyword] of [[positive, "EXISTS"], [negative, "NOT EXISTS"]] as const) {
				if (!tags.length) continue;
				clauses.push(`${keyword} (SELECT 1 FROM tag_index t WHERE t.tag IN (${placeholders(tags.length)}) AND t.rank = c.rank AND t.sequence = c.sequence)`);
				params.push(...tags);
			}
		}
		const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
		const orderCols = candidates.order.map((col) => (candidates.unique ? `c.${col}` : `min(c.${col}) AS ${col}`)).join(", ");
		const groupBy = candidates.unique ? "" : "GROUP BY c.sequence";
		const orderBy = candidates.order.join(", ");
		const rows = await this.query<SummaryRow>(
			`WITH top AS (SELECT c.sequence, ${orderCols} FROM (${candidates.sql}) c ${where} ${groupBy} ORDER BY ${orderBy} LIMIT ?)
			 ${SUMMARY_SELECT} ORDER BY ${candidates.order.map((col) => `top.${col}`).join(", ")}`,
			...params,
			limit,
		);
		return rows.map(toSummary);
	}

	/* The hit set for free text, or null when a wildcard leaves no literal
	   prefix to bound the index with (a leading wildcard would scan everything). */
	private textCandidates(text: string): Candidates | null {
		if (isJapanese(text)) {
			const hira = toHiragana(text);
			const kata = toKatakana(text);
			if (!hasWildcard(text)) {
				return {
					sql: `SELECT sequence, rank, key <> ? AND key <> ? AS inexact FROM jp_index
					      WHERE (key >= ? AND key < ?) OR (key >= ? AND key < ?)`,
					params: [hira, kata, hira, hira + PREFIX_END, kata, kata + PREFIX_END],
					order: ["inexact", "rank"],
					unique: false,
				};
			}
			const prefixes = [literalPrefix(hira), literalPrefix(kata)];
			if (!prefixes[0]) return null;
			return {
				sql: `SELECT sequence, rank FROM jp_index WHERE key >= ? AND key < ? AND key GLOB ?
				      UNION ALL SELECT sequence, rank FROM jp_index WHERE key >= ? AND key < ? AND key GLOB ?`,
				params: [prefixes[0], prefixes[0] + PREFIX_END, toGlobPattern(hira), prefixes[1], prefixes[1] + PREFIX_END, toGlobPattern(kata)],
				order: ["rank"],
				unique: false,
			};
		}
		const q = text.toLowerCase().replace(/[%_]/g, "");
		if (hasWildcard(q)) {
			if (!literalPrefix(q)) return null;
			return {
				sql: "SELECT sequence, sense_rank, position, rank FROM en_index WHERE gloss LIKE ?",
				params: [q.replace(/[*＊]/g, "%").replace(/[?？]/g, "_")],
				order: ["sense_rank", "position", "rank"],
				unique: false,
			};
		}
		return {
			sql: `SELECT sequence, sense_rank, 0 AS match_type, position, rank FROM en_index WHERE gloss = ? COLLATE NOCASE
			      UNION ALL SELECT sequence, sense_rank, 0, position, rank FROM en_index WHERE gloss = ? COLLATE NOCASE
			      UNION ALL SELECT sequence, sense_rank, gloss NOT LIKE ?, position, rank FROM en_index WHERE gloss LIKE ?
			      UNION ALL SELECT sequence, sense_rank, gloss NOT LIKE ?, position, rank FROM en_index WHERE gloss LIKE ?`,
			params: [q, `to ${q}`, `${q} (%`, `${q} %`, `to ${q} (%`, `to ${q} %`],
			order: ["sense_rank", "match_type", "position", "rank"],
			unique: false,
		};
	}

	/* Kanji matching the grade, strokes and jlpt filters, narrowed to the text. */
	private async filteredKanji(text: string, filters: ResolvedFilter[], limit: number): Promise<KanjiEntry[]> {
		const column: Record<string, string> = { grade: "grade", strokes: "stroke_count", jlpt: "jlpt_level" };
		const clauses: string[] = [];
		const params: unknown[] = [];
		for (const f of filters) {
			const col = column[f.prefix];
			const values = f.codes.map(Number);
			clauses.push(f.negated ? `(${col} IS NULL OR ${col} NOT IN (${placeholders(values.length)}))` : `${col} IN (${placeholders(values.length)})`);
			params.push(...values);
		}
		if (hasKanji(text)) {
			const chars = kanjiIn(text);
			clauses.push(`character IN (${placeholders(chars.length)})`);
			params.push(...chars);
		} else if (hasKana(text)) {
			clauses.push("character IN (SELECT character FROM kanji_reading WHERE reading IN (?, ?))");
			params.push(toHiragana(text), toKatakana(text));
		} else if (text) {
			clauses.push("meanings LIKE ?");
			params.push(`%${text.toLowerCase()}%`);
		}
		const rows = await this.query<KanjiRow>(
			`${KANJI_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY stroke_count, character LIMIT ?`,
			...params,
			limit,
		);
		return rows.map(toKanji);
	}

	/* The kanji panel for a plain search: the characters typed, or kanji read as the kana typed. */
	async kanjiForText(text: string, limit: number): Promise<KanjiEntry[]> {
		if (hasKanji(text)) return this.kanjiForWord(text);
		if (hasKana(text)) return this.kanjiByReading(text, limit);
		return [];
	}

	/* Every sense of a word, with its translation rebuilt from the glosses
	   table so cross-references become links instead of "see: ..." text. */
	async wordDetails(sequence: number): Promise<DictEntry[]> {
		const rows = await this.query<EntryRow>(
			`${ENTRY_SELECT} WHERE s.sequence = ?1 ORDER BY s.frequency DESC, s.id`,
			sequence,
		);
		const entries = rows.map(toEntry);
		if (entries.length === 0) return entries;

		const placeholders = entries.map(() => "?").join(", ");
		const glosses = await this.query<{ sense_id: number; gloss: string }>(
			`SELECT sense_id, gloss FROM glosses WHERE sense_id IN (${placeholders}) ORDER BY sense_id, position`,
			...entries.map((e) => e.id),
		);
		const bySense = new Map<number, string[]>();
		for (const { sense_id, gloss } of glosses) {
			bySense.set(sense_id, [...(bySense.get(sense_id) ?? []), gloss]);
		}
		for (const entry of entries) {
			const own = bySense.get(entry.id);
			if (!own) continue;
			const real: string[] = [];
			const refs = new Set<string>();
			for (const gloss of own) {
				const ref = parseSeeReference(gloss);
				if (ref) refs.add(ref);
				else real.push(gloss);
			}
			entry.translation = real.join(", ");
			entry.references = [...refs];
		}
		return entries;
	}

	async kanjiForWord(term: string): Promise<KanjiEntry[]> {
		const chars = kanjiIn(term);
		if (chars.length === 0) return [];
		const placeholders = chars.map(() => "?").join(", ");
		const rows = await this.query<KanjiRow>(
			`${KANJI_SELECT} WHERE character IN (${placeholders})`,
			...chars,
		);
		const byChar = new Map(rows.map((r) => [r.character, toKanji(r)]));
		return chars.flatMap((c) => byChar.get(c) ?? []);
	}

	async kanji(character: string): Promise<KanjiEntry | null> {
		const rows = await this.query<KanjiRow>(`${KANJI_SELECT} WHERE character = ?1`, character);
		return rows.length ? toKanji(rows[0]) : null;
	}

	/* Prefix match on reading tokens in either script, via kanji_reading. */
	async kanjiByReading(reading: string, limit: number): Promise<KanjiEntry[]> {
		const hira = toHiragana(reading);
		const kata = toKatakana(reading);
		const rows = await this.query<KanjiRow>(
			`WITH matched AS MATERIALIZED (
			   SELECT character FROM kanji_reading WHERE reading >= ? AND reading < ?
			   UNION SELECT character FROM kanji_reading WHERE reading >= ? AND reading < ?
			 )
			 ${KANJI_SELECT} WHERE character IN (SELECT character FROM matched)
			 ORDER BY stroke_count, character LIMIT ?`,
			hira,
			hira + PREFIX_END,
			kata,
			kata + PREFIX_END,
			limit,
		);
		return rows.map(toKanji);
	}

	async radicals(): Promise<Radical[]> {
		return this.query<Radical>("SELECT radical, strokes FROM radical ORDER BY strokes, radical");
	}

	/* Kanji containing every selected radical, and the radicals that can still narrow them. */
	async kanjiByRadicals(selected: string[]): Promise<RadicalSearchResult> {
		this.kanjiRadicals ??= this.query<KanjiRadicalsRow>("SELECT character, stroke_count, radicals FROM kanji_radicals")
			.then((rows) => rows.map((r) => ({ character: r.character, strokes: r.stroke_count, radicals: new Set(r.radicals.split(" ")) })))
			.catch((err: unknown) => {
				this.kanjiRadicals = null;
				throw err;
			});
		const all = await this.kanjiRadicals;
		if (selected.length === 0) return { kanji: [], total: 0, available: [] };

		const matches = all
			.filter((k) => selected.every((r) => k.radicals.has(r)))
			.sort((a, b) => a.strokes - b.strokes || a.character.localeCompare(b.character));
		const available = new Set<string>();
		for (const k of matches) for (const r of k.radicals) available.add(r);

		const shown = matches.slice(0, RADICAL_MATCH_LIMIT).map((k) => k.character);
		const rows = shown.length
			? await this.query<KanjiRow>(`${KANJI_SELECT} WHERE character IN (${placeholders(shown.length)})`, ...shown)
			: [];
		const byChar = new Map(rows.map((r) => [r.character, toKanji(r)]));
		return { kanji: shown.flatMap((c) => byChar.get(c) ?? []), total: matches.length, available: [...available] };
	}

	/* A cross-reference names a headword or a reading; pick the best-ranked match. */
	async resolveReference(term: string): Promise<DictEntry | null> {
		const rows = await this.query<EntryRow>(
			`${ENTRY_SELECT} WHERE s.term = ?1 OR s.reading = ?1 ORDER BY ${RANK_ORDER} LIMIT 1`,
			term,
		);
		return rows.length ? toEntry(rows[0]) : null;
	}
}
