import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PowerUpData } from '../types';

interface PowerUpOrbProps {
  data: PowerUpData;
}

export const PowerUpOrb: React.FC<PowerUpOrbProps> = ({ data }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const color = useMemo(() => new THREE.Color('#ffd166'), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    groupRef.current.position.lerp(data.position, 0.25);
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.08;
    groupRef.current.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.2);

    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 1.4;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[0.18, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.28, 0.02, 16, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.32, 20, 20]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};
