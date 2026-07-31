
export interface SettingsActions {
  setThreshold: (v: number) => void; getThreshold: () => number;
  setModel: (m: string) => void; getModel: () => string;
  setCharge: (v: number) => void;          // forza repulsione (default -180)
  setParticleSpeed: (v: number) => void;   // default 0.004
  setAutoRotate: (on: boolean, speed: number) => void;
  setBloom: (on: boolean) => void;
  setNodeScale: (v: number) => void;       // moltiplicatore raggio sfere
  exportData: () => void;
  importData: () => void;
  resetDB: () => void;
}

export function initSettings(a: SettingsActions): void {
  const wrap = document.createElement('div');
  wrap.id = 'settings';
  wrap.innerHTML = `
    <button id="set-toggle" title="Impostazioni">⚙</button>
    <div id="set-panel">
      <div class="st-title">IMPOSTAZIONI</div>
      <label>Soglia similarità <span id="st-thr-v"></span>
        <input id="st-thr" type="range" min="0.3" max="0.9" step="0.01"></label>
      <label>Modello Ollama
        <input id="st-model" type="text" list="st-model-list" placeholder="llama3.1:8b"></label>
        <datalist id="st-model-list">
          <option value="llama3.1:8b">
          <option value="llama3.2:3b">
          <option value="mistral:7b">
          <option value="gemma2:9b">
        </datalist>
      </label>
      <label>Repulsione nodi <span id="st-charge-v"></span>
        <input id="st-charge" type="range" min="-400" max="-40" step="10"></label>
      <label>Velocità particelle <span id="st-part-v"></span>
        <input id="st-part" type="range" min="0" max="0.02" step="0.001"></label>
      <label>Scala nodi <span id="st-scale-v"></span>
        <input id="st-scale" type="range" min="0.5" max="2" step="0.1"></label>
      <label class="st-check"><input id="st-rotate" type="checkbox"> Auto-rotate idle</label>
      <label class="st-check"><input id="st-bloom" type="checkbox" checked> Bloom</label>
      <div class="st-actions">
        <button id="st-export">EXPORT</button>
        <button id="st-import">IMPORT</button>
        <button id="st-reset" class="danger">RESET DB</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
  const panel = document.getElementById('set-panel')!;
  document.getElementById('set-toggle')!.onclick = () => panel.classList.toggle('open');

  $('st-thr').value = String(a.getThreshold());
  $('st-model').value = a.getModel();
  $('st-charge').value = '-180'; $('st-part').value = '0.004'; $('st-scale').value = '1';

  const bindLabel = (id: string, fmt: (v: string) => string) => {
    const el = $(id); const lbl = document.getElementById(id + '-v')!;
    const upd = () => { lbl.textContent = fmt(el.value); };
    el.addEventListener('input', upd); upd();
  };
  bindLabel('st-thr', (v) => v);
  bindLabel('st-charge', (v) => v);
  bindLabel('st-part', (v) => v);
  bindLabel('st-scale', (v) => v + 'x');

  $('st-thr').oninput = (e) => a.setThreshold(Number((e.target as HTMLInputElement).value));
  $('st-model').onchange = (e) => a.setModel((e.target as HTMLInputElement).value);
  $('st-charge').oninput = (e) => a.setCharge(Number((e.target as HTMLInputElement).value));
  $('st-part').oninput = (e) => a.setParticleSpeed(Number((e.target as HTMLInputElement).value));
  $('st-scale').oninput = (e) => a.setNodeScale(Number((e.target as HTMLInputElement).value));
  $('st-rotate').onchange = (e) => a.setAutoRotate((e.target as HTMLInputElement).checked, 0.4);
  $('st-bloom').onchange = (e) => a.setBloom((e.target as HTMLInputElement).checked);
  (document.getElementById('st-export') as HTMLButtonElement).onclick = a.exportData;
  (document.getElementById('st-import') as HTMLButtonElement).onclick = a.importData;
  (document.getElementById('st-reset') as HTMLButtonElement).onclick = () => {
    if (confirm('Cancellare TUTTO il grafo? Irreversibile.')) a.resetDB();
  };
}

