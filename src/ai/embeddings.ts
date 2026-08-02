
const OLLAMA = 'http://localhost:11434';

export interface EmbeddingResult { vector: number[]; model: string }

async function ollamaEmbed(text: string): Promise<EmbeddingResult | null> {
  try {
    const r = await fetch(`${OLLAMA}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: 'nomic-embed-text', 
        input: 'search_document ${text}',
       }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const vec = data.embeddings[0]?.[0]?? data.embeddings;
    if (!Array.isArray(vec)||vec.length === 0) return null;
    return { vector: vec, model: 'nomic-embed-text' };
  } catch { return null; }
} 

// --- Worker: il modello browser non blocca piu' l'UI ---
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (v: number[]) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./embeddings.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; vector?: number[]; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.vector) p.resolve(e.data.vector);
      else p.reject(new Error(e.data.error ?? 'Embedding worker error'));
    };
  }
  return worker;
}

function browserEmbed(text: string): Promise<EmbeddingResult> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, {
      resolve: (vector) => resolve({ vector, model: 'minilm' }),
      reject,
    });
    getWorker().postMessage({ id, text });
  });
}

export async function embed(text: string): Promise<EmbeddingResult> {
  return (await ollamaEmbed(text)) ?? (await browserEmbed(text));
}
