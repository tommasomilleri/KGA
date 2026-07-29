import type { KGNode, KGLink } from '../core/types';

export interface HighlightState {
  hoverId: string | null;
  neighbors: Set<string>;
  focusId: string | null;      // focus mode: solo vicini a 1-2 livelli
  focusVisible: Set<string>;
}

export const highlight: HighlightState = {
  hoverId: null,
  neighbors: new Set(),
  focusId: null,
  focusVisible: new Set(),
};

export function computeNeighbors(nodeId: string, links: KGLink[]): Set<string> {
  const s = new Set<string>([nodeId]);
  for (const l of links) {
    // dopo il caricamento nel grafo, source/target possono essere oggetti
    const src = typeof l.source === 'object' ? (l.source as unknown as KGNode).id : l.source;
    const tgt = typeof l.target === 'object' ? (l.target as unknown as KGNode).id : l.target;
    if (src === nodeId) s.add(tgt);
    if (tgt === nodeId) s.add(src);
  }
  return s;
}

// Vicinato esteso a N livelli (per focus mode)
export function computeNeighborhood(nodeId: string, links: KGLink[], depth: number): Set<string> {
  let frontier = new Set<string>([nodeId]);
  const visible = new Set<string>([nodeId]);
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const n of computeNeighbors(id, links)) {
        if (!visible.has(n)) { visible.add(n); next.add(n); }
      }
    }
    frontier = next;
  }
  return visible;
}

