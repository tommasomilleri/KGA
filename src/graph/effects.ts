import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { KGNode } from '../core/types';
import { highlight } from './highlight';

export function createBloom(): UnrealBloomPass {
  const pass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35,   // strength
    0.25,   // radius
    0.55,  // threshold
  );
  return pass;
}
export function nodeObject(node: KGNode): THREE.Mesh {
  const size = 4 + Math.min((node.degree ?? 0) * 1.2, 10);
  const dimmed =
    (highlight.hoverId && !highlight.neighbors.has(node.id)) ||
    (highlight.focusId && !highlight.focusVisible.has(node.id));
  return new THREE.Mesh(
    new THREE.SphereGeometry(size, 24, 24),
    new THREE.MeshStandardMaterial({
      color: node.color || '#ffffff',
      emissive: node.color || '#ffffff',
      emissiveIntensity: dimmed ? 0.04 : 0.45,
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
      opacity: dimmed ? 0.15 : 1,
    }),
  );
}