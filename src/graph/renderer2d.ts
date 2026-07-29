
import ForceGraph2D from 'force-graph';
import type { KGNode, KGLink } from '../core/types';

export function createGraph2D(
  container: HTMLElement,
  onNodeClick: (n: KGNode) => void,
  onNodeHover: (n: KGNode | null) => void,
) {
  const g = new ForceGraph2D(container)
    .backgroundColor('#FAF6EE')                       // bianco panna
    .nodeCanvasObject((node: any, ctx, scale) => {
      const r = 3 + Math.min((node.degree ?? 0) * 0.8, 7);
      ctx.fillStyle = '#111111';                      // pallina nera
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (scale > 1.2) {                              // etichetta se zoomato
        ctx.font = `${11 / scale * 1.2}px ui-monospace, monospace`;
        ctx.fillStyle = '#111111';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y - r - 4);
      }
    })
    .linkColor(() => 'rgba(17,17,17,0.55)')           // linee nere
    .linkWidth((l: any) => 0.5 + (l as KGLink).weight * 1.5)
    .onNodeClick((n: any) => onNodeClick(n as KGNode))
    .onNodeHover((n: any) => onNodeHover(n as KGNode | null));
  return g;
}

