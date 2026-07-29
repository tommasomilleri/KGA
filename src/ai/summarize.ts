
import { db } from '../data/db';

export async function summarizeCluster(cluster: number): Promise<string> {
  const nodes = await db.nodes.where('cluster').equals(cluster).toArray();
  if (nodes.length === 0) return 'Cluster vuoto.';
  const labels = nodes.map((n) => n.label).join(', ');

  const r = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: localStorage.getItem('kga-model') ?? 'llama3.1:8b',
      stream: false,
      prompt: `Questi argomenti formano un gruppo tematico: ${labels}.
In italiano: 1) proponi un NOME breve per il gruppo (max 4 parole);
2) riassumi in 2-3 frasi il filo conduttore. Formato:
NOME: ...
SINTESI: ...`,
    }),
  });
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
  const data = await r.json();
  return data.response as string;
}

