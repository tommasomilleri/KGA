
import type { KGNode } from '../core/types';

export function createMinimap(
  getNodes: () => KGNode[],
  getCameraPos: () => { x: number; z: number },
  onJump: (x: number, z: number) => void,
): void {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.id = 'minimap';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const draw = () => {
    const nodes = getNodes();
    ctx.clearRect(0, 0, size, size);
    // sfondo glassy
    ctx.fillStyle = 'rgba(15,15,25,0.75)';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();

    if (nodes.length > 0) {
      // scala automatica sul bounding box del grafo (proiezione X/Z)
      const xs = nodes.map((n) => n.x ?? 0);
      const zs = nodes.map((n) => n.z ?? 0);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const span = Math.max(maxX - minX, maxZ - minZ, 1);
      const scale = (size - 24) / span;
      const px = (x: number) => 12 + (x - minX) * scale;
      const pz = (z: number) => 12 + (z - minZ) * scale;

      // nodi come puntini colorati per cluster
      for (const n of nodes) {
        ctx.fillStyle = n.color || '#ffffff';
        ctx.beginPath();
        ctx.arc(px(n.x ?? 0), pz(n.z ?? 0), 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // posizione camera: cerchietto bianco
      const cam = getCameraPos();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px(cam.x), pz(cam.z), 5, 0, Math.PI * 2);
      ctx.stroke();

      // click sulla mappa = vola in quella zona
      canvas.onclick = (e) => {
        const r = canvas.getBoundingClientRect();
        const wx = minX + (e.clientX - r.left - 12) / scale;
        const wz = minZ + (e.clientY - r.top - 12) / scale;
        onJump(wx, wz);
      };
    }
    requestAnimationFrame(draw);
  };
  draw();
}
