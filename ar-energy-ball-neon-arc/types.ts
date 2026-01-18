import * as THREE from 'three';

export interface HandData {
  id: string; // Unique identifier for the hand (e.g., 'Right-0')
  handedness: 'Left' | 'Right';
  landmarks: any[]; // MediaPipe raw landmarks
  worldPos: THREE.Vector3;
  palmUp: boolean;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  isPinching: boolean;
}

export interface BallData {
  id: string;
  ownerId?: string; // ID of the hand that last threw the ball
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  scale: number;
  energy: number; // 0 to 1
  state: 'charging' | 'flying' | 'fizzle' | 'exploded';
  heldBy: string | null; // Stores HandData.id
  color: string;
  spawnTime: number; // For cooldowns
}

export interface GameState {
  score: number;
  balls: BallData[];
  status: string;
}