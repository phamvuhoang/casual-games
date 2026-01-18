import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ImpactBurstProps {
  position: THREE.Vector3;
  color: THREE.Color | string;
  intensity: number;
  onDone?: () => void;
}

export const ImpactBurst: React.FC<ImpactBurstProps> = ({ position, color, intensity, onDone }) => {
  const groupRef = useRef<THREE.Group>(null);
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    if (startRef.current === null) {
      startRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - (startRef.current ?? 0);
    const duration = 0.6;
    const t = Math.min(elapsed / duration, 1);
    const scale = 0.4 + t * (0.9 + intensity * 0.4);

    groupRef.current.position.copy(position);
    groupRef.current.scale.setScalar(scale);
    groupRef.current.rotation.y += 0.1;

    if (groupRef.current.children[0]) {
      const material = (groupRef.current.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = (1 - t) * 0.7;
    }

    if (groupRef.current.children[1]) {
      const material = (groupRef.current.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      material.opacity = (1 - t) * 0.35;
    }

    if (t >= 1 && onDone && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <ringGeometry args={[0.2, 0.5, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};
