
# KGA Music Server
Companion locale per il player musicale di KGA (usa yt-dlp).
## Setup (una volta)
    winget install Python.Python.3.12 yt-dlp Gyan.FFmpeg   # Windows
    # macOS: brew install yt-dlp ffmpeg
    cd kga-music-server && npm install
## Avvio (ogni volta che vuoi l'audio potenziato)
    npm start
Il sito lo rileva da solo su http://localhost:7777.
Senza server il player usa YouTube IFrame (funziona comunque).

--- A4. FILE: .gitignore (root della repo) — AGGIUNGI ---------------------------

kga-music-server/node_modules/
kga-music-server/.kga-temp/
