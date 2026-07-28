import './style.css';
import ForceGraph3D from '3d-force-graph';
import Fuse from 'fuse.js';

// Importiamo la struttura base e il DB
import { db } from './data/db';
import { safeAddNode } from './data/db-errors';
import type { KGNode, KGLink } from './core/types';

// Importiamo l'IA e la semantica
import { embed } from './ai/embeddings';
import { autoLink } from './ai/similarity';
import { streamDefinition } from './ai/ollama';
import { enqueue } from './ai/queue';

// Importiamo la Grafica avanzata
import { assignClusters } from './graph/clusters';
import { createBloom, nodeObject } from './graph/effects';
import { initUI } from './ui';

const container = document.getElementById('app');

if (container) {
  // 1. INIZIALIZZAZIONE GRAFO 3D E GRAFICA
  const graph = ForceGraph3D()(container)
    .backgroundColor('#050510')
    .nodeThreeObject(nodeObject) // Pallini personalizzati
    .linkDirectionalParticles((l: any) => Math.round(l.weight * 4)) // Effetto particelle
    .linkDirectionalParticleSpeed(0.004)
    .linkWidth((l: any) => l.weight * 2)
    .linkColor((l: any) => l.origin === 'manual' ? '#FCE676' : 'rgba(255,255,255,0.25)')
    .linkLabel((l: any) => l.label ?? l.type);

  // Aggiungiamo il Bloom selettivo
  graph.postProcessingComposer().addPass(createBloom());

  // 2. PANNELLO LATERALE E TELECAMERA
  const infoPanel = document.getElementById('info-panel');
  const nodeTitle = document.getElementById('node-title');
  const nodeDesc = document.getElementById('node-description');
  const closeBtn = document.getElementById('close-btn');

  const flyToNode = (node: any) => {
    const distance = 40;
    const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
    graph.cameraPosition(
      { x: (node.x||0) * distRatio, y: (node.y||0) * distRatio, z: (node.z||0) * distRatio },
      node,
      1500
    );
    if (nodeTitle && nodeDesc && infoPanel) {
        nodeTitle.innerText = node.label;
        nodeDesc.innerText = node.info || "Nessuna informazione disponibile...";
        infoPanel.classList.add('visible');
    }
  };

  graph.onNodeClick(flyToNode);

  if (closeBtn && infoPanel) {
    closeBtn.addEventListener('click', () => {
        infoPanel.classList.remove('visible');
    });
  }

  // 3. SINCRONIZZAZIONE DATI E CLUSTER
  const refreshGraph = async () => {
    const nodes = await db.nodes.toArray();
    const links = await db.links.toArray();
    
    // Calcoliamo quante connessioni ha ogni nodo per ingrandirlo
    nodes.forEach((n: any) => {
       n.degree = links.filter(l => l.source === n.id || l.target === n.id).length;
    });

    // Assegniamo i colori intelligenti
    assignClusters(nodes, links);
    graph.graphData({ nodes, links });
  };

  // 4. LOGICA DELL'APPLICAZIONE (LE AZIONI DELL'UTENTE)
  
  // A. Aggiunta Nodo e IA
  const handleAddNode = async (term: string) => {
    const newNode: KGNode = {
      id: term,
      label: term,
      info: "⏳ L'IA sta comprendendo l'argomento...",
      color: '#ffffff', // Colore temporaneo neutro
      createdAt: Date.now()
    };

    try {
      // Usiamo safeAddNode per gestire elegantemente i duplicati
      await safeAddNode(async () => {
        await db.nodes.add(newNode);
      });
      await refreshGraph();

      // Inseriamo il lavoro IA in coda per evitare blocchi
      enqueue(async () => {
        // 1. Troviamo il significato spaziale (Embedding)
        const embedding = await embed(term);
        if (embedding) {
          await db.nodes.update(term, { embedding });
          
          // 2. Creiamo i collegamenti semantici automatici (Auto-Link)
          await autoLink(term, embedding);
          await refreshGraph(); // Vedrai le linee apparire da sole!
        }

        // 3. Generiamo la definizione in Streaming
        let fullText = "";
        for await (const chunk of streamDefinition(term)) {
          fullText += chunk;
          await db.nodes.update(term, { info: fullText });
          // Effetto live writing se hai il pannello aperto
          if (nodeTitle?.innerText === term) {
              nodeDesc!.innerText = fullText;
          }
        }
      });

    } catch (error: any) {
      if (error.message === 'DUPLICATE') {
        alert(`Il termine "${term}" esiste già nel tuo Secondo Cervello!`);
      } else {
        console.error(error);
      }
    }
  };

  // B. Motore di Ricerca
  const handleSearch = async (term: string) => {
    if (!term) return;
    const nodes = await db.nodes.toArray();
    const fuse = new Fuse(nodes, { keys: ['label'], threshold: 0.3 });
    const results = fuse.search(term);
    
    if (results.length > 0) {
        const targetId = results[0].item.id;
        const graphNodes = graph.graphData().nodes as KGNode[];
        const nodeInGraph = graphNodes.find((n: any) => n.id === targetId);
        if (nodeInGraph) {
            flyToNode(nodeInGraph);
        }
    }
  };

  // C. Collegamento Manuale
  const handleAddLink = async (source: string, target: string) => {
    try {
      const s = await db.nodes.get(source);
      const t = await db.nodes.get(target);
      if (s && t) {
        const newLink: KGLink = {
          id: `${source}->${target}`,
          source, target,
          type: 'custom',
          weight: 0.8,
          origin: 'manual',
          label: 'collegato a'
        };
        await db.links.add(newLink);
        await refreshGraph();
      } else {
        alert("Controlla di aver scritto correttamente i nomi. I nodi devono esistere!");
      }
    } catch (e) { console.error(e); }
  };

  // AVVIAMO L'APP
  initUI(handleAddNode, handleSearch, handleAddLink);
  refreshGraph();
}