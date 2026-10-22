# Vocabulizer Dictionary CLI

CLI tool for building Japanese dictionary SQLite databases from JMdict/KANJIDIC source data.

## Setup

```bash
git clone https://github.com/Pjiwm/vocabulizer-dictionary-cli.git
cd vocabulizer-dictionary-cli
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m unidic download
```

## Usage

```bash
python src/main.py
```

Select a dictionary to build or "Build All". Output goes to `db_files/`.

## Website

`site/` is the Yomidachi Dictionary website: a static page on GitHub Pages
that queries `Japanese_English.db` in the browser. Nothing runs on a server;
the database is split into chunks and SQLite (compiled to WebAssembly) fetches
only the pages a lookup touches.

Build it locally:

```bash
python src/main.py --build Japanese_English   # the dictionary, if db_files/ is empty
python scripts/prepare_site_db.py             # adds the site's search tables, chunks into site/public/db/
cd site
npm install
npm run dev                                   # http://localhost:5173
```

`npm run build` writes the production site to `site/dist/`; `npm run preview`
serves it. `npm test` runs the unit tests for the query parser and filters.

The prepare script leaves `db_files/Japanese_English.db` untouched. It works on
a copy, adding tables that make filtering and ranking cheap over HTTP, and
writes `meta.json` with the counts the landing page shows.

Deployment runs from `.github/workflows/pages.yml`: it builds the dictionary,
prepares the database, builds the site and publishes it to GitHub Pages. The
`base` input selects the project URL or a custom domain.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Data Attribution

The dictionary databases built by this tool use data from the
[Electronic Dictionary Research and Development Group](https://www.edrdg.org/)
(EDRDG). The JMdict/EDICT, KANJIDIC2, and RADKFILE files are licensed under
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
The generated .db files are derivative works and inherit this license.

JLPT levels (N5-N1) for words and kanji come from [Jonathan Waller's JLPT lists](https://www.tanos.co.uk/jlpt/) (CC BY),
via [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) and [kanji-data](https://github.com/davidluzgouveia/kanji-data) (both MIT).

Pitch accent data is extracted from [UniDic](https://clrd.ninjal.ac.jp/unidic/) (NINJAL, BSD 3-Clause).

Example sentences (examples.db) come from the [Tatoeba Project](https://tatoeba.org/en/downloads),
licensed under [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/).

See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for full details.

## License

Source code is licensed under the [MIT License](LICENSE).
Dictionary data has its own licensing - see above.

The Yomidachi name, wordmark and icons are not covered by the MIT License.
They identify this project and the Yomidachi app; forks and derived work may
not use them to present themselves as Yomidachi.
