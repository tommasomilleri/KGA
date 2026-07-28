import Dexie, { type EntityTable } from 'dexie';

// Definiamo la forma dei nostri dati
export interface GraphNode {
  id: string; // Il nome del termine sarà anche il suo ID univoco
  label: string;
  info: string;
  color: string;
}

export interface GraphLink {
  id?: number;
  source: string;
  target: string;
  label: string;
}

// Inizializziamo il database
const db = new Dexie('KGADatabase') as Dexie & {
  nodes: EntityTable<GraphNode, 'id'>;
  links: EntityTable<GraphLink, 'id'>;
};

// Struttura delle "tabelle"
db.version(1).stores({
  nodes: 'id, label',
  links: '++id, source, target'
});

export { db };