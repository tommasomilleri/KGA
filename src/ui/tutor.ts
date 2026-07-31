import { askTutor } from '../ai/tutor';
import { db } from '../data/db';

let currentNodeId: string | null = null;
let session = 0;

export function setTutorNode(id: string): void {
  currentNodeId = id;
  session++;
  const out = document.getElementById('tutor-answer')!;
  if (out) out.textContent = '';
}

export function cancelTutor(): void {
  session++;
}   

async function ask(question: string): Promise<void> {
  if (!currentNodeId) return;
  const mySession = ++session;
  const out = document.getElementById('tutor-answer')!;
  if (!out) return;
  out.textContent = '⏳ ';
  let text = '';
  for await (const chunk of askTutor(currentNodeId, question)) {
    if (mySession !== session) return;
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
  const input = document.getElementById('tutor-input') as HTMLInputElement | null;
  input?.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && input.value.trim()) { ask(input.value.trim()); input.value = ''; }
    e.stopPropagation();   // non far arrivare i tasti alle scorciatoie globali (F, Ctrl+K)
  });
}