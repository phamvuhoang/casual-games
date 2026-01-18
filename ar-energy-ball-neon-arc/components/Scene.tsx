import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { BallData, HandData, ScoreEvent, ShieldState, PowerUpData, PowerUpState, FXEvent } from '../types';
import { EnergyBall } from './EnergyBall';
import { PowerUpOrb } from './PowerUpOrb';
import { ImpactBurst } from './ImpactBurst';
import { v4 as uuidv4 } from 'uuid';

interface SceneContentProps {
  hands: HandData[];
  setScore: (cb: (s: number) => number) => void;
  setBallsCount: (n: number) => void;
  setStatus: (s: string) => void;
  playerId?: string | null;
  localTeamId?: string | null;
  friendlyFire?: boolean;
  matchActive?: boolean;
  targets?: HitTarget[];
  onScoreEvent?: (event: ScoreEvent) => void;
  onShieldState?: (state: ShieldState) => void;
  onPowerUpState?: (state: PowerUpState) => void;
  qualityTier?: 'high' | 'balanced' | 'low';
  effectsEnabled?: boolean;
  audioEnabled?: boolean;
}

type HitTarget = {
  playerId: string;
  handId?: string;
  teamId?: string | null;
  position: THREE.Vector3;
  radius: number;
};

type ShieldRuntime = ShieldState & {
  center: THREE.Vector3;
  radius: number;
};

type HazardPhase = 'cooldown' | 'telegraph' | 'active';

type HazardRuntime = {
  phase: HazardPhase;
  timer: number;
  index: number;
  position: THREE.Vector3;
  radius: number;
};

const BALL_COLORS = ['#00ffff', '#ff00ff', '#00ff00', '#ffff00'];
const SHIELD_ENERGY_DRAIN = 0.18;
const SHIELD_ENERGY_REGEN = 0.12;
const SHIELD_COOLDOWN_TIME = 2.5;
const SHIELD_REPAIR_TIME = 3.5;
const SHIELD_MAX_DURABILITY = 100;
const HAZARD_POSITIONS = [
  new THREE.Vector3(-2.2, -0.6, -5.5),
  new THREE.Vector3(1.8, -0.4, -6.5),
  new THREE.Vector3(0.2, -0.2, -4.8)
];
const HAZARD_RADIUS = 0.95;
const HAZARD_COOLDOWN = 4.5;
const HAZARD_TELEGRAPH = 1.1;
const HAZARD_ACTIVE = 1.4;
const HAZARD_FORCE = 2.6;
const POWER_UP_TTL = 10;
const POWER_UP_SPAWN_MIN = 6;
const POWER_UP_SPAWN_MAX = 12;
const POWER_UP_PICKUP_RADIUS = 0.7;
const POWER_UP_BUFF_DURATION = 6;
const POWER_UP_CHARGE_MULTIPLIER = 1.6;
const POWER_UP_THROW_BONUS = 0.15;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const GameLogic: React.FC<SceneContentProps> = ({
  hands,
  setScore,
  setBallsCount,
  setStatus,
  playerId,
  localTeamId,
  friendlyFire = false,
  matchActive = true,
  targets = [],
  onScoreEvent,
  onShieldState,
  onPowerUpState,
  qualityTier = 'high',
  effectsEnabled = true,
  audioEnabled = true
}) => {
  const [balls, setBalls] = useState<BallData[]>([]);
  const ballsRef = useRef<BallData[]>([]); // Ref for physics loop to avoid re-renders
  const lastSpawnTime = useRef<number>(0);
  const shieldRef = useRef<ShieldRuntime>({
    active: false,
    energy: 1,
    durability: SHIELD_MAX_DURABILITY,
    cooldown: 0,
    center: new THREE.Vector3(0, 0, 0),
    radius: 0.9
  });
  const shieldMeshRef = useRef<THREE.Mesh>(null);
  const shieldGlowRef = useRef<THREE.Mesh>(null);
  const shieldHitRef = useRef<Map<string, number>>(new Map());
  const lastShieldEmitRef = useRef<number>(0);
  const lastShieldSnapshotRef = useRef<ShieldState>({
    active: false,
    energy: 1,
    durability: SHIELD_MAX_DURABILITY,
    cooldown: 0
  });
  const audioRef = useRef<AudioContext | null>(null);
  const lastSoundAtRef = useRef<number>(0);
  const hazardRef = useRef<HazardRuntime>({
    phase: 'cooldown',
    timer: HAZARD_COOLDOWN,
    index: 0,
    position: HAZARD_POSITIONS[0].clone(),
    radius: HAZARD_RADIUS
  });
  const hazardRingRef = useRef<THREE.Mesh>(null);
  const hazardCoreRef = useRef<THREE.Mesh>(null);
  const hazardHitRef = useRef<Map<string, number>>(new Map());
  const [powerUps, setPowerUps] = useState<PowerUpData[]>([]);
  const [fxEvents, setFxEvents] = useState<FXEvent[]>([]);
  const fxEventsRef = useRef<FXEvent[]>([]);
  const powerUpsRef = useRef<PowerUpData[]>([]);
  const nextPowerUpAtRef = useRef<number>(3);
  const powerUpStateRef = useRef<PowerUpState>({
    active: false,
    type: null,
    expiresAt: 0
  });
  const lastPowerUpEmitRef = useRef<number>(0);
  const lastPowerUpSnapshotRef = useRef<PowerUpState>({
    active: false,
    type: null,
    expiresAt: 0
  });

  // Helper for haptics
  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const emitScoreEvent = (event: ScoreEvent) => {
    if (onScoreEvent) {
      onScoreEvent(event);
    }
  };

  const playFxSound = (type: FXEvent['type'], intensity: number) => {
    if (!audioEnabled) {
      return;
    }

    const audio = audioRef.current;
    if (!audio || audio.state !== 'running') {
      return;
    }

    const now = audio.currentTime;
    if (now - lastSoundAtRef.current < 0.04) {
      return;
    }
    lastSoundAtRef.current = now;

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'triangle';

    let baseFreq = 180;
    switch (type) {
      case 'throw':
        baseFreq = 260;
        break;
      case 'impact':
        baseFreq = 140;
        break;
      case 'shield':
        baseFreq = 220;
        break;
      case 'hazard':
        baseFreq = 120;
        break;
      case 'catch':
        baseFreq = 200;
        break;
      default:
        baseFreq = 180;
    }

    oscillator.frequency.value = baseFreq + intensity * 220;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.05 + intensity * 0.06, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.22);
  };

  const enqueueFx = (event: Omit<FXEvent, 'id' | 'timestamp'>, timestamp: number) => {
    const entry: FXEvent = {
      ...event,
      id: uuidv4(),
      timestamp
    };
    fxEventsRef.current = [...fxEventsRef.current, entry];
    setFxEvents(fxEventsRef.current);
    playFxSound(event.type, event.intensity);
  };

  useEffect(() => {
    if (!audioEnabled) {
      if (audioRef.current && audioRef.current.state !== 'closed') {
        audioRef.current.suspend();
      }
    }
  }, [audioEnabled]);

  useEffect(() => {
    const handlePointer = () => {
      if (!audioEnabled) {
        return;
      }
      if (audioRef.current) {
        if (audioRef.current.state === 'suspended') {
          audioRef.current.resume();
        }
        return;
      }

      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      audioRef.current = new AudioContextClass();
    };

    window.addEventListener('pointerdown', handlePointer);
    return () => window.removeEventListener('pointerdown', handlePointer);
  }, [audioEnabled]);

  // Sync state for rendering
  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    let activeBalls = [...ballsRef.current];
    let needsUpdate = false;
    let powerUpNeedsUpdate = false;
    const shieldRuntime = shieldRef.current;
    let shieldEnergy = shieldRuntime.energy;
    let shieldDurability = shieldRuntime.durability;
    let shieldCooldown = shieldRuntime.cooldown;
    let shieldActive = shieldRuntime.active;
    let shieldRadius = shieldRuntime.radius;
    const shieldCenter = shieldRuntime.center;
    let activePowerUps = [...powerUpsRef.current];
    let powerUpState = powerUpStateRef.current;
    let powerUpActive = powerUpState.active && powerUpState.expiresAt > now;
    let chargeMultiplier = powerUpActive && powerUpState.type === 'overcharge' ? POWER_UP_CHARGE_MULTIPLIER : 1;
    const matchLive = matchActive;
    const hazardRuntime = hazardRef.current;
    let hazardPhase = hazardRuntime.phase;
    let hazardTimer = hazardRuntime.timer;
    if (matchLive) {
      hazardTimer = hazardRuntime.timer - delta;
      if (hazardTimer <= 0) {
        if (hazardPhase === 'cooldown') {
          hazardPhase = 'telegraph';
          hazardTimer = HAZARD_TELEGRAPH;
        } else if (hazardPhase === 'telegraph') {
          hazardPhase = 'active';
          hazardTimer = HAZARD_ACTIVE;
        } else {
          hazardPhase = 'cooldown';
          hazardTimer = HAZARD_COOLDOWN;
          hazardRuntime.index = (hazardRuntime.index + 1) % HAZARD_POSITIONS.length;
          hazardRuntime.position.copy(HAZARD_POSITIONS[hazardRuntime.index]);
        }
      }
    } else {
      hazardPhase = 'cooldown';
      hazardTimer = HAZARD_COOLDOWN;
    }
    hazardRuntime.phase = hazardPhase;
    hazardRuntime.timer = hazardTimer;
    const hazardActive = matchLive && hazardPhase === 'active';
    const hazardTelegraph = matchLive && hazardPhase === 'telegraph';

    if (powerUpState.active && powerUpState.expiresAt <= now) {
      powerUpState = { active: false, type: null, expiresAt: 0 };
      powerUpStateRef.current = powerUpState;
      powerUpActive = false;
      chargeMultiplier = 1;
    }

    if (shieldCooldown > 0) {
      shieldCooldown = Math.max(0, shieldCooldown - delta);
    }

    if (shieldDurability <= 0 && shieldCooldown === 0) {
      shieldCooldown = SHIELD_REPAIR_TIME;
      shieldActive = false;
    }

    const shieldHands = hands.filter(hand => hand.palmForward && hand.palmUp && !hand.isPinching);
    const wantsShield = shieldHands.length >= 2;
    const canActivateShield = shieldCooldown === 0 && shieldDurability > 0 && shieldEnergy > 0.05;

    if (wantsShield && canActivateShield) {
      shieldActive = true;
      shieldEnergy = Math.max(0, shieldEnergy - SHIELD_ENERGY_DRAIN * delta);
    } else {
      shieldActive = false;
      shieldEnergy = Math.min(1, shieldEnergy + SHIELD_ENERGY_REGEN * delta);
    }

    if (shieldActive && shieldEnergy <= 0.05) {
      shieldActive = false;
      shieldCooldown = Math.max(shieldCooldown, SHIELD_COOLDOWN_TIME);
    }

    if (shieldActive) {
      const [handA, handB] = shieldHands;
      const center = handA.worldPos.clone().add(handB.worldPos).multiplyScalar(0.5);
      const handDistance = handA.worldPos.distanceTo(handB.worldPos);
      shieldCenter.copy(center);
      shieldRadius = clamp(handDistance * 0.65, 0.55, 1.25);
    } else if (hands.length > 0) {
      shieldCenter.copy(hands[0].worldPos);
      shieldRadius = shieldRuntime.radius;
    }

    if (shieldCooldown === 0 && shieldDurability <= 0) {
      shieldDurability = SHIELD_MAX_DURABILITY;
    }

    if (matchLive) {
      if (activePowerUps.length === 0 && now >= nextPowerUpAtRef.current) {
        const spawnX = (Math.random() * 2 - 1) * 3.2;
        const spawnY = -0.4 + Math.random() * 1.8;
        const spawnZ = -6 + Math.random() * 3;
        const basePosition = new THREE.Vector3(spawnX, spawnY, spawnZ);
        const newPowerUp: PowerUpData = {
          id: uuidv4(),
          type: 'overcharge',
          position: basePosition.clone(),
          basePosition,
          radius: POWER_UP_PICKUP_RADIUS,
          spawnTime: now,
          ttl: POWER_UP_TTL
        };
        activePowerUps.push(newPowerUp);
        powerUpNeedsUpdate = true;
        nextPowerUpAtRef.current = now + POWER_UP_SPAWN_MIN + Math.random() * (POWER_UP_SPAWN_MAX - POWER_UP_SPAWN_MIN);
        setStatus('Power-up detected!');
      }

      activePowerUps = activePowerUps
        .map((powerUp, index) => {
          const age = now - powerUp.spawnTime;
          if (age > powerUp.ttl) {
            powerUpNeedsUpdate = true;
            return null;
          }

          powerUp.position.set(
            powerUp.basePosition.x,
            powerUp.basePosition.y + Math.sin(now * 2.4 + index) * 0.2,
            powerUp.basePosition.z
          );

          const collector = hands.find(hand => hand.palmUp && !hand.isPinching && hand.worldPos.distanceTo(powerUp.position) < powerUp.radius);
          if (collector) {
            powerUpState = {
              active: true,
              type: powerUp.type,
              expiresAt: now + POWER_UP_BUFF_DURATION
            };
            powerUpStateRef.current = powerUpState;
            powerUpActive = true;
            chargeMultiplier = POWER_UP_CHARGE_MULTIPLIER;
            powerUpNeedsUpdate = true;
            setStatus('Power Surge!');
            triggerHaptic([30, 40, 30]);
            return null;
          }

          return powerUp;
        })
        .filter(Boolean) as PowerUpData[];
    } else {
      if (activePowerUps.length > 0) {
        activePowerUps = [];
        powerUpNeedsUpdate = true;
      }
      if (powerUpState.active) {
        powerUpState = { active: false, type: null, expiresAt: 0 };
        powerUpStateRef.current = powerUpState;
      }
      powerUpActive = false;
      chargeMultiplier = 1;
    }

    // --- 1. Spawning Logic ---
    if (matchLive) {
      hands.forEach(hand => {
        // Find if this hand is holding a ball
        const holdingBall = activeBalls.find(b => b.heldBy === hand.id);
        
        // Spawn condition: Palm Up + No ball + Cooldown
        if (!holdingBall && hand.palmUp && (now - lastSpawnTime.current > 0.5)) {
          const newBall: BallData = {
            id: uuidv4(),
            ownerId: playerId ?? hand.id,
            position: hand.worldPos.clone().add(new THREE.Vector3(0, 0.2, 0)),
            velocity: new THREE.Vector3(0,0,0),
            scale: 0.1,
            energy: 0.1,
            state: 'charging',
            heldBy: hand.id,
            color: BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)],
          };
          activeBalls.push(newBall);
          lastSpawnTime.current = now;
          needsUpdate = true;
          setStatus('Charging Orb...');
          triggerHaptic(20); // Subtle haptic on spawn
        }
      });
    }

    // --- 2. Update Physics & Interaction ---
    activeBalls = activeBalls.map(ball => {
      let nextBall = { ...ball };

      if (ball.state === 'charging' && ball.heldBy) {
        const hand = hands.find(h => h.id === ball.heldBy);
        
        if (hand) {
          // Stick to hand position with slight lag for weight
          const targetPos = hand.worldPos.clone().add(new THREE.Vector3(0, 0.15, 0));
          nextBall.position.lerp(targetPos, 0.3);
          
          // Charge up
          nextBall.energy = Math.min(nextBall.energy + delta * 0.5 * chargeMultiplier, 1.0);
          nextBall.scale = 0.3 + (nextBall.energy * 0.5); 

          // --- Throw Mechanics ---
          // We analyze both Velocity and Acceleration for a "Physics-based" throw feeling.
          
          const vel = hand.velocity;
          const accel = hand.acceleration;
          
          const forwardVel = -vel.z; // Speed towards screen/world (away from user)
          const forwardAccel = -accel.z; // Acceleration towards screen
          
          // A "Throw" is defined by high forward velocity OR a significant forward acceleration impulse (flick)
          // while not moving backwards.
          const isMovingForward = forwardVel > 0.5;
          const isRapidAcceleration = forwardAccel > 8.0; // Sharp flick
          const isHighVelocity = forwardVel > 3.0;
          
          // Visual Squash/Stretch based on velocity
          if (vel.length() > 1) {
             nextBall.scale = (0.3 + nextBall.energy * 0.5) * (1 - vel.length() * 0.05);
          }

          const isThrowingMotion = isMovingForward && (isHighVelocity || isRapidAcceleration);
          const isEnergySufficient = nextBall.energy > 0.25;

          if (isThrowingMotion && isEnergySufficient) {
            nextBall.state = 'flying';
            nextBall.heldBy = null;
            
            // --- Physics Impulse Calculation ---
            // Base velocity from hand movement
            const throwVelocity = vel.clone();
            
            // Add "Snap" Impulse from acceleration
            // This makes the throw feel responsive to the *force* of the flick, not just the speed.
            // We project acceleration onto the forward vector to boost z-axis primarily.
            if (forwardAccel > 0) {
                 const impulse = accel.clone().multiplyScalar(0.15);
                 throwVelocity.add(impulse);
            }
            
            // General Throw Boost
            throwVelocity.multiplyScalar(1.3);

            // Enforce minimum satisfaction speed for throws
            if (throwVelocity.z > -4.0) {
                // If the user flicked but physical tracking was slow, ensure it still flies
                throwVelocity.z = -4.0 - (forwardAccel * 0.1); 
            }
            
            // Add a slight upward arc if thrown mostly straight, to help it travel
            throwVelocity.y += 0.5;

            nextBall.velocity = throwVelocity;

            if (powerUpActive && powerUpState.type === 'overcharge') {
              nextBall.energy = Math.min(1.0, nextBall.energy + POWER_UP_THROW_BONUS);
              powerUpState = { active: false, type: null, expiresAt: 0 };
              powerUpStateRef.current = powerUpState;
              powerUpActive = false;
              chargeMultiplier = 1;
            }

            emitScoreEvent({
              type: 'throw',
              playerId: playerId ?? hand.id,
              ballId: nextBall.id,
              energy: nextBall.energy,
              position: nextBall.position.clone(),
              timestamp: now
            });
            enqueueFx({
              type: 'throw',
              position: nextBall.position.clone(),
              color: nextBall.color,
              intensity: nextBall.energy
            }, now);

            setStatus('Flick Throw!');
            triggerHaptic(50); // Throw release haptic
            needsUpdate = true;
          } else if (!hand.palmUp && now - lastSpawnTime.current > 1.0 && vel.length() < 1.0) {
             // Dropped (slow movement + hand turned over)
             nextBall.state = 'flying';
             nextBall.heldBy = null;
             nextBall.velocity = new THREE.Vector3(0, -2, 0); // Drop down
             needsUpdate = true;
          }
        } else {
            // Hand lost tracking
            nextBall.state = 'flying';
            nextBall.heldBy = null;
        }

      } else if (ball.state === 'flying') {
        // Apply Gravity
        nextBall.velocity.y -= 9.8 * delta * 0.2; // Low gravity
        nextBall.position.add(nextBall.velocity.clone().multiplyScalar(delta));

        // Air Drag
        nextBall.velocity.multiplyScalar(0.995);
        
        // Spin effect recovery (if squashed)
        nextBall.scale = Math.min(nextBall.scale + delta, 0.3 + (nextBall.energy * 0.5)); 

        // --- Catching Logic ---
        hands.forEach(hand => {
            // Can only catch if palm is up and not holding another ball
            if (hand.palmUp && !activeBalls.find(b => b.heldBy === hand.id)) {
                const dist = hand.worldPos.distanceTo(nextBall.position);
                // Catch radius
                if (dist < 0.6) {
                    nextBall.state = 'charging';
                    nextBall.heldBy = hand.id;
                    nextBall.ownerId = playerId ?? hand.id;
                    nextBall.velocity.set(0,0,0);
                    // Bonus energy on catch
                    nextBall.energy = Math.min(nextBall.energy + 0.2, 1.0);
                    emitScoreEvent({
                      type: 'catch',
                      playerId: playerId ?? hand.id,
                      ballId: nextBall.id,
                      energy: nextBall.energy,
                      position: nextBall.position.clone(),
                      timestamp: now
                    });
                    enqueueFx({
                      type: 'catch',
                      position: nextBall.position.clone(),
                      color: nextBall.color,
                      intensity: 0.6
                    }, now);
                    setScore(s => s + 10);
                    setStatus('Caught!');
                    triggerHaptic(100); // Solid catch haptic
                    needsUpdate = true;
                }
            }
        });

        if (nextBall.state !== 'flying') {
          return nextBall;
        }

        // --- Player Hitboxes ---
        for (const target of targets) {
          if (nextBall.ownerId && target.playerId === nextBall.ownerId) {
            continue;
          }
          if (!friendlyFire && localTeamId && target.teamId && target.teamId === localTeamId) {
            continue;
          }
          const dist = target.position.distanceTo(nextBall.position);
          if (dist < target.radius) {
            emitScoreEvent({
              type: 'impact',
              playerId: nextBall.ownerId ?? null,
              targetId: target.playerId,
              ballId: nextBall.id,
              energy: nextBall.energy,
              position: nextBall.position.clone(),
              timestamp: now
            });
            enqueueFx({
              type: 'impact',
              position: nextBall.position.clone(),
              color: nextBall.color,
              intensity: 1.1
            }, now);
            setStatus('Direct Hit!');
            triggerHaptic(70);
            needsUpdate = true;
            return null;
          }
        }

        // --- Shield Deflection ---
        if (shieldActive && shieldDurability > 0 && shieldRadius > 0.1) {
          const isLocalOwner =
            (playerId && nextBall.ownerId === playerId) ||
            hands.some(hand => hand.id === nextBall.ownerId);
          if (!isLocalOwner) {
            const lastShieldHit = shieldHitRef.current.get(nextBall.id) ?? 0;
            if (now - lastShieldHit > 0.25) {
              const distToShield = shieldCenter.distanceTo(nextBall.position);
              if (distToShield < shieldRadius) {
                const normal = nextBall.position.clone().sub(shieldCenter).normalize();
                nextBall.velocity.reflect(normal);
                nextBall.velocity.multiplyScalar(0.8 + shieldEnergy * 0.2);
                nextBall.energy = Math.max(0.05, nextBall.energy - 0.15);
                shieldDurability = Math.max(0, shieldDurability - nextBall.energy * 35);
                shieldEnergy = Math.max(0, shieldEnergy - 0.08);
                shieldHitRef.current.set(nextBall.id, now);
                enqueueFx({
                  type: 'shield',
                  position: nextBall.position.clone(),
                  color: '#7ef9ff',
                  intensity: 0.9
                }, now);
                setStatus('Shield Block!');
                triggerHaptic(35);
                needsUpdate = true;
              }
            }
          }
        }

        // --- Hazard Field ---
        if (hazardActive) {
          const lastHit = hazardHitRef.current.get(nextBall.id) ?? 0;
          if (now - lastHit > 0.35) {
            const distToHazard = hazardRuntime.position.distanceTo(nextBall.position);
            if (distToHazard < hazardRuntime.radius) {
              const pushDir = nextBall.position.clone().sub(hazardRuntime.position).normalize();
              nextBall.velocity.add(pushDir.multiplyScalar(HAZARD_FORCE));
              nextBall.velocity.y += 0.9;
              nextBall.energy = Math.max(0.05, nextBall.energy - 0.2);
              hazardHitRef.current.set(nextBall.id, now);
              enqueueFx({
                type: 'hazard',
                position: nextBall.position.clone(),
                color: '#ff8a00',
                intensity: 0.8
              }, now);
              setStatus('Shock Field!');
              triggerHaptic(25);
              needsUpdate = true;
            }
          }
        }

        // --- Multi-Ball Collision ---
        activeBalls.forEach(other => {
            if (other.id !== nextBall.id && other.state === 'flying') {
                const dist = nextBall.position.distanceTo(other.position);
                const minDist = (nextBall.scale + other.scale) * 0.4; // Approximate radius
                if (dist < minDist) {
                    // Elastic collision
                    const dir = nextBall.position.clone().sub(other.position).normalize();
                    const vRelative = nextBall.velocity.clone().sub(other.velocity);
                    const speed = vRelative.length();
                    
                    // Simple bounce impulse
                    nextBall.velocity.add(dir.multiplyScalar(speed * 0.5 + 1));
                    other.velocity.sub(dir.multiplyScalar(speed * 0.5 + 1));
                    
                    // FX
                    setStatus('Impact!');
                    triggerHaptic(40); // Impact haptic
                    needsUpdate = true;
                }
            }
        });

        // --- Boundaries ---
        if (nextBall.position.y < -2.5) { // Floor
           nextBall.velocity.y *= -0.6;
           nextBall.position.y = -2.5;
           triggerHaptic(15); // Floor bounce
        }
        if (Math.abs(nextBall.position.x) > 4) { // Side walls
           nextBall.velocity.x *= -0.8;
           nextBall.position.x = Math.sign(nextBall.position.x) * 4;
           triggerHaptic(15); // Wall bounce
        }
        if (nextBall.position.z < -8) { // Back wall
           nextBall.velocity.z *= -0.8;
           nextBall.position.z = -8;
           triggerHaptic(15); // Back wall bounce
        }
        
        // Cleanup when behind camera
        if (nextBall.position.z > 3) {
             return null; 
        }
      }

      return nextBall;
    }).filter(Boolean) as BallData[];

    if (shieldDurability <= 0 && shieldCooldown === 0) {
      shieldCooldown = SHIELD_REPAIR_TIME;
      shieldActive = false;
    }

    shieldRuntime.active = shieldActive;
    shieldRuntime.energy = shieldEnergy;
    shieldRuntime.durability = shieldDurability;
    shieldRuntime.cooldown = shieldCooldown;
    shieldRuntime.radius = shieldRadius;

    if (shieldMeshRef.current) {
      const pulse = 1 + Math.sin(now * 6) * 0.03;
      shieldMeshRef.current.visible = shieldActive;
      shieldMeshRef.current.position.copy(shieldCenter);
      shieldMeshRef.current.scale.setScalar(shieldRadius * pulse);
      const material = shieldMeshRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.15 + shieldEnergy * 0.25;
    }

    if (shieldGlowRef.current) {
      shieldGlowRef.current.visible = shieldActive;
      shieldGlowRef.current.position.copy(shieldCenter);
      shieldGlowRef.current.scale.setScalar(shieldRadius * 1.15);
      const material = shieldGlowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.08 + shieldEnergy * 0.2;
    }

    if (shieldHitRef.current.size > 40) {
      shieldHitRef.current.forEach((time, key) => {
        if (now - time > 1.5) {
          shieldHitRef.current.delete(key);
        }
      });
    }

    if (onShieldState) {
      const snapshot = {
        active: shieldActive,
        energy: shieldEnergy,
        durability: shieldDurability,
        cooldown: shieldCooldown
      };
      const lastSnapshot = lastShieldSnapshotRef.current;
      const changed =
        snapshot.active !== lastSnapshot.active ||
        Math.abs(snapshot.energy - lastSnapshot.energy) > 0.02 ||
        Math.abs(snapshot.durability - lastSnapshot.durability) > 1 ||
        Math.abs(snapshot.cooldown - lastSnapshot.cooldown) > 0.1;

      if (changed || now - lastShieldEmitRef.current > 0.4) {
        onShieldState(snapshot);
        lastShieldSnapshotRef.current = snapshot;
        lastShieldEmitRef.current = now;
      }
    }

    if (onPowerUpState) {
      const snapshot = {
        active: powerUpActive,
        type: powerUpActive ? powerUpState.type : null,
        expiresAt: powerUpActive ? powerUpState.expiresAt : 0
      };
      const lastSnapshot = lastPowerUpSnapshotRef.current;
      const changed =
        snapshot.active !== lastSnapshot.active ||
        snapshot.type !== lastSnapshot.type ||
        Math.abs(snapshot.expiresAt - lastSnapshot.expiresAt) > 0.1;

      if (changed || now - lastPowerUpEmitRef.current > 0.4) {
        onPowerUpState(snapshot);
        lastPowerUpSnapshotRef.current = snapshot;
        lastPowerUpEmitRef.current = now;
      }
    }

    if (fxEventsRef.current.length > 0) {
      const cutoff = now - 0.8;
      const nextFx = fxEventsRef.current.filter(event => event.timestamp > cutoff);
      if (nextFx.length !== fxEventsRef.current.length) {
        fxEventsRef.current = nextFx;
        setFxEvents(nextFx);
      }
    }

    if (hazardRingRef.current) {
      hazardRingRef.current.visible = hazardTelegraph || hazardActive;
      hazardRingRef.current.position.copy(hazardRuntime.position);
      hazardRingRef.current.rotation.x = -Math.PI / 2;
      const pulse = 1 + Math.sin(now * 7) * 0.06;
      hazardRingRef.current.scale.setScalar(hazardRuntime.radius * pulse);
      const ringMaterial = hazardRingRef.current.material as THREE.MeshBasicMaterial;
      ringMaterial.opacity = hazardTelegraph ? 0.35 : 0.6;
    }

    if (hazardCoreRef.current) {
      hazardCoreRef.current.visible = hazardActive;
      hazardCoreRef.current.position.copy(hazardRuntime.position);
      hazardCoreRef.current.rotation.y += delta * 0.7;
      hazardCoreRef.current.scale.set(hazardRuntime.radius * 0.4, 1.4, hazardRuntime.radius * 0.4);
      const coreMaterial = hazardCoreRef.current.material as THREE.MeshBasicMaterial;
      coreMaterial.opacity = 0.5 + Math.sin(now * 9) * 0.2;
    }

    if (hazardHitRef.current.size > 40) {
      hazardHitRef.current.forEach((time, key) => {
        if (now - time > 1.2) {
          hazardHitRef.current.delete(key);
        }
      });
    }

    if (activePowerUps.length !== powerUpsRef.current.length || powerUpNeedsUpdate) {
      powerUpsRef.current = activePowerUps;
      setPowerUps(activePowerUps);
    } else {
      powerUpsRef.current = activePowerUps;
    }

    if (activeBalls.length !== ballsRef.current.length || needsUpdate) {
       ballsRef.current = activeBalls;
       setBalls(activeBalls);
       setBallsCount(activeBalls.length);
    } else {
        ballsRef.current = activeBalls;
        setBalls(activeBalls); 
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[0, 5, 5]} intensity={0.5} />

      {balls.map(ball => (
        <EnergyBall key={ball.id} data={ball} qualityTier={qualityTier} effectsEnabled={effectsEnabled} />
      ))}

      {effectsEnabled
        ? powerUps.map(powerUp => <PowerUpOrb key={powerUp.id} data={powerUp} />)
        : null}

      {effectsEnabled
        ? fxEvents.map(event => (
            <ImpactBurst
              key={event.id}
              position={event.position}
              color={event.color}
              intensity={event.intensity}
              onDone={() => {
                fxEventsRef.current = fxEventsRef.current.filter(entry => entry.id !== event.id);
                setFxEvents(fxEventsRef.current);
              }}
            />
          ))
        : null}

      {effectsEnabled ? (
        <group>
          <mesh ref={hazardRingRef} visible={false}>
            <ringGeometry args={[0.6, 0.95, 48]} />
            <meshBasicMaterial
              color="#ff7b00"
              transparent
              opacity={0.4}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <mesh ref={hazardCoreRef} visible={false}>
            <cylinderGeometry args={[0.15, 0.4, 1.6, 16, 1, true]} />
            <meshBasicMaterial
              color="#ffb347"
              transparent
              opacity={0.6}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ) : null}

      <group>
        <mesh ref={shieldMeshRef} visible={false}>
          <circleGeometry args={[1, 40]} />
          <meshBasicMaterial
            color="#7ef9ff"
            transparent
            opacity={0.2}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh ref={shieldGlowRef} visible={false}>
          <ringGeometry args={[0.7, 1, 48]} />
          <meshBasicMaterial
            color="#b9ffff"
            transparent
            opacity={0.12}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      
      {/* Environment Grid */}
      <gridHelper args={[20, 20, 0x303030, 0x101010]} position={[0, -2.5, -4]} />
    </>
  );
};

export const Scene: React.FC<SceneContentProps> = (props) => {
  const { effectsEnabled = true, qualityTier = 'high' } = props;
  return (
    <div className="absolute inset-0 z-10">
      <Canvas camera={{ position: [0, 0, 4], fov: 60 }} gl={{ alpha: true, antialias: true }}>
        <GameLogic {...props} />
        {effectsEnabled ? (
          <EffectComposer>
            <Bloom
              luminanceThreshold={qualityTier === 'low' ? 1.4 : 1}
              mipmapBlur={qualityTier !== 'low'}
              intensity={qualityTier === 'low' ? 0.6 : qualityTier === 'balanced' ? 1.0 : 1.5}
              radius={qualityTier === 'low' ? 0.3 : 0.6}
            />
          </EffectComposer>
        ) : null}
      </Canvas>
    </div>
  );
};
