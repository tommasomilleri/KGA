import { db } from '../data/db';
import type { KGLink } from '../core/types';

let currentThreshold = 0.62;

export function getThreshold(): number {
  return currentThreshold;
}

export function setThreshold(val: number): void {
  currentThreshold = val;
}

export function linkId(source: string, target: string): string {
  const [a, b] = [source, target].sort();
  return `${a}---${b}`;
}

export function cosineSimilarity(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length || v1.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    normA += v1[i] * v1[i];
    normB += v2[i] * v2[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function autoLink(term: string, vector: number[], model: string): Promise<KGLink[]> {
  const allNodes = await db.nodes.toArray();
  const newLinks: KGLink[] = [];

  for (const node of allNodes) {
    if (node.id === term || !node.embedding) continue;
    const sim = cosineSimilarity(vector, node.embedding);
    if (sim >= currentThreshold) {
      const id = linkId(term, node.id);
      const link: KGLink = {
        id,
        source: term,
        target: node.id,
        type: 'semantic_similarity',
        weight: Number(sim.toFixed(3)),
        origin: 'auto',
        label: `sim: ${(sim * 100).toFixed(0)}%`,
      };
      await db.links.put(link);
      newLinks.push(link);
    }
  }
  return newLinks;
}

// --- NUOVA FUNZIONE: RICALCOLA TUTTI I COLLEGAMENTI ---
export async function recalculateAllLinks(): Promise<number> {
  const nodes = await db.nodes.toArray();
  const threshold = getThreshold();

  // Cancella i vecchi collegamenti generati dall'IA
  const allLinks = await db.links.toArray();
  const autoLinksToDelete = allLinks.filter((l) => l.origin === 'auto').map((l) => l.id);
  await db.links.bulkDelete(autoLinksToDelete);

  let addedCount = 0;

  // Confronta tutte le coppie di nodi presenti nel DB
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i];
      const n2 = nodes[j];
      if (n1.embedding && n2.embedding) {
        const sim = cosineSimilarity(n1.embedding, n2.embedding);
        if (sim >= threshold) {
          const id = linkId(n1.id, n2.id);
          await db.links.put({
            id,
            source: n1.id,
            target: n2.id,
            type: 'semantic_similarity',
            weight: Number(sim.toFixed(3)),
            origin: 'auto',
            label: `sim: ${(sim * 100).toFixed(0)}%`,
          });
          addedCount++;
        }
      }
    }
  }
  return addedCount;
}