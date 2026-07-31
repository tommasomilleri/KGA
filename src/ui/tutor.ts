import { askTutor } from '../ai/tutor';
import { db } from '../data/db';

let currentNodeId: string | null = null;
let aborted = false;

export function setTutorNode(id: string): void {
  currentNodeId = id;
  document.getElementById('tutor-answer')!.textContent = '';
}

async function ask(question: string): Promise<void> {
  if (!currentNodeId) return;
  const out = document.getElementById('tutor-answer')!;
  out.textContent = '⏳ ';
  aborted = false;
  let text = '';
  for await (const chunk of askTutor(currentNodeId, question)) {
    if (aborted) return;
    text += chunk;
    out.textContent = text;
  }
}

export function initTutor(): void {
  document.querySelectorAll<HTMLButtonElement>('.tutor-chip[data-q]').forEach((b) => {
    b.onclick = () => ask(b.dataset.q!);
  });
  document.getElementById('tutor-diff')!.addEventListener('click', async () => {
    if (!currentNodeId) return;
    const links = await db.links
      .filter((l) => l.source === currentNodeId || l.target === currentNodeId).toArray();
    const others = links.map((l) => l.source === currentNodeId ? l.target : l.source);
    if (others.length === 0) { ask('Con quali concetti simili potrei confonderlo?'); return; }
    const pick = prompt(`Differenza con quale?\n${others.join(', ')}`, others[0] as string);
    if (pick) ask(`Qual è la differenza tra questo concetto e "${pick}"?`);
  });
  const input = document.getElementById('tutor-input') as HTMLInputElement;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) { ask(input.value.trim()); input.value = ''; }
    e.stopPropagation();   // non far arrivare i tasti alle scorciatoie globali (F, Ctrl+K)
  });
}