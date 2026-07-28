// src/ai/similarity.ts
import { db } from '../data/db';
import type { KGLink } from '../core/types';

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2; nb += b[i] ** 2;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export const SIMILARITY_THRESHOLD = 0.62; // 62% di somiglianza minima per collegarli

export async function autoLink(nodeId: string, embedding: number[]): Promise<KGLink[]> {
  const others = await db.nodes.where('id').notEqual(nodeId).toArray();
  const created: KGLink[] = [];
  
  for (const other of others) {
    if (!other.embedding) continue;
    
    const sim = cosine(embedding, other.embedding);
    if (sim >= SIMILARITY_THRESHOLD) {
      const link: KGLink = {
        id: `${nodeId}->${other.id}`,
        source: nodeId, 
        target: other.id,
        type: 'correlato', 
        weight: sim, 
        origin: 'ai',
      };
      await db.links.put(link);
      created.push(link);
    }
  }
  return created;
}