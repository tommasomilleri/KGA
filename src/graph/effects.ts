// src/graph/effects.ts
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Effetto luce selettivo
export function createBloom(): UnrealBloomPass {
  const pass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,   // strength: meno aggressivo, più elegante
    0.4,   // radius
    0.15,  // threshold: SOLO i materiali emissivi brillano, lo spazio resta scuro!
  );
  return pass;
}

// Generatore dei nostri pallini (Sfere 3D)
export function nodeObject(node: any): THREE.Mesh {
  // Se un nodo ha tante connessioni (degree), diventa più grande!
  const size = 4 + Math.min((node.degree ?? 0) * 1.2, 10);

  return new THREE.Mesh(
    new THREE.SphereGeometry(size, 24, 24),
    new THREE.MeshStandardMaterial({
      color: node.color || '#ffffff',
      emissive: node.color || '#ffffff',
      emissiveIntensity: 0.9, // Li rende luminosi per farli "catturare" dal Bloom
    }),
  );
}