import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BallData } from '../types';

interface EnergyBallProps {
  data: BallData;
}

export const EnergyBall: React.FC<EnergyBallProps> = ({ data }) => {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Generate random rotation axis
  const rotAxis = useMemo(() => new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(), []);
  
  // Memoize particle geometry for efficiency
  const particleGeo = useMemo(() => {
    const count = 40;
    const positions = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.2 + Math.random() * 0.5;
      positions[i*3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i*3+2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Smooth position update
    groupRef.current.position.lerp(data.position, 0.4);
    
    // Scale animation based on energy
    const targetScale = data.scale * (1 + Math.sin(state.clock.elapsedTime * 8) * 0.05);
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);

    // Rotations
    if (coreRef.current) coreRef.current.rotateOnAxis(rotAxis, delta * 2);
    if (shellRef.current) shellRef.current.rotateOnAxis(rotAxis, -delta);
    if (particlesRef.current) particlesRef.current.rotation.y += delta * 0.5;

    // Color pulsing
    if (coreRef.current) {
        const material = coreRef.current.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 2 + data.energy * 2 + Math.sin(state.clock.elapsedTime * 10) * 0.5;
    }
  });

  const color = new THREE.Color(data.color);

  return (
    <group ref={groupRef}>
      {/* Inner Core - Solid energy */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>

      {/* Outer Shell - Mesh/Grid look */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[0.35, 2]} />
        <meshBasicMaterial 
          color={color} 
          wireframe 
          transparent 
          opacity={0.3} 
        />
      </mesh>

      {/* Glow Halo */}
      <mesh>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.15} 
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Floating Particles */}
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial 
          size={0.03} 
          color={color} 
          transparent 
          opacity={0.6}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};
