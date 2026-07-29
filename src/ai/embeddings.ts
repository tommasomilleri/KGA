import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
const OLLAMA = 'http://localhost:11434';

export interface EmbeddingResult { vector: number[]; model: string }

async function ollamaEmbed(text: string): Promise<EmbeddingResult | null> {
  try {
    console.log(`[AI] 1. Chiedo a Ollama le coordinate per: "${text}"...`);
    const r = await fetch(`${OLLAMA}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', input: text }),
    });
    if (!r.ok) {
        console.warn(`[AI] ❌ Ollama ha rifiutato la richiesta (Codice ${r.status}).`);
        return null;
    }
    const data = await r.json();
    console.log(`[AI] ✅ Coordinate Ollama ricevute con successo!`);
    return { vector: data.embeddings[0], model: 'nomic-embed-text' };
  } catch (e) {
    console.warn(`[AI] ❌ Errore di connessione a Ollama:`, e);
    return null; 
  }
}

let browserPipe: FeatureExtractionPipeline | null = null;
async function browserEmbed(text: string): Promise<EmbeddingResult | null> {
  try {
    console.log(`[AI] 2. Avvio Piano B (Browser). Attenzione: potrebbe scaricare il modello...`);
    browserPipe ??= (await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2')) as any;
    const out = await browserPipe(text, { pooling: 'mean', normalize: true });
    console.log(`[AI] ✅ Coordinate Piano B ricevute!`);
    return { vector: Array.from(out.data as Float32Array), model: 'minilm' };
  } catch (e) {
    console.error(`[AI] ❌ Anche il piano B ha fallito:`, e);
    return null;
  }
}

export async function embed(text: string): Promise<EmbeddingResult> {
  const result = (await ollamaEmbed(text)) ?? (await browserEmbed(text));
  if (result) return result;
  
  console.warn(`[AI] ⚠️ Nessuna IA disponibile. Creo un nodo vuoto di emergenza.`);
  return { vector: new Array(384).fill(0), model: 'fallback' }; // Salvagente anti-crash
}