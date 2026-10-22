import type { DbWorker } from "./worker.ts";
import type { ResolvedFilter } from "../search/filters.ts";
import { isJapanese, kanjiIn, toHiragana, toKatakana } from "../search/kana.ts";
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

const ENTRY_SELECT = `
	SELECT s.id, s.sequence, s.term, s.reading, s.pos, s.frequency, s.translation,
	       w.jlpt_level, s.pitch_accent
	FROM senses s LEFT JOIN words w ON w.sequence = s.sequence`;

/* Jiten rank first (unranked last), then JMdict's own frequency score. */
const RANK_ORDER = "w.freq_rank IS NULL, w.freq_rank, s.frequency DESC";

const KANJI_SELECT = `
	SELECT character, stroke_count, grade, jlpt_level, meanings, readings_on, readings_kun
	FROM kanji`;

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
	constructor(private readonly db: DbWorker) {}

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
		const rows = await this.query<SummaryRow>(
			`WITH hits AS MATERIALIZED (
			   SELECT * FROM jp_index WHERE key >= ?1 AND key < ?2
			   UNION ALL SELECT * FROM jp_index WHERE key >= ?3 AND key < ?4
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
			   SELECT sequence, sense_rank, 0 AS match_type, position, rank
			     FROM en_index WHERE gloss = ?1 COLLATE NOCASE
			   UNION ALL SELECT sequence, sense_rank, 0, position, rank
			     FROM en_index WHERE gloss = ?2 COLLATE NOCASE
			   UNION ALL SELECT sequence, sense_rank, gloss NOT LIKE ?5, position, rank
			     FROM en_index WHERE gloss LIKE ?3
			   UNION ALL SELECT sequence, sense_rank, gloss NOT LIKE ?6, position, rank
			     FROM en_index WHERE gloss LIKE ?4
			 ),
			 top AS (
			   SELECT sequence, min(sense_rank) AS a, min(match_type) AS b,
			          min(position) AS c, min(rank) AS d
			   FROM hits GROUP BY sequence ORDER BY a, b, c, d LIMIT ?7
			 )
			 SELECT ws.sequence, ws.term, ws.reading, ws.gloss, ws.common
			 FROM top JOIN word_summary ws ON ws.sequence = top.sequence
			 ORDER BY top.a, top.b, top.c, top.d`,
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

	async advancedSearch(
		_text: string,
		_filters: ResolvedFilter[],
		_limit: number,
	): Promise<SearchResults> {
		return { words: [], kanji: [] };
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

	async kanjiByReading(_reading: string, _limit: number): Promise<KanjiEntry[]> {
		return [];
	}

	async kanjiByRadicals(_radicals: string[]): Promise<RadicalSearchResult> {
		return { kanji: [], available: [] };
	}

	async radicals(): Promise<Radical[]> {
		return [];
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
