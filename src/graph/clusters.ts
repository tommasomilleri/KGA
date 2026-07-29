// src/graph/clusters.ts
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import type { KGNode, KGLink } from '../core/types';

// La nostra palette di colori "galattica"
const PALETTE = [
  '#E8C468', // oro sabbia
  '#6FA8DC', // blu polvere
  '#9B8CC4', // lavanda
  '#7BC49A', // salvia
  '#D98E73', // terracotta
  '#6BC5C9', // petrolio chiaro
  '#C97B9B', // malva
  '#A3B18A', // oliva
];

export function assignClusters(nodes: KGNode[], links: KGLink[]): void {
  const g = new Graph({ type: 'undirected' });
  nodes.forEach(n => g.addNode(n.id));
  
  // Aggiungiamo i collegamenti calcolati dall'IA
  links.forEach(l => { 
      try { g.addEdge(l.source, l.target, { weight: l.weight }); } catch { /* Ignora */ } 
  });

  // L'algoritmo divide la galassia in "Quartieri" (Comunità)
  const communities = louvain(g);
  nodes.forEach(n => {
    n.cluster = communities[n.id] ?? 0;
    n.color = PALETTE[n.cluster % PALETTE.length];
  });
}