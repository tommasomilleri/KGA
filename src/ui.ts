import { Pane } from 'tweakpane';
import { getThreshold, setThreshold } from './ai/similarity';
import { exportJSON, importJSON } from './data/db';

export function initUI(
  onAddNode: (label: string) => void,
  onSearch: (term: string) => void,
  onAddLink: (source: string, target: string) => void,
) {
  const pane = new Pane({ title: 'KGA Control Panel' });
  const PARAMS = { newNode: '', search: '', linkFrom: '', linkTo: '', threshold: getThreshold() };

  // --- Aggiungi nodo ---
  const addFolder = pane.addFolder({ title: 'Aggiungi Conoscenza' });
  addFolder.addBinding(PARAMS, 'newNode', { label: 'Termine' });
  addFolder.addButton({ title: 'Aggiungi al Grafo' }).on('click', () => {
    const term = PARAMS.newNode.trim();
    if (!term) return;
    onAddNode(term);
    PARAMS.newNode = '';
    pane.refresh();
  });

  // --- Ricerca ---
  const searchFolder = pane.addFolder({ title: 'Ricerca' });
  searchFolder.addBinding(PARAMS, 'search', { label: 'Cerca' });
  searchFolder.addButton({ title: 'Vola al nodo' }).on('click', () => onSearch(PARAMS.search.trim()));

  // --- Collegamento manuale ---
  const linkFolder = pane.addFolder({ title: 'Collega Manualmente' });
  linkFolder.addBinding(PARAMS, 'linkFrom', { label: 'Da' });
  linkFolder.addBinding(PARAMS, 'linkTo', { label: 'A' });
  linkFolder.addButton({ title: 'Crea collegamento' }).on('click', () =>
    onAddLink(PARAMS.linkFrom.trim(), PARAMS.linkTo.trim()),
  );

  // --- Soglia configurabile ---
  const aiFolder = pane.addFolder({ title: 'Impostazioni AI' });
  aiFolder
    .addBinding(PARAMS, 'threshold', { label: 'Soglia similarita', min: 0.3, max: 0.9, step: 0.01 })
    .on('change', (ev) => setThreshold(ev.value));

  // --- Backup ---
  const dataFolder = pane.addFolder({ title: 'Dati' });
  dataFolder.addButton({ title: 'Esporta JSON' }).on('click', async () => {
    const blob = new Blob([await exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kga-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  dataFolder.addButton({ title: 'Importa JSON' }).on('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) { await importJSON(await file.text()); location.reload(); }
    };
    input.click();
  });

  return pane;
}