import * as THREE from 'three';

export interface HandData {
  handedness: 'Left' | 'Right';
  landmarks: any[]; // MediaPipe raw landmarks
  worldPos: THREE.Vector3;
  palmUp: boolean;
  velocity: THREE.Vector3;
  isPinching: boolean;
}

export interface BallData {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  scale: number;
  energy: number; // 0 to 1
  state: 'charging' | 'flying' | 'fizzle';
  heldBy: 'Left' | 'Right' | null;
  color: string;
}

export interface GameState {
  score: number;
  balls: BallData[];
  status: string;
}
