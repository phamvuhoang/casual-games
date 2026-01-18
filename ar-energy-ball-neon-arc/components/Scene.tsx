import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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

const GameLogic: React.FC<SceneContentProps> = ({ hands, setScore, setBallsCount, setStatus }) => {
  const [balls, setBalls] = useState<BallData[]>([]);
  const ballsRef = useRef<BallData[]>([]); // Ref for physics loop to avoid re-renders
  const lastSpawnTime = useRef<number>(0);

  // Sync state for rendering
  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    let activeBalls = [...ballsRef.current];
    let needsUpdate = false;

    // --- 1. Spawning Logic ---
    hands.forEach(hand => {
      // Find if this hand is holding a ball
      const holdingBall = activeBalls.find(b => b.heldBy === hand.handedness);
      
      // Spawn condition: Palm Up + No ball + Cooldown
      if (!holdingBall && hand.palmUp && (now - lastSpawnTime.current > 0.5)) {
        const newBall: BallData = {
          id: uuidv4(),
          position: hand.worldPos.clone().add(new THREE.Vector3(0, 0.2, 0)),
          velocity: new THREE.Vector3(0,0,0),
          scale: 0.1,
          energy: 0.1,
          state: 'charging',
          heldBy: hand.handedness,
          color: BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)],
        };
        activeBalls.push(newBall);
        lastSpawnTime.current = now;
        needsUpdate = true;
        setStatus('Charging Orb...');
      }
    });

    // --- 2. Update Physics & Interaction ---
    activeBalls = activeBalls.map(ball => {
      let nextBall = { ...ball };

      if (ball.state === 'charging' && ball.heldBy) {
        const hand = hands.find(h => h.handedness === ball.heldBy);
        
        if (hand) {
          // Stick to hand position with slight lag for weight
          const targetPos = hand.worldPos.clone().add(new THREE.Vector3(0, 0.15, 0));
          nextBall.position.lerp(targetPos, 0.3);
          
          // Charge up
          nextBall.energy = Math.min(nextBall.energy + delta * 0.5, 1.0);
          nextBall.scale = 0.3 + (nextBall.energy * 0.5); 

          // --- Throw Mechanics ---
          const speed = hand.velocity.length();
          const forwardSpeed = -hand.velocity.z; // Positive = away from camera
          
          // Visual Squash/Stretch based on velocity
          if (speed > 1) {
             // Stretch along movement vector (simplified effect)
             nextBall.scale = (0.3 + nextBall.energy * 0.5) * (1 - speed * 0.05);
          }

          // Throw Trigger Conditions:
          // 1. Moving fast away from camera
          // 2. Minimum energy
          // 3. Not holding palm perfectly flat up (natural throw rotates hand)
          const isThrowingMotion = forwardSpeed > 2.5; 
          const isEnergySufficient = nextBall.energy > 0.25;

          if (isThrowingMotion && isEnergySufficient) {
            nextBall.state = 'flying';
            nextBall.heldBy = null;
            
            // Transfer momentum with a boost
            // We use the hand's velocity but amplify the forward component
            const throwVelocity = hand.velocity.clone().multiplyScalar(1.4); 
            
            // Ensure minimum forward velocity if the gesture was detected
            if (throwVelocity.z > -3.0) throwVelocity.z = -3.0 - (speed * 0.2);
            
            nextBall.velocity = throwVelocity;
            
            setStatus('Throw!');
            needsUpdate = true;
          } else if (!hand.palmUp && now - lastSpawnTime.current > 1.0 && speed < 1.0) {
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
        
        // Spin effect
        nextBall.scale = Math.min(nextBall.scale + delta, 0.3 + (nextBall.energy * 0.5)); // Restore scale if squashed

        // --- Catching Logic ---
        hands.forEach(hand => {
            // Can only catch if palm is up and not holding another ball
            if (hand.palmUp && !activeBalls.find(b => b.heldBy === hand.handedness)) {
                const dist = hand.worldPos.distanceTo(nextBall.position);
                // Catch radius
                if (dist < 0.6) {
                    nextBall.state = 'charging';
                    nextBall.heldBy = hand.handedness;
                    nextBall.velocity.set(0,0,0);
                    // Bonus energy on catch
                    nextBall.energy = Math.min(nextBall.energy + 0.2, 1.0);
                    setScore(s => s + 10);
                    setStatus('Caught!');
                    needsUpdate = true;
                }
            }
        });

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
                    needsUpdate = true;
                }
            }
        });

        // --- Boundaries ---
        if (nextBall.position.y < -2.5) { // Floor
           nextBall.velocity.y *= -0.6;
           nextBall.position.y = -2.5;
        }
        if (Math.abs(nextBall.position.x) > 4) { // Side walls
           nextBall.velocity.x *= -0.8;
           nextBall.position.x = Math.sign(nextBall.position.x) * 4;
        }
        if (nextBall.position.z < -8) { // Back wall
           nextBall.velocity.z *= -0.8;
           nextBall.position.z = -8;
        }
        
        // Cleanup when behind camera
        if (nextBall.position.z > 3) {
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
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[0, 5, 5]} intensity={0.5} />

      {balls.map(ball => (
        <EnergyBall key={ball.id} data={ball} />
      ))}
      
      {/* Environment Grid */}
      <gridHelper args={[20, 20, 0x303030, 0x101010]} position={[0, -2.5, -4]} />
    </>
  );
};

export const Scene: React.FC<SceneContentProps> = (props) => {
  return (
    <div className="absolute inset-0 z-10">
      <Canvas camera={{ position: [0, 0, 4], fov: 60 }} gl={{ alpha: true, antialias: true }}>
        <GameLogic {...props} />
        <EffectComposer>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.6} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};