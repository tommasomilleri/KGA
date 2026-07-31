import { db } from '../data/db';
import { streamChat } from './ollama';

async function buildContext(nodeId: string): Promise<string> {
  const node = await db.nodes.get(nodeId);
  const links = await db.links
    .filter((l) => l.source === nodeId || l.target === nodeId).toArray();
  const neighbors = links.map((l) => {
    const other = l.source === nodeId ? l.target : l.source;
    return `- ${other} (relazione: ${l.label ?? l.type})`;
  }).join('\n');
  return `CONCETTO: ${node?.label}
DESCRIZIONE: ${String(node?.info ?? '').slice(0, 400)}
CONCETTI COLLEGATI:
${neighbors || '(nessuno)'}`;
}

export async function* askTutor(nodeId: string, question: string): AsyncGenerator<string> {
  const ctx = await buildContext(nodeId);
  yield* streamChat(`Sei un tutor didattico. Rispondi in ITALIANO, max 4-5 frasi,
in modo semplice e concreto. Se l'utente chiede "approfondisci", puoi essere più lungo.

${ctx}

DOMANDA: ${question}`);
}