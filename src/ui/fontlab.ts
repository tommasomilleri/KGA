
const SYSTEM_FONTS = [
  'ui-monospace', 'SF Mono', 'Cascadia Code', 'Consolas', 'Menlo', 'Monaco',
  'Courier New', 'Lucida Console', 'OCR A Extended', 'Terminal',
];
const GOOGLE_FONTS = [
  'Fira Code', 'JetBrains Mono', 'IBM Plex Mono', 'Source Code Pro',
  'Space Mono', 'VT323', 'Share Tech Mono', 'Major Mono Display',
  'Roboto Mono', 'Ubuntu Mono', 'Inconsolata', 'Anonymous Pro',
  'Cutive Mono', 'Nova Mono', 'Syne Mono', 'Xanh Mono', 'Red Hat Mono',
  'Overpass Mono', 'Azeret Mono', 'Martian Mono', 'DotGothic16', 'Silkscreen',
];

interface FontSettings {
  family: string; size: number; spacing: number; accent: string; glow: number;
}
const DEFAULTS: FontSettings = {
  family: 'ui-monospace', size: 14, spacing: 0.02, accent: '#00ff66', glow: 0.5,
};

const loaded = new Set<string>();
function loadGoogleFont(name: string): void {
  if (loaded.has(name) || SYSTEM_FONTS.includes(name)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}&display=swap`;
  document.head.appendChild(link);
  loaded.add(name);
}

export function applyFontSettings(s: FontSettings): void {
  loadGoogleFont(s.family);
  const r = document.documentElement.style;
  r.setProperty('--ui-font', `'${s.family}', ui-monospace, monospace`);
  r.setProperty('--ui-size', `${s.size}px`);
  r.setProperty('--ui-spacing', `${s.spacing}em`);
  r.setProperty('--accent', s.accent);
  r.setProperty('--glow', String(s.glow));
  localStorage.setItem('kga-font', JSON.stringify(s));
}

export function initFontLab(): void {
  const saved = localStorage.getItem('kga-font');
  const settings: FontSettings = saved ? JSON.parse(saved) : { ...DEFAULTS };
  applyFontSettings(settings);

  const panel = document.createElement('div');
  panel.id = 'fontlab';
  panel.innerHTML = `
    <div class="fl-title">FONT LAB <button id="fl-close">✕</button></div>
    <label>Font
      <select id="fl-family">
        <optgroup label="Sistema">${SYSTEM_FONTS.map((f) => `<option>${f}</option>`).join('')}</optgroup>
        <optgroup label="Google Fonts">${GOOGLE_FONTS.map((f) => `<option>${f}</option>`).join('')}</optgroup>
      </select>
    </label>
    <label>Dimensione <span id="fl-size-v"></span>
      <input id="fl-size" type="range" min="10" max="22" step="1"></label>
    <label>Spaziatura <span id="fl-spacing-v"></span>
      <input id="fl-spacing" type="range" min="-0.02" max="0.2" step="0.005"></label>
    <label>Colore accento
      <input id="fl-accent" type="color"></label>
    <label>Glow <span id="fl-glow-v"></span>
      <input id="fl-glow" type="range" min="0" max="1" step="0.05"></label>
    <div class="fl-preview">the quick brown fox 0123 &gt; /cerca gatto_</div>
    <button id="fl-reset">RESET</button>`;
  document.body.appendChild(panel);

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const family = $<HTMLSelectElement>('fl-family');
  const size = $<HTMLInputElement>('fl-size');
  const spacing = $<HTMLInputElement>('fl-spacing');
  const accent = $<HTMLInputElement>('fl-accent');
  const glow = $<HTMLInputElement>('fl-glow');

  const sync = () => {
    family.value = settings.family;
    size.value = String(settings.size);
    spacing.value = String(settings.spacing);
    accent.value = settings.accent;
    glow.value = String(settings.glow);
    $('fl-size-v').textContent = `${settings.size}px`;
    $('fl-spacing-v').textContent = `${settings.spacing}em`;
    $('fl-glow-v').textContent = String(settings.glow);
  };
  sync();

  const update = () => {
    settings.family = family.value;
    settings.size = Number(size.value);
    settings.spacing = Number(spacing.value);
    settings.accent = accent.value;
    settings.glow = Number(glow.value);
    applyFontSettings(settings); sync();
  };
  [family, size, spacing, accent, glow].forEach((el) => el.addEventListener('input', update));

  $('fl-reset').onclick = () => { Object.assign(settings, DEFAULTS); applyFontSettings(settings); sync(); };
  $('fl-close').onclick = () => panel.classList.remove('open');
  document.addEventListener('kga:fontlab', () => panel.classList.toggle('open'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F9') { e.preventDefault(); panel.classList.toggle('open'); }
  });
}

