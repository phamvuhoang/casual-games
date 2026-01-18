import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as THREE from 'three';
import { Scene } from './components/Scene';
import { HandData } from './types';
import { toWorld, isPalmUp } from './services/handUtils';
import { Activity, Zap, Hand } from 'lucide-react';

// Declare MediaPipe globals on window
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

const App: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [hands, setHands] = useState<HandData[]>([]);
  const handsRef = useRef<HandData[]>([]); // For velocity calc
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [ballCount, setBallCount] = useState(0);
  const [status, setStatus] = useState('Initialize...');
  const [showDebug, setShowDebug] = useState(false);

  // Velocity Calculation helper
  const updateHandsWithVelocity = useCallback((newHands: any[], results: any) => {
    const timestamp = Date.now();
    const aspect = results.image.width / results.image.height;

    const processedHands: HandData[] = newHands.map((landmarks, index) => {
      const handedness = results.multiHandedness[index].label as 'Left' | 'Right';
      const worldPos = toWorld(landmarks[9], aspect); // Using middle finger knuckle (9) as center approx

      // Calculate velocity based on previous frame
      let velocity = new THREE.Vector3(0, 0, 0);
      const prevHand = handsRef.current.find(h => h.handedness === handedness);
      
      if (prevHand) {
        // Simple discrete differentiation
        velocity = worldPos.clone().sub(prevHand.worldPos).multiplyScalar(10); // scale up for readable units
        // Smoothing
        velocity.lerp(prevHand.velocity, 0.5); 
      }

      const palmUp = isPalmUp(landmarks);

      return {
        handedness,
        landmarks,
        worldPos,
        palmUp,
        velocity,
        isPinching: false // Not implemented specifically
      };
    });

    handsRef.current = processedHands;
    setHands(processedHands);
  }, []);

  useEffect(() => {
    let camera: any = null;
    let handsModule: any = null;

    const onResults = (results: any) => {
      setLoading(false);
      if (results.multiHandLandmarks && results.multiHandedness) {
        updateHandsWithVelocity(results.multiHandLandmarks, results);
      } else {
        setHands([]);
        handsRef.current = [];
      }
    };

    const initMediaPipe = async () => {
      if (window.Hands && window.Camera) {
        handsModule = new window.Hands({
          locateFile: (file: string) => `https://unpkg.com/@mediapipe/hands@0.4.1646424915/${file}`,
        });

        handsModule.setOptions({
          maxNumHands: 2, // Supports 2 hands (single user) or 4 if we bump this up for multi-user
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        handsModule.onResults(onResults);

        if (webcamRef.current && webcamRef.current.video) {
          const videoElement = webcamRef.current.video;
          camera = new window.Camera(videoElement, {
            onFrame: async () => {
              if (videoElement.videoWidth) {
                await handsModule.send({ image: videoElement });
              }
            },
            width: 640,
            height: 480,
          });
          camera.start();
          setStatus('Ready. Raise palm to spawn.');
        }
      } else {
        // Retry if script hasn't loaded yet
        setTimeout(initMediaPipe, 500);
      }
    };

    initMediaPipe();

    return () => {
      if (camera) camera.stop();
      if (handsModule) handsModule.close();
    };
  }, [updateHandsWithVelocity]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* Background Video */}
      <Webcam
        ref={webcamRef}
        className="absolute inset-0 w-full h-full object-cover opacity-50 filter grayscale contrast-125 transform -scale-x-100"
        playsInline
        mirrored
        videoConstraints={{ facingMode: "user" }}
      />

      {/* 3D Scene Layer */}
      <Scene 
        hands={hands} 
        setScore={setScore} 
        setBallsCount={setBallCount}
        setStatus={setStatus}
      />

      {/* HUD Layer */}
      <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-50">
        
        {/* Top Bar */}
        <div className="flex justify-between items-start">
          <div className="bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-[0_0_15px_rgba(0,255,255,0.3)]">
            <h1 className="text-2xl font-bold tracking-wider text-cyan-400 flex items-center gap-2">
              <Zap className="fill-cyan-400" size={24}/> NEON ARC
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-cyan-100/80">
              <div className="flex items-center gap-1">
                <Activity size={16} /> Status: <span className="text-white font-mono">{status}</span>
              </div>
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 text-right">
             <div className="text-xs text-cyan-200 uppercase tracking-widest">Score</div>
             <div className="text-4xl font-mono font-bold text-white tabular-nums">{score.toString().padStart(4, '0')}</div>
          </div>
        </div>

        {/* Center Loader */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-cyan-400 tracking-widest animate-pulse">INITIALIZING OPTICS...</div>
            </div>
          </div>
        )}

        {/* Bottom Bar */}
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-2">
            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
              <Hand size={18} className={hands.length > 0 ? "text-green-400" : "text-red-400"} />
              <span className="text-sm font-mono text-white/80">
                HANDS DETECTED: <span className="text-white font-bold">{hands.length}</span>
              </span>
            </div>
             <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-cyan-500 shadow-[0_0_10px_cyan]"></div>
              <span className="text-sm font-mono text-white/80">
                ACTIVE ORBS: <span className="text-white font-bold">{ballCount}</span>
              </span>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gradient-to-l from-black/60 to-transparent p-4 rounded-l-xl text-right max-w-md">
            <div className="text-xs font-bold text-cyan-400 mb-1">CONTROLS</div>
            <ul className="text-sm text-white/80 space-y-1">
              <li><span className="text-cyan-300">PALM UP</span> to spawn & charge</li>
              <li><span className="text-cyan-300">FLICK</span> to throw</li>
              <li><span className="text-cyan-300">CATCH</span> with open hand</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Debug Dots (Optional) */}
      {showDebug && hands.map((hand, i) => (
        <div 
          key={i} 
          className="absolute w-4 h-4 bg-red-500 rounded-full z-40"
          style={{ 
             left: '50%', top: '50%', // Centered relative base
             transform: `translate(${hand.worldPos.x * 100}px, ${-hand.worldPos.y * 100}px)` // Rough debug viz
          }} 
        />
      ))}
    </div>
  );
};

export default App;