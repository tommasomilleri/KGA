export interface KGNode {
  id: string;
  label: string;
  info: string;
  embedding?: number[];
  embeddingModel?: string;   // es. 'nomic-embed-text' | 'minilm'
  cluster?: number;
  color: string;
  createdAt: number;
  degree?: number;           // dichiarato, niente più any
  x?: number; y?: number; z?: number;
}

export type RelationType =
  | 'e-un' | 'parte-di' | 'influenza' | 'si-oppone-a'
  | 'precede' | 'correlato' | 'custom';

export interface KGLink {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  weight: number; // 0..1
  origin: 'ai' | 'manual';
  label?: string;
}