// src/data/db-errors.ts
import Dexie from 'dexie';

export async function safeAddNode(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof Dexie.ConstraintError) {
      throw new Error('DUPLICATE', { cause: e });
    }
    console.error('Errore DB inatteso:', e);
    throw e; 
  }
}