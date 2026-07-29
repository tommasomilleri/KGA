
import type { KGNode } from '../core/types';

export function createMinimap(
  getNodes: () => KGNode[],
  getCamera: () => { x: number; z: number; lookX: number; lookZ: number },
  onJumpToNode: (node: KGNode) => void,
): void {
  const SIZE = 170;
  const PAD = 14;
  const wrap = document.createElement('div');
  wrap.id = 'minimap-wrap';
  wrap.innerHTML = `<canvas id="minimap" width="${SIZE}" height="${SIZE}"></canvas>
    <button id="minimap-toggle" title="Mostra/nascondi mappa">▾</button>`;
  document.body.appendChild(wrap);
  const canvas = wrap.querySelector('canvas')!;
  const toggle = wrap.querySelector('button')!;
  const ctx = canvas.getContext('2d')!;

  let collapsed = localStorage.getItem('kga-minimap') === 'hidden';
  const applyCollapse = () => {
    canvas.style.display = collapsed ? 'none' : 'block';
    toggle.textContent = collapsed ? '▴' : '▾';
    localStorage.setItem('kga-minimap', collapsed ? 'hidden' : 'shown');
  };
  toggle.onclick = () => { collapsed = !collapsed; applyCollapse(); };
  applyCollapse();

  // bounding box ammortizzato (lerp) per una mappa stabile
  let bMinX = -100, bMaxX = 100, bMinZ = -100, bMaxZ = 100;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  let mouse: { x: number; y: number } | null = null;
  canvas.onmousemove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.onmouseleave = () => { mouse = null; };

  const project = () => {
    const nodes = getNodes();
    if (nodes.length === 0) return null;
    const xs = nodes.map((n) => n.x ?? 0);
    const zs = nodes.map((n) => n.z ?? 0);
    // ammortizza il box: la mappa non "salta" durante la simulazione
    bMinX = lerp(bMinX, Math.min(...xs), 0.08);
    bMaxX = lerp(bMaxX, Math.max(...xs), 0.08);
    bMinZ = lerp(bMinZ, Math.min(...zs), 0.08);
    bMaxZ = lerp(bMaxZ, Math.max(...zs), 0.08);
    const span = Math.max(bMaxX - bMinX, bMaxZ - bMinZ, 1);
    const scale = (SIZE - PAD * 2) / span;
    return {
      nodes,
      px: (x: number) => PAD + (x - bMinX) * scale,
      pz: (z: number) => PAD + (z - bMinZ) * scale,
      invX: (px: number) => bMinX + (px - PAD) / scale,
      invZ: (pz: number) => bMinZ + (pz - PAD) / scale,
    };
  };

  const nearestNode = (wx: number, wz: number, nodes: KGNode[]): KGNode | null => {
    let best: KGNode | null = null, bestD = Infinity;
    for (const n of nodes) {
      const d = (n.x! - wx) ** 2 + (n.z! - wz) ** 2;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  };

  canvas.onclick = (e) => {
    const p = project();
    if (!p) return;
    const r = canvas.getBoundingClientRect();
    const target = nearestNode(
      p.invX(e.clientX - r.left), p.invZ(e.clientY - r.top), p.nodes,
    );
    if (target) onJumpToNode(target);
  };

  const draw = () => {
    if (collapsed) return;
    const p = project();
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(10,10,16,0.78)';
    ctx.beginPath(); ctx.roundRect(0, 0, SIZE, SIZE, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.stroke();
    if (!p) return;

    // nodo evidenziato in hover
    let hovered: KGNode | null = null;
    if (mouse) hovered = nearestNode(p.invX(mouse.x), p.invZ(mouse.y), p.nodes);

    for (const n of p.nodes) {
      const isHover = hovered?.id === n.id;
      ctx.fillStyle = n.color || '#ffffff';
      ctx.globalAlpha = isHover ? 1 : 0.85;
      ctx.beginPath();
      ctx.arc(p.px(n.x ?? 0), p.pz(n.z ?? 0), isHover ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // camera: punto + cono direzionale verso il target
    const cam = getCamera();
    const cx = p.px(cam.x), cz = p.pz(cam.z);
    const ang = Math.atan2(p.pz(cam.lookZ) - cz, p.px(cam.lookX) - cx);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(cx, cz);
    ctx.arc(cx, cz, 22, ang - 0.42, ang + 0.42);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cz, 4, 0, Math.PI * 2); ctx.stroke();

    // tooltip nome nodo in hover
    if (hovered && mouse) {
      ctx.font = '500 10px ui-monospace, monospace';
      const label = hovered.label.slice(0, 22);
      const w = ctx.measureText(label).width + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.beginPath();
      ctx.roundRect(Math.min(mouse.x, SIZE - w - 2), mouse.y - 18, w, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, Math.min(mouse.x, SIZE - w - 2) + 5, mouse.y - 8);
    }
  };
  setInterval(draw, 66); // ~15fps: fluido per una mappa, CPU quasi a zero
}
