# KGA — Knowledge Graph App
Paragrafo descrittivo (grafo 3D, AI locale via Ollama con fallback Transformers.js nel browser, persistenza IndexedDB).

## Requisiti
Node 22+, opzionale Ollama con modelli nomic-embed-text e llama3.1:8b

## Installazione
npm install
npm run dev
npm run build

## Come funziona
Aggiungi termine -> embedding -> auto-link -> definizione in streaming; soglia configurabile; export/import JSON

## Stack
Vite, TypeScript, 3d-force-graph, Three.js, Dexie, Fuse.js, Tweakpane, graphology, Transformers.js