// src/data/db.ts
import Dexie, { type Table } from 'dexie';
import type { KGNode, KGLink } from '../core/types';

export class KGADatabase extends Dexie {
  nodes!: Table<KGNode, string>;
  links!: Table<KGLink, string>;

  constructor() {
    super('kga');
    // Versione 2: Schema aggiornato per supportare i cluster AI
    this.version(2).stores({
      nodes: 'id, label, cluster, createdAt',
      links: 'id, source, target, type, origin',
    });
  }
}
export const db = new KGADatabase();

// Funzioni per Esportare/Importare tutto il tuo cervello in JSON
export async function exportJSON(): Promise<string> {
  const [nodes, links] = await Promise.all([db.nodes.toArray(), db.links.toArray()]);
  return JSON.stringify({ version: 2, exportedAt: Date.now(), nodes, links }, null, 2);
}

export async function importJSON(json: string): Promise<void> {
  const data = JSON.parse(json);
  await db.transaction('rw', db.nodes, db.links, async () => {
    await db.nodes.bulkPut(data.nodes);
    await db.links.bulkPut(data.links);
  });
}