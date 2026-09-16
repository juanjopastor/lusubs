const sourceText = document.querySelector('#sourceText');
const resultText = document.querySelector('#resultText');
const fileInput = document.querySelector('#fileInput');
const processButton = document.querySelector('#processButton');
const copyButton = document.querySelector('#copyButton');
const downloadButton = document.querySelector('#downloadButton');
const clearButton = document.querySelector('#clearButton');
const sourceMeta = document.querySelector('#sourceMeta');
const resultMeta = document.querySelector('#resultMeta');
const wordCount = document.querySelector('#wordCount');

const subtitleTimecode = /^\s*(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->\s*(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}.*$/;
const subtitleIndex = /^\s*\d+\s*$/;
const symbolsPattern = /[?!¡¿.,;:\-_\[\](){}*€$%&/'…0123456789\\"]/g;

function updateSourceMeta() {
  const characters = sourceText.value.length;
  sourceMeta.textContent = `${characters.toLocaleString('es-ES')} caracteres`;
}

function removeSubtitleMetadata(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !subtitleTimecode.test(line) && !subtitleIndex.test(line.trim()) && !/^\s*WEBVTT\s*$/i.test(line))
    .join('\n');
}

function processText(text) {
  const plainText = removeSubtitleMetadata(text).toLocaleLowerCase('es');
  const normalized = plainText.replace(symbolsPattern, ' ');
  const words = normalized
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const seenWords = new Set();
  const uniqueWords = words.filter((word) => {
    const normalizedWord = word.toLocaleLowerCase('es');
    if (seenWords.has(normalizedWord)) return false;
    seenWords.add(normalizedWord);
    return true;
  });
  uniqueWords.sort((firstWord, secondWord) => firstWord.localeCompare(secondWord, 'es'));
  return uniqueWords.join('\n');
}

function updateResultMeta() {
  const result = resultText.value;
  const count = result ? result.split('\n').length : 0;
  wordCount.textContent = `${count.toLocaleString('es-ES')} ${count === 1 ? 'palabra' : 'palabras'}`;
  resultMeta.textContent = result ? `${result.length.toLocaleString('es-ES')} caracteres` : 'Sin resultados';
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
  const separator = sourceText.value && !sourceText.value.endsWith('\n') ? '\n' : '';
  sourceText.value += separator + contents.join('\n');
  updateSourceMeta();
  sourceText.focus();
  fileInput.value = '';
});

clearButton.addEventListener('click', () => {
  sourceText.value = '';
  updateSourceMeta();
  sourceText.focus();
});

processButton.addEventListener('click', () => {
  showResult(processText(sourceText.value));
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultText.value);
    resultMeta.textContent = 'Lista copiada';
    window.setTimeout(() => {
      resultMeta.textContent = `${resultText.value.length.toLocaleString('es-ES')} caracteres`;
    }, 1800);
  } catch {
    resultText.select();
    document.execCommand('copy');
    resultMeta.textContent = 'Lista copiada';
  }
});

downloadButton.addEventListener('click', () => {
  const file = new Blob([resultText.value], { type: 'text/plain;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = 'palabras.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
});

updateSourceMeta();
