'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  drawBreathGuideOverlay,
  drawSomaticTraceOverlay,
  type BreathGuideOverlayData,
  type SomaticTraceOverlayData
} from '@/components/audio/visualizationSessionOverlay';
import { cn } from '@/lib/utils/helpers';

type LivingMirrorMode = 'breath' | 'somatic';

interface LivingMirrorFieldProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  mode: LivingMirrorMode;
  breathGuide?: BreathGuideOverlayData | null;
  somaticOverlay?: SomaticTraceOverlayData | null;
  tracePreview?: SomaticTraceOverlayData | null;
  className?: string;
}

const VERTEX_SHADER = `
precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform float uTime;
uniform float uEnergy;
uniform float uBass;
uniform float uModeBlend;
uniform float uBreathPhase;
uniform float uBreathProgress;
uniform float uBreathCoherence;
uniform float uSomaticTension;
uniform float uSomaticCoherence;
uniform float uSomaticProgress;

attribute vec3 position;
attribute vec3 offset;
attribute vec4 color;
attribute float seed;

varying vec4 vColor;
varying float vGlow;

void main() {
  float inhalePulse = mix(uBreathProgress, 1.0 - uBreathProgress, step(0.5, uBreathPhase));
  float modePulse = mix(inhalePulse, uSomaticProgress, uModeBlend);
  float localWave = sin(uTime * 0.0018 + seed * 14.0) * 0.5 + 0.5;

  float baseScale = 0.28 + localWave * 0.22;
  float scale = baseScale + modePulse * 0.56 + uEnergy * 0.42;

  vec3 modelOffset = offset;
  modelOffset.xy += vec2(
    sin(uTime * 0.0008 + seed * 19.0),
    cos(uTime * 0.0009 + seed * 17.0)
  ) * (0.02 + uEnergy * 0.08 + uModeBlend * 0.05);

  modelOffset.z += sin(uTime * 0.0011 + seed * 11.0) * (0.04 + uSomaticTension * 0.11);

  vec3 finalPos = modelOffset + position * scale;

  vColor = color;
  vGlow = clamp(scale, 0.05, 2.0);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform float uModeBlend;
uniform float uSomaticTension;
uniform float uBreathCoherence;

varying vec4 vColor;
varying float vGlow;

void main() {
  float pulse = 0.5 + 0.5 * sin(uTime * 0.004 + vGlow * 7.5);
  vec3 breathTint = vec3(0.70, 0.94, 0.92);
  vec3 somaticTint = vec3(0.86, 0.95, 1.00);
  vec3 tint = mix(breathTint, somaticTint, uModeBlend);

  float alpha = clamp((0.18 + pulse * 0.55 + vGlow * 0.08) * (0.7 + uBreathCoherence * 0.25 + uSomaticTension * 0.25), 0.04, 0.96);

  gl_FragColor = vec4(vColor.rgb * tint, alpha);
}
`;

interface InstancingBuffers {
  baseOffsets: Float32Array;
  liveOffsets: Float32Array;
  seeds: Float32Array;
  mesh: THREE.Mesh;
  offsetAttribute: THREE.InstancedBufferAttribute;
  uniforms: {
    uTime: { value: number };
    uEnergy: { value: number };
    uBass: { value: number };
    uModeBlend: { value: number };
    uBreathPhase: { value: number };
    uBreathProgress: { value: number };
    uBreathCoherence: { value: number };
    uSomaticTension: { value: number };
    uSomaticCoherence: { value: number };
    uSomaticProgress: { value: number };
  };
}

function clampValue(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function detectLowPower() {
  if (typeof window === 'undefined') {
    return false;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallViewport = window.matchMedia('(max-width: 960px)').matches;
  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  return reducedMotion || smallViewport || lowCores;
}

function toWorldX(x: number) {
  return (x - 0.5) * 2.4;
}

function toWorldY(y: number) {
  return (0.5 - y) * 1.6;
}

export default function LivingMirrorField({
  analyser,
  isActive,
  mode,
  breathGuide = null,
  somaticOverlay = null,
  tracePreview = null,
  className
}: LivingMirrorFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const frameRef = useRef<number | null>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const instancingRef = useRef<InstancingBuffers | null>(null);

  const analyserRef = useRef<AnalyserNode | null>(analyser);
  const modeRef = useRef<LivingMirrorMode>(mode);
  const breathGuideRef = useRef<BreathGuideOverlayData | null>(breathGuide);
  const somaticRef = useRef<SomaticTraceOverlayData | null>(somaticOverlay);
  const tracePreviewRef = useRef<SomaticTraceOverlayData | null>(tracePreview);
  const isActiveRef = useRef<boolean>(isActive);
  const isLowPower = useMemo(() => detectLowPower(), []);

  const smoothedEnergyRef = useRef(0.08);
  const smoothedBassRef = useRef(0.08);

  useEffect(() => {
    analyserRef.current = analyser;
  }, [analyser]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    breathGuideRef.current = breathGuide;
  }, [breathGuide]);

  useEffect(() => {
    somaticRef.current = somaticOverlay;
  }, [somaticOverlay]);

  useEffect(() => {
    tracePreviewRef.current = tracePreview;
  }, [tracePreview]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) {
      return;
    }

    const instanceCount = isLowPower ? 3200 : 7600;
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isLowPower,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(isLowPower ? Math.min(window.devicePixelRatio || 1, 1.2) : Math.min(window.devicePixelRatio || 1, 1.8));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 14);
    camera.position.set(0, 0, 3.65);

    const positions = new Float32Array([
      0.024, -0.022, 0,
      -0.022, 0.024, 0,
      0, 0, 0.03
    ]);

    const baseOffsets = new Float32Array(instanceCount * 3);
    const liveOffsets = new Float32Array(instanceCount * 3);
    const colors = new Float32Array(instanceCount * 4);
    const seeds = new Float32Array(instanceCount);

    for (let index = 0; index < instanceCount; index += 1) {
      const radius = 0.24 + Math.random() * 1.35;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi) * 0.72;

      const cursor = index * 3;
      baseOffsets[cursor] = x;
      baseOffsets[cursor + 1] = y;
      baseOffsets[cursor + 2] = z;

      liveOffsets[cursor] = x;
      liveOffsets[cursor + 1] = y;
      liveOffsets[cursor + 2] = z;

      const colorCursor = index * 4;
      const hueJitter = Math.random() * 0.18;
      colors[colorCursor] = 0.6 + hueJitter;
      colors[colorCursor + 1] = 0.74 + Math.random() * 0.2;
      colors[colorCursor + 2] = 0.88 + Math.random() * 0.1;
      colors[colorCursor + 3] = 0.45 + Math.random() * 0.45;

      seeds[index] = Math.random();
    }

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.instanceCount = instanceCount;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const offsetAttribute = new THREE.InstancedBufferAttribute(liveOffsets, 3);
    geometry.setAttribute('offset', offsetAttribute);
    geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 4));
    geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 1));

    const uniforms = {
      uTime: { value: 0 },
      uEnergy: { value: 0.08 },
      uBass: { value: 0.08 },
      uModeBlend: { value: modeRef.current === 'somatic' ? 1 : 0 },
      uBreathPhase: { value: 0 },
      uBreathProgress: { value: 0.5 },
      uBreathCoherence: { value: 0.62 },
      uSomaticTension: { value: 0.24 },
      uSomaticCoherence: { value: 0.74 },
      uSomaticProgress: { value: 0 }
    };

    const material = new THREE.RawShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    host.appendChild(renderer.domElement);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    instancingRef.current = {
      baseOffsets,
      liveOffsets,
      seeds,
      mesh,
      offsetAttribute,
      uniforms
    };

    const resize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));

      rendererRef.current.setSize(width, height, false);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();

      const overlayCanvas = overlayCanvasRef.current;
      if (overlayCanvas) {
        const ratio = isLowPower ? 1 : Math.min(window.devicePixelRatio || 1, 1.6);
        overlayCanvas.width = Math.max(1, Math.floor(width * ratio));
        overlayCanvas.height = Math.max(1, Math.floor(height * ratio));
        const overlayCtx = overlayCtxRef.current;
        if (overlayCtx) {
          overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
          overlayCtx.scale(ratio, ratio);
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const frequencyData = new Uint8Array(1024);

    const render = (time: number) => {
      frameRef.current = requestAnimationFrame(render);

      const node = analyserRef.current;
      let targetEnergy = 0.08;
      let targetBass = 0.08;

      if (node && isActiveRef.current) {
        const requiredLength = node.frequencyBinCount;
        if (frequencyData.length >= requiredLength) {
          node.getByteFrequencyData(frequencyData.subarray(0, requiredLength));
          let total = 0;
          let bassTotal = 0;
          const bassEnd = Math.max(1, Math.floor(requiredLength * 0.14));

          for (let index = 0; index < requiredLength; index += 1) {
            const value = frequencyData[index] / 255;
            total += value;
            if (index < bassEnd) {
              bassTotal += value;
            }
          }

          targetEnergy = total / requiredLength;
          targetBass = bassTotal / bassEnd;
        }
      } else {
        targetEnergy = 0.08 + Math.sin(time * 0.00038) * 0.03;
        targetBass = 0.09 + Math.cos(time * 0.00032) * 0.03;
      }

      const smoothedEnergy = smoothedEnergyRef.current * 0.88 + targetEnergy * 0.12;
      const smoothedBass = smoothedBassRef.current * 0.86 + targetBass * 0.14;
      smoothedEnergyRef.current = smoothedEnergy;
      smoothedBassRef.current = smoothedBass;

      const instancing = instancingRef.current;
      const cameraNode = cameraRef.current;
      const rendererNode = rendererRef.current;
      const sceneNode = sceneRef.current;

      if (!instancing || !cameraNode || !rendererNode || !sceneNode) {
        return;
      }

      const activeSomatic = somaticRef.current ?? tracePreviewRef.current;
      const activeBreath = breathGuideRef.current;
      const modeTarget = modeRef.current === 'somatic' ? 1 : 0;

      instancing.uniforms.uModeBlend.value += (modeTarget - instancing.uniforms.uModeBlend.value) * 0.08;
      instancing.uniforms.uTime.value = time;
      instancing.uniforms.uEnergy.value = smoothedEnergy;
      instancing.uniforms.uBass.value = smoothedBass;
      instancing.uniforms.uBreathPhase.value = activeBreath?.phase === 'exhale' ? 1 : 0;
      instancing.uniforms.uBreathProgress.value = activeBreath?.phaseProgress ?? (0.5 + Math.sin(time * 0.00045) * 0.5);
      instancing.uniforms.uBreathCoherence.value = activeBreath?.coherenceScore ?? 0.62;
      instancing.uniforms.uSomaticTension.value = activeSomatic?.tension ?? 0.22;
      instancing.uniforms.uSomaticCoherence.value = activeSomatic?.coherence ?? 0.76;
      instancing.uniforms.uSomaticProgress.value = activeSomatic?.overallProgress ?? 0;

      const modeBlend = instancing.uniforms.uModeBlend.value;
      const liveOffsets = instancing.liveOffsets;
      const baseOffsets = instancing.baseOffsets;
      const seeds = instancing.seeds;
      const points = activeSomatic?.points ?? [];

      if (modeBlend > 0.08 && points.length > 1) {
        const traceInfluence = clampValue(
          0.1,
          (0.2 + (activeSomatic?.tension ?? 0.2) * 0.5 + (1 - (activeSomatic?.phaseProgress ?? 0)) * 0.22) * modeBlend,
          0.92
        );

        for (let index = 0; index < seeds.length; index += 1) {
          const cursor = index * 3;
          const seed = seeds[index];
          const baseX = baseOffsets[cursor];
          const baseY = baseOffsets[cursor + 1];
          const baseZ = baseOffsets[cursor + 2];

          const point = points[Math.floor((index / seeds.length) * points.length)] ?? points[points.length - 1];
          const targetX = toWorldX(point.x) * (0.48 + point.energy * 0.95);
          const targetY = toWorldY(point.y) * (0.56 + point.energy * 0.88);
          const targetZ = (point.energy - 0.5) * 1.3;

          const swirlX = Math.sin(time * 0.001 + seed * 18.0) * (0.05 + (activeSomatic?.tension ?? 0.2) * 0.16);
          const swirlY = Math.cos(time * 0.0012 + seed * 16.0) * (0.05 + point.energy * 0.15);

          liveOffsets[cursor] = baseX * (1 - traceInfluence) + (targetX + swirlX) * traceInfluence;
          liveOffsets[cursor + 1] = baseY * (1 - traceInfluence) + (targetY + swirlY) * traceInfluence;
          liveOffsets[cursor + 2] = baseZ * (1 - traceInfluence) + targetZ * traceInfluence;
        }
      } else {
        const breathProgress = activeBreath?.phaseProgress ?? (0.5 + Math.sin(time * 0.00045) * 0.5);
        const breathArc = activeBreath?.phase === 'exhale' ? 1 - breathProgress : breathProgress;
        const spread = 1 + breathArc * 0.28 + smoothedEnergy * 0.24;

        for (let index = 0; index < seeds.length; index += 1) {
          const cursor = index * 3;
          const seed = seeds[index];
          const driftX = Math.sin(time * 0.0009 + seed * 22.0) * (0.03 + smoothedEnergy * 0.08);
          const driftY = Math.cos(time * 0.00085 + seed * 20.0) * (0.03 + smoothedBass * 0.09);
          const driftZ = Math.sin(time * 0.001 + seed * 14.0) * (0.015 + smoothedEnergy * 0.03);

          liveOffsets[cursor] = baseOffsets[cursor] * spread + driftX;
          liveOffsets[cursor + 1] = baseOffsets[cursor + 1] * spread + driftY;
          liveOffsets[cursor + 2] = baseOffsets[cursor + 2] * spread + driftZ;
        }
      }

      instancing.offsetAttribute.needsUpdate = true;

      instancing.mesh.rotation.y += 0.0009 + smoothedBass * 0.008 + modeBlend * 0.0016;
      instancing.mesh.rotation.x = Math.sin(time * 0.00022) * 0.12;

      cameraNode.position.x = Math.sin(time * 0.00017) * 0.14;
      cameraNode.position.y = Math.cos(time * 0.00015) * 0.1;
      cameraNode.lookAt(0, 0, 0);

      rendererNode.render(sceneNode, cameraNode);

      const overlayCtx = overlayCtxRef.current;
      const overlayCanvas = overlayCanvasRef.current;

      if (overlayCtx && overlayCanvas) {
        const width = overlayCanvas.getBoundingClientRect().width;
        const height = overlayCanvas.getBoundingClientRect().height;
        overlayCtx.clearRect(0, 0, width, height);

        if (activeBreath && modeBlend < 0.95) {
          drawBreathGuideOverlay(overlayCtx, width, height, activeBreath);
        }

        if (activeSomatic) {
          drawSomaticTraceOverlay(overlayCtx, width, height, activeSomatic, time);
        }
      }
    };

    frameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      if (instancingRef.current) {
        instancingRef.current.mesh.geometry.dispose();
        const materialNode = instancingRef.current.mesh.material;
        if (materialNode instanceof THREE.Material) {
          materialNode.dispose();
        }
      }

      renderer.dispose();
      renderer.domElement.remove();

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      instancingRef.current = null;
    };
  }, [isLowPower]);

  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) {
      return;
    }

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) {
      return;
    }

    overlayCtxRef.current = ctx;
  }, []);

  return (
    <div className={cn('relative h-[54vh] min-h-[340px] overflow-hidden rounded-3xl border border-white/25 bg-black/12 md:h-[58vh]', className)}>
      <div ref={containerRef} className="h-full w-full" />
      <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {isLowPower ? (
        <span className="absolute bottom-2 right-3 rounded-full bg-black/35 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/82">
          Lightweight
        </span>
      ) : null}
    </div>
  );
}

export type { LivingMirrorMode };
