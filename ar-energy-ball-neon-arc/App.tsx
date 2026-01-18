import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import * as THREE from 'three';
import { Scene } from './components/Scene';
import type { HandData, ScoreEvent, ShieldState, PowerUpState } from './types';
import { toWorld, isPalmUp, isPalmFacingCamera, getPinchStrength } from './services/handUtils';
import { createNetworkClient, type ConnectionStatus, type NetworkClient } from './services/networking/client';
import type { ClientPoseUpdate, HandPose, PlayerState, ServerMessage } from './services/networking/types';
import { Activity, Zap, Hand } from 'lucide-react';

// Declare MediaPipe globals on window
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

const initialShieldState: ShieldState = {
  active: false,
  energy: 1,
  durability: 100,
  cooldown: 0
};

const initialPowerUpState: PowerUpState = {
  active: false,
  type: null,
  expiresAt: 0
};

const App: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [hands, setHands] = useState<HandData[]>([]);
  const handsRef = useRef<HandData[]>([]); // For velocity calc
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [ballCount, setBallCount] = useState(0);
  const [status, setStatus] = useState('Initialize...');
  const [showDebug, setShowDebug] = useState(false);
  const [scoreByPlayer, setScoreByPlayer] = useState<Record<string, number>>({});
  const [shieldState, setShieldState] = useState<ShieldState>(initialShieldState);
  const shieldStateRef = useRef<ShieldState>(initialShieldState);
  const [powerUpState, setPowerUpState] = useState<PowerUpState>(initialPowerUpState);
  const [roomPlayers, setRoomPlayers] = useState<PlayerState[]>([]);
  const [remoteHands, setRemoteHands] = useState<Record<string, HandPose[]>>({});
  const [playerVitals, setPlayerVitals] = useState<Record<string, { health: number; shield: number }>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [roomId, setRoomId] = useState('lobby');
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [localTeamId, setLocalTeamId] = useState<string | null>(null);
  const [friendlyFireEnabled, setFriendlyFireEnabled] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [qualityTier, setQualityTier] = useState<'high' | 'balanced' | 'low'>('high');
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [localReady, setLocalReady] = useState(false);
  const [matchCountdown, setMatchCountdown] = useState<number | null>(null);
  const [matchLive, setMatchLive] = useState(false);
  const [matchTimer, setMatchTimer] = useState<number | null>(null);
  const [matchEnded, setMatchEnded] = useState(false);
  const [matchSummaryOpen, setMatchSummaryOpen] = useState(false);
  const [matchDurationSec, setMatchDurationSec] = useState(120);
  const [scoreCapOverride, setScoreCapOverride] = useState<number | null>(null);
  const networkRef = useRef<NetworkClient | null>(null);
  const playerIdRef = useRef<string | null>(null);

  // Velocity Calculation helper
  const updateHandsWithVelocity = useCallback((newHands: any[], results: any) => {
    const aspect = results.image.width / results.image.height;

    const processedHands: HandData[] = newHands.map((landmarks, index) => {
      const handedness = results.multiHandedness[index].label as 'Left' | 'Right';
      const trackingIndex = results.multiHandedness[index].index ?? index;
      const id = `${handedness}-${trackingIndex}`;
      const worldPos = toWorld(landmarks[9], aspect); // Using middle finger knuckle (9) as center approx

      let velocity = new THREE.Vector3(0, 0, 0);
      let acceleration = new THREE.Vector3(0, 0, 0);

      // Find previous data for this hand
      // Note: We match by a best-effort tracking index to support multiple hands.
      const prevHandIndex = handsRef.current.findIndex(h => h.id === id);
      const prevHand = handsRef.current[prevHandIndex];
      
      if (prevHand) {
        // Calculate raw velocity (Units per frame approx, scaled up)
        const deltaPos = worldPos.clone().sub(prevHand.worldPos);
        const rawVelocity = deltaPos.multiplyScalar(20); // Scale for usable units

        // Smooth velocity: Higher alpha (0.6) means we trust new data more (responsive)
        // Lower alpha (0.3) means smoother but laggy
        velocity.copy(prevHand.velocity).lerp(rawVelocity, 0.6);

        // Calculate Acceleration: Change in velocity
        acceleration.subVectors(velocity, prevHand.velocity).multiplyScalar(20);
      }

      const palmUp = isPalmUp(landmarks);
      const palmForward = isPalmFacingCamera(landmarks, handedness);
      const pinchStrength = getPinchStrength(landmarks);
      const isPinching = pinchStrength > 0.7;

      return {
        id,
        handedness,
        landmarks,
        worldPos,
        palmUp,
        palmForward,
        velocity,
        acceleration,
        pinchStrength,
        isPinching
      };
    });

    handsRef.current = processedHands;
    setHands(processedHands);
  }, []);

  const calculateLocalHitPoints = useCallback((energy: number) => Math.round(10 + energy * 20), []);
  const calculateLocalDamage = useCallback((energy: number) => Math.round(8 + energy * 12), []);
  const sanitizeScore = useCallback((value: number | undefined) => (Number.isFinite(value) ? value : 0), []);

  const handleScoreEvent = useCallback(
    (event: ScoreEvent) => {
      if (event.type === 'catch' && event.playerId) {
        setScoreByPlayer(prev => ({
          ...prev,
          [event.playerId]: (prev[event.playerId] ?? 0) + 10
        }));
        return;
      }

      if (event.type === 'impact' && event.targetId && event.playerId) {
        const client = networkRef.current;
        if (client && client.isOpen()) {
          client.send({
            type: 'ball_hit',
            ballId: event.ballId,
            targetId: event.targetId,
            energy: event.energy,
            timestamp: event.timestamp
          });
          return;
        }

        const points = calculateLocalHitPoints(event.energy);
        const damage = calculateLocalDamage(event.energy);

        setScoreByPlayer(prev => ({
          ...prev,
          [event.playerId as string]: (prev[event.playerId as string] ?? 0) + points
        }));
        setScore(prev => prev + points);
        setPlayerVitals(prev => {
          const current = prev[event.targetId as string] ?? { health: 100, shield: 0 };
          return {
            ...prev,
            [event.targetId as string]: {
              ...current,
              health: Math.max(0, current.health - damage)
            }
          };
        });
      }
    },
    [calculateLocalDamage, calculateLocalHitPoints]
  );

  const handleShieldState = useCallback((next: ShieldState) => {
    shieldStateRef.current = next;
    setShieldState(prev => {
      const changed =
        prev.active !== next.active ||
        Math.abs(prev.energy - next.energy) > 0.02 ||
        Math.abs(prev.durability - next.durability) > 1 ||
        Math.abs(prev.cooldown - next.cooldown) > 0.1;
      return changed ? next : prev;
    });

    const localId = playerIdRef.current;
    if (localId) {
      setPlayerVitals(prev => {
        const current = prev[localId] ?? { health: 100, shield: 0 };
        return {
          ...prev,
          [localId]: {
            ...current,
            shield: Math.round(next.durability)
          }
        };
      });
    }
  }, []);

  const handlePowerUpState = useCallback((next: PowerUpState) => {
    setPowerUpState(prev => {
      const changed =
        prev.active !== next.active ||
        prev.type !== next.type ||
        Math.abs(prev.expiresAt - next.expiresAt) > 0.1;
      return changed ? next : prev;
    });
  }, []);

  const handleLocalScore = useCallback(
    (cb: (s: number) => number) => {
      if (connectionStatus === 'open') {
        return;
      }
      setScore(cb);
    },
    [connectionStatus]
  );

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  const serializeVector = useCallback(
    (vector: THREE.Vector3) => ({ x: vector.x, y: vector.y, z: vector.z }),
    []
  );

  const serializeHands = useCallback(
    (entries: HandData[]): HandPose[] => {
      return entries.map(hand => ({
        id: hand.id,
        handedness: hand.handedness,
        worldPos: serializeVector(hand.worldPos),
        velocity: serializeVector(hand.velocity),
        acceleration: serializeVector(hand.acceleration),
        palmUp: hand.palmUp,
        palmForward: hand.palmForward,
        pinchStrength: hand.pinchStrength
      }));
    },
    [serializeVector]
  );

  const syncRoomPlayers = useCallback((players: PlayerState[]) => {
    setRoomPlayers(players);
    setPlayerVitals(prev => {
      const next = { ...prev };
      const ids = new Set(players.map(player => player.id));
      players.forEach(player => {
        if (!next[player.id]) {
          next[player.id] = { health: 100, shield: 0 };
        }
      });
      Object.keys(next).forEach(id => {
        if (!ids.has(id)) {
          delete next[id];
        }
      });
      return next;
    });

    const localId = playerIdRef.current;
    if (localId) {
      const localPlayer = players.find(player => player.id === localId);
      if (localPlayer) {
        setScore(localPlayer.score);
        setLocalReady(localPlayer.ready);
        if (localPlayer.teamId && localTeamId !== localPlayer.teamId) {
          setLocalTeamId(localPlayer.teamId);
        }
      }
    }
  }, [localTeamId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedTier = window.localStorage.getItem('neonArcQuality');
    const storedFx = window.localStorage.getItem('neonArcFX');
    const storedAudio = window.localStorage.getItem('neonArcAudio');
    const hasStored = Boolean(storedTier || storedFx || storedAudio);

    if (storedTier === 'high' || storedTier === 'balanced' || storedTier === 'low') {
      setQualityTier(storedTier);
      if (!storedFx && storedTier === 'low') {
        setEffectsEnabled(false);
      }
      if (!storedAudio && storedTier === 'low') {
        setAudioEnabled(false);
      }
    }

    if (storedFx === 'true' || storedFx === 'false') {
      setEffectsEnabled(storedFx === 'true');
    }

    if (storedAudio === 'true' || storedAudio === 'false') {
      setAudioEnabled(storedAudio === 'true');
    }

    if (hasStored) {
      return;
    }

    const coreCount = navigator.hardwareConcurrency ?? 4;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const smallScreen = window.innerWidth < 540 || window.innerHeight < 540;
    if (coreCount <= 4 || memory <= 4 || smallScreen) {
      setQualityTier('low');
      setEffectsEnabled(false);
      setAudioEnabled(false);
    } else if (coreCount <= 6 || memory <= 6) {
      setQualityTier('balanced');
    }
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
          maxNumHands: 4, // Increased to support multiple people
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

  useEffect(() => {
    const wsUrl = (import.meta.env.VITE_WS_URL ?? '').trim();
    if (!wsUrl) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const nextRoomId = params.get('room') ?? 'lobby';
    const nextTeamId = params.get('team') ?? null;
    const nextName = params.get('name') ?? params.get('player') ?? params.get('n');
    const friendlyParam = params.get('friendlyFire') ?? params.get('ff');
    const durationParam = params.get('match') ?? params.get('duration') ?? params.get('time');
    const scoreCapParam = params.get('scoreCap') ?? params.get('cap') ?? params.get('score');
    const parsePositiveInt = (value: string | null) => {
      if (!value) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
    };
    setRoomId(nextRoomId);
    setLocalTeamId(nextTeamId);
    setPlayerName(nextName ? nextName.trim() : null);
    setFriendlyFireEnabled(friendlyParam === '1' || friendlyParam === 'true');
    const durationOverride = parsePositiveInt(durationParam);
    if (durationOverride) {
      setMatchDurationSec(durationOverride);
    }
    const scoreCapOverrideValue = parsePositiveInt(scoreCapParam);
    if (scoreCapOverrideValue) {
      setScoreCapOverride(scoreCapOverrideValue);
    }
    const latencyMsRaw = Number(import.meta.env.VITE_NET_LATENCY_MS ?? 0);
    const jitterMsRaw = Number(import.meta.env.VITE_NET_JITTER_MS ?? 0);
    const lossPctRaw = Number(import.meta.env.VITE_NET_LOSS_PCT ?? 0);
    const latencyMs = Number.isFinite(latencyMsRaw) ? latencyMsRaw : 0;
    const jitterMs = Number.isFinite(jitterMsRaw) ? jitterMsRaw : 0;
    const lossPercent = Number.isFinite(lossPctRaw) ? lossPctRaw : 0;
    const latency =
      latencyMs > 0 || jitterMs > 0 || lossPercent > 0
        ? {
            baseMs: Math.max(0, latencyMs),
            jitterMs: Math.max(0, jitterMs),
            lossPercent: Math.max(0, lossPercent)
          }
        : undefined;

    const handleMessage = (message: ServerMessage) => {
      switch (message.type) {
        case 'joined': {
          setPlayerId(message.playerId);
          playerIdRef.current = message.playerId;
          setNetworkError(null);
          syncRoomPlayers(message.state.players);
          break;
        }
        case 'room_update': {
          syncRoomPlayers(message.state.players);
          break;
        }
        case 'player_joined': {
          setRoomPlayers(prev => {
            if (prev.some(player => player.id === message.player.id)) {
              return prev;
            }
            return [...prev, message.player];
          });
          setPlayerVitals(prev => ({
            ...prev,
            [message.player.id]: prev[message.player.id] ?? { health: 100, shield: 0 }
          }));
          break;
        }
        case 'player_left': {
          setRoomPlayers(prev => prev.filter(player => player.id !== message.playerId));
          setRemoteHands(prev => {
            const next = { ...prev };
            delete next[message.playerId];
            return next;
          });
          setPlayerVitals(prev => {
            const next = { ...prev };
            delete next[message.playerId];
            return next;
          });
          break;
        }
        case 'pose_update': {
          setRemoteHands(prev => ({
            ...prev,
            [message.playerId]: message.hands
          }));
          setPlayerVitals(prev => {
            const current = prev[message.playerId] ?? { health: 100, shield: 0 };
            return {
              ...prev,
              [message.playerId]: {
                ...current,
                shield: message.shieldActive ? Math.max(1, current.shield || 100) : 0
              }
            };
          });
          break;
        }
        case 'ball_hit': {
          setPlayerVitals(prev => {
            const current = prev[message.targetId] ?? { health: 100, shield: 0 };
            return {
              ...prev,
              [message.targetId]: {
                ...current,
                health: Math.max(0, current.health - message.damage)
              }
            };
          });
          setStatus('Hit confirmed!');
          break;
        }
        case 'match_reset': {
          resetMatchState();
          setStatus('Match reset.');
          break;
        }
        case 'error': {
          setNetworkError(message.code);
          break;
        }
        default: {
          break;
        }
      }
    };

    const client = createNetworkClient({
      url: wsUrl,
      roomId: nextRoomId,
      name: nextName ? nextName.trim() : undefined,
      teamId: nextTeamId ?? undefined,
      latency,
      onStatusChange: setConnectionStatus,
      onMessage: handleMessage
    });

    networkRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      networkRef.current = null;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const client = networkRef.current;
      if (!client || !client.isOpen()) return;

      const payload: ClientPoseUpdate = {
        type: 'pose_update',
        hands: serializeHands(handsRef.current),
        shieldActive: shieldStateRef.current.active,
        timestamp: Date.now()
      };
      client.send(payload);
    }, 1000 / 20);

    return () => window.clearInterval(interval);
  }, [serializeHands]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'd') {
        setShowDebug(prev => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const teamByPlayer = useMemo(() => {
    const mapping: Record<string, string | null | undefined> = {};
    roomPlayers.forEach(player => {
      mapping[player.id] = player.teamId ?? null;
    });
    return mapping;
  }, [roomPlayers]);

  const hitTargets = useMemo(() => {
    const targets: Array<{
      playerId: string;
      handId: string;
      teamId?: string | null;
      position: THREE.Vector3;
      radius: number;
    }> = [];

    Object.entries(remoteHands).forEach(([remotePlayerId, hands]) => {
      const teamId = teamByPlayer[remotePlayerId] ?? null;
      hands.forEach(hand => {
        targets.push({
          playerId: remotePlayerId,
          handId: hand.id,
          teamId,
          position: new THREE.Vector3(hand.worldPos.x, hand.worldPos.y, hand.worldPos.z),
          radius: 0.55
        });
      });
    });

    return targets;
  }, [remoteHands, teamByPlayer]);

  const playersForHud = useMemo(() => {
    if (roomPlayers.length > 0) {
      return roomPlayers
        .map(player => {
          const vitals = playerVitals[player.id] ?? { health: 100, shield: 0 };
          return {
            id: player.id,
            name: player.name,
            score: sanitizeScore(player.score),
            health: vitals.health,
            shield: vitals.shield,
            teamId: player.teamId ?? null,
            isLocal: player.id === playerId
          };
        })
        .sort((a, b) => b.score - a.score);
    }

    return Object.entries(scoreByPlayer)
      .map(([id, scoreValue]) => {
        const vitals = playerVitals[id] ?? { health: 100, shield: 0 };
        return {
          id,
          name: undefined,
          score: sanitizeScore(scoreValue),
          health: vitals.health,
          shield: vitals.shield,
          teamId: null,
          isLocal: false
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [playerId, playerVitals, roomPlayers, sanitizeScore, scoreByPlayer]);

  const totalPlayers = roomPlayers.length;
  const readyCount = useMemo(() => roomPlayers.filter(player => player.ready).length, [roomPlayers]);
  const allReady = totalPlayers > 0 && readyCount === totalPlayers;
  const matchActive = connectionStatus === 'open' ? matchLive : true;
  const canToggleReady = connectionStatus === 'open';
  const baseScoreCap = 300;
  const scoreCap = scoreCapOverride ?? (baseScoreCap + Math.max(0, totalPlayers - 2) * 150);
  const topScore = useMemo(() => {
    if (playersForHud.length === 0) return 0;
    return Math.max(...playersForHud.map(player => player.score));
  }, [playersForHud]);

  const handleReadyToggle = useCallback(() => {
    if (!canToggleReady) return;
    const next = !localReady;
    setLocalReady(next);
    const client = networkRef.current;
    if (client && client.isOpen()) {
      client.send({ type: 'player_ready', ready: next });
    }
  }, [canToggleReady, localReady]);

  const resetMatchState = useCallback(() => {
    setMatchLive(false);
    setMatchCountdown(null);
    setMatchTimer(null);
    setMatchEnded(false);
    setMatchSummaryOpen(false);
    setLocalReady(false);
    setScoreByPlayer({});
    setScore(0);
    setPlayerVitals(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = { ...next[key], health: 100, shield: next[key].shield };
      });
      return next;
    });
  }, []);

  const handleMatchReset = useCallback(() => {
    const client = networkRef.current;
    if (client && client.isOpen()) {
      client.send({ type: 'match_reset', reason: 'manual' });
    }
    resetMatchState();
  }, [resetMatchState]);

  const endMatch = useCallback(() => {
    if (matchEnded) return;
    setMatchEnded(true);
    setMatchLive(false);
    setMatchCountdown(null);
    setMatchSummaryOpen(true);
    setLocalReady(false);
    const client = networkRef.current;
    if (client && client.isOpen()) {
      client.send({ type: 'player_ready', ready: false });
    }
  }, [matchEnded]);

  const startMatchTimer = useCallback(() => {
    setMatchTimer(matchDurationSec);
    setMatchEnded(false);
    setMatchSummaryOpen(false);
  }, [matchDurationSec]);

  useEffect(() => {
    if (connectionStatus !== 'open') {
      setMatchLive(true);
      setMatchCountdown(null);
      setMatchTimer(null);
      setMatchEnded(false);
      return;
    }

    if (matchEnded) {
      return;
    }

    if (!allReady) {
      setMatchLive(false);
      setMatchCountdown(null);
      setMatchTimer(null);
      setMatchEnded(false);
      return;
    }

    if (matchLive) {
      return;
    }

    if (matchCountdown === null) {
      setMatchCountdown(3);
      return;
    }

    if (matchCountdown <= 1) {
      setMatchLive(true);
      setMatchCountdown(null);
      startMatchTimer();
      return;
    }

    const timer = window.setTimeout(() => {
      setMatchCountdown(prev => (prev === null ? prev : prev - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [allReady, connectionStatus, matchCountdown, matchEnded, matchLive, startMatchTimer]);

  useEffect(() => {
    if (!matchLive || matchTimer === null || matchEnded) {
      return;
    }

    if (matchTimer <= 0) {
      endMatch();
      return;
    }

    const timer = window.setTimeout(() => {
      setMatchTimer(prev => (prev === null ? prev : Math.max(0, prev - 1)));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [endMatch, matchEnded, matchLive, matchTimer]);

  useEffect(() => {
    if (!matchLive || matchEnded) return;
    if (topScore >= scoreCap) {
      endMatch();
    }
  }, [endMatch, matchEnded, matchLive, topScore]);

  useEffect(() => {
    if (qualityTier === 'low') {
      setEffectsEnabled(false);
      setAudioEnabled(false);
    }
    if (qualityTier === 'balanced') {
      setEffectsEnabled(true);
    }
  }, [qualityTier]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('neonArcQuality', qualityTier);
    window.localStorage.setItem('neonArcFX', String(effectsEnabled));
    window.localStorage.setItem('neonArcAudio', String(audioEnabled));
  }, [qualityTier, effectsEnabled, audioEnabled]);
  const teamGroups = useMemo(() => {
    const groups = new Map<string, typeof playersForHud>();
    playersForHud.forEach(player => {
      const key = player.teamId ?? 'unassigned';
      const current = groups.get(key) ?? [];
      groups.set(key, [...current, player]);
    });

    return Array.from(groups.entries())
      .map(([teamId, members]) => {
        const totalScore = members.reduce((sum, member) => sum + member.score, 0);
        return { teamId, members, totalScore };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [playersForHud]);
  const mvp = useMemo(() => {
    if (playersForHud.length === 0) return null;
    return playersForHud[0];
  }, [playersForHud]);
  const winningTeam = useMemo(() => {
    if (teamGroups.length === 0) return null;
    return teamGroups[0];
  }, [teamGroups]);

  const formatPlayerName = (player: { id: string; name?: string; isLocal?: boolean }) => {
    const trimmed = (player.name ?? '').trim();
    const base = trimmed.length > 0 ? trimmed : player.id.slice(0, 8);
    return player.isLocal ? `${base} (You)` : base;
  };

  const teamBadgeClass = (teamId: string | null | undefined) => {
    switch ((teamId ?? '').toLowerCase()) {
      case 'red':
        return 'bg-rose-400';
      case 'blue':
        return 'bg-sky-400';
      case 'green':
        return 'bg-emerald-400';
      case 'yellow':
        return 'bg-amber-400';
      case 'alpha':
        return 'bg-cyan-400';
      case 'beta':
        return 'bg-violet-400';
      default:
        return 'bg-white/20';
    }
  };
  const winningBadgeClass = winningTeam ? teamBadgeClass(winningTeam.teamId) : 'bg-white/20';
  const localDisplayName = playerName?.trim() || (playerId ? playerId.slice(0, 8) : 'pending');
  const scoreEntries = playersForHud.map(player => ({
    id: player.id,
    label: formatPlayerName(player),
    score: player.score
  }));
  const connectionBadge =
    connectionStatus === 'open'
      ? 'bg-green-400'
      : connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
        ? 'bg-yellow-400'
        : connectionStatus === 'error'
          ? 'bg-red-500'
          : 'bg-white/30';

  return (
    <>
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
          setScore={handleLocalScore} 
          setBallsCount={setBallCount}
          setStatus={setStatus}
          playerId={playerId ?? undefined}
          localTeamId={localTeamId ?? undefined}
          friendlyFire={friendlyFireEnabled}
          matchActive={matchActive}
          targets={hitTargets}
          onScoreEvent={handleScoreEvent}
          onShieldState={handleShieldState}
          onPowerUpState={handlePowerUpState}
          qualityTier={qualityTier}
          effectsEnabled={effectsEnabled}
          audioEnabled={audioEnabled}
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
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${connectionBadge}`} />
                <span>Net: <span className="text-white font-mono">{connectionStatus}</span></span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-cyan-100/80">
              <div className="flex items-center gap-2">
                <span>Player:</span>
                <span className="text-white font-mono">{localDisplayName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${teamBadgeClass(localTeamId)}`} />
                <span>Team:</span>
                <span className="text-white font-mono">{localTeamId ?? 'none'}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-widest text-white/70">
              <button
                type="button"
                onClick={() => setQualityTier('high')}
                className={`pointer-events-auto rounded-md px-2 py-1 border ${qualityTier === 'high' ? 'border-cyan-400 text-white' : 'border-white/10'}`}
              >
                High
              </button>
              <button
                type="button"
                onClick={() => setQualityTier('balanced')}
                className={`pointer-events-auto rounded-md px-2 py-1 border ${qualityTier === 'balanced' ? 'border-cyan-400 text-white' : 'border-white/10'}`}
              >
                Balanced
              </button>
              <button
                type="button"
                onClick={() => setQualityTier('low')}
                className={`pointer-events-auto rounded-md px-2 py-1 border ${qualityTier === 'low' ? 'border-cyan-400 text-white' : 'border-white/10'}`}
              >
                Low
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/70">
              <button
                type="button"
                onClick={() => setEffectsEnabled(prev => !prev)}
                className={`pointer-events-auto rounded-md px-2 py-1 border ${effectsEnabled ? 'border-cyan-400 text-white' : 'border-white/10'}`}
              >
                FX {effectsEnabled ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={() => setAudioEnabled(prev => !prev)}
                className={`pointer-events-auto rounded-md px-2 py-1 border ${audioEnabled ? 'border-cyan-400 text-white' : 'border-white/10'}`}
              >
                Audio {audioEnabled ? 'On' : 'Off'}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-white/70">
              <button
                type="button"
                onClick={handleReadyToggle}
                disabled={!canToggleReady}
                className={`pointer-events-auto rounded-md px-2 py-1 border ${
                  localReady ? 'border-emerald-400 text-white' : 'border-white/10'
                } ${!canToggleReady ? 'opacity-50' : ''}`}
              >
                {localReady ? 'Unready' : 'Ready'}
              </button>
              <button
                type="button"
                onClick={handleMatchReset}
                className="pointer-events-auto rounded-md px-2 py-1 border border-white/20 text-white/80"
              >
                Reset
              </button>
              <span>Ready {readyCount}/{totalPlayers}</span>
              <span>
                {matchCountdown !== null ? `Countdown ${matchCountdown}` : matchActive ? 'Match Live' : 'Waiting'}
              </span>
              <span>Timer {matchTimer ?? '-'}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 text-right">
            <div className="bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10">
              <div className="text-xs text-cyan-200 uppercase tracking-widest">Score</div>
              <div className="text-4xl font-mono font-bold text-white tabular-nums">{score.toString().padStart(4, '0')}</div>
            </div>
            <div className="bg-black/40 backdrop-blur-md p-3 rounded-xl border border-white/10 w-64">
              <div className="text-[10px] text-cyan-200 uppercase tracking-widest mb-2">Combatants</div>
              {teamGroups.length === 0 ? (
                <div className="text-[11px] text-white/70">No players yet.</div>
              ) : (
                <div className="space-y-2 text-[11px] font-mono">
                  {teamGroups.map(group => (
                    <div key={group.teamId} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-white/70">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${teamBadgeClass(group.teamId)}`} />
                          <span className="uppercase tracking-widest">
                            {group.teamId === 'unassigned' ? 'Neutral' : group.teamId}
                          </span>
                        </div>
                        <span className="text-white/80">Team {group.totalScore}</span>
                      </div>
                      {group.members.map(player => (
                        <div key={player.id} className="flex items-center justify-between text-white/80">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${player.isLocal ? 'bg-cyan-400' : 'bg-white/20'}`} />
                            <span className={player.isLocal ? 'text-white' : 'text-white/70'}>
                              {formatPlayerName(player)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] tabular-nums text-white/70">
                            <span>HP {player.health}</span>
                            <span>SH {player.shield}</span>
                            <span className="text-white">{player.score}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              <li><span className="text-cyan-300">FLICK FAST</span> to throw</li>
              <li><span className="text-cyan-300">CATCH</span> with open hand</li>
              <li><span className="text-cyan-300">BOTH PALMS FORWARD</span> to shield</li>
              <li><span className="text-cyan-300">GRAB POWER-UP</span> with palm up</li>
              <li><span className="text-cyan-300">AVOID SHOCK FIELD</span> during pulses</li>
              <li><span className="text-cyan-300">PRESS D</span> to toggle debug</li>
            </ul>
          </div>
        </div>
      </div>

      {showDebug && (
        <div className="absolute left-6 top-28 z-50 w-80 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-3 text-xs text-cyan-100/90">
          <div className="text-[10px] text-cyan-300 uppercase tracking-widest mb-2">Gesture Debug</div>
          {hands.length === 0 ? (
            <div className="text-white/70">No hands detected.</div>
          ) : (
            <div className="space-y-2">
              {hands.map(hand => (
                <div key={hand.id} className="border border-white/5 rounded-lg p-2">
                  <div className="text-white font-mono">{hand.id}</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                    <div>Palm Up: <span className="text-white">{hand.palmUp ? 'yes' : 'no'}</span></div>
                    <div>Forward: <span className="text-white">{hand.palmForward ? 'yes' : 'no'}</span></div>
                    <div>Pinch: <span className="text-white">{hand.pinchStrength.toFixed(2)}</span></div>
                    <div>Speed: <span className="text-white">{hand.velocity.length().toFixed(2)}</span></div>
                    <div>Accel: <span className="text-white">{hand.acceleration.length().toFixed(2)}</span></div>
                    <div>Handed: <span className="text-white">{hand.handedness}</span></div>
                  </div>
                </div>
              ))}
            </div>
            )}
          <div className="mt-3 border-t border-white/10 pt-2">
            <div className="text-[10px] text-cyan-300 uppercase tracking-widest mb-1">Scoreboard</div>
            {scoreEntries.length === 0 ? (
              <div className="text-white/70">No score events yet.</div>
            ) : (
              <div className="space-y-1">
                {scoreEntries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between">
                    <span className="text-white font-mono">{entry.label}</span>
                    <span className="text-white tabular-nums">{entry.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 border-t border-white/10 pt-2 text-[11px] text-white/80">
            <div className="text-[10px] text-cyan-300 uppercase tracking-widest mb-1">Shield</div>
            <div>Status: <span className="text-white font-mono">{shieldState.active ? 'active' : 'idle'}</span></div>
            <div>Energy: <span className="text-white font-mono">{shieldState.energy.toFixed(2)}</span></div>
            <div>Durability: <span className="text-white font-mono">{Math.round(shieldState.durability)}</span></div>
            <div>Cooldown: <span className="text-white font-mono">{shieldState.cooldown.toFixed(1)}</span></div>
          </div>
          <div className="mt-3 border-t border-white/10 pt-2 text-[11px] text-white/80">
            <div className="text-[10px] text-cyan-300 uppercase tracking-widest mb-1">Power-Up</div>
            <div>Active: <span className="text-white font-mono">{powerUpState.active ? 'yes' : 'no'}</span></div>
            <div>Type: <span className="text-white font-mono">{powerUpState.type ?? 'none'}</span></div>
          </div>
          <div className="mt-3 border-t border-white/10 pt-2 text-[11px] text-white/80">
            <div>Room: <span className="text-white font-mono">{roomId}</span></div>
            <div>Player: <span className="text-white font-mono">{playerId ?? 'pending'}</span></div>
            <div>Team: <span className="text-white font-mono">{localTeamId ?? 'none'}</span></div>
            <div>Friendly Fire: <span className="text-white font-mono">{friendlyFireEnabled ? 'on' : 'off'}</span></div>
            <div>Ready: <span className="text-white font-mono">{localReady ? 'yes' : 'no'}</span></div>
            <div>All Ready: <span className="text-white font-mono">{allReady ? 'yes' : 'no'}</span></div>
            <div>Countdown: <span className="text-white font-mono">{matchCountdown ?? '-'}</span></div>
            <div>Match Live: <span className="text-white font-mono">{matchActive ? 'yes' : 'no'}</span></div>
            <div>Timer: <span className="text-white font-mono">{matchTimer ?? '-'}</span></div>
            <div>Score Cap: <span className="text-white font-mono">{scoreCap}</span></div>
            {networkError ? (
              <div>Error: <span className="text-white font-mono">{networkError}</span></div>
            ) : null}
          </div>
        </div>
      )}
      
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

      {matchSummaryOpen ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-[320px] bg-black/70 border border-white/10 rounded-2xl p-6 text-center">
            <div className={`h-1 rounded-full mb-4 ${winningBadgeClass}`} />
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-400 mb-2">Match Summary</div>
            <div className="text-2xl font-bold text-white mb-4">
              {teamGroups.length > 1 ? 'Team Victory' : 'Top Scorer'}
            </div>
            {mvp ? (
              <div className="text-sm text-white/80 mb-4">
                MVP <span className="text-white font-mono">{formatPlayerName(mvp)}</span> — {mvp.score} pts
              </div>
            ) : null}
            <div className="space-y-2 text-sm text-white/80">
              {teamGroups.slice(0, 2).map(group => (
                <div key={group.teamId} className="flex items-center justify-between">
                  <span className="uppercase tracking-widest">{group.teamId === 'unassigned' ? 'Neutral' : group.teamId}</span>
                  <span className="text-white font-mono">{group.totalScore}</span>
                </div>
              ))}
              {teamGroups.length === 0 ? (
                <div className="text-white/70">No scores recorded.</div>
              ) : null}
            </div>
            <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleMatchReset}
              className="pointer-events-auto rounded-full px-4 py-2 text-xs uppercase tracking-widest border border-cyan-400 text-white"
            >
              Reset
            </button>
              <button
                type="button"
                onClick={() => setMatchSummaryOpen(false)}
                className="pointer-events-auto rounded-full px-4 py-2 text-xs uppercase tracking-widest border border-white/20 text-white/80"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default App;
