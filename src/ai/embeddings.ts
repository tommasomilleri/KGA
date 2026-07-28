import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
const OLLAMA = 'http://localhost:11434';

export interface EmbeddingResult { vector: number[]; model: string }

async function ollamaEmbed(text: string): Promise<EmbeddingResult | null> {
  try {
    const r = await fetch(`${OLLAMA}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', input: text }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return { vector: data.embeddings[0], model: 'nomic-embed-text' };
  } catch { return null; }
}

let browserPipe: FeatureExtractionPipeline | null = null;
async function browserEmbed(text: string): Promise<EmbeddingResult> {
  browserPipe ??= await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
  const out = await browserPipe(text, { pooling: 'mean', normalize: true });
  return { vector: Array.from(out.data as Float32Array), model: 'minilm' };
}

export async function embed(text: string): Promise<EmbeddingResult> {
  return (await ollamaEmbed(text)) ?? (await browserEmbed(text));
}