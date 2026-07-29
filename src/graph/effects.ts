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
    new THREE.SphereGeometry(size, 32, 32),
    new THREE.MeshPhysicalMaterial({
      color: node.color || '#ffffff',
      emissive: node.color || '#ffffff',
      emissiveIntensity: dimmed ? 0.03 : 0.22,  // luce interna appena accennata
      roughness: 0.35,
      metalness: 0.0,
      clearcoat: 0.8,           // strato lucido sottile: effetto "vetro smaltato"
      clearcoatRoughness: 0.25,
      sheen: 0.4,               // riflesso morbido tipo ceramica
      sheenColor: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: dimmed ? 0.15 : 1,
    }),
  );

}