
import { db } from './db';
import { linkId } from '../ai/similarity';
import type { KGNode } from '../core/types';

// Elimina un nodo e TUTTI i suoi archi
export async function deleteNode(id: string): Promise<void> {
  await db.transaction('rw', db.nodes, db.links, async () => {
    await db.nodes.delete(id);
    await db.links.where('source').equals(id).delete();
    await db.links.where('target').equals(id).delete();
  });
}

// Rinomina un nodo: essendo l'id la chiave, si ricrea nodo e archi
export async function renameNode(oldId: string, newLabel: string): Promise<void> {
  const newId = newLabel.trim();
  if (!newId || newId === oldId) return;
  await db.transaction('rw', db.nodes, db.links, async () => {
    const node = await db.nodes.get(oldId);
    if (!node) throw new Error(`Nodo "${oldId}" non trovato.`);
    const exists = await db.nodes.get(newId);
    if (exists) throw new Error(`"${newId}" esiste gia'.`);

    const renamed: KGNode = { ...node, id: newId, label: newId };
    await db.nodes.add(renamed);

    const links = await db.links
      .filter((l) => l.source === oldId || l.target === oldId)
      .toArray();
    for (const l of links) {
      await db.links.delete(l.id);
      const source = l.source === oldId ? newId : l.source;
      const target = l.target === oldId ? newId : l.target;
      await db.links.put({ ...l, id: linkId(source, target), source, target });
    }
    await db.nodes.delete(oldId);
  });
}

