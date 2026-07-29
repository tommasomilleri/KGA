
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
}

const COMMANDS = [
  '/cerca', '/collega', '/elimina', '/rinomina', '/scopri',
  '/ricalcola', '/soglia', '/modello', '/esporta', '/aiuto',
];

export function initTerminal(actions: TerminalActions): void {
  const input = document.getElementById('cmd-input') as HTMLInputElement;
  const hint = document.getElementById('cmd-hint')!;
  const history: string[] = JSON.parse(localStorage.getItem('kga-history') ?? '[]');
  let hIndex = history.length;

  const flash = (msg: string, ok = true) => {
    hint.textContent = msg;
    hint.style.color = ok ? 'rgba(120,220,150,0.9)' : 'rgba(230,120,120,0.9)';
    setTimeout(() => { hint.textContent = ''; }, 2500);
  };

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
        if (a && b) { actions.addLink(a, b); flash(`${a} ↔ ${b}`); }
        else flash('uso: /collega A -> B', false);
        break;
      }
      case '/elimina':  actions.deleteNode(arg); break;
      case '/rinomina': {
        const [o, n] = arg.split('->').map((s) => s.trim());
        if (o && n) { await actions.renameNode(o, n); flash(`${o} → ${n}`); }
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
      case '/aiuto':    flash(COMMANDS.join('  ')); break;
      default:          flash(`comando sconosciuto: ${cmd}`, false);
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {                    // <-- INVIO fa tutto
      run(input.value); input.value = ''; hint.textContent = '';
    } else if (e.key === 'ArrowUp') {           // history come un vero terminale
      e.preventDefault();
      if (hIndex > 0) { hIndex--; input.value = history[hIndex]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIndex < history.length - 1) { hIndex++; input.value = history[hIndex]; }
      else { hIndex = history.length; input.value = ''; }
    } else if (e.key === 'Tab') {               // autocomplete comandi
      e.preventDefault();
      const m = COMMANDS.find((c) => c.startsWith(input.value));
      if (m) input.value = m + ' ';
    } else if (e.key === 'Escape') { input.blur(); }
  });

  // suggerimento comandi live mentre digiti "/"
  input.addEventListener('input', () => {
    if (input.value.startsWith('/')) {
      const matches = COMMANDS.filter((c) => c.startsWith(input.value.split(' ')[0]));
      hint.textContent = matches.join('  ');
      hint.style.color = 'rgba(255,255,255,0.35)';
    } else hint.textContent = '';
  });

  // Ctrl+K per aprire la barra da ovunque
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); input.focus(); }
  });
}
