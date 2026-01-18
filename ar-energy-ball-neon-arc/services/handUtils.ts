import * as THREE from 'three';

// Approximate arena dimensions in 3D space
const ARENA_W = 4.0;
const ARENA_H = 3.0;
const ARENA_D = 5.0;

export const toWorld = (landmark: { x: number; y: number; z: number }, aspect: number): THREE.Vector3 => {
  // Center is 0.5, 0.5. Flip X for mirror effect.
  const x = (0.5 - landmark.x) * ARENA_W * aspect; 
  const y = -(landmark.y - 0.5) * ARENA_H;
  // Z estimation from MediaPipe is relative, we project it slightly forward
  const z = -landmark.z * 2.0; 
  return new THREE.Vector3(x, y, z);
};

export const getPalmCenter = (landmarks: any[]): { x: number; y: number; z: number } => {
  const indices = [0, 5, 9, 13, 17];
  let x = 0, y = 0, z = 0;
  indices.forEach((i) => {
    x += landmarks[i].x;
    y += landmarks[i].y;
    z += landmarks[i].z;
  });
  const n = indices.length;
  return { x: x / n, y: y / n, z: z / n };
};

export const isPalmUp = (landmarks: any[]): boolean => {
  const wrist = landmarks[0];
  const middleTip = landmarks[12];
  const pinkyTip = landmarks[20];
  
  // Hand is upright (fingers above wrist)
  const isUpright = middleTip.y < wrist.y; 
  
  // Simple heuristic: if pinky x is "outside" relative to wrist, it might be palm up/open
  // Better heuristic: Check z-depth order or use specific landmark geometry.
  // For webcams, simple geometry checks are robust:
  // Palm center (calc from knuckles) should be close to wrist Z, but tips should not be curled in.
  
  return isUpright;
};

export const detectFlick = (velocity: THREE.Vector3): boolean => {
  return velocity.z < -2.5 && velocity.length() > 3.0; // Fast movement away from camera
};
