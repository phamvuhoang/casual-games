'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  drawSessionOverlay,
  getSessionOverlayLines,
  type VisualizationSessionOverlayData
} from '@/components/audio/visualizationSessionOverlay';

interface ThreeVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  showSessionInfo?: boolean;
  sessionInfo?: VisualizationSessionOverlayData | null;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

function detectLowPower() {
  if (typeof window === 'undefined') {
    return false;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallViewport = window.matchMedia('(max-width: 820px)').matches;
  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  return reducedMotion || smallViewport || lowCores;
}

export default function ThreeVisualizer({
  analyser,
  isActive,
  showSessionInfo = false,
  sessionInfo = null,
  onCanvasReady
}: ThreeVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const coreRef = useRef<THREE.Mesh | null>(null);
  const shellRef = useRef<THREE.Mesh | null>(null);
  const ringRef = useRef<THREE.Mesh | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);

  const smoothedEnergyRef = useRef(0.08);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const starBasePositionsRef = useRef<Float32Array | null>(null);
  const starSeedsRef = useRef<Float32Array | null>(null);

  const isLowPower = useMemo(() => detectLowPower(), []);
  const overlayLines = useMemo(
    () => (sessionInfo ? getSessionOverlayLines(sessionInfo) : []),
    [sessionInfo]
  );

  useEffect(() => {
    analyserRef.current = analyser;
  }, [analyser]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 0, 3.3);

    const renderer = new THREE.WebGLRenderer({ antialias: !isLowPower, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(isLowPower ? Math.min(window.devicePixelRatio || 1, 1.2) : Math.min(window.devicePixelRatio || 1, 1.8));
    containerRef.current.appendChild(renderer.domElement);

    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');

    exportCanvasRef.current = exportCanvas;
    exportCtxRef.current = exportCtx;
    onCanvasReady?.(exportCanvas);

    const baseGeometry = new THREE.IcosahedronGeometry(0.9, isLowPower ? 1 : 2);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#8f7adb'),
      emissive: new THREE.Color('#6a92c2'),
      emissiveIntensity: 0.62,
      roughness: 0.24,
      metalness: 0.14
    });
    const core = new THREE.Mesh(baseGeometry, coreMaterial);

    const shellMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#b9ccc4'),
      wireframe: true,
      transparent: true,
      opacity: 0.28
    });
    const shell = new THREE.Mesh(baseGeometry.clone(), shellMaterial);
    shell.scale.setScalar(1.18);

    const ringGeometry = new THREE.TorusGeometry(1.52, 0.05, isLowPower ? 14 : 22, isLowPower ? 70 : 130);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#c79b73'),
      transparent: true,
      opacity: 0.32
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI * 0.5;

    const starCount = isLowPower ? 220 : 460;
    const starPositions = new Float32Array(starCount * 3);
    const starBase = new Float32Array(starCount * 3);
    const starSeeds = new Float32Array(starCount);

    for (let index = 0; index < starCount; index += 1) {
      const radius = 2.2 + Math.random() * 2.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const cursor = index * 3;
      starPositions[cursor] = x;
      starPositions[cursor + 1] = y;
      starPositions[cursor + 2] = z;

      starBase[cursor] = x;
      starBase[cursor + 1] = y;
      starBase[cursor + 2] = z;
      starSeeds[index] = Math.random();
    }

    starBasePositionsRef.current = starBase;
    starSeedsRef.current = starSeeds;

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMaterial = new THREE.PointsMaterial({
      color: new THREE.Color('#d5dff4'),
      size: isLowPower ? 0.03 : 0.025,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      depthWrite: false
    });

    const stars = new THREE.Points(starGeometry, starMaterial);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const key = new THREE.PointLight(0xaec7ff, 1.2, 8);
    key.position.set(2.1, 1.8, 2.6);
    const fill = new THREE.PointLight(0xc99de5, 1.1, 8);
    fill.position.set(-2.4, -1.4, 2.1);

    scene.add(ambient, key, fill, stars, ring, shell, core);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    coreRef.current = core;
    shellRef.current = shell;
    ringRef.current = ring;
    starsRef.current = stars;

    const resize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) {
        return;
      }

      const { width, height } = containerRef.current.getBoundingClientRect();
      const safeWidth = Math.max(1, Math.round(width));
      const safeHeight = Math.max(1, Math.round(height));

      rendererRef.current.setSize(safeWidth, safeHeight, false);
      cameraRef.current.aspect = safeWidth / safeHeight;
      cameraRef.current.updateProjectionMatrix();

      if (exportCanvasRef.current) {
        exportCanvasRef.current.width = safeWidth;
        exportCanvasRef.current.height = safeHeight;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }

      renderer.dispose();
      renderer.domElement.remove();

      baseGeometry.dispose();
      coreMaterial.dispose();
      shell.geometry.dispose();
      shellMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();

      onCanvasReady?.(null);

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      coreRef.current = null;
      shellRef.current = null;
      ringRef.current = null;
      starsRef.current = null;
      exportCanvasRef.current = null;
      exportCtxRef.current = null;
      starBasePositionsRef.current = null;
      starSeedsRef.current = null;
    };
  }, [isLowPower, onCanvasReady]);

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
      return;
    }

    if (!isActive) {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    const frequencyData = new Uint8Array(512);

    const render = (time: number) => {
      frameRef.current = requestAnimationFrame(render);

      const analyserNode = analyserRef.current;
      let energy = 0.08;
      let bass = 0.08;
      if (analyserNode) {
        analyserNode.getByteFrequencyData(frequencyData);

        const count = frequencyData.length;
        const bassEnd = Math.max(1, Math.floor(count * 0.16));
        let bassTotal = 0;
        let total = 0;

        for (let index = 0; index < count; index += 1) {
          const value = frequencyData[index] / 255;
          total += value;
          if (index < bassEnd) {
            bassTotal += value;
          }
        }

        energy = total / count;
        bass = bassTotal / bassEnd;
      }

      const smoothed = smoothedEnergyRef.current * 0.87 + energy * 0.13;
      smoothedEnergyRef.current = smoothed;

      const core = coreRef.current;
      const shell = shellRef.current;
      const ring = ringRef.current;
      const stars = starsRef.current;
      const camera = cameraRef.current;

      if (core) {
        const pulse = 0.92 + smoothed * 0.58;
        core.scale.setScalar(pulse);
        core.rotation.x += isLowPower ? 0.0022 : 0.0032;
        core.rotation.y += isLowPower ? 0.0035 : 0.0052;

        const material = core.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 0.48 + smoothed * 1.34;
      }

      if (shell) {
        shell.rotation.x -= isLowPower ? 0.0017 : 0.0026;
        shell.rotation.y -= isLowPower ? 0.002 : 0.0031;
        shell.scale.setScalar(1.1 + smoothed * 0.32);
      }

      if (ring) {
        ring.rotation.z += 0.0018 + bass * 0.012;
        ring.rotation.y += 0.0012;
        ring.scale.setScalar(1 + smoothed * 0.3);

        const material = ring.material as THREE.MeshBasicMaterial;
        material.opacity = 0.24 + smoothed * 0.46;
      }

      if (stars && starBasePositionsRef.current && starSeedsRef.current) {
        const base = starBasePositionsRef.current;
        const seeds = starSeedsRef.current;
        const positions = stars.geometry.getAttribute('position') as THREE.BufferAttribute;

        for (let index = 0; index < positions.count; index += 1) {
          const cursor = index * 3;
          const seed = seeds[index];
          const pulse = 1 + Math.sin(time * 0.00028 + seed * 7.4) * (0.03 + smoothed * 0.14);
          const drift = Math.cos(time * 0.0004 + seed * 11.3) * (0.02 + smoothed * 0.08);

          positions.array[cursor] = base[cursor] * pulse + drift;
          positions.array[cursor + 1] = base[cursor + 1] * pulse + drift * 0.8;
          positions.array[cursor + 2] = base[cursor + 2] * pulse;
        }

        positions.needsUpdate = true;
      }

      if (camera) {
        camera.position.x = Math.sin(time * 0.00016) * 0.2;
        camera.position.y = Math.cos(time * 0.00018) * 0.14;
        camera.lookAt(0, 0, 0);
      }

      rendererRef.current?.render(sceneRef.current!, cameraRef.current!);

      const exportCanvas = exportCanvasRef.current;
      const exportCtx = exportCtxRef.current;
      const rendererCanvas = rendererRef.current?.domElement;

      if (exportCanvas && exportCtx && rendererCanvas) {
        exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportCtx.drawImage(rendererCanvas, 0, 0, exportCanvas.width, exportCanvas.height);

        if (showSessionInfo && overlayLines.length > 0) {
          drawSessionOverlay(exportCtx, exportCanvas.width, exportCanvas.height, overlayLines, smoothed);
        }
      }
    };

    frameRef.current = requestAnimationFrame(render);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isActive, isLowPower, overlayLines, showSessionInfo]);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-3xl border border-black/5 bg-black/10 md:h-72">
      <div ref={containerRef} className="h-full w-full" />
      {showSessionInfo && overlayLines.length > 0 ? (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[82%] rounded-2xl border border-white/20 bg-slate-950/52 px-3 py-2 text-[11px] leading-relaxed text-white/90 backdrop-blur-sm">
          {overlayLines.map((line, index) => (
            <p key={`overlay-line-${index}`}>{line}</p>
          ))}
        </div>
      ) : null}
      {isLowPower ? (
        <span className="absolute bottom-2 right-3 rounded-full bg-black/35 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80">
          Low power
        </span>
      ) : null}
    </div>
  );
}
