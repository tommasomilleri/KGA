// src/ai/embeddings.ts
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

const OLLAMA = 'http://localhost:11434';

// Tentativo 1: Ollama (veloce, sul tuo PC)
async function ollamaEmbed(text: string): Promise<number[] | null> {
  try {
    const r = await fetch(`${OLLAMA}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', input: text }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.embeddings[0];
  } catch { 
    return null; 
  }
}

// Tentativo 2: Transformers.js (funziona nel browser, anche offline e su telefono!)
let browserPipe: FeatureExtractionPipeline | null = null;
async function browserEmbed(text: string): Promise<number[]> {
  browserPipe ??= await pipeline(
    'feature-extraction',
    'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  );
  const out = await browserPipe(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data as Float32Array);
}

// Esporta la funzione finale (cascata)
export async function embed(text: string): Promise<number[]> {
  return (await ollamaEmbed(text)) ?? (await browserEmbed(text));
}