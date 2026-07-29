import './style.css';
import ForceGraph3D from '3d-force-graph';
import Fuse from 'fuse.js';
import { db } from './data/db';
import { safeAddNode } from './data/db-errors';
import type { KGNode, KGLink } from './core/types';
import { embed } from './ai/embeddings';
import { autoLink, linkId } from './ai/similarity';
import { classifyRelations } from './ai/relations';
import { streamDefinition } from './ai/ollama';
import { enqueue } from './ai/queue';
import { assignClusters } from './graph/clusters';
import { createBloom, nodeObject } from './graph/effects';
import { initUI } from './ui';

const container = document.getElementById('app');

if (container) {
  const graph = (ForceGraph3D as any)()(container)    
    .backgroundColor('#050510')
    .nodeThreeObject((n) => nodeObject(n as KGNode))
    .linkDirectionalParticles((l) => Math.round((l as KGLink).weight * 4))
    .linkDirectionalParticleSpeed(0.004)
    .linkWidth((l) => (l as KGLink).weight * 2)
    .linkColor((l) => ((l as KGLink).origin === 'manual' ? '#FCE676' : 'rgba(255,255,255,0.25)'))
    .linkLabel((l) => (l as KGLink).label ?? (l as KGLink).type);

  graph.postProcessingComposer().addPass(createBloom());

  const infoPanel = document.getElementById('info-panel');
  const nodeTitle = document.getElementById('node-title');
  const nodeDesc = document.getElementById('node-description');
  const closeBtn = document.getElementById('close-btn');

  const flyToNode = (node: KGNode) => {
    const x = node.x ?? 0, y = node.y ?? 0, z = node.z ?? 0;
    const dist = Math.hypot(x, y, z);
    if (dist < 1e-6) {
      graph.cameraPosition({ x: 0, y: 0, z: 120 }, { x, y, z }, 1500);
    } else {
      const distRatio = 1 + 40 / dist;
      graph.cameraPosition({ x: x * distRatio, y: y * distRatio, z: z * distRatio }, node, 1500);
    }
    if (nodeTitle && nodeDesc && infoPanel) {
      nodeTitle.innerText = node.label;
      nodeDesc.innerText = node.info || 'Nessuna informazione disponibile...';
      infoPanel.classList.add('visible');
    }
  };

  graph.onNodeClick((n) => flyToNode(n as KGNode));
  closeBtn?.addEventListener('click', () => infoPanel?.classList.remove('visible'));

  let lastLinkCount = -1;
  const refreshGraph = async () => {
    const nodes = await db.nodes.toArray();
    const links = await db.links.toArray();
    // Preserva le posizioni correnti (evita il "salto" del layout a ogni refresh)
    const current = new Map((graph.graphData().nodes as KGNode[]).map((n) => [n.id, n]));
    nodes.forEach((n) => {
      const old = current.get(n.id);
      if (old) { n.x = old.x; n.y = old.y; n.z = old.z; }
      n.degree = links.filter((l) => l.source === n.id || l.target === n.id).length;
    });
    if (links.length !== lastLinkCount) {
      assignClusters(nodes, links);
      lastLinkCount = links.length;
    }
    graph.graphData({ nodes, links });
  };

  const handleAddNode = async (term: string) => {
    const newNode: KGNode = {
      id: term, label: term,
      info: "⏳ L'IA sta comprendendo l'argomento...",
      color: '#ffffff', createdAt: Date.now(),
    };
    try {
      await safeAddNode(async () => { await db.nodes.add(newNode); });
      invalidateSearchIndex();
      await refreshGraph();

      enqueue(async () => {
        try {
          const { vector, model } = await embed(term);
          await db.nodes.update(term, { embedding: vector, embeddingModel: model });
          const newLinks = await autoLink(term, vector, model);
          if (newLinks.length > 0) {
            const pairs = newLinks.map((l) => [l.source, l.target] as [string, string]);
            const rels = await classifyRelations(pairs).catch(() => []);
            for (const r of rels) {
              await db.links.update(linkId(r.da, r.a), { type: r.tipo, label: r.label });
            }
          }
          await refreshGraph();

          let fullText = '';
          for await (const chunk of streamDefinition(term)) {
            fullText += chunk;
            if (nodeTitle?.innerText === term && nodeDesc) nodeDesc.innerText = fullText;
          }
          await db.nodes.update(term, { info: fullText });
          await refreshGraph();
        } catch (e) {
          console.error('AI fallita per', term, e);
          await db.nodes.update(term, {
            info: 'Definizione non disponibile (AI offline). Riprova quando Ollama e attivo.',
          });
          await refreshGraph();
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE') {
        alert(`Il termine "${term}" esiste gia nel tuo Secondo Cervello!`);
      } else {
        console.error(error);
      }
    }
  };

  let fuseIndex: Fuse<KGNode> | null = null;
  const invalidateSearchIndex = () => { fuseIndex = null; };

  const handleSearch = async (term: string) => {
    if (!term) return;
    if (!fuseIndex) {
      const nodes = await db.nodes.toArray();
      fuseIndex = new Fuse(nodes, { keys: ['label'], threshold: 0.3 });
    }
    const results = fuseIndex.search(term);
    if (results.length > 0) {
      const target = (graph.graphData().nodes as KGNode[]).find((n) => n.id === results[0].item.id);
      if (target) flyToNode(target);
    }
  };

  const handleAddLink = async (source: string, target: string) => {
    if (!source || !target || source === target) return;
    const [s, t] = await Promise.all([db.nodes.get(source), db.nodes.get(target)]);
    if (!s || !t) { alert('I nodi devono esistere! Controlla i nomi.'); return; }
    const id = linkId(source, target);
    if (await db.links.get(id)) { alert('Questi nodi sono gia collegati.'); return; }
    await db.links.add({ id, source, target, type: 'custom', weight: 0.8, origin: 'manual', label: 'collegato a' });
    await refreshGraph();
  };

  initUI(handleAddNode, handleSearch, handleAddLink);
  refreshGraph();
}