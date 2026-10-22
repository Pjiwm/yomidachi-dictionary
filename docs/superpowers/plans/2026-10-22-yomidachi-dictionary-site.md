# Yomidachi Dictionary site: implementation plan

Spec: `docs/superpowers/specs/2026-10-22-yomidachi-dictionary-site-design.md`.
Branch: `feature/pages-dictionary-site`.

Each chunk is one reviewable diff. Skeleton before fill. Pim runs the build
and tooling commands. Tests are agreed per chunk, not assumed.

## File map

```
src/main.py                              headless --build flag (modify)
scripts/prepare_site_db.py               page size, VACUUM, ANALYZE, chunk, config.json
site/package.json, vite.config.ts, tsconfig.json, index.html
site/src/styles/tokens.css               yomidachi tokens, light and dark
site/src/styles/app.css                  Tailwind import, base typography, fonts
site/src/types.ts                        DictEntry, KanjiEntry, Radical, SearchResults
site/src/db/worker.ts                    sql.js-httpvfs bootstrap
site/src/db/repository.ts                DictRepository: SQL + row mapping
site/src/search/query.ts                 parseQuery, chips, wildcards
site/src/search/filters.ts               filter tables + resolveFilter
site/src/search/pos.ts                   POS labels
site/src/search/kana.ts                  toHiragana, toKatakana, script tests
site/src/search/pitch.ts                 splitMora, pitchType
site/src/state/state.ts                  AppState, update(), subscribe
site/src/state/router.ts                 hash <-> Route
site/src/ui/*.ts                         one render function per view
site/src/main.ts                         wiring
site/src/search/filters.json             filter tables, shared with the prepare script
site/public/db/                          gitignored chunked database for local dev
.github/workflows/pages.yml              build + deploy
LICENSE, README.md                       brand exception, site section, attribution
```

## Chunks

1. **Headless builder entry.** `src/main.py --build Japanese_English` builds one
   dictionary and exits non-zero on failure; no args keeps the menu.
2. **Database post-processing script.** `scripts/prepare_site_db.py`: rebuild at
   page size 1024, VACUUM, ANALYZE, split into 10 MB chunks, write
   `config.json` in the sql.js-httpvfs layout. Pim runs it once locally to get
   `site/public/db/`.
3. **Site skeleton (C3).** Dependencies raised, Pim adds them. Vite, Tailwind,
   tokens, `index.html`, `types.ts`, every module with signatures and empty
   bodies, `main.ts` wiring. Nothing queries yet. Pim runs `npm run dev` to see
   the shell render.
4. **Worker + repository, word side.** `db/worker.ts` init; `repository.ts`
   `search`, `wordDetails`, `kanjiForWord`, `resolveReference`.
5. **Pure search modules.** `kana.ts`, `pitch.ts`, `query.ts`, `filters.ts`
   (data port), `pos.ts` (data port). Tests agreed here.
6. **State and router.** `state.ts` single store with `update`, `router.ts`
   parse/format of the four routes, `main.ts` subscribes and renders.
7. **Word views.** `SearchBar`, `ResultsList`, `EntryDetail`, `PitchDiagram`.
  
8. **Advanced search.** `repository.advancedSearch` clause builder for pos, is,
   topic, dialect, jlpt, pitch, grade, strokes, and `not:`.
9. **Kanji views and radicals.** `KanjiDetail`, `RadicalPicker`,
   `repository.kanjiByReading`, `kanjiByRadicals`, `radicals`.
10. **Footer, attribution, brand exception.** Site footer with EDRDG and the
    other attributions, LICENSE brand paragraph, README site section.
11. **Pages workflow.** `.github/workflows/pages.yml` drafted for review; Pim
    owns the CI change, enables Pages in repo settings, triggers the first run.
12. **PWA.** Web app manifest with Pim's dictionary logos, service worker
    that caches the app shell (not the database chunks), install prompt
    left to the browser.
13. **Final independent review** of the whole branch.
