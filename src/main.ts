import './style.css';
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { db } from './db';
import { initUI } from './ui';

const container = document.getElementById('app');

if (container) {
  // 1. Inizializziamo il Grafo
  const graph = ForceGraph3D()(container)
    .backgroundColor('#050510')
    .nodeRelSize(6)
    .nodeOpacity(1) // Opacità al massimo per la luce
    .nodeLabel('label')
    .nodeColor('color')
    .linkColor(() => 'rgba(255,255,255,0.15)');

  // 2. Effetto Post-Processing: BLOOM (Luce Neon)
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.strength = 2.0; // Intensità della luce
  bloomPass.radius = 0.5;   // Ampiezza del bagliore
  bloomPass.threshold = 0;  // Fa brillare tutti gli oggetti
  graph.postProcessingComposer().addPass(bloomPass);

  // 3. Interazione: Volo della telecamera e Pannello
  const infoPanel = document.getElementById('info-panel');
  const nodeTitle = document.getElementById('node-title');
  const nodeDesc = document.getElementById('node-description');
  const closeBtn = document.getElementById('close-btn');

  graph.onNodeClick((node: any) => {
    // Calcola la distanza per il volo
    const distance = 40;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
    
    // Anima la telecamera verso il nodo in 1.5 secondi
    graph.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      node, // Guarda verso il nodo
      1500  // ms di animazione
    );

    // Aggiorna e apri il pannello HTML
    if (nodeTitle && nodeDesc && infoPanel) {
        nodeTitle.innerText = node.label;
        nodeDesc.innerText = node.info || "Nessuna informazione disponibile...";
        infoPanel.classList.add('visible');
    }
  });

  // Chiudi il pannello con la X
  if (closeBtn && infoPanel) {
    closeBtn.addEventListener('click', () => {
        infoPanel.classList.remove('visible');
    });
  }

  // 4. Logica del Database
  const refreshGraph = async () => {
    const nodes = await db.nodes.toArray();
    const links = await db.links.toArray();
    graph.graphData({ nodes, links });
  };

  const handleAddNode = async (term: string) => {
    const palette = ["#FCE676", "#7AA2C6", "#564B7A", "#426788", "#e24a4a", "#4ae28a"];
    const randomColor = palette[Math.floor(Math.random() * palette.length)];

    try {
      await db.nodes.add({
        id: term,
        label: term,
        info: "In attesa di definizione AI...",
        color: randomColor
      });
      await refreshGraph();
    } catch (error) {
      alert(`Il termine "${term}" esiste già nel tuo grafo!`);
    }
  };

  initUI(handleAddNode);
  refreshGraph();
}