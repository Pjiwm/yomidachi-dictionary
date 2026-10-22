# Vocabulizer Dictionary & CLI

[Search the dictionary](https://pjiwm.github.io/yomidachi-dictionary/#/)

CLI tool & website for building Japanese dictionary SQLite databases from JMdict/KANJIDIC source data.

## Setup

```bash
git clone https://github.com/Pjiwm/yomidachi-dictionary.git
cd yomidachi-dictionary
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

`site/` is the Yomidachi Dictionary web app, served from GitHub Pages. The
browser queries the SQLite file directly, so there is no server.

```bash
python src/main.py --build Japanese_English   # if db_files/ is empty
python scripts/prepare_site_db.py             # search tables + chunks into site/public/db/
cd site && npm install && npm run dev
```

`npm run build` writes `site/dist/`. Deploys are manual: Actions → "Build and
deploy the dictionary site" → Run workflow.

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
