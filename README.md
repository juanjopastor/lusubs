# LuSubs

**Learn languages using subtitles.**

LuSubs is a lightweight browser tool that turns subtitle files and plain text into a clean list of unique words. It removes subtitle metadata, punctuation, symbols, and numbers, then sorts the words alphabetically.

## Live demo

[Open LuSubs](https://juanjopastor.github.io/lusubs/)

## Features

- Process `.srt`, `.vtt`, and `.txt` files.
- Paste text directly into the editor.
- Remove subtitle timestamps, cue numbers, and `WEBVTT` headers.
- Extract words from different writing systems using Unicode-aware matching.
- Remove duplicate words while respecting the browser's language settings.
- Sort the final word list according to the browser's locale.
- Copy the result or download it as a `.txt` file.
- Process everything locally in the browser. No uploads, accounts, or server required.

## How to use

1. Paste subtitles or text into the input panel, or load one or more supported files.
2. Click **Process text**.
3. Review the unique word list in the output panel.
4. Copy the list or save it as a text file.

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
