import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BallData } from '../types';

interface EnergyBallTrailProps {
  data: BallData;
}

export const EnergyBallTrail: React.FC<EnergyBallTrailProps> = ({ data }) => {
  const points = useMemo(() => {
    const positions = new Float32Array(24 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { positions, geometry };
  }, []);

  useFrame(() => {
    const { positions } = points;
    for (let i = positions.length - 3; i >= 3; i -= 3) {
      positions[i] = positions[i - 3];
      positions[i + 1] = positions[i - 2];
      positions[i + 2] = positions[i - 1];
    }
    positions[0] = data.position.x;
    positions[1] = data.position.y;
    positions[2] = data.position.z;
    points.geometry.attributes.position.needsUpdate = true;
  });

  const color = new THREE.Color(data.color);

  return (
    <line geometry={points.geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.4} />
    </line>
  );
};
