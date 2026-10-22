# Yomidachi Dictionary site

2026-10-22. A free, static Japanese-English dictionary website, built from this
repo's `Japanese_English.db` and hosted on GitHub Pages under the Yomidachi name.

## Goal

Visitors look up Japanese words and kanji in the browser with no backend. The
site ships the SQLite database as-is and queries it client side, so the Python
builder stays the single source of truth for dictionary content.

## Constraints

- GitHub free plan, public repo. Pages and Actions are free for public repos.
  Pages limits: 1 GB site, 100 GB bandwidth per month (soft), no commercial
  transactions on the site.
- Only `Japanese_English.db` (about 200 MB). No examples.db.
- No runtime server. All lookups run in the browser.
- No settings. Pitch accent is always shown; theme follows the OS.
- The site is a rewrite of yomidachi-app's dictionary screen, not a port of its
  code. The data tables (filter codes, POS labels) carry over as data.
- The Yomidachi name, logo and wordmark are excluded from the MIT license. The
  site uses a text wordmark; no logo files in the repo.

## Context (C1)

```
Visitor's browser  ──HTTP Range──▶  GitHub Pages (static files + chunked .db)
                                           ▲
                                           │ deploy
GitHub Actions ──builds──▶ site/dist  ─────┘
     │
     └── downloads JMdict, KANJIDIC2, RADKFILE (EDRDG), UniDic at build time
```

No external system is called at runtime.

## Containers (C2)

| Container | Responsibility |
| --- | --- |
| Python builder (`src/`, `database_installers/`) | Existing. Produces `db_files/Japanese_English.db`. Gains a headless entry point so CI can build one dictionary without the interactive menu. |
| `site/` | New. Vite + TypeScript + Tailwind v4 single-page app. Queries the database through sql.js-httpvfs in a Web Worker. |
| `.github/workflows/pages.yml` | New. Runs the builder, post-processes the database, builds the site, deploys to Pages. |

The seam between builder and site is the database file and its schema. The site
reads the schema as it exists today; no schema changes.

### Database schema the site depends on

Tables `words(sequence, jlpt_level, freq_rank)`, `senses(id, sequence, term,
reading, pos, frequency, translation, pitch_accent)`, `glosses(id, sense_id,
gloss, position)`, `kanji(character, stroke_count, grade, jlpt_level, freq,
meanings, readings_on, readings_kun)`, `kanji_word_map(character, sequence)`,
`radical(radical, strokes)`, `kanji_radical(character, radical)`.

Existing indexes: `senses(term)`, `senses(reading)`, `senses(sequence)`,
`glosses(gloss COLLATE NOCASE)`, `glosses(sense_id)`, `kanji_word_map(sequence)`,
`kanji_radical(radical)`, `kanji_radical(character)`.

## Site components (C3)

```
site/src/
  db/        DictRepository        SQL + row mapping, talks to the worker
  search/    query parsing         pure functions, filter tables, POS labels, kana
  state/     AppState + router     one state object, hash routes, render on change
  ui/        views                 render functions, one per view
  main.ts                          wires the four together
```

### db/

`DictRepository` wraps a sql.js-httpvfs worker. It is the only module that
contains SQL. Method set mirrors yomidachi's Rust `DictRepository`:

- `search(text, limit)`: Japanese input matches `term` or `reading` by exact
  then prefix (`LIKE 'x%'`), with the kana variant (hiragana and katakana) of the
  input tried as well. English input matches `glosses.gloss` exact, then
  word-start, then substring. Order: Jiten `freq_rank` first (unranked last),
  then JMdict `frequency` descending.
- `advancedSearch(text, filters, limit)`: text clause as above, plus AND-ed
  filter clauses. Word filters apply to `senses.pos` (code match), `is:common`
  to `frequency > 0`, `jlpt:` to `words.jlpt_level`, `pitch:` to the pitch
  type computed from `pitch_accent` and the reading's mora count. Kanji filters
  (`grade:`, `strokes:`, `jlpt:` on kanji) restrict words through
  `kanji_word_map`. Wildcards `*` and `?` map to `%` and `_`.
- `wordDetails(sequence)`: all senses for a sequence, each with its glosses,
  with `See: X` glosses stripped out of the translation and collected as
  `references`.
- `kanjiForWord(term)`: kanji rows for each CJK character in the term, in order.
- `kanjiByReading(reading, limit)`: kanji whose on or kun readings match, with
  the okurigana dot removed from kun readings.
- `kanjiByRadicals(radicals)`: kanji containing all selected radicals, plus the
  set of radicals still combinable with them.
- `radicals()`: all radicals grouped by stroke count.
- `resolveReference(term)`: first entry whose term or reading equals the text.

Every query is checked with `EXPLAIN QUERY PLAN` against the real database
during development. A query that scans a table does not ship.

### search/

Pure, no I/O, unit-testable:

- `parseQuery(input)`: splits free text from `prefix:value` chips, handles
  `not:` negation, returns `{ text, chips }`.
- `resolveFilter(chip)`: chip to DB codes, from the filter tables.
- Filter tables: `POS_FILTERS`, `IS_FILTERS`, `TOPIC_FILTERS`, `DIALECT_FILTERS`,
  `JLPT_FILTERS`, `PITCH_FILTERS`, `GRADE_FILTERS`. Data only.
- `formatPos(codes)`: POS code string to English labels.
- `toHiragana`, `toKatakana`, `isJapanese`, `hasKanji`.
- `splitMora(reading)`, `pitchType(moraCount, downstep)`.

### state/

One `AppState`:

```ts
interface AppState {
  route: Route;                       // parsed from location.hash
  query: string;
  results: { words: DictEntry[]; kanji: KanjiEntry[] } | null;
  loading: boolean;
  selected: { kind: "word"; sequence: number } | { kind: "kanji"; char: string } | null;
  radicalPicker: { open: boolean; selected: string[] } | null;
  error: string | null;
}
```

Routes: `#/` (empty), `#/?q=<query>` (results), `#/word/<sequence>`,
`#/kanji/<char>`. Navigation is a hash change; the router updates state; one
`render(state)` call redraws. Back and forward work through the hash.

### ui/

Render functions that return DOM, one per view. No framework.

- `SearchBar`: text field, submit on Enter, radical picker button, chip display.
- `ResultsList`: kanji rows first (collapsed to 3 with a show-all toggle), then
  word rows (term, reading, common badge, first translation).
- `EntryDetail`: headword, pitch diagram (always on), common and JLPT N-level
  chips, POS chips, numbered meanings with clickable cross-references, other
  forms, kanji in the word.
- `KanjiDetail`: character, meanings, stroke count, JLPT, grade, kun and on
  readings.
- `RadicalPicker`: radicals grouped by stroke count, toggling narrows the kanji
  list and greys out radicals no longer combinable.
- `PitchDiagram`: mora boxes with high and low borders and the downstep number,
  one diagram per pattern in the comma-separated `pitch_accent`.

Layout: search bar on top, two panes below on wide screens (results left, detail
right), stacked with a back button on narrow screens. Breakpoint 768 px.

### Visual design

Taken from yomidachi's tokens: paper light theme (`#f5f2eb` surface, `#1a1814`
text, `#b83a2c` accent), near-black dark theme (`#0f0f0f`, `#f5f5f3`,
`#d04a3a`), chosen by `prefers-color-scheme`. Noto Sans JP self-hosted, latin
and japanese subsets, `palt` feature on. Chips are bordered pills; POS chips are
filled with the text colour. Section headers are small uppercase tracked muted
text.

## Data flow

1. Visitor types and presses Enter. `SearchBar` sets `location.hash` to
   `#/?q=...`.
2. Router parses the hash into `AppState.route`, marks `loading`.
3. `main.ts` calls `parseQuery`, then `repository.search` or
   `repository.advancedSearch`, and in parallel `kanjiForWord` or
   `kanjiByReading` depending on the text's script.
4. The repository posts the SQL to the worker. sql.js-httpvfs fetches the
   database pages it needs through Range requests, cached for the session.
5. Rows are mapped to `DictEntry` and `KanjiEntry`, state is updated,
   `render` runs.
6. Clicking a row sets the hash to `#/word/<sequence>`; the detail view runs
   `wordDetails` and `kanjiForWord` in parallel.

## Database post-processing (CI)

After the Python build, before the site build:

1. `PRAGMA page_size = 1024; VACUUM;` so a lookup pulls fewer bytes per page.
2. `ANALYZE;` so the planner picks the indexes.
3. Split into 10 MB chunks with sql.js-httpvfs's `create_db.sh` layout
   (`db.sqlite3.000`, `.001`, ... plus `config.json` with the chunk size and
   page size).
4. Copy into `site/dist/db/`.

Chunking keeps each file small for the CDN and leaves headroom under any
per-file limit.

## CI workflow

`.github/workflows/pages.yml`, triggered on push to `main`, weekly on a
schedule (JMdict updates daily), and manually.

Steps: checkout, set up Python and Node, restore the downloads cache (UniDic,
JMdict, KANJIDIC2, RADKFILE keyed on the week), run the headless build for
`Japanese_English`, post-process the database, `npm ci && npm run build` in
`site/` with `VITE_BASE` set from a workflow input (`/` for the custom domain,
`/vocabulizer-dictionary-cli/` for the project page), upload the Pages
artifact, deploy.

The builder gets a non-interactive entry: `python src/main.py --build
Japanese_English` builds that one dictionary and exits non-zero on failure.

## Error handling

- Worker or database init fails: the page shows one message with a reload link.
  No retry loop.
- A query fails: results are cleared, the error is logged to the console, the
  search bar stays usable.
- A route points at a sequence or kanji that does not exist: the detail pane
  shows "not found".

## Testing

To be agreed per chunk. Candidates: the pure `search/` functions (query parser,
filter resolution, mora splitting, pitch type, kana conversion) with Vitest;
`EXPLAIN QUERY PLAN` checks for every repository query against the real
database; one smoke run of the built site against a local chunked database.

## Out of scope

Example sentences, stroke-order SVG (needs KanjiVG, not in the database),
search history, bookmarks, settings, deck or app integration, i18n, the
French and Spanish databases.

## Licensing and attribution

- Site code: MIT, same as the repo. Brand exception for the Yomidachi name and
  wordmark, stated in LICENSE and README.
- Data: EDRDG CC BY-SA 3.0 attribution with link in the site footer, plus
  UniDic, JLPT lists, kanji-data and Jiten attributions from
  THIRD_PARTY_LICENSES.md.
- The Pages site carries no purchases or pricing. A link to the Yomidachi app
  is allowed.

## New dependencies (site/)

`vite`, `typescript`, `tailwindcss` with `@tailwindcss/vite`, `sql.js-httpvfs`,
`vitest` if tests are agreed. Added by Pim, not by tooling.
