
import type { KGNode } from '../core/types';
import { cosineSimilarity } from '../ai/similarity';

interface Pair { a: KGNode; b: KGNode; sim: number }

// forza d3 custom: attrazione proporzionale alla similarita' semantica
export function semanticForce() {
  let pairs: Pair[] = [];

  const force = Object.assign(
    (alpha: number) => {
      for (const { a, b, sim } of pairs) {
        const ax = a as unknown as { x: number; y: number; z: number; vx: number; vy: number; vz: number };
        const bx = b as unknown as { x: number; y: number; z: number; vx: number; vy: number; vz: number };
        const dx = (bx.x ?? 0) - (ax.x ?? 0);
        const dy = (bx.y ?? 0) - (ax.y ?? 0);
        const dz = (bx.z ?? 0) - (ax.z ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const k = (sim - 0.42) * 0.03 * alpha;
        const fx = (dx / dist) * k * dist;
        const fy = (dy / dist) * k * dist;
        const fz = (dz / dist) * k * dist;
        ax.vx = (ax.vx ?? 0) + fx; ax.vy = (ax.vy ?? 0) + fy; ax.vz = (ax.vz ?? 0) + fz;
        bx.vx = (bx.vx ?? 0) - fx; bx.vy = (bx.vy ?? 0) - fy; bx.vz = (bx.vz ?? 0) - fz;
      }
    },
    {
      initialize(nodes: KGNode[]) {
        pairs = [];
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            if (!a.embedding || !b.embedding) continue;
            if (a.embeddingModel !== b.embeddingModel) continue;
            const sim = cosineSimilarity(a.embedding, b.embedding);
            if (sim > 0.42) pairs.push({ a, b, sim });
          }
        }
        pairs.sort((x, y) => y.sim - x.sim);
        pairs = pairs.slice(0, 400);   // cap: fisica sempre fluida
      },
    },
  );
  return force;
}
