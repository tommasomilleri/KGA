import * as THREE from 'three';

import './style.css';
import ForceGraph3D from '3d-force-graph';
import Fuse from 'fuse.js';
import { db } from './data/db';
import { safeAddNode } from './data/db-errors';
import type { KGNode, KGLink } from './core/types';
import { embed } from './ai/embeddings';
import { autoLink, linkId, recalculateAllLinks } from './ai/similarity';
import { classifyRelations } from './ai/relations';
import { streamDefinition } from './ai/ollama';
import { enqueue } from './ai/queue';
import { assignClusters } from './graph/clusters';
import { createBloom, nodeObject } from './graph/effects';
import { highlight, computeNeighbors, computeNeighborhood } from './graph/highlight';
import { summarizeCluster } from './ai/summarize';
import { createMinimap } from './graph/minimap';
import { initFontLab } from './ui/fontlab';
import { initTerminal } from './ui/terminal';
import { setThreshold } from './ai/similarity';
import { renameNode } from './data/mutations';
import { exportJSON } from './data/db';
import { findHiddenLinks, applyProposals } from './ai/discovery';
import { initMusicPlayer } from './ui/music';
import { initSettings } from './ui/settings';
import { getThreshold } from './ai/similarity';
import { createGraph2D } from './graph/renderer2d';



const scene = graph.scene();
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(120, 180, 80);
scene.add(key);
const rim = new THREE.DirectionalLight(0x88aaff, 0.4);  // controluce fredda
rim.position.set(-100, -60, -120);
scene.add(rim);


const container = document.getElementById('app');

if (container) {
  const graph = (ForceGraph3D as any)()(container)
    .backgroundColor('#030308')
    .nodeLabel((n: any) => `
    <div style="
      background: rgba(15,15,25,.9);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      padding: 6px 12px;
      font: 500 13px Inter, sans-serif;
      color: #fff;
      letter-spacing: .02em;
    ">${(n as KGNode).label}</div>
  `)
    .nodeThreeObject((n: any) => nodeObject(n as KGNode))
    .linkDirectionalParticles((l: any) => Math.round((l as KGLink).weight * 4))
    .linkDirectionalParticleSpeed(0.004)
    .linkWidth((l: any) => (l as KGLink).weight * 2)
    .linkColor((l: any) => ((l as KGLink).origin === 'manual' ? '#FCE676' : 'rgba(255,255,255,0.25)'))
    .linkLabel((l: any) => (l as KGLink).label ?? (l as KGLink).type);

  graph
    .onNodeHover((n) => {
      const node = n as KGNode | null;
      highlight.hoverId = node?.id ?? null;
      highlight.neighbors = node
        ? computeNeighbors(node.id, graph.graphData().links as KGLink[])
        : new Set();
      graph.nodeThreeObject(graph.nodeThreeObject()); // forza il re-render dei nodi
    })
    .linkOpacity(0.9);

  graph.linkColor((l) => {
    const link = l as KGLink;
    const src = typeof link.source === 'object' ? (link.source as unknown as KGNode).id : link.source;
    const tgt = typeof link.target === 'object' ? (link.target as unknown as KGNode).id : link.target;
    const active =
      (!highlight.hoverId || (highlight.neighbors.has(src) && highlight.neighbors.has(tgt))) &&
      (!highlight.focusId || (highlight.focusVisible.has(src) && highlight.focusVisible.has(tgt)));
    if (!active) return 'rgba(255,255,255,0.03)';
    return link.origin === 'manual' ? '#FCE676' : 'rgba(255,255,255,0.12)';
  });

  // FISICA DI ATTRAZIONE E REPULSIONE
  graph.d3Force('charge').strength(-180);
  graph.d3Force('link').distance((link: any) => Math.max(20, 120 - (link.weight * 80)));

  graph.postProcessingComposer().addPass(createBloom());

  const infoPanel = document.getElementById('info-panel');
  const nodeTitle = document.getElementById('node-title');
  const nodeDesc = document.getElementById('node-description');
  const closeBtn = document.getElementById('close-btn');

  const renderNodeLinks = (nodeId: string) => {
    const list = document.getElementById('node-links-list');
    if (!list) return;
    const links = (graph.graphData().links as KGLink[]).filter((l) => {
      const src = typeof l.source === 'object' ? (l.source as unknown as KGNode).id : l.source;
      const tgt = typeof l.target === 'object' ? (l.target as unknown as KGNode).id : l.target;
      return src === nodeId || tgt === nodeId;
    });
    list.innerHTML = '';
    if (links.length === 0) {
      list.innerHTML = '<div class="link-row"><span class="link-rel">nessuno</span></div>';
      return;
    }
    // ordina per peso decrescente: i collegamenti piu' forti in alto
    links.sort((a, b) => b.weight - a.weight);
    for (const l of links) {
      const src = typeof l.source === 'object' ? (l.source as unknown as KGNode).id : l.source;
      const tgt = typeof l.target === 'object' ? (l.target as unknown as KGNode).id : l.target;
      const other = src === nodeId ? tgt : src;
      const row = document.createElement('div');
      row.className = 'link-row';
      row.innerHTML = `
        <span class="link-rel">${l.label ?? l.type}</span>
        <span class="link-target">${other}</span>
        <span class="link-weight">${Math.round(l.weight * 100)}%</span>`;
      // click sul collegamento = vola al nodo collegato
      row.onclick = () => {
        const target = (graph.graphData().nodes as KGNode[]).find((n) => n.id === other);
        if (target) flyToNode(target);
      };
      list.appendChild(row);
    }
  };

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
      renderNodeLinks(node.id);

    }
    if (visited[visited.length - 1] !== node.id) { visited.push(node.id); renderBreadcrumb(); }
  };

  graph.onNodeClick((n: any) => flyToNode(n as KGNode));
  closeBtn?.addEventListener('click', () => infoPanel?.classList.remove('visible'));


  const visited: string[] = [];
  const renderBreadcrumb = () => {
    const el = document.getElementById('breadcrumb');
    if (!el) return;
    el.innerHTML = '';
    visited.slice(-4).forEach((id) => {
      const s = document.createElement('span');
      s.textContent = id;
      s.onclick = () => {
        const n = (graph.graphData().nodes as KGNode[]).find((x) => x.id === id);
        if (n) flyToNode(n);
      };
      el.appendChild(s);
    });
  };
  // Dentro flyToNode, come ULTIMA riga del corpo, aggiungi:
  //   if (visited[visited.length - 1] !== node.id) { visited.push(node.id); renderBreadcrumb(); }


  let lastLinkCount = -1;
  const refreshGraph = async () => {
    const nodes = await db.nodes.toArray();
    const links = await db.links.toArray();
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
    if (is2D && graph2d) graph2d.graphData({ nodes, links });

  };

  let lastClickTime = 0;
  graph.onNodeClick((n) => {
    const node = n as KGNode;
    const now = Date.now();
    const isDouble = now - lastClickTime < 350;
    lastClickTime = now;
    lastClickedId = node.id;
    if (isDouble && node.cluster !== undefined) {
      if (nodeTitle && nodeDesc && infoPanel) {
        nodeTitle.innerText = `Cluster di "${node.label}"`;
        nodeDesc.innerText = '⏳ Sintesi in corso...';
        infoPanel.classList.add('visible');
        summarizeCluster(node.cluster)
          .then((text) => { nodeDesc.innerText = text; })
          .catch(() => { nodeDesc.innerText = 'Sintesi non disponibile (Ollama offline).'; });
      }
    } else {
      flyToNode(node);
    }
  });

  let idleTimer: ReturnType<typeof setTimeout>;
  const resetIdle = () => {
    graph.controls().autoRotate = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      graph.controls().autoRotate = true;
      graph.controls().autoRotateSpeed = 0.4; // lentissimo, elegante
    }, 30000); // 30s senza input
  };
  ['mousemove', 'mousedown', 'wheel', 'touchstart', 'keydown']
    .forEach((ev) => document.addEventListener(ev, resetIdle));
  resetIdle();


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

  let bloomPass = createBloom();               // tieni il riferimento
  graph.postProcessingComposer().addPass(bloomPass);
  let nodeScale = 1;                           // usalo dentro nodeObject: size * nodeScale
  // (esporta una setNodeScale da effects.ts
  //  o passa via modulo highlight-style)

  initSettings({
    setThreshold, getThreshold,
    setModel: (m) => localStorage.setItem('kga-model', m),
    getModel: () => localStorage.getItem('kga-model') ?? 'llama3.1:8b',
    setCharge: (v) => { graph.d3Force('charge').strength(v); graph.d3ReheatSimulation(); },
    setParticleSpeed: (v) => graph.linkDirectionalParticleSpeed(v),
    setAutoRotate: (on, speed) => {
      graph.controls().autoRotate = on;
      graph.controls().autoRotateSpeed = speed;
    },
    setBloom: (on) => { bloomPass.enabled = on; },
    setNodeScale: (v) => { nodeScale = v; graph.nodeThreeObject(graph.nodeThreeObject()); },
    exportData: /* riusa la funzione export gia' presente */ exportHandler,
    importData: /* riusa l'import file picker gia' presente */ importHandler,
    resetDB: async () => { await db.nodes.clear(); await db.links.clear(); location.reload(); },
  });

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
  const container2d = document.getElementById('app2d')!;
  let graph2d: ReturnType<typeof createGraph2D> | null = null;
  let is2D = false;

  const dimBtn = document.getElementById('dim-toggle')!;
  dimBtn.onclick = async () => {
    is2D = !is2D;
    dimBtn.textContent = is2D ? '3D' : '2D';
    container.style.display = is2D ? 'none' : 'block';
    container2d.style.display = is2D ? 'block' : 'none';
    document.body.classList.toggle('paper', is2D);   // tema chiaro per la UI
    if (is2D) {
      if (!graph2d) graph2d = createGraph2D(container2d, flyToNode2D, () => { });
      const nodes = await db.nodes.toArray();
      const links = await db.links.toArray();
      nodes.forEach((n) => {
        n.degree = links.filter((l) => l.source === n.id || l.target === n.id).length;
      });
      graph2d.graphData({ nodes, links });
    }
  };

  const flyToNode2D = (node: KGNode) => {
    graph2d?.centerAt(node.x, node.y, 800);
    graph2d?.zoom(3, 800);
    // riusa il pannello info esistente:
    if (nodeTitle && nodeDesc && infoPanel) {
      nodeTitle.innerText = node.label;
      nodeDesc.innerText = node.info || '…';
      infoPanel.classList.add('visible');
      renderNodeLinks(node.id);
    }
  };

  const handleDeleteNode = async (term: string) => {
    const exists = await db.nodes.get(term);
    if (!exists) {
      alert(`Il nodo "${term}" non esiste nel grafo.`);
      return;
    }
    if (confirm(`Sei sicuro di voler eliminare "${term}" e tutti i suoi collegamenti?`)) {
      await db.transaction('rw', db.nodes, db.links, async () => {
        await db.nodes.delete(term);
        const allLinks = await db.links.toArray();
        const linksToDelete = allLinks
          .filter((l) => l.source === term || l.target === term)
          .map((l) => l.id);
        await db.links.bulkDelete(linksToDelete);
      });
      invalidateSearchIndex();
      await refreshGraph();
    }
  };

  // REFRESH: Ricalcola auto-link AI con la nuova soglia e ri-centra la camera
  const handleRefresh = async () => {
    const added = await recalculateAllLinks();
    console.log(`[AI] Ricalcolo completato. Nuovi collegamenti creati: ${added}`);
    graph.cameraPosition({ x: 0, y: 0, z: 250 }, { x: 0, y: 0, z: 0 }, 1500);
    await refreshGraph();
  };

  let lastClickedId: string | null = null;
  graph.onNodeClick((n) => { lastClickedId = (n as KGNode).id; flyToNode(n as KGNode); });
  // NOTA: questa riga SOSTITUISCE la vecchia `graph.onNodeClick((n) => flyToNode(n as KGNode));`
  // eliminala per non avere due handler.

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'f') return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return; // non rubare la F ai campi testo
    if (highlight.focusId) {
      highlight.focusId = null;
      highlight.focusVisible = new Set();
    } else if (lastClickedId) {
      highlight.focusId = lastClickedId;
      highlight.focusVisible = computeNeighborhood(
        lastClickedId, graph.graphData().links as KGLink[], 2,
      );
    }
    graph.nodeThreeObject(graph.nodeThreeObject());
  });


  createMinimap(
    () => graph.graphData().nodes as KGNode[],
    () => {
      const c = graph.cameraPosition();
      const t = graph.controls().target ?? { x: 0, z: 0 };
      return { x: c.x, z: c.z, lookX: t.x, lookZ: t.z };
    },
    (node) => flyToNode(node),
  );




  initTerminal({
    addNode: handleAddNode,

    getNodeNames: () => (graph.graphData().nodes as KGNode[]).map((n) => n.label),
    search: handleSearch,
    addLink: handleAddLink,
    deleteNode: handleDeleteNode,
    renameNode: async (o, n) => { await renameNode(o, n); invalidateSearchIndex(); await refreshGraph(); },
    discover: async () => {
      const proposals = await findHiddenLinks(10);
      if (proposals.length === 0) { alert('Nessun collegamento nascosto.'); return; }
      const summary = proposals.map((p) => `• ${p.source} ↔ ${p.target} (${Math.round(p.sim * 100)}%)`).join('\n');
      if (confirm(`Trovati ${proposals.length}:\n\n${summary}\n\nAggiungerli?`)) {
        await applyProposals(proposals);
        await refreshGraph();
      }
    },
    recalc: handleRefresh,
    setThreshold,
    setModel: (m) => localStorage.setItem('kga-model', m),
    exportData: async () => {
      const blob = new Blob([await exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `kga-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(a.href);
    },
  });

  initFontLab();
  initMusicPlayer();

  refreshGraph();
}