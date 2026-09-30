# LuSubs

**Learn languages using subtitles.**

LuSubs is a lightweight browser tool that turns subtitle files and plain text into a CSV of unique words and the subtitle lines they came from. It removes subtitle metadata, punctuation, symbols, and numbers from extracted words.

## Live demo

[Open LuSubs](https://juanjopastor.github.io/lusubs/)

## Features

- Process `.srt`, `.vtt`, and `.txt` files.
- Paste text directly into the editor.
- Remove subtitle timestamps, cue numbers, and `WEBVTT` headers.
- Extract words from different writing systems using Unicode-aware matching.
- Remove duplicate words while respecting the browser's language settings.
- Keep the first subtitle line where each unique word appears.
- Copy the CSV result or download it as a `.csv` file.
- Process everything locally in the browser. No uploads, accounts, or server required.

## How to use

1. Paste subtitles or text into the input panel, or load one or more supported files.
2. Click **Process text**.
3. Review the unique word list in the output panel.
3. Review the CSV rows in the output panel. Each row contains a unique word and its original subtitle line.
4. Copy the CSV or save it as a `.csv` file.

The tool uses `navigator.language` for case conversion, duplicate detection, sorting, and number formatting. The word extractor keeps letters and combining marks while excluding punctuation, symbols, and numbers.

## Run locally

LuSubs is a dependency-free static web application. Clone the repository and open `index.html` in a browser, or serve the directory with any local static web server.

```bash
git clone https://github.com/juanjopastor/lusubs.git
cd lusubs
```

Then open `index.html` or start a local server, for example:

```bash
python -m http.server
```

## Project files

- `index.html` - application structure and interface text.
- `styles.css` - layout and visual styles.
- `app.js` - subtitle cleanup, word extraction, and file actions.
