import * as THREE from 'three';

export interface HandData {
  id: string;
  handedness: 'Left' | 'Right';
  landmarks: any[]; // MediaPipe raw landmarks
  worldPos: THREE.Vector3;
  palmUp: boolean;
  palmForward: boolean;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  pinchStrength: number;
  isPinching: boolean;
}

export interface BallData {
  id: string;
  ownerId: string | null;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  scale: number;
  energy: number; // 0 to 1
  state: 'charging' | 'flying' | 'fizzle';
  heldBy: string | null;
  color: string;
}

export type ScoreEventType = 'catch' | 'throw' | 'impact';

export interface ScoreEvent {
  type: ScoreEventType;
  playerId: string | null;
  targetId?: string | null;
  ballId: string;
  energy: number;
  position: THREE.Vector3;
  timestamp: number;
  points?: number;
  damage?: number;
}

export interface ShieldState {
  active: boolean;
  energy: number;
  durability: number;
  cooldown: number;
}

export type PowerUpType = 'overcharge';

export interface PowerUpData {
  id: string;
  type: PowerUpType;
  position: THREE.Vector3;
  basePosition: THREE.Vector3;
  radius: number;
  spawnTime: number;
  ttl: number;
}

export interface PowerUpState {
  active: boolean;
  type: PowerUpType | null;
  expiresAt: number;
}

export interface FXEvent {
  id: string;
  type: 'throw' | 'impact' | 'shield' | 'hazard' | 'catch';
  position: THREE.Vector3;
  color: string;
  intensity: number;
  timestamp: number;
}

export interface GameState {
  score: number;
  balls: BallData[];
  status: string;
}
