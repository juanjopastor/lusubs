const fileInput = document.querySelector('#fileInput');
const loadButton = document.querySelector('#loadButton');
const audioInput = document.querySelector('#audioInput');
const loadAudioButton = document.querySelector('#loadAudioButton');
const downloadVttButton = document.querySelector('#downloadVttButton');
const downloadHtmlButton = document.querySelector('#downloadHtmlButton');
const installButton = document.querySelector('#installButton');
const previewContainer = document.querySelector('#previewContainer');
const appTitle = document.querySelector('#appTitle');
const brand = document.querySelector('.brand');

const subtitleTimecode = /^\s*(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->\s*(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}.*$/;
const printableTimecode = /^\s*((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}).*$/;
const subtitleIndex = /^\s*\d+\s*$/;
let printableSections = [];
let audioBuffer = null;
let audioContext = null;
let audioDecodeStatus = 'none';
let audioLoadRequest = 0;
let activeCueSource = null;
let activeCueKey = null;
let cuePlaybackRequest = 0;
let deferredInstallPrompt = null;

function removeSubtitleMetadata(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !subtitleTimecode.test(line) && !subtitleIndex.test(line.trim()) && !/^\s*WEBVTT\s*$/i.test(line));
}

function getPrintableSubtitles(text, readVttNotes = false) {
  const subtitles = [];
  const visibleLines = [];
  const lines = text.split(/\r?\n/);
  let currentSubtitle = null;
  let pendingSubtitleIndex = null;
  let pendingNote = '';

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const followingLineIsCue = lineIndex + 1 < lines.length && printableTimecode.test(lines[lineIndex + 1]);
    const startsNoteBlock = readVttNotes
      && /^NOTE(?:[ \t]|$)/.test(line)
      && (!currentSubtitle || lineIndex === 0 || !lines[lineIndex - 1].trim())
      && !followingLineIsCue;
    if (startsNoteBlock) {
      if (currentSubtitle) {
        subtitles.push(currentSubtitle);
        currentSubtitle = null;
      }

      const isLuSubsNote = line.trim() === 'NOTE LUSUBS';
      const noteLines = [];
      while (lineIndex + 1 < lines.length && lines[lineIndex + 1].trim()) {
        noteLines.push(lines[lineIndex + 1]);
        lineIndex += 1;
      }
      pendingNote = isLuSubsNote ? noteLines.join(' ').trim() : '';
      continue;
    }

    if (readVttNotes && !line.trim()) {
      if (currentSubtitle) {
        subtitles.push(currentSubtitle);
        currentSubtitle = null;
      }
      visibleLines.push(line);
      continue;
    }

    visibleLines.push(line);
    const timecode = line.match(printableTimecode);
    if (timecode) {
      if (currentSubtitle) subtitles.push(currentSubtitle);
      currentSubtitle = {
        index: pendingSubtitleIndex,
        start: timecode[1],
        end: timecode[2],
        lines: [],
        note: pendingNote,
      };
      pendingNote = '';
      pendingSubtitleIndex = null;
    } else if (subtitleIndex.test(line.trim())) {
      pendingSubtitleIndex = line.trim();
    } else {
      if (line.trim()) pendingSubtitleIndex = null;
      if (currentSubtitle && !/^\s*WEBVTT\s*$/i.test(line)) {
        const cleanLine = line.replace(/<[^>]*>/g, '').trim();
        if (cleanLine) currentSubtitle.lines.push(cleanLine);
      }
    }
  }

  if (currentSubtitle) subtitles.push(currentSubtitle);

  if (subtitles.length) {
    return subtitles
      .filter((subtitle) => subtitle.lines.length)
      .map((subtitle) => ({
        index: subtitle.index,
        start: subtitle.start,
        end: subtitle.end,
        text: subtitle.lines.join('\n'),
        note: subtitle.note,
      }));
  }

  return removeSubtitleMetadata(visibleLines.join('\n'))
    .map((line) => line.replace(/<[^>]*>/g, '').trim())
    .filter(Boolean)
    .map((line) => ({ index: null, start: null, end: null, text: line, note: '' }));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function getSubtitleName(fileName) {
  return fileName.replace(/\.(?:srt|vtt)$/i, '') || 'Subtitles';
}

function getSubtitleTitle(sections) {
  const names = sections.filter((section) => section.name).map((section) => getSubtitleName(section.name));
  return names.length ? names.join(' - ') : 'Subtitles';
}

function getTimeInSeconds(timecode) {
  const parts = timecode.replace(',', '.').split(':').map(Number);
  const seconds = parts.pop();
  const minutes = parts.pop();
  const hours = parts.length ? parts.pop() : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  if (!audioContext) audioContext = new AudioContextConstructor();
  return audioContext;
}

function canPlaySubtitle(subtitle) {
  if (audioDecodeStatus !== 'ready' || !audioBuffer || !subtitle.start || !subtitle.end) {
    return false;
  }

  const start = getTimeInSeconds(subtitle.start);
  const end = getTimeInSeconds(subtitle.end);
  return Number.isFinite(start)
    && Number.isFinite(end)
    && start >= 0
    && start < end
    && start < audioBuffer.duration;
}

function updatePlaybackButtons() {
  previewContainer.querySelectorAll('.subtitle-play').forEach((button) => {
    const isActive = button.dataset.cueKey === activeCueKey;
    button.classList.toggle('is-playing', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function cancelCuePlayback() {
  cuePlaybackRequest += 1;
}

function clearActiveCue() {
  if (activeCueSource) {
    const source = activeCueSource;
    activeCueSource = null;
    source.onended = null;
    source.stop();
  }
  activeCueKey = null;
  updatePlaybackButtons();
}

function buildSubtitleMarkup(includeSectionTitles, includeNoteControls) {
  return printableSections.map((section, sectionIndex) => {
    const heading = includeSectionTitles && section.name
      ? `<h1>${escapeHtml(getSubtitleName(section.name))}</h1>`
      : '';
    const separator = includeSectionTitles && sectionIndex > 0 ? '<hr>' : '';
    const subtitles = section.subtitles.map((subtitle, subtitleIndex) => {
      const cueKey = `${sectionIndex}:${subtitleIndex}`;
      const timestamp = subtitle.start
        ? `<span class="subtitle-time">${subtitle.index !== null ? `<strong>${escapeHtml(subtitle.index)}</strong> ` : ''}[${escapeHtml(subtitle.start)} --> ${escapeHtml(subtitle.end)}]</span>`
        : '';
      const text = subtitle.text.split(/\r?\n/).map(escapeHtml).join('<br>');
      const note = subtitle.note ? `<p class="subtitle-note">${escapeHtml(subtitle.note)}</p>` : '';
      const canPlay = canPlaySubtitle(subtitle);
      const isPlaying = cueKey === activeCueKey;
      const playTitle = canPlay
        ? 'Play this subtitle'
        : audioDecodeStatus === 'loading'
          ? 'Preparing MP3 for accurate playback'
          : audioDecodeStatus === 'error'
            ? 'The MP3 could not be decoded'
            : 'Load an MP3 to play this subtitle';
      const playbackButton = includeNoteControls && audioDecodeStatus === 'ready' && audioBuffer
        ? `<button class="subtitle-play${isPlaying ? ' is-playing' : ''}" type="button" data-play-cue data-cue-key="${cueKey}" data-section="${sectionIndex}" data-subtitle="${subtitleIndex}" aria-label="Play subtitle ${subtitleIndex + 1}" aria-pressed="${isPlaying}" title="${playTitle}" ${canPlay ? '' : 'disabled'}>
            ${timestamp}<span class="subtitle-text">${text}</span>
          </button>`
        : `<div class="subtitle-content">${timestamp}<p class="subtitle-text">${text}</p></div>`;
      const noteControls = includeNoteControls
        ? `<button class="note-trigger" type="button" data-note-action="edit" aria-label="Add or edit note for subtitle ${subtitleIndex + 1}">+</button>
          <form class="note-editor" data-section="${sectionIndex}" data-subtitle="${subtitleIndex}" hidden>
            <div class="note-input-row">
              <input class="note-input" type="text" aria-label="Note for subtitle ${subtitleIndex + 1}" placeholder="Write a note..." value="${escapeHtml(subtitle.note || '')}">
              <button class="note-clear" type="button" data-note-action="clear" aria-label="Clear note" title="Clear note">×</button>
            </div>
            <div class="note-actions">
              <button class="note-save" type="submit">Save note</button>
              <button class="note-cancel" type="button" data-note-action="cancel">Cancel</button>
            </div>
          </form>`
        : '';

      return `<article class="subtitle-row" data-section="${sectionIndex}" data-subtitle="${subtitleIndex}">
        ${playbackButton}
        ${note}
        ${noteControls}
      </article>`;
    }).join('\n');

    return `${separator}${heading}${subtitles}`;
  }).join('\n');
}

function buildPrintableHtml() {
  const subtitleMarkup = buildSubtitleMarkup(true, false);
  const title = getSubtitleTitle(printableSections);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { max-width: 800px; margin: 40px auto; padding: 0 24px; color: #17221f; background: #fff; font: 16px/1.6 Arial, sans-serif; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    .subtitle-row { margin: 0 0 12pt; }
    .subtitle-time { display: block; color: #78817c; font-size: 9pt; line-height: 1.2; }
    .subtitle-text { margin: 0; color: #17221f; font-size: 12pt; line-height: 1.5; white-space: pre-wrap; }
    .subtitle-note { margin: 4pt 0 0; color: #c0392b; font-size: 11pt; line-height: 1.4; white-space: pre-wrap; }
    hr { margin: 24px 0; border: 0; border-top: 1px solid #d9ddd5; }
  </style>
</head>
<body>
  ${subtitleMarkup}
</body>
</html>`;
}

function getExportBaseName() {
  const baseName = printableSections.length === 1
    ? getSubtitleName(printableSections[0].name)
    : 'subtitles';
  return baseName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '') || 'subtitles';
}

function renderPreview() {
  previewContainer.innerHTML = buildSubtitleMarkup(false, true);
  previewContainer.hidden = false;
}

function playSubtitleCue(button) {
  const section = printableSections[Number(button.dataset.section)];
  const subtitle = section.subtitles[Number(button.dataset.subtitle)];
  if (!canPlaySubtitle(subtitle)) return;

  const cueKey = button.dataset.cueKey;
  if (activeCueKey === cueKey && activeCueSource) {
    cancelCuePlayback();
    clearActiveCue();
    return;
  }

  cancelCuePlayback();
  const playbackRequest = cuePlaybackRequest;
  clearActiveCue();
  activeCueKey = cueKey;
  const start = getTimeInSeconds(subtitle.start);
  const end = Math.min(getTimeInSeconds(subtitle.end), audioBuffer.duration);
  updatePlaybackButtons();

  audioContext.resume().then(() => {
    if (playbackRequest !== cuePlaybackRequest || activeCueKey !== cueKey || !audioBuffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      if (activeCueSource !== source) return;
      activeCueSource = null;
      activeCueKey = null;
      updatePlaybackButtons();
    };
    source.start(0, start, end - start);
    activeCueSource = source;
  }).catch(() => {
    if (playbackRequest === cuePlaybackRequest) {
      clearActiveCue();
      window.alert('The selected audio could not be played.');
    }
  });
}

function downloadFile(contents, filename, contentType) {
  const file = new Blob([contents], { type: contentType });
  const downloadUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function downloadPrintableHtml() {
  downloadFile(buildPrintableHtml(), `${getExportBaseName()}.html`, 'text/html;charset=utf-8');
}

function canSaveAsVtt() {
  return printableSections.length > 0
    && printableSections.every((section) => section.subtitles.length > 0
      && section.subtitles.every((subtitle) => subtitle.start && subtitle.end));
}

function formatWebVttTime(time) {
  return time.replace(/^(\d):/, '0$1:').replace(',', '.');
}

function buildAnnotatedVtt() {
  const cues = printableSections.flatMap((section) => section.subtitles.map((subtitle) => {
    const note = subtitle.note ? `NOTE LUSUBS\n${subtitle.note.replace(/[\r\n]+/g, ' ')}\n\n` : '';
    const start = formatWebVttTime(subtitle.start);
    const end = formatWebVttTime(subtitle.end);
    return `${note}${start} --> ${end}\n${subtitle.text}`;
  }));
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

function downloadAnnotatedVtt() {
  downloadFile(buildAnnotatedVtt(), `${getExportBaseName()}.vtt`, 'text/vtt;charset=utf-8');
}

function saveNote(form) {
  const section = printableSections[Number(form.dataset.section)];
  const subtitle = section.subtitles[Number(form.dataset.subtitle)];
  subtitle.note = form.querySelector('.note-input').value.trim();
  renderPreview();
}

loadButton.addEventListener('click', () => fileInput.click());
loadAudioButton.addEventListener('click', () => audioInput.click());
brand.addEventListener('click', (event) => event.preventDefault());

audioInput.addEventListener('change', async () => {
  const file = audioInput.files[0];
  if (!file) return;
  if (!/\.mp3$/i.test(file.name) && !/^audio\/(?:mpeg|mp3)$/i.test(file.type)) {
    audioInput.value = '';
    window.alert('Choose an MP3 audio file.');
    return;
  }

  if (!window.confirm('For accurate cue playback, the full MP3 must be decoded into memory. Long files can require hundreds of MB. Continue?')) {
    audioInput.value = '';
    return;
  }

  const loadRequest = ++audioLoadRequest;
  cancelCuePlayback();
  clearActiveCue();
  audioBuffer = null;
  audioDecodeStatus = 'loading';
  loadAudioButton.disabled = true;
  audioInput.value = '';
  if (printableSections.length) renderPreview();

  try {
    const context = getAudioContext();
    if (!context) throw new Error('This browser does not support Web Audio.');
    const encodedAudio = await file.arrayBuffer();
    const decodedAudio = await context.decodeAudioData(encodedAudio);
    if (loadRequest !== audioLoadRequest) return;
    audioBuffer = decodedAudio;
    audioDecodeStatus = 'ready';
  } catch (error) {
    if (loadRequest !== audioLoadRequest) return;
    audioDecodeStatus = 'error';
    window.alert(`The selected MP3 could not be prepared for accurate playback. ${error.message}`);
  } finally {
    if (loadRequest === audioLoadRequest) {
      loadAudioButton.disabled = false;
      if (printableSections.length) renderPreview();
    }
  }
});

previewContainer.addEventListener('click', (event) => {
  const playButton = event.target.closest('button[data-play-cue]');
  if (playButton) {
    playSubtitleCue(playButton);
    return;
  }

  const button = event.target.closest('button[data-note-action]');
  if (!button) return;

  if (button.dataset.noteAction === 'edit') {
    const form = button.closest('.subtitle-row').querySelector('.note-editor');
    form.hidden = false;
    form.querySelector('.note-input').focus();
  } else if (button.dataset.noteAction === 'clear') {
    const form = button.closest('.note-editor');
    form.querySelector('.note-input').value = '';
    saveNote(form);
  } else if (button.dataset.noteAction === 'cancel') {
    const form = button.closest('.note-editor');
    const section = printableSections[Number(form.dataset.section)];
    const subtitle = section.subtitles[Number(form.dataset.subtitle)];
    form.querySelector('.note-input').value = subtitle.note || '';
    form.hidden = true;
  }
});

previewContainer.addEventListener('submit', (event) => {
  const form = event.target.closest('.note-editor');
  if (!form) return;
  event.preventDefault();
  saveNote(form);
});

fileInput.addEventListener('change', async () => {
  const files = Array.from(fileInput.files);
  if (!files.length) return;

  const contents = await Promise.all(files.map((file) => file.text()));
  cancelCuePlayback();
  clearActiveCue();
  printableSections = files.map((file, index) => {
    const isVtt = /\.vtt$/i.test(file.name);
    return {
      name: file.name,
      text: contents[index],
      subtitles: getPrintableSubtitles(contents[index], isVtt),
    };
  });
  const title = getSubtitleTitle(printableSections);
  appTitle.textContent = title;
  brand.setAttribute('aria-label', `${title}, inicio`);
  fileInput.value = '';
  downloadHtmlButton.disabled = !printableSections.some((section) => section.text.trim());
  downloadVttButton.disabled = !canSaveAsVtt();
  renderPreview();
});

downloadVttButton.addEventListener('click', downloadAnnotatedVtt);
downloadHtmlButton.addEventListener('click', downloadPrintableHtml);

window.addEventListener('pagehide', () => {
  audioLoadRequest += 1;
  cancelCuePlayback();
  clearActiveCue();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;

  const installPrompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  installButton.disabled = true;
  try {
    await installPrompt.prompt();
    await installPrompt.userChoice;
  } catch (error) {
    console.error('The app installation prompt failed.', error);
  } finally {
    installButton.disabled = false;
    installButton.hidden = true;
  }
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('The service worker could not be registered.', error);
    });
  });
}
