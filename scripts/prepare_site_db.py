"""Turn a built dictionary into the chunked layout sql.js-httpvfs reads over HTTP."""

import argparse
import json
import shutil
import sqlite3
import sys
from datetime import date
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

# Smaller pages make indexed lookups cheaper over HTTP.
PAGE_SIZE = 1024
DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024
SUFFIX_LENGTH = 3
CHUNK_PREFIX = "db.sqlite3."


KATAKANA_OFFSET = 0x60
SUMMARY_GLOSS_CHARS = 200
UNRANKED = 1_000_000
FILTERS_JSON = ROOT_DIR / "site" / "src" / "search" / "filters.json"
COMBINING_SMALL_KANA = set("ゃゅょぁぃぅぇぉャュョァィゥェォ")


def to_hiragana(text: str) -> str:
    return "".join(
        chr(ord(c) - KATAKANA_OFFSET) if "\u30a1" <= c <= "\u30f6" else c for c in text
    )


def mora_count(reading: str) -> int:
    return sum(1 for c in reading if c not in COMBINING_SMALL_KANA)


def pitch_type(moras: int, downstep: int) -> str:
    if downstep == 0:
        return "heiban"
    if downstep == 1:
        return "atamadaka"
    if downstep == moras:
        return "odaka"
    return "nakadaka"


def word_tags(conn: sqlite3.Connection) -> list:
    """Every (tag, rank, sequence) a filter can match, tags named prefix:key as in filters.json."""
    filters = json.loads(FILTERS_JSON.read_text())
    code_tags = {}
    for prefix in ("pos", "is", "topic", "dialect"):
        for option in filters[prefix]:
            for code in option["codes"]:
                code_tags.setdefault(code, set()).add(f"{prefix}:{option['key']}")
    grade_tags = {}
    for option in filters["grade"]:
        for code in option["codes"]:
            grade_tags.setdefault(int(code), set()).add(f"grade:{option['key']}")

    tags = {}

    def add(sequence, tag):
        tags.setdefault(sequence, set()).add(tag)

    for sequence, rank, jlpt in conn.execute("SELECT w.sequence, ws.rank, w.jlpt_level FROM words w JOIN word_summary ws USING (sequence)"):
        tags[sequence] = set()
        if jlpt is not None:
            add(sequence, f"jlpt:n{jlpt}")
    for sequence, pos, frequency, reading, pitch in conn.execute(
        "SELECT sequence, pos, frequency, reading, pitch_accent FROM senses"
    ):
        for code in (pos or "").split():
            for tag in code_tags.get(code, ()):
                add(sequence, tag)
        if frequency and frequency > 0:
            add(sequence, "is:common")
        if pitch:
            moras = mora_count(reading)
            for part in pitch.split(","):
                if part.strip().isdigit():
                    add(sequence, f"pitch:{pitch_type(moras, int(part))}")
    for sequence, grade, strokes in conn.execute(
        "SELECT m.sequence, k.grade, k.stroke_count FROM kanji_word_map m JOIN kanji k USING (character)"
    ):
        for tag in grade_tags.get(grade, ()):
            add(sequence, tag)
        if strokes:
            add(sequence, f"strokes:{strokes}")

    ranks = dict(conn.execute("SELECT sequence, rank FROM word_summary"))
    return [(tag, ranks[seq], seq) for seq, seq_tags in tags.items() for tag in seq_tags]


def kanji_readings(conn: sqlite3.Connection) -> list:
    """One row per reading token; okurigana dots and affix hyphens stripped (た.べる -> たべる)."""
    rows = []
    for character, kun, on in conn.execute("SELECT character, readings_kun, readings_on FROM kanji"):
        for token in f"{kun or ''} {on or ''}".split():
            cleaned = token.replace(".", "").replace("-", "")
            if cleaned:
                rows.append((cleaned, character))
    return rows


def build_search_tables(conn: sqlite3.Connection) -> None:
    """Denormalized search tables: key, rank and display columns in one b-tree.

    Over HTTP every row visited is a round trip, so a search must read one
    contiguous key range and nothing else. These tables make that possible;
    the original tables stay for the detail views. kanji_radicals is small
    enough that the radical picker reads it whole and intersects in the browser.
    """
    conn.executescript(
        f"""
        DROP TABLE IF EXISTS word_summary;
        DROP TABLE IF EXISTS jp_index;
        DROP TABLE IF EXISTS en_index;
        DROP TABLE IF EXISTS tag_index;
        DROP TABLE IF EXISTS kanji_reading;
        DROP TABLE IF EXISTS kanji_radicals;

        CREATE TABLE word_summary (
            sequence INTEGER PRIMARY KEY,
            term TEXT NOT NULL,
            reading TEXT NOT NULL,
            gloss TEXT NOT NULL,
            common INTEGER NOT NULL,
            rank INTEGER NOT NULL
        );
        INSERT INTO word_summary
        SELECT w.sequence, p.term, p.reading,
               coalesce((SELECT group_concat(gloss, ', ') FROM (
                   SELECT gloss FROM glosses g
                   WHERE g.sense_id = p.id AND g.gloss NOT LIKE 'see:%'
                   ORDER BY g.position)), p.translation, ''),
               p.frequency > 0,
               CASE WHEN w.freq_rank IS NOT NULL THEN w.freq_rank
                    ELSE {UNRANKED} - min(coalesce(
                        (SELECT max(frequency) FROM senses f WHERE f.sequence = w.sequence), 0), 99999)
               END
        FROM words w
        JOIN senses p ON p.id = (SELECT min(id) FROM senses m WHERE m.sequence = w.sequence);

        CREATE INDEX idx_summary_rank ON word_summary(rank);

        CREATE TABLE tag_index (
            tag TEXT NOT NULL,
            rank INTEGER NOT NULL,
            sequence INTEGER NOT NULL,
            PRIMARY KEY (tag, rank, sequence)
        ) WITHOUT ROWID;

        CREATE TABLE kanji_reading (
            reading TEXT NOT NULL,
            character TEXT NOT NULL,
            PRIMARY KEY (reading, character)
        ) WITHOUT ROWID;

        CREATE TABLE kanji_radicals (
            character TEXT PRIMARY KEY,
            stroke_count INTEGER NOT NULL,
            radicals TEXT NOT NULL
        ) WITHOUT ROWID;
        INSERT INTO kanji_radicals
        SELECT kr.character, coalesce(k.stroke_count, 0), group_concat(kr.radical, ' ')
        FROM kanji_radical kr JOIN kanji k ON k.character = kr.character
        GROUP BY kr.character;

        CREATE INDEX idx_kanji_grade ON kanji(grade, stroke_count);
        CREATE INDEX idx_kanji_strokes ON kanji(stroke_count);
        CREATE INDEX idx_kanji_jlpt ON kanji(jlpt_level, stroke_count);

        CREATE TABLE jp_index (
            key TEXT NOT NULL,
            rank INTEGER NOT NULL,
            sequence INTEGER NOT NULL,
            term TEXT NOT NULL,
            reading TEXT NOT NULL,
            gloss TEXT NOT NULL,
            common INTEGER NOT NULL,
            PRIMARY KEY (key, rank, sequence)
        ) WITHOUT ROWID;

        CREATE TABLE en_index (
            gloss TEXT NOT NULL COLLATE NOCASE,
            sense_rank INTEGER NOT NULL,
            position INTEGER NOT NULL,
            rank INTEGER NOT NULL,
            sequence INTEGER NOT NULL,
            PRIMARY KEY (gloss, sense_rank, position, rank, sequence)
        ) WITHOUT ROWID;
        INSERT OR IGNORE INTO en_index
        SELECT g.gloss,
               s.id <> (SELECT min(id) FROM senses m WHERE m.sequence = s.sequence),
               g.position, ws.rank, s.sequence
        FROM glosses g
        JOIN senses s ON s.id = g.sense_id
        JOIN word_summary ws ON ws.sequence = s.sequence
        WHERE g.gloss NOT LIKE 'see:%';
        """
    )
    # The results list truncates with CSS; this cap only bounds row size.
    conn.execute(
        f"""UPDATE word_summary SET gloss = substr(gloss, 1, {SUMMARY_GLOSS_CHARS}) || '…'
            WHERE length(gloss) > {SUMMARY_GLOSS_CHARS}"""
    )
    forms = conn.execute(
        """SELECT DISTINCT s.sequence, s.term, s.reading, ws.rank, ws.gloss, ws.common
           FROM senses s JOIN word_summary ws ON ws.sequence = s.sequence"""
    ).fetchall()
    rows = []
    for sequence, term, reading, rank, gloss, common in forms:
        for key in {term, to_hiragana(reading)}:
            rows.append((key, rank, sequence, term, reading, gloss, common))
    conn.executemany("INSERT OR IGNORE INTO jp_index VALUES (?, ?, ?, ?, ?, ?, ?)", rows)
    conn.executemany("INSERT OR IGNORE INTO tag_index VALUES (?, ?, ?)", word_tags(conn))
    conn.executemany("INSERT OR IGNORE INTO kanji_reading VALUES (?, ?)", kanji_readings(conn))
    conn.commit()


def collect_meta(conn: sqlite3.Connection) -> dict:
    """Counts the landing page shows; computed here because counting over HTTP is a full scan."""
    count = lambda sql: conn.execute(sql).fetchone()[0]
    return {
        "words": count("SELECT count(*) FROM words"),
        "kanji": count("SELECT count(*) FROM kanji"),
        "pitchWords": count("SELECT count(DISTINCT sequence) FROM senses WHERE pitch_accent IS NOT NULL"),
        "jlptWords": count("SELECT count(*) FROM words WHERE jlpt_level IS NOT NULL"),
        "rankedWords": count("SELECT count(*) FROM words WHERE freq_rank IS NOT NULL"),
        "builtAt": date.today().isoformat(),
    }


def prepare_database(source: Path, work_copy: Path) -> dict:
    """Copy the database, add the search tables, rewrite at PAGE_SIZE with fresh statistics."""
    shutil.copyfile(source, work_copy)
    conn = sqlite3.connect(work_copy)
    try:
        build_search_tables(conn)
        meta = collect_meta(conn)
        # A new page size only applies on VACUUM, and never in WAL mode.
        conn.execute("PRAGMA journal_mode = DELETE")
        conn.execute(f"PRAGMA page_size = {PAGE_SIZE}")
        conn.execute("VACUUM")
        conn.execute("ANALYZE")
        conn.commit()
        actual = conn.execute("PRAGMA page_size").fetchone()[0]
    finally:
        conn.close()
    if actual != PAGE_SIZE:
        raise RuntimeError(f"page size is {actual}, expected {PAGE_SIZE}")
    return meta


def write_chunks(prepared: Path, out_dir: Path, chunk_size: int) -> dict:
    """Split the database into chunk files and return the matching httpvfs config."""
    for stale in out_dir.glob(CHUNK_PREFIX + "*"):
        stale.unlink()
    with prepared.open("rb") as src:
        index = 0
        while block := src.read(chunk_size):
            (out_dir / f"{CHUNK_PREFIX}{index:0{SUFFIX_LENGTH}d}").write_bytes(block)
            index += 1
    return {
        "serverMode": "chunked",
        # Must equal the SQLite page size, or page reads straddle request boundaries.
        "requestChunkSize": PAGE_SIZE,
        "databaseLengthBytes": prepared.stat().st_size,
        "serverChunkSize": chunk_size,
        "urlPrefix": CHUNK_PREFIX,
        "suffixLength": SUFFIX_LENGTH,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "source",
        nargs="?",
        default=ROOT_DIR / "db_files" / "Japanese_English.db",
        type=Path,
        help="built dictionary to prepare (default: db_files/Japanese_English.db)",
    )
    parser.add_argument(
        "--out",
        default=ROOT_DIR / "site" / "public" / "db",
        type=Path,
        help="directory for the chunk files and config.json (default: site/public/db)",
    )
    parser.add_argument(
        "--chunk-size",
        default=DEFAULT_CHUNK_SIZE,
        type=int,
        help="bytes per chunk file (default: 10 MiB)",
    )
    args = parser.parse_args()

    if not args.source.exists():
        print(f"No database at {args.source}. Build it first: python src/main.py --build Japanese_English")
        return 1
    if args.chunk_size % PAGE_SIZE != 0:
        print(f"--chunk-size must be a multiple of {PAGE_SIZE}")
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    work_copy = args.out / "prepared.db"
    meta = prepare_database(args.source, work_copy)
    config = write_chunks(work_copy, args.out, args.chunk_size)
    (args.out / "config.json").write_text(json.dumps(config, indent=2) + "\n")
    (args.out / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    work_copy.unlink()

    chunk_count = len(list(args.out.glob(CHUNK_PREFIX + "*")))
    print(f"{config['databaseLengthBytes']} bytes in {chunk_count} chunks at {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
