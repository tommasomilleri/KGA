
import Fuse from 'fuse.js';

export interface TerminalActions {
  addNode: (term: string) => void;
  search: (term: string) => void;
  addLink: (a: string, b: string) => void;
  deleteNode: (term: string) => void;
  renameNode: (oldId: string, newId: string) => Promise<void>;
  discover: () => void;
  recalc: () => void;
  repair: () => void;  // <-- NUOVO: per la riparazione del grafo
  setThreshold: (v: number) => void;
  setModel: (m: string) => void;
  exportData: () => void;
  getNodeNames: () => string[];        // <-- NUOVO: per l'autocomplete sui nodi
}


const COMMANDS = ['/aggiungi', '/ripara',
  '/cerca', '/collega', '/elimina', '/rinomina', '/scopri',
  '/ricalcola', '/soglia', '/modello', '/esporta', '/aiuto', '/font', '/ytkey', '/saggio', 
];


// comandi che accettano un NOME DI NODO come argomento
const NODE_ARG_COMMANDS = new Set(['/cerca', '/elimina', '/collega', '/rinomina']);

export function initTerminal(actions: TerminalActions): void {
  const input = document.getElementById('cmd-input') as HTMLInputElement;
  const hint = document.getElementById('cmd-hint')!;
  const history: string[] = JSON.parse(localStorage.getItem('kga-history') ?? '[]');
  let hIndex = history.length;
  let flashTimer : ReturnType<typeof setTimeout>;
  const flash = (msg: string, ok = true) => {
    clearTimeout(flashTimer);
    hint.textContent = msg;
    hint.style.color = ok ? 'var(--ok)' : 'var(--err)';
    setTimeout(() => { hint.textContent = ''; }, 2500);
  };

  
  // ghost text: mostra la parte mancante in grigio dopo il testo digitato
  let items: string[] = [];
  let selected = -1;
  const listEl = document.getElementById('cmd-list') as HTMLUListElement;

  const buildCandidates = (value: string): string[] => {
    if (!value) return [];
    if (value.startsWith('/') && !value.includes(' ')) {
      return COMMANDS.filter((c) => c.startsWith(value.toLowerCase()));
    }
    const nodeNames = actions.getNodeNames();
    let partial = value;
    let prefix = '';
    if (value.startsWith('/')) {
      const i = value.indexOf(' ');
      const cmd = value.slice(0, i);
      if (!NODE_ARG_COMMANDS.has(cmd)) return [];
      const segs = value.slice(i + 1).split('->');
      partial = segs[segs.length - 1].trim();
      segs[segs.length - 1] = ' ';
      prefix = cmd + ' ' + segs.slice(0, -1).map((s) => s.trim()).join(' -> ')
        + (segs.length > 1 ? ' -> ' : '');
      prefix = prefix.replace(/\s+$/, ' ');
    }
    if (!partial) return [];
    const lower = partial.toLowerCase();
    const starts = nodeNames.filter((n) => n.toLowerCase().startsWith(lower));
    const fuse = new Fuse(nodeNames.filter((n) => !starts.includes(n)), { threshold: 0.35 });
    const fuzzy = fuse.search(partial).map((r) => r.item);
    return [...starts, ...fuzzy].slice(0, 8).map((n) => prefix + n);
  };

  const renderList = () => {
    listEl.innerHTML = '';
    listEl.style.display = items.length ? 'block' : 'none';
    items.forEach((it, i) => {
      const li = document.createElement('li');
      li.textContent = it;
      if (i === selected) li.classList.add('sel');
      li.onmouseenter = () => { selected = i; renderList(); };
      li.onclick = () => { input.value = it; closeList(); input.focus(); };
      listEl.appendChild(li);
    });
  };
  const closeList = () => { items = []; selected = -1; renderList(); };


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
      case '/cerca': actions.search(arg); break;
      case '/collega': {
        const [a, b] = arg.split('->').map((s) => s.trim());
        if (a && b) { actions.addLink(a, b); flash(`${a} <-> ${b}`); }
        else flash('uso: /collega A -> B', false);
        break;
      }
      case '/ripara': actions.repair(); flash('riparazione grafo…'); break;
      case '/elimina': actions.deleteNode(arg); break;
      case '/rinomina': {
        const [o, n] = arg.split('->').map((s) => s.trim());
        if (o && n) { await actions.renameNode(o, n); flash(`${o} -> ${n}`); }
        else flash('uso: /rinomina VECCHIO -> NUOVO', false);
        break;
      }
      case '/scopri': actions.discover(); break;
      case '/ricalcola': actions.recalc(); flash('ricalcolo…'); break;
      case '/soglia': {
        const v = parseFloat(arg);
        if (v >= 0.3 && v <= 0.9) { actions.setThreshold(v); flash(`soglia = ${v}`); }
        else flash('valore tra 0.3 e 0.9', false);
        break;
      }
      case '/modello': actions.setModel(arg); flash(`modello = ${arg}`); break;
      case '/esporta': actions.exportData(); flash('backup scaricato'); break;
      case '/font': document.dispatchEvent(new CustomEvent('kga:fontlab')); break;

      case '/ytkey':
        if (arg) { localStorage.setItem('kga-yt-key', arg); flash('YouTube API key salvata'); }
        else flash('uso: /ytkey LA_TUA_KEY', false);
        break;

      case '/saggio': {
        const { exportEssayPDF } = await import('../ai/essay');
        try { await exportEssayPDF((m) => flash(m)); }
        catch (err) { flash(err instanceof Error ? err.message : 'errore saggio', false); }
        break;
      }
      case '/aggiungi': 
      if(!arg) { flash('uso: \aggiungi TERMINE', false); break; }
      else {actions.addNode(arg); flash(`+ ${arg}`); break; }

      case '/aiuto': flash('aggiungi: scrivi testo + INVIO oppure \aggiungi TERMINE' + COMMANDS.join('  ')); break;
      default: flash(`comando sconosciuto: ${cmd}`, false);
      
    }
  };

  input.addEventListener('keydown', (e) => {
    if (items.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      selected = e.key === 'ArrowDown'
        ? (selected + 1) % items.length
        : (selected - 1 + items.length) % items.length;
      renderList();
    } else if (items.length && e.key === 'Tab') {
      e.preventDefault();
      input.value = items[selected];      // TAB conferma la voce evidenziata
      closeList();
    } else if (e.key === 'Enter') {
      if (items.length && selected >= 0 && items[selected] !== input.value
          && input.value.startsWith('/') && !input.value.includes(' ')) {
        input.value = items[selected];    // Enter su comando parziale: completa
        closeList(); return;
      }
      closeList(); run(input.value); input.value = '';
    } else if (e.key === 'ArrowUp' && !items.length) {
      e.preventDefault();
      if (hIndex > 0) { hIndex--; input.value = history[hIndex]; }
    } else if (e.key === 'ArrowDown' && !items.length) {
      e.preventDefault();
      if (hIndex < history.length - 1) { hIndex++; input.value = history[hIndex]; }
      else { hIndex = history.length; input.value = ''; }
    } else if (e.key === 'Escape') { closeList(); input.blur(); }
  });


  input.addEventListener('input', () => {
    items = buildCandidates(input.value);
    selected = items.length ? 0 : -1;
    renderList();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); input.focus(); }
  });
}
