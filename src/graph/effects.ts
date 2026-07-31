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

const NODE_CLOUDS: THREE.Points[] = [];   // registro per l'animazione

export function nodeObject(node: KGNode): THREE.Points {
  const baseSize = 4 + Math.min((node.degree ?? 0) * 1.2, 10);
  const COUNT = CLOUD_COUNT;                       // se lagga con 100+ nodi: usa 150
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    const u = Math.random(), v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = baseSize * Math.cbrt(Math.random());
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
      uAlpha: { value: dimmed ? 0.06 : 0.55 },
    },
    vertexShader: `
      attribute float seed;
      uniform float uTime;
      varying float vFade;
      void main() {
        vec3 p = position;
        float breathe = 1.0 + 0.06 * sin(uTime * 0.8 + seed);
        p += normalize(p + 0.0001) * 0.35 * sin(uTime * 1.7 + seed * 7.0);
        p *= breathe;
        vFade = 0.55 + 0.45 * sin(uTime * 1.3 + seed * 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.2 * vFade) * (140.0 / -mv.z);
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

export function tickClouds(time: number): void {
  for (let i = NODE_CLOUDS.length - 1; i >= 0; i--) {
    const c = NODE_CLOUDS[i];
    if (!c.parent) { NODE_CLOUDS.splice(i, 1); continue; }
    (c.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
  }
}
function deviceClass(): 'low'|'mid'|'high' {
      const cores = navigator.hardwareConcurrency ?? 4;
      const touch = matchMedia('(pointer: coarse)').matches;
      if (touch || cores <= 4) return 'low';
      if (cores <= 8) return 'mid';
      return 'high';
    }
    const CLOUD_COUNT = { low: 500, mid: 1200, high: 2200 }[deviceClass()];

