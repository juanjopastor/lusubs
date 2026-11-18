const sourceText = document.querySelector('#sourceText');
const resultText = document.querySelector('#resultText');
const fileInput = document.querySelector('#fileInput');
const processButton = document.querySelector('#processButton');
const printableButton = document.querySelector('#printableButton');
const downloadHtmlButton = document.querySelector('#downloadHtmlButton');
const copyButton = document.querySelector('#copyButton');
const downloadButton = document.querySelector('#downloadButton');
const clearButton = document.querySelector('#clearButton');
const sourceMeta = document.querySelector('#sourceMeta');
const resultMeta = document.querySelector('#resultMeta');
const wordCount = document.querySelector('#wordCount');

const subtitleTimecode = /^\s*(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->\s*(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}.*$/;
const printableTimecode = /^\s*((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}).*$/;
const subtitleIndex = /^\s*\d+\s*$/;
const wordPattern = /[\p{L}\p{M}]+/gu;
let printableSections = [];
let trackedSourceValue = '';

function updateSourceMeta() {
  const characters = sourceText.value.length;
  sourceMeta.textContent = `${characters.toLocaleString(navigator.language)} characters`;
}

function removeSubtitleMetadata(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !subtitleTimecode.test(line) && !subtitleIndex.test(line.trim()) && !/^\s*WEBVTT\s*$/i.test(line));
}

function processText(text) {
  const locale = navigator.language;
  const seenWords = new Set();
  const rows = [];

  for (const line of removeSubtitleMetadata(text)) {
    const phrase = line.trim();
    const words = phrase.toLocaleLowerCase(locale).match(wordPattern) ?? [];
    for (const word of words) {
      if (seenWords.has(word)) continue;
      seenWords.add(word);
      rows.push([word, phrase]);
    }
  }

  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
}

function getPrintableSubtitles(text) {
  const subtitles = [];
  let currentSubtitle = null;
  let pendingSubtitleIndex = null;

  for (const line of text.split(/\r?\n/)) {
    const timecode = line.match(printableTimecode);
    if (timecode) {
      if (currentSubtitle) subtitles.push(currentSubtitle);
      currentSubtitle = { index: pendingSubtitleIndex, start: timecode[1], end: timecode[2], lines: [] };
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
      }));
  }

  return removeSubtitleMetadata(text)
    .map((line) => line.replace(/<[^>]*>/g, '').trim())
    .filter(Boolean)
    .map((line) => ({ index: null, start: null, text: line }));
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

function getPrintableSections() {
  return sourceText.value === trackedSourceValue && printableSections.length
    ? printableSections
    : [{ name: null, text: sourceText.value }];
}

function buildPrintableHtml() {
  const sections = getPrintableSections();
  const subtitleMarkup = sections.map((section, index) => {
    const heading = section.name ? `<h1>${escapeHtml(section.name)}</h1>` : '';
    const separator = index > 0 ? '<hr>' : '';
    const subtitles = getPrintableSubtitles(section.text)
      .map((subtitle) => {
        const timestamp = subtitle.start
          ? `<p style="margin: 0; line-height: 1.2;"><span style="color: #78817c; font-size: 9pt;">${subtitle.index !== null ? `<strong style="font-weight: bold;">${escapeHtml(subtitle.index)}</strong> ` : ''}[${escapeHtml(subtitle.start)} --> ${escapeHtml(subtitle.end)}]</span></p>`
          : '';
        const text = subtitle.text.split(/\r?\n/).map(escapeHtml).join('<br>');
        return `${timestamp}<p style="margin: 0 0 12pt; line-height: 1.5;"><span style="color: #17221f; font-size: 12pt;">${text}</span></p>`;
      })
      .join('\n');
    return `${separator}${heading}${subtitles}`;
  }).join('\n');
  const fileNames = sections.filter((section) => section.name).map((section) => section.name);
  const title = fileNames.length ? fileNames.join(' - ') : 'Subtitles';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { max-width: 800px; margin: 40px auto; padding: 0 24px; color: #17221f; background: #fff; font: 16px/1.6 Arial, sans-serif; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    p { margin: 0 0 16px; white-space: pre-wrap; }
    hr { margin: 24px 0; border: 0; border-top: 1px solid #d9ddd5; }
  </style>
</head>
<body>
  ${subtitleMarkup}
</body>
</html>`;
}

function getPrintableHtmlFilename() {
  const fileNames = getPrintableSections().filter((section) => section.name).map((section) => section.name);
  const baseName = fileNames.length === 1 ? fileNames[0].replace(/\.[^.]+$/, '') : 'subtitles';
  const safeBaseName = baseName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '') || 'subtitles';
  return `${safeBaseName}.html`;
}

function openPrintableSubtitles() {
  const printableWindow = window.open('', '_blank');
  if (!printableWindow) {
    window.alert('Please allow pop-ups to open the printable version.');
    return;
  }

  printableWindow.document.write(buildPrintableHtml());
  printableWindow.document.close();
}

function downloadPrintableHtml() {
  const file = new Blob([buildPrintableHtml()], { type: 'text/html;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = getPrintableHtmlFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function escapeCsvField(value) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function updateResultMeta() {
  const result = resultText.value;
  const count = result ? result.split('\n').length : 0;
  wordCount.textContent = `${count.toLocaleString(navigator.language)} ${count === 1 ? 'word' : 'words'}`;
  resultMeta.textContent = result ? `${result.length.toLocaleString(navigator.language)} characters` : 'No results';
  copyButton.disabled = !result;
  downloadButton.disabled = !result;
}

function showResult(result) {
  resultText.value = result;
  updateResultMeta();
}

sourceText.addEventListener('input', updateSourceMeta);
resultText.addEventListener('input', updateResultMeta);

fileInput.addEventListener('change', async () => {
  const files = Array.from(fileInput.files);
  if (!files.length) return;

  const contents = await Promise.all(files.map((file) => file.text()));
  if (sourceText.value !== trackedSourceValue) {
    printableSections = sourceText.value ? [{ name: null, text: sourceText.value }] : [];
  }
  const newSections = files.map((file, index) => ({ name: file.name, text: contents[index] }));
  const separator = sourceText.value && !sourceText.value.endsWith('\n') ? '\n' : '';
  sourceText.value += separator + contents.join('\n');
  printableSections.push(...newSections);
  trackedSourceValue = sourceText.value;
  updateSourceMeta();
  sourceText.focus();
  fileInput.value = '';
});

clearButton.addEventListener('click', () => {
  sourceText.value = '';
  printableSections = [];
  trackedSourceValue = '';
  updateSourceMeta();
  sourceText.focus();
});

processButton.addEventListener('click', () => {
  showResult(processText(sourceText.value));
});

printableButton.addEventListener('click', openPrintableSubtitles);
downloadHtmlButton.addEventListener('click', downloadPrintableHtml);

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultText.value);
    resultMeta.textContent = 'List copied';
    window.setTimeout(() => {
      resultMeta.textContent = `${resultText.value.length.toLocaleString(navigator.language)} characters`;
    }, 1800);
  } catch {
    resultText.select();
    document.execCommand('copy');
    resultMeta.textContent = 'Lista copiada';
  }
});

downloadButton.addEventListener('click', () => {
  const file = new Blob([resultText.value], { type: 'text/csv;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = 'words.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
});

updateSourceMeta();
