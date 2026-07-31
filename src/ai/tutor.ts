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
  yield* streamChat(`Sei un tutor socratico esperto, integrato in una mappa della conoscenza personale.

REGOLE (obbligatorie):
1. Rispondi SOLO in italiano.
2. Massimo 4-5 frasi, a meno che la domanda contenga "approfondisci".
3. Parti SEMPRE dal contesto fornito sotto: se la domanda riguarda il concetto, ancora la risposta alla sua descrizione e ai concetti collegati.
4. Se citi un concetto collegato, usa il suo nome esatto tra virgolette (es. "Entropia") così l'utente lo ritrova nella mappa.
5. Usa un esempio concreto e quotidiano quando spieghi qualcosa di astratto.
6. Se il contesto non basta per rispondere con certezza, dillo esplicitamente in una frase e rispondi con la conoscenza generale, segnalando la differenza.
7. Niente preamboli ("Certo!", "Ottima domanda"): vai dritto alla risposta.
8. Formato: testo semplice, niente markdown, niente elenchi puntati salvo esplicita richiesta.

CONTESTO DELLA MAPPA:
${ctx}

DOMANDA DELL'UTENTE: ${question}

RISPOSTA:`);
}