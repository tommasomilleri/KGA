// src/ai/relations.ts
import type { RelationType } from '../core/types';

interface AIRelation { da: string; a: string; tipo: RelationType; forza: number; label: string }

export async function classifyRelations(pairs: [string, string][]): Promise<AIRelation[]> {
  try {
      const r = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: localStorage.getItem('kga-model') ?? 'llama3', // o llama3.1
          format: 'json', // JSON puro per evitare errori di lettura
          stream: false,
          prompt: `Analizza queste coppie di argomenti e restituisci un JSON {"relazioni":[{"da":"nome","a":"nome","tipo":"tipo","forza":0.8,"label":"descrizione"}]}. tipo deve essere uno tra: e-un, parte-di, influenza, si-oppone-a, precede, correlato. forza tra 0 e 1. label = frase brevissima in italiano. Coppie: ${JSON.stringify(pairs)}`,
        }),
      });
      const data = await r.json();
      return JSON.parse(data.response).relazioni ?? [];
  } catch (e) {
      console.warn("Classificazione fallita", e);
      return [];
  }
}