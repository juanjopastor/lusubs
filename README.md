# LuSubs

**Preview and export subtitles as HTML.**

LuSubs is a lightweight browser tool for previewing subtitle files and exporting them as a clean HTML document.

## Live demo

[Open LuSubs](https://juanjopastor.github.io/lusubs/)

## Features

- Load `.srt` and `.vtt` files.
- Load an `.mp3` file and click any timed subtitle cue to play just that segment. The audio is decoded locally for accurate timing, which can use substantial memory for long files.
- Preview a clean HTML subtitle view with timestamps and imported file names without their `.srt`/`.vtt` extensions. Loading subtitles opens the preview in the same page, and the header shows the file name without its extension.
- Add a note to each subtitle cue; notes appear below the cue in red.
- Save annotated subtitles as `.vtt` files. Notes are stored in `NOTE LUSUBS` blocks, which WebVTT players ignore.
- Download the subtitle view as an `.html` file.
- Use the fixed header buttons to load and save subtitles on mobile or desktop.
- Process everything locally in the browser. No uploads, accounts, or server required.

## How to use

1. Select one or more `.srt` or `.vtt` files using **Load subtitles**.
2. Select an `.mp3` file using the music button, then click a timed cue to play that segment.
3. Select **+** beside a cue to add or edit a note.
4. While editing, select **×** beside the note field to clear and save the note, closing the editor.
5. Use **Save HTML** for a printable view or **Save VTT** to keep cue notes embedded in a subtitle file.

## Install as an app

Open the hosted site over HTTPS. In Chrome or Edge, use the **Install LuSubs** button when it appears, or the browser's install option. On iPhone or iPad, use Safari's **Share** menu and choose **Add to Home Screen**. Opening `index.html` directly from disk does not support installation; for local testing, serve the app from `localhost`.

The app shell is cached after the first visit so it can open offline. Subtitle and audio files are still selected locally and are not uploaded.

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

- `index.html` - application structure.
- `styles.css` - layout and visual styles.
- `app.js` - subtitle parsing, cue annotations, audio playback, and HTML/WebVTT export actions.
- `manifest.webmanifest` - install name, launch mode, and app icons.
- `service-worker.js` - app-shell caching for offline launches.
- `icons/` - install and home-screen icons.
