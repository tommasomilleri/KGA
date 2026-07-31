
import { db } from '../data/db';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import html2pdf from 'html2pdf.js';

async function generateEssayMarkdown(): Promise<string> {
  const nodes = await db.nodes.toArray();
  const links = await db.links.toArray();
  if (nodes.length === 0) throw new Error('La rete e\' vuota.');

  const concepts = nodes.map((n) =>
    `- ${n.label}: ${String(n.info ?? '').slice(0, 200)}`).join('\n');
  const relations = links.slice(0, 60).map((l) =>
    `- ${l.source} -[${l.label ?? l.type}]-> ${l.target}`).join('\n');

  const r = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: localStorage.getItem('kga-model') || 'llama3.1:8b',
      stream: false,
      options: { num_predict: 2500 },
      prompt: `Sei un saggista accademico. Scrivi in ITALIANO un saggio organico
e ben strutturato che colleghi TUTTA la conoscenza seguente in una narrazione
coerente (non un elenco!). Usa Markdown: # titolo, ## sezioni, **grassetto**.
REGOLA MATEMATICA: ogni formula in LaTeX tra dollari: inline $x^2$ oppure
display $$E = mc^2$$. MAI formule in testo semplice.
Concludi con "## Sintesi" e "## Connessioni inattese".

CONCETTI:
${concepts}

RELAZIONI:
${relations}`,
    }),
  });
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status} — Ollama e' acceso?`);
  const data = await r.json();
  return data.response as string;
}

function renderMath(html: string): string {
  return html
    .replace(/\$\$([^$]+)\$\$/g, (_, tex) => {
      try { return katex.renderToString(tex, { displayMode: true }); }
      catch { return `<code>${tex}</code>`; }
    })
    .replace(/\$([^$\n]+)\$/g, (_, tex) => {
      try { return katex.renderToString(tex, { displayMode: false }); }
      catch { return `<code>${tex}</code>`; }
    });
}

export async function exportEssayPDF(
  onProgress: (msg: string) => void,
): Promise<void> {
  onProgress('L\'AI sta scrivendo il saggio (1-3 min)…');
  const md = await generateEssayMarkdown();

  onProgress('Impagino formule e testo…');
  const body = renderMath(await marked.parse(md));

  const el = document.createElement('div');
  el.innerHTML = `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #111;
                line-height: 1.7; font-size: 12pt; padding: 8mm;">
      <div style="text-align:center; border-bottom: 2px solid #111;
                  margin-bottom: 8mm; padding-bottom: 4mm;">
        <div style="font-size: 9pt; letter-spacing: 3px;">KGA — KNOWLEDGE GRAPH</div>
        <div style="font-size: 8pt; color: #666;">${new Date().toLocaleDateString('it-IT')}</div>
      </div>
      ${body}
    </div>`;

  onProgress('Genero il PDF…');
  await html2pdf().set({
    margin: [15, 15, 20, 15],
    filename: `kga-saggio-${new Date().toISOString().slice(0, 10)}.pdf`,
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4' },
    pagebreak: { mode: ['avoid-all', 'css'] },
  }as any).from(el).save();
  onProgress('PDF scaricato');
}

