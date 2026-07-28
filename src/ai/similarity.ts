import { db } from '../data/db';
import type { KGLink } from '../core/types';

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0; // guard di sicurezza
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { 
    dot += a[i] * b[i]; 
    na += a[i] ** 2; 
    nb += b[i] ** 2; 
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// Soglia configurabile a runtime, persistita in localStorage
let threshold = Number(localStorage.getItem('kga-threshold') ?? 0.62);
export const getThreshold = () => threshold;
export const setThreshold = (v: number) => { 
  threshold = v; 
  localStorage.setItem('kga-threshold', String(v));
};

// ID canonico indipendente dall'ordine (evita link duplicati A->B / B->A)
export const linkId = (a: string, b: string) => [a, b].sort().join('<->');

export async function autoLink(nodeId: string, embedding: number[], model: string): Promise<KGLink[]> {
  const others = await db.nodes.where('id').notEqual(nodeId).toArray();
  const created: KGLink[] = [];
  for (const other of others) {
    // Confronta solo embeddings dello stesso modello
    if (!other.embedding || other.embeddingModel !== model) continue;
    const sim = cosine(embedding, other.embedding);
    if (sim >= threshold) {
      const link: KGLink = {
        id: linkId(nodeId, other.id),
        source: nodeId, target: other.id,
        type: 'correlato', weight: sim, origin: 'ai',
      };
      await db.links.put(link);
      created.push(link);
    }
  }
  return created;
}