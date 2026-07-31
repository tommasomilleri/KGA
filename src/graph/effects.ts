

import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { KGNode } from '../core/types';
import { highlight } from './highlight';

export function createBloom(): UnrealBloomPass {
  const pass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35,   // strength
    0.25,   // radius
    0.55,   // threshold
  );
  return pass;
}

// ============ NUVOLE DI PUNTI ============

// registro per id: la nuvola si crea UNA volta sola per nodo
// (SOSTITUISCE il vecchio array NODE_CLOUDS: eliminalo)
const CLOUD_BY_ID = new Map<string, THREE.Points>();

// seed deterministico: stesso nodo = stessa nuvola
function hashString(s: string): number {
  let h = 1779033703;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isDimmed(id: string): boolean {
  return Boolean(
    (highlight.hoverId && !highlight.neighbors.has(id)) ||
    (highlight.focusId && !highlight.focusVisible.has(id)),
  );
}

export function nodeObject(node: KGNode): THREE.Points {
  const CLOUD_COUNT = { low: 1500, mid: 3000, high: 5000 }[deviceClass()];

export function nodeObject(node: KGNode): THREE.Points {
  const baseSize = 4 + Math.min((node.degree ?? 0) * 1.2, 10);
  const COUNT = CLOUD_COUNT;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    // SUPERFICIE: raggio quasi fisso, solo un velo di spessore (±6%)
    const r = baseSize * (0.94 + Math.random() * 0.12);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    seeds[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));

  const dimmed =
    (highlight.hoverId && !highlight.neighbors.has(node.id)) ||
    (highlight.focusId && !highlight.focusVisible.has(node.id));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime:  { value: 0 },
      uColor: { value: new THREE.Color(node.color || '#ffffff') },
      uAlpha: { value: dimmed ? 0.05 : 0.5 },
    },
    vertexShader: `
      attribute float seed;
      uniform float uTime;
      varying float vFade;

      void main() {
        vec3 dir = normalize(position);

        // INCRESPATURA AMORFA: 3 onde direzionali sfasate che deformano
        // il raggio lungo la superficie (lobi lenti che si muovono)
        float ripple =
            0.10 * sin(uTime * 0.7  + dot(dir, vec3( 3.1,  1.7, 2.3)) * 2.0)
          + 0.07 * sin(uTime * 1.1  + dot(dir, vec3(-2.2,  3.4, 1.1)) * 3.0)
          + 0.05 * sin(uTime * 1.7  + dot(dir, vec3( 1.4, -2.8, 3.7)) * 5.0);

        // micro-brulichio individuale dei punti lungo la normale
        float shimmer = 0.02 * sin(uTime * 2.0 + seed * 11.0);

        vec3 p = position * (1.0 + ripple + shimmer);

        vFade = 0.65 + 0.35 * sin(uTime * 1.3 + seed * 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = max(1.5, (1.6 * vFade) * (160.0 / -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uAlpha;
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float soft = smoothstep(0.5, 0.1, d);
        gl_FragColor = vec4(uColor, uAlpha * soft * vFade);
      }`,
  });

  const cloud = new THREE.Points(geo, mat);
  NODE_CLOUDS.push(cloud);
  return cloud;
}
export function setCloudDim(id: string, dimmed: boolean): void {
  const c = CLOUD_BY_ID.get(id);
  if (c) (c.material as THREE.ShaderMaterial).uniforms.uAlpha.value = dimmed ? 0.06 : 0.55;
}

export function refreshCloudDim(): void {
  CLOUD_BY_ID.forEach((_, id) => setCloudDim(id, isDimmed(id)));
}

export function invalidateCloud(id: string): void { CLOUD_BY_ID.delete(id); }
export function clearClouds(): void { CLOUD_BY_ID.clear(); }

export function tickClouds(time: number): void {
  CLOUD_BY_ID.forEach((c, id) => {
    if (!c.parent) { CLOUD_BY_ID.delete(id); return; }   // nodo rimosso dalla scena
    (c.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
  });
}