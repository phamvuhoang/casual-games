import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { BallData, HandData } from '../types';
import { EnergyBall } from './EnergyBall';
import { v4 as uuidv4 } from 'uuid';

interface SceneContentProps {
  hands: HandData[];
  setScore: (cb: (s: number) => number) => void;
  setBallsCount: (n: number) => void;
  setStatus: (s: string) => void;
}

const BALL_COLORS = ['#00ffff', '#ff00ff', '#00ff00', '#ffff00'];

const RoomGrid: React.FC = () => {
  const lines = useMemo(() => {
    const vertices: number[] = [];
    const width = 8;    // x: -4 to 4
    const height = 6;   // y: -2.5 to 3.5
    const depth = 14;   // z: -10 to 4
    
    const xMin = -4, xMax = 4;
    const yMin = -2.5, yMax = 3.5;
    const zMin = -10, zMax = 2; // End grid slightly in front of camera

    // Helper to add line
    const addLine = (p1: number[], p2: number[]) => vertices.push(...p1, ...p2);

    // 1. Floor (y = yMin) - Horizontal & Depth lines
    for (let x = xMin; x <= xMax; x += 2) addLine([x, yMin, zMin], [x, yMin, zMax]);
    for (let z = zMin; z <= zMax; z += 2) addLine([xMin, yMin, z], [xMax, yMin, z]);

    // 2. Ceiling (y = yMax)
    for (let x = xMin; x <= xMax; x += 2) addLine([x, yMax, zMin], [x, yMax, zMax]);
    for (let z = zMin; z <= zMax; z += 2) addLine([xMin, yMax, z], [xMax, yMax, z]);

    // 3. Left Wall (x = xMin)
    for (let y = yMin; y <= yMax; y += 1.5) addLine([xMin, y, zMin], [xMin, y, zMax]);
    for (let z = zMin; z <= zMax; z += 2) addLine([xMin, yMin, z], [xMin, yMax, z]);

    // 4. Right Wall (x = xMax)
    for (let y = yMin; y <= yMax; y += 1.5) addLine([xMax, y, zMin], [xMax, y, zMax]);
    for (let z = zMin; z <= zMax; z += 2) addLine([xMax, yMin, z], [xMax, yMax, z]);

    // 5. Back Wall (z = zMin)
    for (let x = xMin; x <= xMax; x += 2) addLine([x, yMin, zMin], [x, yMax, zMin]);
    for (let y = yMin; y <= yMax; y += 1.5) addLine([xMin, y, zMin], [xMax, y, zMin]);

    return new Float32Array(vertices);
  }, []);

  return (
    <group>
        <lineSegments>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={lines.length / 3} array={lines} itemSize={3} />
            </bufferGeometry>
            <lineBasicMaterial color="#0088ff" transparent opacity={0.15} blending={THREE.AdditiveBlending} />
        </lineSegments>
    </group>
  );
}

const GameLogic: React.FC<SceneContentProps> = ({ hands, setScore, setBallsCount, setStatus }) => {
  const [balls, setBalls] = useState<BallData[]>([]);
  const ballsRef = useRef<BallData[]>([]); 
  const lastSpawnTime = useRef<number>(0);

  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    let activeBalls = [...ballsRef.current];
    let needsUpdate = false;

    // --- 1. Spawning Logic ---
    hands.forEach(hand => {
      const holdingBall = activeBalls.find(b => b.heldBy === hand.id);
      
      // Spawn condition: Palm Up + No ball + Cooldown
      if (!holdingBall && hand.palmUp && (now - lastSpawnTime.current > 0.5)) {
        const newBall: BallData = {
          id: uuidv4(),
          ownerId: hand.id,
          position: hand.worldPos.clone().add(new THREE.Vector3(0, 0.2, 0)),
          velocity: new THREE.Vector3(0,0,0),
          scale: 0.1,
          energy: 0.1,
          state: 'charging',
          heldBy: hand.id,
          color: BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)],
          spawnTime: now
        };
        activeBalls.push(newBall);
        lastSpawnTime.current = now;
        needsUpdate = true;
        setStatus('Charging Orb...');
        triggerHaptic(20); 
      }
    });

    // --- 2. Update Physics & Interaction ---
    activeBalls = activeBalls.map(ball => {
      let nextBall = { ...ball };

      // Handle terminal states
      if (ball.state === 'exploded' || ball.state === 'fizzle') {
          // Remove after animation duration
          const lifeTime = (ball as any).terminalTime || now;
          if ((ball as any).terminalTime === undefined) (nextBall as any).terminalTime = now;
          
          if (now - lifeTime > 0.8) return null; // Remove logic
          return nextBall;
      }

      // --- HOLDING / CHARGING STATE ---
      if (ball.state === 'charging' && ball.heldBy) {
        const hand = hands.find(h => h.id === ball.heldBy);
        
        if (hand) {
          const targetPos = hand.worldPos.clone().add(new THREE.Vector3(0, 0.15, 0));
          nextBall.position.lerp(targetPos, 0.4); 
          
          // Charge up
          nextBall.energy = Math.min(nextBall.energy + delta * 0.8, 1.0);
          nextBall.scale = 0.3 + (nextBall.energy * 0.5); 

          // --- Throw Mechanics (Bi-directional) ---
          const vel = hand.velocity;
          const accel = hand.acceleration;
          
          const zVel = vel.z;
          const zAcc = accel.z;
          
          // Throw Away (Negative Z)
          const isThrowAway = zVel < -2.5 || zAcc < -8.0;
          // Throw At Camera (Positive Z)
          const isThrowAtCamera = zVel > 2.5 || zAcc > 8.0;

          const speed = vel.length();
          const isMoving = speed > 0.5;

          if (isMoving && (isThrowAway || isThrowAtCamera) && nextBall.energy > 0.15) {
            nextBall.state = 'flying';
            nextBall.heldBy = null;
            nextBall.ownerId = hand.id;
            
            const throwVelocity = vel.clone();
            
            // Add Impulse from acceleration for "snap"
            if (Math.abs(zAcc) > 5.0) {
                 const impulse = accel.clone().multiplyScalar(0.2); 
                 throwVelocity.add(impulse);
            }
            
            // Boost speed
            throwVelocity.multiplyScalar(1.4);

            // Min Speed Enforcement
            if (isThrowAway && throwVelocity.z > -5.0) throwVelocity.z = -5.0;
            if (isThrowAtCamera && throwVelocity.z < 5.0) throwVelocity.z = 5.0;

            // Arc for visual weight
            throwVelocity.y += 0.5;

            nextBall.velocity = throwVelocity;
            setStatus(isThrowAtCamera ? 'Incoming!' : 'Away!');
            triggerHaptic(50);
            needsUpdate = true;
          } 
          // Drop Logic
          else if (!hand.palmUp && now - lastSpawnTime.current > 1.0 && speed < 1.0) {
             nextBall.state = 'flying';
             nextBall.heldBy = null;
             nextBall.velocity = new THREE.Vector3(0, -2, 0); 
             needsUpdate = true;
          }
        } else {
            // Hand lost
            nextBall.state = 'flying';
            nextBall.heldBy = null;
        }

      } 
      // --- FLYING STATE ---
      else if (ball.state === 'flying') {
        // 1. Gravity & Drag
        nextBall.velocity.y -= 9.8 * delta * 0.4;
        nextBall.velocity.multiplyScalar(0.99);
        nextBall.position.add(nextBall.velocity.clone().multiplyScalar(delta));
        
        // 2. Energy Decay
        nextBall.energy -= delta * 0.08; // Lose 8% energy per second flying
        nextBall.scale = Math.max(0.1, 0.3 + (nextBall.energy * 0.5));

        // 3. Fizzle out if energy empty
        if (nextBall.energy <= 0) {
            nextBall.state = 'fizzle';
            setStatus('Fizzled out...');
            needsUpdate = true;
            return nextBall;
        }

        // 4. Collision with Hand (Catch or Hit)
        hands.forEach(hand => {
            const dist = hand.worldPos.distanceTo(nextBall.position);
            
            if (dist < 0.5) {
                const isOwner = ball.ownerId === hand.id;
                const gracePeriodPassed = (now - (ball as any).spawnTime > 0.5);

                if (!isOwner || gracePeriodPassed) {
                    if (hand.palmUp && !activeBalls.find(b => b.heldBy === hand.id)) {
                        // CATCH
                        nextBall.state = 'charging';
                        nextBall.heldBy = hand.id;
                        nextBall.velocity.set(0,0,0);
                        nextBall.energy = Math.min(nextBall.energy + 0.3, 1.0); // Boost energy on catch
                        setScore(s => s + 10);
                        setStatus('Caught!');
                        triggerHaptic(100);
                        needsUpdate = true;
                    } else if (!hand.palmUp) {
                        // HIT HAND
                        nextBall.state = 'exploded';
                        setScore(s => s + 50);
                        setStatus('Hand Hit!');
                        triggerHaptic([40, 40, 40]);
                        needsUpdate = true;
                    }
                }
            }
        });

        // 5. Collision with SCREEN (User)
        // If ball is moving towards camera (z > 0) and gets very close (z > 3.0)
        // (Camera is usually at 4)
        if (nextBall.velocity.z > 0 && nextBall.position.z > 3.0 && Math.abs(nextBall.position.x) < 2.0 && Math.abs(nextBall.position.y) < 2.0) {
            nextBall.state = 'exploded';
            setScore(s => s + 100); // Bonus for hitting screen
            setStatus('SCREEN CRACK!');
            triggerHaptic([80, 50, 80, 50]); // Strong pattern
            needsUpdate = true;
        }

        // 6. Ball-Ball Collision
        activeBalls.forEach(other => {
            if (other.id !== nextBall.id && other.state === 'flying') {
                const dist = nextBall.position.distanceTo(other.position);
                const minDist = (nextBall.scale + other.scale) * 0.4; 
                if (dist < minDist) {
                    const dir = nextBall.position.clone().sub(other.position).normalize();
                    const vRelative = nextBall.velocity.clone().sub(other.velocity);
                    const speed = vRelative.length();
                    
                    nextBall.velocity.add(dir.multiplyScalar(speed * 0.5 + 1));
                    other.velocity.sub(dir.multiplyScalar(speed * 0.5 + 1));
                    
                    triggerHaptic(30);
                    needsUpdate = true;
                }
            }
        });

        // 7. Wall Bounces
        if (nextBall.position.y < -2.5) { 
           nextBall.velocity.y = Math.abs(nextBall.velocity.y) * 0.6;
           nextBall.position.y = -2.5;
        }
        if (nextBall.position.y > 3.5) { 
           nextBall.velocity.y = -Math.abs(nextBall.velocity.y) * 0.6;
           nextBall.position.y = 3.5;
        }
        if (Math.abs(nextBall.position.x) > 4) {
           nextBall.velocity.x *= -0.8;
           nextBall.position.x = Math.sign(nextBall.position.x) * 4;
        }
        if (nextBall.position.z < -10) { 
           nextBall.velocity.z = Math.abs(nextBall.velocity.z) * 0.8;
           nextBall.position.z = -10;
        }
        
        // Remove if way out of bounds
        if (nextBall.position.z > 5 || nextBall.position.y < -10) {
             return null; 
        }
      }

      return nextBall;
    }).filter(Boolean) as BallData[];

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
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 4, 0]} intensity={0.8} />
      <directionalLight position={[0, 0, 5]} intensity={0.5} />

      {balls.map(ball => (
        <EnergyBall key={ball.id} data={ball} />
      ))}
      
      <RoomGrid />
    </>
  );
};

export const Scene: React.FC<SceneContentProps> = (props) => {
  return (
    <div className="absolute inset-0 z-10">
      <Canvas camera={{ position: [0, 0, 4], fov: 65 }} gl={{ alpha: true, antialias: true }}>
        <GameLogic {...props} />
        <EffectComposer>
          <Bloom luminanceThreshold={0.8} mipmapBlur intensity={1.8} radius={0.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};