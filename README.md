# Cardly

A browser-based anatomy flashcard app with 292 built-in cards from **100 Concepts of Anatomy — Dorian**, illustrated answers, and Anki deck imports.

## Run locally

Open `index.html` in a browser. No build step, server, account, or internet connection is required.

Keep `index.html`, `flashcards.js`, `anatomy-deck.js`, `deck-media/`, and `vendor/` together.

## Study

- Reveal answers with the button or Space; cards flip between question and answer.
- Navigate with the arrow buttons or Left/Right keys.
- Rate cards **Hard**, **Good**, or **Easy**, then use the header filters to study a group.
- Shuffle changes card order. Restart returns to the first card in the current group and keeps ratings.
- Long questions and answers scroll inside the card.

Ratings, position, card order, selected filter, and answer visibility are saved per deck in browser local storage. Use the same browser and page address to resume. Clearing browser storage removes saved progress. Progress from a local file does not transfer automatically to a hosted site.

## Import decks

Choose **Import Anki deck** or drag an Anki package onto the page. Imports are processed locally. Standard field-based templates, cloze deletions, and the included deck's image overlays are supported. Templates requiring add-ons or JavaScript are not executed.

For newer compressed Anki packages, export from Anki with **Support older Anki versions** enabled.

Imported deck files and media last for the current session. Re-importing the same deck restores its saved ratings and progress. Reopening the page loads the built-in anatomy deck.

## Upload to GitHub

1. Create an empty repository on GitHub, without adding a README or other files.
2. From this folder, run the commands below, replacing `YOUR-USERNAME` and `YOUR-REPOSITORY`.

```sh
git add .
git commit -m "Add Cardly anatomy flashcard app"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

The original HTML reference and raw deck imports are ignored; the runnable app includes its extracted built-in deck and images.

## Publish with GitHub Pages

In the repository, open **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/ (root)**, then save. GitHub displays the site address when publishing finishes. No build configuration is needed.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Layout and styles |
| `flashcards.js` | Study controls, flip animation, ratings, storage, and imports |
| `anatomy-deck.js` | Built-in notes, card templates, and media map |
| `deck-media/` | Built-in anatomy images and answer masks |
| `vendor/` | Local Anki import libraries and license notices |

## Attribution

The included study content is from **100 Concepts of Anatomy — Dorian**. Original content and image rights remain with their respective owners; this repository does not grant a new license to those materials.

Bundled libraries:

- [fflate 0.8.2](https://github.com/101arrowz/fflate), MIT license; see `vendor/fflate-LICENSE.txt`.
- [sql.js 1.13.0](https://github.com/sql-js/sql.js), MIT license; see `vendor/sql.js-LICENSE.txt`. SQLite is public domain.
