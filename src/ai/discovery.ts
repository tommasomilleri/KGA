
import { db } from '../data/db';
import { cosine, linkId, getThreshold } from './similarity';
import { classifyRelations } from './relations';
import type { KGLink } from '../core/types';

export interface Proposal { source: string; target: string; sim: number }

// Trova coppie simili NON ancora collegate (soglia leggermente sotto quella auto)
export async function findHiddenLinks(maxProposals = 10): Promise<Proposal[]> {
  const nodes = await db.nodes.toArray();
  const links = await db.links.toArray();
  const existing = new Set(links.map((l) => l.id));
  const proposals: Proposal[] = [];
  const softThreshold = Math.max(0.45, getThreshold() - 0.1);

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (!a.embedding || !b.embedding) continue;
      if (a.embeddingModel !== b.embeddingModel) continue;
      if (existing.has(linkId(a.id, b.id))) continue;
      const sim = cosine(a.embedding, b.embedding);
      if (sim >= softThreshold) proposals.push({ source: a.id, target: b.id, sim });
    }
  }
  return proposals.sort((x, y) => y.sim - x.sim).slice(0, maxProposals);
}

// Applica le proposte confermate, con etichetta AI se disponibile
export async function applyProposals(proposals: Proposal[]): Promise<number> {
  if (proposals.length === 0) return 0;
  const pairs = proposals.map((p) => [p.source, p.target] as [string, string]);
  const rels = await classifyRelations(pairs).catch(() => []);
  const relMap = new Map(rels.map((r) => [linkId(r.da, r.a), r]));

  let count = 0;
  for (const p of proposals) {
    const id = linkId(p.source, p.target);
    const rel = relMap.get(id);
    const link: KGLink = {
      id, source: p.source, target: p.target,
      type: rel?.tipo ?? 'correlato',
      weight: p.sim, origin: 'ai',
      label: rel?.label,
    };
    await db.links.put(link);
    count++;
  }
  return count;
}

