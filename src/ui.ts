import { Pane } from 'tweakpane';
import { getThreshold, setThreshold } from './ai/similarity';
import { exportJSON, importJSON } from './data/db';
import { deleteNode, renameNode } from './data/mutations';
import { findHiddenLinks, applyProposals } from './ai/discovery';



export function initUI(
  onAddNode: (label: string) => void,
  onSearch: (term: string) => void,
  onAddLink: (source: string, target: string) => void,
  onDeleteNode: (term: string) => void,
  onRefresh: () => void,
  onGraphChanged: () => void,          // <-- NUOVO

) {
  const pane: any = new Pane({ title: 'KGA Control Panel' });
  const PARAMS = { newNode: '', search: '', linkFrom: '', linkTo: '',
                   threshold: getThreshold(), editTarget: '', editNewName: '',
                   nodeToDelete: '' };


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

  // --- Gestione nodi (elimina / rinomina) ---
  const editFolder = pane.addFolder({ title: 'Gestione Nodo' });
  editFolder.addBinding(PARAMS, 'editTarget', { label: 'Nodo' });
  editFolder.addBinding(PARAMS, 'editNewName', { label: 'Nuovo nome' });
  editFolder.addButton({ title: 'Rinomina' }).on('click', async () => {
    try {
      await renameNode(PARAMS.editTarget.trim(), PARAMS.editNewName.trim());
      onGraphChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rinomina fallita.');
    }
  });
  editFolder.addButton({ title: 'Elimina nodo' }).on('click', async () => {
    const id = PARAMS.editTarget.trim();
    if (!id) return;
    if (!confirm(`Eliminare "${id}" e tutti i suoi collegamenti?`)) return;
    await deleteNode(id);
    onGraphChanged();
  });

  // --- Gestione Grafo ---
  const manageFolder = pane.addFolder({ title: 'Gestione Grafo' });
  manageFolder.addButton({ title: '🔄 Ricalcola AI & Vista' }).on('click', () => onRefresh());
  manageFolder.addBinding(PARAMS, 'nodeToDelete', { label: 'Nome Nodo' });
  manageFolder.addButton({ title: '🗑️ Elimina Nodo' }).on('click', () => {
    const term = PARAMS.nodeToDelete.trim();
    if (term) {
      onDeleteNode(term);
      PARAMS.nodeToDelete = '';
      pane.refresh();
    }
  });

  // --- Impostazioni AI ---
  const aiFolder = pane.addFolder({ title: 'Impostazioni AI' });
  aiFolder
    .addBinding(PARAMS, 'threshold', { label: 'Soglia', min: 0.3, max: 0.9, step: 0.01 })
    .on('change', (ev: any) => setThreshold(ev.value));

  const MODEL_PARAMS = { model: localStorage.getItem('kga-model') ?? 'llama3.1:8b' };
  aiFolder
    .addBinding(MODEL_PARAMS, 'model', { label: 'Ollama Model' })
    .on('change', (ev: any) => localStorage.setItem('kga-model', ev.value));

  // --- Scoperta collegamenti nascosti ---
  const discoveryFolder = pane.addFolder({ title: 'Scoperta AI' });
  discoveryFolder.addButton({ title: 'Trova collegamenti nascosti' }).on('click', async () => {
    const proposals = await findHiddenLinks(10);
    if (proposals.length === 0) { alert('Nessun collegamento nascosto trovato.'); return; }
    const summary = proposals
      .map((p) => `• ${p.source} <-> ${p.target} (${Math.round(p.sim * 100)}%)`)
      .join('\n');
    if (confirm(`Trovati ${proposals.length} collegamenti:\n\n${summary}\n\nAggiungerli tutti?`)) {
      const n = await applyProposals(proposals);
      alert(`${n} collegamenti aggiunti.`);
      onGraphChanged();
    }
  });

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
      if (file) {
        try { await importJSON(await file.text()); location.reload(); } 
        catch (err) { alert(err instanceof Error ? err.message : 'Import fallito.'); }
      }
    };
    input.click();
  });

  return pane;
}