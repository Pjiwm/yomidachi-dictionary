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
SUMMARY_GLOSS_CHARS = 80
UNRANKED = 1_000_000


def to_hiragana(text: str) -> str:
    return "".join(
        chr(ord(c) - KATAKANA_OFFSET) if "\u30a1" <= c <= "\u30f6" else c for c in text
    )


def build_search_tables(conn: sqlite3.Connection) -> None:
    """Denormalized search tables: key, rank and display columns in one b-tree.

    Over HTTP every row visited is a round trip, so a search must read one
    contiguous key range and nothing else. These tables make that possible;
    the original tables stay for the detail views.
    """
    conn.executescript(
        f"""
        DROP TABLE IF EXISTS word_summary;
        DROP TABLE IF EXISTS jp_index;
        DROP TABLE IF EXISTS en_index;

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
               substr(coalesce(p.translation, ''), 1, {SUMMARY_GLOSS_CHARS}),
               p.frequency > 0,
               CASE WHEN w.freq_rank IS NOT NULL THEN w.freq_rank
                    ELSE {UNRANKED} - min(coalesce(
                        (SELECT max(frequency) FROM senses f WHERE f.sequence = w.sequence), 0), 99999)
               END
        FROM words w
        JOIN senses p ON p.id = (SELECT min(id) FROM senses m WHERE m.sequence = w.sequence);

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
    forms = conn.execute(
        """SELECT DISTINCT s.sequence, s.term, s.reading, ws.rank, ws.gloss, ws.common
           FROM senses s JOIN word_summary ws ON ws.sequence = s.sequence"""
    ).fetchall()
    rows = []
    for sequence, term, reading, rank, gloss, common in forms:
        for key in {term, to_hiragana(reading)}:
            rows.append((key, rank, sequence, term, reading, gloss, common))
    conn.executemany("INSERT OR IGNORE INTO jp_index VALUES (?, ?, ?, ?, ?, ?, ?)", rows)
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
