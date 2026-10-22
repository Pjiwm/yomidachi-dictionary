"""Turn a built dictionary into the chunked layout sql.js-httpvfs reads over HTTP."""

import argparse
import json
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

# Smaller pages make indexed lookups cheaper over HTTP.
PAGE_SIZE = 1024
DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024
SUFFIX_LENGTH = 3
CHUNK_PREFIX = "db.sqlite3."


def prepare_database(source: Path, work_copy: Path) -> None:
    """Copy the database and rewrite it at PAGE_SIZE with fresh planner statistics."""
    shutil.copyfile(source, work_copy)
    conn = sqlite3.connect(work_copy)
    try:
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
    prepare_database(args.source, work_copy)
    config = write_chunks(work_copy, args.out, args.chunk_size)
    (args.out / "config.json").write_text(json.dumps(config, indent=2) + "\n")
    work_copy.unlink()

    chunk_count = len(list(args.out.glob(CHUNK_PREFIX + "*")))
    print(f"{config['databaseLengthBytes']} bytes in {chunk_count} chunks at {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
