import Dexie, { type Table } from 'dexie';
import type { KGNode, KGLink } from '../core/types';

export class KGADatabase extends Dexie {
  nodes!: Table<KGNode, string>;
  links!: Table<KGLink, string>;

  constructor() {
    super('kga');
    this.version(2).stores({
      nodes: 'id, label, cluster, createdAt',
      links: 'id, source, target, type, origin',
    });
  }
}
export const db = new KGADatabase();

export async function exportJSON(): Promise<string> {
  const [nodes, links] = await Promise.all([db.nodes.toArray(), db.links.toArray()]);
  return JSON.stringify({ version: 2, exportedAt: Date.now(), nodes, links }, null, 2);
}

export async function importJSON(json: string): Promise<void> {
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
    throw new Error('File di backup non valido: attesi campi "nodes" e "links" (array).');
  }
  const nodesValid = data.nodes.every(
    (n: unknown) => typeof n === 'object' && n !== null && typeof (n as { id?: unknown }).id === 'string',
  );
  const linksValid = data.links.every(
    (l: unknown) => typeof l === 'object' && l !== null && typeof (l as { id?: unknown }).id === 'string',
  );
  if (!nodesValid || !linksValid) {
    throw new Error('File di backup non valido: ogni nodo e link deve avere un id stringa.');
  }
  await db.transaction('rw', db.nodes, db.links, async () => {
    await db.nodes.bulkPut(data.nodes);
    await db.links.bulkPut(data.links);
  });
}