
import Fuse from 'fuse.js';

export interface TerminalActions {
  addNode: (term: string) => void;
  search: (term: string) => void;
  addLink: (a: string, b: string) => void;
  deleteNode: (term: string) => void;
  renameNode: (oldId: string, newId: string) => Promise<void>;
  discover: () => void;
  recalc: () => void;
  setThreshold: (v: number) => void;
  setModel: (m: string) => void;
  exportData: () => void;
  getNodeNames: () => string[];        // <-- NUOVO: per l'autocomplete sui nodi
}

const COMMANDS = [
  '/cerca', '/collega', '/elimina', '/rinomina', '/scopri',
  '/ricalcola', '/soglia', '/modello', '/esporta', '/aiuto', '/font',
];

// comandi che accettano un NOME DI NODO come argomento
const NODE_ARG_COMMANDS = new Set(['/cerca', '/elimina', '/collega', '/rinomina']);

export function initTerminal(actions: TerminalActions): void {
  const input = document.getElementById('cmd-input') as HTMLInputElement;
  const ghost = document.getElementById('cmd-ghost')!;
  const hint = document.getElementById('cmd-hint')!;
  const history: string[] = JSON.parse(localStorage.getItem('kga-history') ?? '[]');
  let hIndex = history.length;
  let suggestion = '';                 // testo completo suggerito

  const flash = (msg: string, ok = true) => {
    hint.textContent = msg;
    hint.style.color = ok ? 'var(--ok)' : 'var(--err)';
    setTimeout(() => { hint.textContent = ''; }, 2500);
  };

  // ---------- MOTORE DI COMPLETAMENTO ----------
  const complete = (value: string): string => {
    if (!value) return '';

    // Caso 1: sta scrivendo un comando ("/ce" -> "/cerca ")
    if (value.startsWith('/') && !value.includes(' ')) {
      const m = COMMANDS.find((c) => c.startsWith(value.toLowerCase()));
      return m ? m + ' ' : '';
    }

    // Caso 2: comando + argomento nodo ("/cerca gat" -> "/cerca gatto")
    if (value.startsWith('/')) {
      const spaceIdx = value.indexOf(' ');
      const cmd = value.slice(0, spaceIdx);
      if (!NODE_ARG_COMMANDS.has(cmd)) return '';
      const argPart = value.slice(spaceIdx + 1);
      // per /collega e /rinomina completa solo il segmento dopo l'ultimo "->"
      const segs = argPart.split('->');
      const last = segs[segs.length - 1].trimStart();
      if (!last) return '';
      const match = fuzzyBest(last);
      if (!match) return '';
      segs[segs.length - 1] = segs[segs.length - 1].replace(/\S.*$/, match);
      return cmd + ' ' + segs.join('->');
    }

    // Caso 3: testo semplice ("gat" -> "gatto" se il nodo esiste)
    const match = fuzzyBest(value);
    return match ?? '';
  };

  // fuzzy: prima prefisso esatto, poi Fuse
  const fuzzyBest = (partial: string): string | null => {
    const names = actions.getNodeNames();
    const lower = partial.toLowerCase();
    const prefix = names.find((n) => n.toLowerCase().startsWith(lower));
    if (prefix) return prefix;
    const fuse = new Fuse(names, { threshold: 0.35 });
    const res = fuse.search(partial);
    return res.length > 0 ? res[0].item : null;
  };

  // ghost text: mostra la parte mancante in grigio dopo il testo digitato
  const updateGhost = () => {
    suggestion = complete(input.value);
    if (suggestion && suggestion.toLowerCase().startsWith(input.value.toLowerCase())
        && suggestion.length > input.value.length) {
      ghost.textContent = input.value + suggestion.slice(input.value.length);
    } else if (suggestion && suggestion !== input.value) {
      ghost.textContent = '';           // fuzzy non-prefisso: mostralo nell'hint
      hint.textContent = `⇥ ${suggestion}`;
      hint.style.color = 'var(--dim)';
      return;
    } else {
      ghost.textContent = '';
    }
    if (!input.value.startsWith('/')) hint.textContent = '';
  };

  // ---------- ESECUZIONE COMANDI ----------
  const run = async (raw: string) => {
    const line = raw.trim();
    if (!line) return;
    history.push(line);
    localStorage.setItem('kga-history', JSON.stringify(history.slice(-50)));
    hIndex = history.length;

    if (!line.startsWith('/')) { actions.addNode(line); flash(`+ ${line}`); return; }

    const [cmd, ...rest] = line.split(' ');
    const arg = rest.join(' ').trim();
    switch (cmd) {
      case '/cerca':    actions.search(arg); break;
      case '/collega': {
        const [a, b] = arg.split('->').map((s) => s.trim());
        if (a && b) { actions.addLink(a, b); flash(`${a} <-> ${b}`); }
        else flash('uso: /collega A -> B', false);
        break;
      }
      case '/elimina':  actions.deleteNode(arg); break;
      case '/rinomina': {
        const [o, n] = arg.split('->').map((s) => s.trim());
        if (o && n) { await actions.renameNode(o, n); flash(`${o} -> ${n}`); }
        else flash('uso: /rinomina VECCHIO -> NUOVO', false);
        break;
      }
      case '/scopri':    actions.discover(); break;
      case '/ricalcola': actions.recalc(); flash('ricalcolo…'); break;
      case '/soglia': {
        const v = parseFloat(arg);
        if (v >= 0.3 && v <= 0.9) { actions.setThreshold(v); flash(`soglia = ${v}`); }
        else flash('valore tra 0.3 e 0.9', false);
        break;
      }
      case '/modello':  actions.setModel(arg); flash(`modello = ${arg}`); break;
      case '/esporta':  actions.exportData(); flash('backup scaricato'); break;
      case '/font':     document.dispatchEvent(new CustomEvent('kga:fontlab')); break;
      case '/aiuto':    flash(COMMANDS.join('  ')); break;
      default:          flash(`comando sconosciuto: ${cmd}`, false);
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestion) { input.value = suggestion; updateGhost(); }
    } else if (e.key === 'Enter') {
      run(input.value); input.value = ''; ghost.textContent = ''; hint.textContent = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIndex > 0) { hIndex--; input.value = history[hIndex]; updateGhost(); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIndex < history.length - 1) { hIndex++; input.value = history[hIndex]; }
      else { hIndex = history.length; input.value = ''; }
      updateGhost();
    } else if (e.key === 'Escape') { ghost.textContent = ''; input.blur(); }
  });

  input.addEventListener('input', updateGhost);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); input.focus(); }
  });
}
