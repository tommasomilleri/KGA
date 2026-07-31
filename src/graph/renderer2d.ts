
import ForceGraph2D from 'force-graph';
import type { KGNode, KGLink } from '../core/types';

export function createGraph2D(
  container: HTMLElement,
  onNodeClick: (n: KGNode) => void,
  onNodeHover: (n: KGNode | null) => void,
) {
  let hoveredId: string | null = null;
  let placed: { x: number; y: number; w: number; h: number }[] = [];

  const g = new ForceGraph2D(container)
    .backgroundColor('#FAF6EE')
    .autoPauseRedraw(false)
    .onRenderFramePre(() => { placed = []; })
    .nodeCanvasObject((node: any, ctx, scale) => {
      const r = 3 + Math.min((node.degree ?? 0) * 0.8, 7);
      const isHover = hoveredId === node.id;

      ctx.fillStyle = isHover ? '#000000' : '#111111';
      ctx.beginPath();
      ctx.arc(node.x, node.y, isHover ? r + 2 : r, 0, Math.PI * 2);
      ctx.fill();

      const fontSize = Math.max(10 / scale, 2.5);
      ctx.font = `${isHover ? 600 : 400} ${fontSize}px ui-monospace, monospace`;
      const w = ctx.measureText(node.label).width;
      const h = fontSize;
      const lx = node.x, ly = node.y - r - 3;
      const box = { x: lx - w / 2, y: ly - h, w, h };
      const collides = placed.some((b) =>
        box.x < b.x + b.w && box.x + box.w > b.x &&
        box.y < b.y + b.h && box.y + box.h > b.y);

      if (isHover || (!collides && scale > 0.8)) {
        if (isHover) {
          ctx.fillStyle = 'rgba(250,246,238,0.95)';
          ctx.fillRect(box.x - 3, box.y - 2, w + 6, h + 4);
        }
        ctx.fillStyle = '#111111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(node.label, lx, ly);
        placed.push(box);
      }
    })
    .nodePointerAreaPaint((node: any, color, ctx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 10, 0, Math.PI * 2);
      ctx.fill();
    })
    .linkColor(() => 'rgba(17,17,17,0.55)')
    .linkWidth((l: any) => 0.5 + (l as KGLink).weight * 1.5)
    .onNodeClick((n: any) => onNodeClick(n as KGNode))
    .onNodeHover((n: any) => {
      hoveredId = (n as KGNode | null)?.id ?? null;
      onNodeHover(n as KGNode | null);
    });
  return g;
}
