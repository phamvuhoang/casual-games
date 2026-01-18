import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8787);

const rooms = new Map();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const calculatePoints = (energy) => Math.round(10 + energy * 20);
const calculateDamage = (energy) => Math.round(8 + energy * 12);

const createRoom = (roomId) => ({
  id: roomId,
  players: new Map(),
  balls: [],
  tick: 0,
  createdAt: Date.now()
});

const getRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom(roomId));
  }
  return rooms.get(roomId);
};

const toPlayerState = (player) => ({
  id: player.id,
  name: player.name,
  teamId: player.teamId,
  score: player.score ?? 0,
  ready: player.ready ?? false,
  lastSeenAt: player.lastSeenAt ?? Date.now()
});

const buildRoomState = (room) => ({
  id: room.id,
  tick: room.tick,
  serverTime: Date.now(),
  players: Array.from(room.players.values()).map(toPlayerState),
  balls: room.balls
});

const send = (ws, payload) => {
  ws.send(JSON.stringify(payload));
};

const broadcast = (room, payload, excludeId) => {
  const message = JSON.stringify(payload);
  room.players.forEach((player) => {
    if (excludeId && player.id === excludeId) return;
    if (player.ws.readyState === player.ws.OPEN) {
      player.ws.send(message);
    }
  });
};

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  res.writeHead(200);
  res.end('Neon Arc server');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      send(ws, { type: 'error', code: 'bad_json', message: 'Invalid JSON payload.' });
      return;
    }

    if (!message || typeof message.type !== 'string') {
      send(ws, { type: 'error', code: 'bad_message', message: 'Missing message type.' });
      return;
    }

    switch (message.type) {
      case 'join_room': {
        const roomId = message.roomId ?? 'lobby';
        const room = getRoom(roomId);
        const playerId = randomUUID();
        const player = {
          id: playerId,
          name: message.name,
          teamId: message.teamId,
          score: 0,
          ready: false,
          lastSeenAt: Date.now(),
          ws
        };
        room.players.set(playerId, player);
        ws.playerId = playerId;
        ws.roomId = roomId;

        send(ws, { type: 'joined', playerId, roomId, state: buildRoomState(room) });
        broadcast(room, { type: 'player_joined', player: toPlayerState(player) }, playerId);
        break;
      }
      case 'leave_room': {
        const roomId = ws.roomId;
        const playerId = ws.playerId;
        if (!roomId || !playerId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        room.players.delete(playerId);
        broadcast(room, { type: 'player_left', playerId });
        if (room.players.size === 0) {
          rooms.delete(roomId);
        }
        break;
      }
      case 'player_ready': {
        const roomId = ws.roomId;
        const playerId = ws.playerId;
        if (!roomId || !playerId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const player = room.players.get(playerId);
        if (!player) return;
        player.ready = Boolean(message.ready);
        player.lastSeenAt = Date.now();
        broadcast(room, { type: 'room_update', state: buildRoomState(room) });
        break;
      }
      case 'pose_update': {
        const roomId = ws.roomId;
        const playerId = ws.playerId;
        if (!roomId || !playerId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const player = room.players.get(playerId);
        if (!player) return;
        player.lastPose = {
          hands: message.hands ?? [],
          shieldActive: Boolean(message.shieldActive),
          timestamp: message.timestamp ?? Date.now()
        };
        player.lastSeenAt = Date.now();
        broadcast(
          room,
          {
            type: 'pose_update',
            playerId,
            hands: player.lastPose.hands,
            shieldActive: player.lastPose.shieldActive,
            timestamp: player.lastPose.timestamp
          },
          playerId
        );
        break;
      }
      case 'ball_hit': {
        const roomId = ws.roomId;
        const playerId = ws.playerId;
        if (!roomId || !playerId) return;
        const room = rooms.get(roomId);
        if (!room) return;
        const targetId = message.targetId;
        const ballId = message.ballId ?? 'unknown';
        if (!targetId) {
          send(ws, { type: 'error', code: 'missing_target', message: 'ball_hit missing targetId.' });
          return;
        }

        const energy = clamp(Number(message.energy ?? 0), 0, 1);
        const points = calculatePoints(energy);
        const damage = calculateDamage(energy);
        const shooter = room.players.get(playerId);
        if (shooter) {
          shooter.score = (shooter.score ?? 0) + points;
          shooter.lastSeenAt = Date.now();
        }

        const payload = {
          type: 'ball_hit',
          ballId,
          shooterId: playerId,
          targetId,
          energy,
          points,
          damage,
          timestamp: message.timestamp ?? Date.now()
        };

        broadcast(room, payload);
        broadcast(room, { type: 'room_update', state: buildRoomState(room) });
        break;
      }
      case 'match_reset': {
        const roomId = ws.roomId;
        const playerId = ws.playerId;
        if (!roomId || !playerId) return;
        const room = rooms.get(roomId);
        if (!room) return;

        room.players.forEach((player) => {
          player.score = 0;
          player.ready = false;
        });

        broadcast(room, {
          type: 'match_reset',
          reason: message.reason ?? 'manual',
          timestamp: Date.now()
        });
        broadcast(room, { type: 'room_update', state: buildRoomState(room) });
        break;
      }
      case 'ping': {
        send(ws, { type: 'pong', timestamp: message.timestamp ?? Date.now() });
        break;
      }
      default: {
        send(ws, { type: 'error', code: 'unknown_type', message: 'Unknown message type.' });
      }
    }
  });

  ws.on('close', () => {
    const roomId = ws.roomId;
    const playerId = ws.playerId;
    if (!roomId || !playerId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.players.delete(playerId);
    broadcast(room, { type: 'player_left', playerId });
    if (room.players.size === 0) {
      rooms.delete(roomId);
    }
  });
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 15000);

wss.on('close', () => {
  clearInterval(heartbeat);
});

server.listen(PORT, () => {
  console.log(`Neon Arc server listening on :${PORT}`);
});
