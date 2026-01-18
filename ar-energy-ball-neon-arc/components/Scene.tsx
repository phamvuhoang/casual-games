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
      const holdingBall = activeBalls.find(b => b.heldBy === hand.handedness);
      
      if (!holdingBall && hand.palmUp && (now - lastSpawnTime.current > 0.5)) {
        // Spawn new ball
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
          // Stick to hand
          nextBall.position.lerp(hand.worldPos.clone().add(new THREE.Vector3(0, 0.15, 0)), 0.2);
          
          // Charge up
          nextBall.energy = Math.min(nextBall.energy + delta * 0.5, 1.0);
          nextBall.scale = 0.3 + (nextBall.energy * 0.5); // Grow

          // Check for throw gesture (Flick)
          // To throw: must have some charge, moving fast away from camera, and not strictly palm up
          const speed = hand.velocity.length();
          const movingAway = hand.velocity.z < -1.0; 
          
          if (movingAway && speed > 2.0 && nextBall.energy > 0.3) {
            nextBall.state = 'flying';
            nextBall.heldBy = null;
            // Add forward impulse
            nextBall.velocity = hand.velocity.clone().multiplyScalar(1.2).add(new THREE.Vector3(0, 0, -2));
            setStatus('Throw!');
            needsUpdate = true;
          } else if (!hand.palmUp && now - lastSpawnTime.current > 1.0) {
            // Dropped it
             nextBall.state = 'flying';
             nextBall.heldBy = null;
             nextBall.velocity = new THREE.Vector3(0, -2, 0); // Drop down
             needsUpdate = true;
          }
        } else {
            // Hand lost
            nextBall.state = 'flying';
            nextBall.heldBy = null;
        }

      } else if (ball.state === 'flying') {
        // Apply Gravity
        nextBall.velocity.y -= 9.8 * delta * 0.1; // Low gravity for effect
        nextBall.position.add(nextBall.velocity.clone().multiplyScalar(delta));

        // Drag
        nextBall.velocity.multiplyScalar(0.99);

        // --- Catching Logic ---
        hands.forEach(hand => {
            if (hand.palmUp && !activeBalls.find(b => b.heldBy === hand.handedness)) {
                const dist = hand.worldPos.distanceTo(nextBall.position);
                if (dist < 0.5) {
                    nextBall.state = 'charging';
                    nextBall.heldBy = hand.handedness;
                    nextBall.velocity.set(0,0,0);
                    setScore(s => s + 10);
                    setStatus('Caught!');
                    needsUpdate = true;
                }
            }
        });

        // --- Multi-Ball Collision (Bounce off each other) ---
        activeBalls.forEach(other => {
            if (other.id !== nextBall.id && other.state === 'flying') {
                const dist = nextBall.position.distanceTo(other.position);
                if (dist < (nextBall.scale + other.scale) * 0.5) {
                    // Simple elastic collision response
                    const dir = nextBall.position.clone().sub(other.position).normalize();
                    nextBall.velocity.add(dir.multiplyScalar(2));
                    other.velocity.sub(dir.multiplyScalar(2));
                    needsUpdate = true;
                }
            }
        });

        // --- Wall/Floor Bounce ---
        if (nextBall.position.y < -2) { // Floor
           nextBall.velocity.y *= -0.7;
           nextBall.position.y = -2;
        }
        if (Math.abs(nextBall.position.x) > 3) { // Side walls
           nextBall.velocity.x *= -0.7;
        }
        if (nextBall.position.z < -6) { // Back wall
           nextBall.velocity.z *= -0.7;
        }
        // Front plane clean up
        if (nextBall.position.z > 2) {
             return null; // Remove ball
        }
      }

      return nextBall;
    }).filter(Boolean) as BallData[]; // Filter out nulls (removed balls)

    // Update refs and state
    if (activeBalls.length !== ballsRef.current.length || needsUpdate) {
       ballsRef.current = activeBalls;
       setBalls(activeBalls);
       setBallsCount(activeBalls.length);
    } else {
        // Just update positions in ref for next frame without triggering react render if structure hasn't changed
        // (Note: To strictly follow React patterns we set state, but for high freq physics 
        // we often direct mutate refs for visuals. Here we do a hybrid: physics in ref, visual props passed via state)
        ballsRef.current = activeBalls;
        // Force a re-render of balls only if trajectory changed significantly? 
        // For simplicity in this demo, we setBalls every frame if moving.
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
      
      {/* Debug Plane Grid for Depth Perception */}
      <gridHelper args={[20, 20, 0x303030, 0x101010]} position={[0, -2, -2]} />
    </>
  );
};

export const Scene: React.FC<SceneContentProps> = (props) => {
  return (
    <div className="absolute inset-0 z-10">
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }} gl={{ alpha: true, antialias: true }}>
        <GameLogic {...props} />
        <EffectComposer>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.6} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};
