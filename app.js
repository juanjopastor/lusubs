let audio = document.getElementById('audioPlayer');
let subtitleDisplay = document.getElementById('subtitleDisplay');
let prevBtn = document.getElementById('prevBtn');
let repeatBtn = document.getElementById('repeatBtn');
let nextBtn = document.getElementById('nextBtn');
let audioFileInput = document.getElementById('audioFileInput');
let subtitleFileInput = document.getElementById('subtitleFileInput');

// Variables para almacenar subtítulos y tiempos
let subtitles = [];
let currentSubtitleIndex = 0;

// Cargar archivo de audio
audioFileInput.addEventListener('change', function(event) {
    let file = event.target.files[0];
    if (file) {
        let url = URL.createObjectURL(file);
        document.getElementById('audioSource').src = url;
        audio.load();
    }
});

// Cargar archivo de subtítulos
subtitleFileInput.addEventListener('change', function(event) {
    let file = event.target.files[0];
    if (file) {
        let reader = new FileReader();
        reader.onload = function(e) {
            parseSubtitles(e.target.result);
        };
        reader.readAsText(file);
    }
});


// Función para parsear subtítulos en formato .srt y .vtt
function parseSubtitles(content) {
    subtitles = [];

    // Detectar si es .vtt o .srt según la presencia de "WEBVTT" al inicio
    let isVTT = content.trim().startsWith('WEBVTT');
    
    // Limpiar encabezado de VTT (si lo tiene)
    if (isVTT) {
        content = content.replace('WEBVTT', '').trim();
    }

    // Dividimos el contenido por líneas
    let lines = content.split('\n');

    let regexSRT = /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/;
    let regexVTT = /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/;

    let currentSubtitle = {};
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        // Comprobar si la línea actual tiene tiempos de subtítulo (SRT o VTT)
        if (regexSRT.test(line) || regexVTT.test(line)) {
            let match = regexSRT.test(line) ? line.match(regexSRT) : line.match(regexVTT);

            let start = timeToSeconds(match[1].replace(',', '.'));  // Convertimos SRT a formato de segundos
            let end = timeToSeconds(match[2].replace(',', '.'));    // Convertimos SRT a formato de segundos
            
            // Reiniciar el objeto de subtítulo
            currentSubtitle = {
                start: start,
                end: end,
                text: ""
            };

            // Agregar al arreglo de subtítulos
            subtitles.push(currentSubtitle);

        } else if (line !== '' && currentSubtitle) {
            // Agregar la línea como texto del subtítulo
            if (currentSubtitle.text) {
                currentSubtitle.text += '\n'; // Para permitir varias líneas
            }
            currentSubtitle.text += line;
        }
    }
}

// Convertir el tiempo de subtítulos a segundos
function timeToSeconds(time) {
    let parts = time.split(/[:,.]/);
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]) + parseInt(parts[3]) / 1000;
}

function updateSubtitlesText() {
    if (subtitles.length > 0) {
        if (currentSubtitleIndex > 0) {
            prevSubtitleDisplay.textContent = subtitles[currentSubtitleIndex-1].text;
        }

        subtitleDisplay.textContent = subtitles[currentSubtitleIndex].text;
        
        if (currentSubtitleIndex < subtitles.length - 2) {
            postSubtitleDisplay.textContent = subtitles[currentSubtitleIndex+1].text;
        }
    }
}

function updateSubtitlesIndex() {
    let currentTime = audio.currentTime;
    for (let i = 0; i < subtitles.length; i++) {
        if (currentTime >= subtitles[i].start && currentTime < subtitles[i].end) {
            currentSubtitleIndex = i;
        }
    }
}

// Sincronizar subtítulos con el audio
audio.addEventListener('timeupdate', function() {
    let currentTime = audio.currentTime;
    if (subtitles.length > 0) {

        if (currentTime < subtitles[currentSubtitleIndex].start || currentTime > subtitles[currentSubtitleIndex].end) {
            updateSubtitlesIndex();
            updateSubtitlesText();

            if (currentSubtitleIndex < subtitles.length) {
                audio.pause();
            }
        }

       
    }
    
});

// Funciones de los botones
prevBtn.addEventListener('click', function() {
    if (currentSubtitleIndex > 0) {
        currentSubtitleIndex--;
        updateSubtitlesText();
        audio.currentTime = subtitles[currentSubtitleIndex].start;
        audio.play();
    }
});

repeatBtn.addEventListener('click', function() {
    audio.currentTime = subtitles[currentSubtitleIndex].start;
    audio.play();
});

nextBtn.addEventListener('click', function() {
    if (currentSubtitleIndex < subtitles.length - 1) {
        currentSubtitleIndex++;
        updateSubtitlesText();
        audio.currentTime = subtitles[currentSubtitleIndex].start;
        audio.play();
    }
});
