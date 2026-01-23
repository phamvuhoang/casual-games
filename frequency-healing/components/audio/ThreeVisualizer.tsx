'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

export default function ThreeVisualizer({ analyser, isActive, onCanvasReady }: ThreeVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const haloRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    analyserRef.current = analyser;
  }, [analyser]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 3.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    containerRef.current.appendChild(renderer.domElement);
    onCanvasReady?.(renderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(0.9, 2);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f7b36a'),
      emissive: new THREE.Color('#2b8c8c'),
      emissiveIntensity: 0.5,
      metalness: 0.2,
      roughness: 0.3
    });
    const mesh = new THREE.Mesh(geometry, material);

    const haloGeometry = new THREE.SphereGeometry(1.1, 32, 32);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#2b8c8c'),
      transparent: true,
      opacity: 0.25
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    const pointLight = new THREE.PointLight(0xffffff, 1, 10);
    pointLight.position.set(2, 2, 3);

    scene.add(ambientLight, pointLight, halo, mesh);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    meshRef.current = mesh;
    haloRef.current = halo;

    const resize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) {
        return;
      }
      const { width, height } = containerRef.current.getBoundingClientRect();
      const safeWidth = width || 1;
      const safeHeight = height || 1;
      rendererRef.current.setSize(safeWidth, safeHeight, false);
      cameraRef.current.aspect = safeWidth / safeHeight;
      cameraRef.current.updateProjectionMatrix();
    };

    resize();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      geometry.dispose();
      material.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      onCanvasReady?.(null);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      meshRef.current = null;
      haloRef.current = null;
    };
  }, []);

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
    const render = () => {
      frameRef.current = requestAnimationFrame(render);

      const analyserNode = analyserRef.current;
      let energy = 0;
      if (analyserNode) {
        analyserNode.getByteFrequencyData(frequencyData);
        energy = frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.length;
      }

      const mesh = meshRef.current;
      const halo = haloRef.current;
      const material = mesh?.material as THREE.MeshStandardMaterial | undefined;

      if (mesh && material) {
        const pulse = 0.85 + (energy / 255) * 0.6;
        mesh.scale.setScalar(pulse);
        mesh.rotation.y += 0.004;
        mesh.rotation.x += 0.0025;
        material.emissiveIntensity = 0.4 + (energy / 255) * 1.4;
      }

      if (halo) {
        const haloScale = 1.1 + (energy / 255) * 0.35;
        halo.scale.setScalar(haloScale);
      }

      rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
    };

    render();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isActive]);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-3xl border border-black/5 bg-black/10 md:h-72">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
