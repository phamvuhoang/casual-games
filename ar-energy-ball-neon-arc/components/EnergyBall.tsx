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
  const shockwaveRef = useRef<THREE.Mesh>(null);

  // Generate random rotation axis
  const rotAxis = useMemo(() => new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(), []);
  
  // Memoize particle geometry
  const particleGeo = useMemo(() => {
    const count = 60;
    const positions = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.0 + Math.random();
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
    
    // Default Scale pulse
    let targetScale = data.scale * (1 + Math.sin(state.clock.elapsedTime * 8) * 0.05);
    
    // STATE VISUALS
    if (data.state === 'exploded') {
        targetScale = 4.0; // Rapid expansion
        
        // Fade out
        [coreRef, shellRef, particlesRef, shockwaveRef].forEach(ref => {
            if (ref.current && ref.current.material) {
                const mat = ref.current.material as THREE.Material;
                mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0, delta * 5);
            }
        });

        // Spin violently
        groupRef.current.rotation.y += delta * 10;

    } else if (data.state === 'fizzle') {
        targetScale = 0.01; // Shrink to nothing
        
        // Fade out
        if (coreRef.current) (coreRef.current.material as THREE.Material).opacity *= 0.9;
        if (shellRef.current) (shellRef.current.material as THREE.Material).opacity *= 0.9;
        
        // Drop down
        groupRef.current.position.y -= delta * 1.0;
    } else {
        // Normal state reset
        if (coreRef.current) (coreRef.current.material as THREE.Material).opacity = 1.0;
        if (shellRef.current) (shellRef.current.material as THREE.Material).opacity = 0.4;
        
        // Rotation
        const speed = data.velocity.length();
        const baseSpeed = data.state === 'flying' ? 6.0 : 2.0;
        const rotationSpeed = baseSpeed + speed * 0.8;

        if (coreRef.current) coreRef.current.rotateOnAxis(rotAxis, delta * rotationSpeed);
        if (shellRef.current) shellRef.current.rotateOnAxis(rotAxis, -delta * (rotationSpeed * 0.7));
    }

    // Apply Scale
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), data.state === 'exploded' ? 0.2 : 0.2);

    // Particle Animation
    if (particlesRef.current) {
        particlesRef.current.rotation.y += delta * 0.5;
        // Expand particles slightly if flying fast
        const s = 1 + data.velocity.length() * 0.1;
        particlesRef.current.scale.setScalar(s);
    }
    
    // Shockwave expansion on explosion
    if (data.state === 'exploded' && shockwaveRef.current) {
        shockwaveRef.current.scale.addScalar(delta * 10);
    }

    // Color Logic
    if (coreRef.current) {
        const material = coreRef.current.material as THREE.MeshStandardMaterial;
        // Brighten on high energy or explosion
        let intensity = 2 + data.energy * 3;
        if (data.state === 'exploded') intensity = 15;
        if (data.state === 'fizzle') intensity = 0.5;
        
        material.emissiveIntensity = intensity + Math.sin(state.clock.elapsedTime * 15) * 0.5;
    }
  });

  const color = new THREE.Color(data.color);

  return (
    <group ref={groupRef}>
      {/* Inner Core */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={2}
          toneMapped={false}
          transparent={true}
        />
      </mesh>

      {/* Outer Shell - Wireframe */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[0.35, 2]} />
        <meshBasicMaterial 
          color={color} 
          wireframe 
          transparent 
          opacity={0.4} 
        />
      </mesh>

      {/* Shockwave Ring (Hidden until explode) */}
      <mesh ref={shockwaveRef} scale={[0.1, 0.1, 0.1]}>
        <ringGeometry args={[0.4, 0.5, 32]} />
        <meshBasicMaterial 
            color={color} 
            transparent 
            opacity={data.state === 'exploded' ? 0.8 : 0} 
            side={THREE.DoubleSide}
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

      {/* Particles */}
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial 
          size={0.04} 
          color={color} 
          transparent 
          opacity={0.6}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};