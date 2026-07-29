# 🧠 KGA — Personal Knowledge Graph Automatico

> Un **"Secondo Cervello" 3D e locale**, basato su grafi di conoscenza semantici, intelligenza artificiale on-device e visualizzazione spaziale delle idee.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF)
![Three.js](https://img.shields.io/badge/Three.js-r166-black)

---

## 🌟 Visione del Progetto

**KGA (Knowledge Graph App)** nasce per risolvere la "sindrome da accumulo di schede" nel browser. Invece di salvare link disorganizzati, KGA ti permette di inserire concetti, terminologie e idee in un hub visivo 3D.

L'applicazione utilizza un'**architettura 100% locale a costo zero**:
- **Generazione definizioni:** Chiamate in streaming a **Ollama** (`llama3.1:8b`) o fallback offline.
- **Auto-linking semantico:** Calcolo dei vettori semantici (*embeddings*) con **Cosine Similarity** ($\ge 0.62$).
- **Clustering cromatico:** Raggruppamento per comunità semantiche via algoritmo di **Louvain**.
- **Privacy & Persistenza:** Tutti i dati risiedono esclusivamente nel browser dell'utente via **IndexedDB** (`Dexie.js`).

---

## 🚀 Funzionalità Chiave

- 🌌 **Visualizzazione Spaziale 3D:** Motore di rendering basato su `3d-force-graph` e `Three.js` con effetto *Bloom selettivo* per una resa estetica cyberpunk/neon.
- ⚡ **AI Cascading:** Tenta il calcolo tramite Ollama locale (`nomic-embed-text`) e ripiega in-browser tramite `@huggingface/transformers` (`MiniLM-L12-v2`).
- 🔗 **Auto-Link & Classificazione:** Riconoscimento automatico delle relazioni tra nodi distinti.
- 🔍 **Ricerca Intelligente:** Ricerca fuzzy tollerante agli errori di battitura tramite `Fuse.js`.
- 💾 **Backup & Restore:** Esportazione ed importazione completa della base di conoscenza in formato JSON.

---

## 🛠️ Stack Tecnologico

| Componente | Tecnologia |
| :--- | :--- |
| **Frontend Framework** | Vite + TypeScript |
| **3D Rendering** | Three.js + 3d-force-graph |
| **Storage Locale** | Dexie.js (IndexedDB) |
| **AI Local Engine** | Ollama API + HuggingFace Transformers.js |
| **Graph Analytics** | Graphology + Louvain Community Detection |
| **Ricerca** | Fuse.js |
| **Control Panel UI** | Tweakpane |

---

## 🏁 Guida all'Avanzamento Locale

### Requisiti
- **Node.js**: `>= 22.0.0`
- **Ollama** *(opzionale ma consigliato per le funzioni AI complete)*: [ollama.com](https://ollama.com)

### 1. Clona il repository
```bash
git clone [https://github.com/tommasomilleri/KGA.git](https://github.com/tommasomilleri/KGA.git)
cd KGA