// src/core/types.ts

export interface KGNode {
  id: string;
  label: string;
  info: string;
  embedding?: number[]; // Le coordinate semantiche dell'IA
  cluster?: number;     // Il gruppo di appartenenza per i colori
  color: string;
  createdAt: number;
  x?: number; y?: number; z?: number; // Generati dal motore 3D
}

export type RelationType =
  | 'e-un' | 'parte-di' | 'influenza' | 'si-oppone-a'
  | 'precede' | 'correlato' | 'custom';

export interface KGLink {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  weight: number; // Forza del legame (da 0 a 1)
  origin: 'ai' | 'manual';
  label?: string;
}