// src/graph/clusters.ts
import Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import type { KGNode, KGLink } from '../core/types';

// La nostra palette di colori "galattica"
const PALETTE = ['#FCE676', '#7AA2C6', '#8b7ad1', '#4ae28a', '#e2724a', '#4ac6e2'];

export function assignClusters(nodes: KGNode[], links: KGLink[]): void {
  const g = new Graph();
  nodes.forEach(n => g.addNode(n.id));
  
  // Aggiungiamo i collegamenti calcolati dall'IA
  links.forEach(l => { 
      try { g.addEdge(l.source, l.target, { weight: l.weight }); } catch {} 
  });

  // L'algoritmo divide la galassia in "Quartieri" (Comunità)
  const communities = louvain(g);
  nodes.forEach(n => {
    n.cluster = communities[n.id] ?? 0;
    n.color = PALETTE[n.cluster % PALETTE.length];
  });
}