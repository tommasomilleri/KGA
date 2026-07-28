import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { KGNode } from '../core/types';

export function createBloom(): UnrealBloomPass {
  const pass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,   // strength
    0.4,   // radius
    0.15,  // threshold
  );
  return pass;
}

export function nodeObject(node: KGNode): THREE.Mesh {
  const size = 4 + Math.min((node.degree ?? 0) * 1.2, 10);
  return new THREE.Mesh(
    new THREE.SphereGeometry(size, 24, 24),
    new THREE.MeshStandardMaterial({
      color: node.color || '#ffffff',
      emissive: node.color || '#ffffff',
      emissiveIntensity: 0.9,
    }),
  );
}