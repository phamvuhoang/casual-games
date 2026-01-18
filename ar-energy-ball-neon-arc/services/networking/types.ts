export type PlayerId = string;
export type RoomId = string;
export type TeamId = string;

export type Vector3Like = {
  x: number;
  y: number;
  z: number;
};

export type Handedness = 'Left' | 'Right';

export type HandPose = {
  id: string;
  handedness: Handedness;
  worldPos: Vector3Like;
  velocity: Vector3Like;
  acceleration: Vector3Like;
  palmUp: boolean;
  palmForward: boolean;
  pinchStrength: number;
};

export type PlayerState = {
  id: PlayerId;
  name?: string;
  teamId?: TeamId;
  score: number;
  ready: boolean;
  lastSeenAt: number;
};

export type BallState = {
  id: string;
  ownerId: PlayerId | null;
  position: Vector3Like;
  velocity: Vector3Like;
  energy: number;
  state: 'charging' | 'flying' | 'fizzle';
};

export type RoomState = {
  id: RoomId;
  tick: number;
  serverTime: number;
  players: PlayerState[];
  balls: BallState[];
};

export type ClientJoinRoom = {
  type: 'join_room';
  roomId: RoomId;
  name?: string;
  teamId?: TeamId;
};

export type ClientLeaveRoom = {
  type: 'leave_room';
};

export type ClientReady = {
  type: 'player_ready';
  ready: boolean;
};

export type ClientPoseUpdate = {
  type: 'pose_update';
  hands: HandPose[];
  shieldActive: boolean;
  timestamp: number;
};

export type ClientBallHit = {
  type: 'ball_hit';
  ballId: string;
  targetId: PlayerId;
  energy: number;
  timestamp: number;
};

export type ClientMatchReset = {
  type: 'match_reset';
  reason?: string;
};

export type ClientPing = {
  type: 'ping';
  timestamp: number;
};

export type ClientMessage =
  | ClientJoinRoom
  | ClientLeaveRoom
  | ClientReady
  | ClientPoseUpdate
  | ClientBallHit
  | ClientMatchReset
  | ClientPing;

export type ServerJoined = {
  type: 'joined';
  playerId: PlayerId;
  roomId: RoomId;
  state: RoomState;
};

export type ServerPlayerJoined = {
  type: 'player_joined';
  player: PlayerState;
};

export type ServerPlayerLeft = {
  type: 'player_left';
  playerId: PlayerId;
};

export type ServerRoomUpdate = {
  type: 'room_update';
  state: RoomState;
};

export type ServerPoseUpdate = {
  type: 'pose_update';
  playerId: PlayerId;
  hands: HandPose[];
  shieldActive: boolean;
  timestamp: number;
};

export type ServerBallHit = {
  type: 'ball_hit';
  ballId: string;
  shooterId: PlayerId;
  targetId: PlayerId;
  energy: number;
  points: number;
  damage: number;
  timestamp: number;
};

export type ServerMatchReset = {
  type: 'match_reset';
  reason?: string;
  timestamp: number;
};

export type ServerError = {
  type: 'error';
  code: string;
  message: string;
};

export type ServerPong = {
  type: 'pong';
  timestamp: number;
};

export type ServerMessage =
  | ServerJoined
  | ServerPlayerJoined
  | ServerPlayerLeft
  | ServerRoomUpdate
  | ServerPoseUpdate
  | ServerBallHit
  | ServerMatchReset
  | ServerError
  | ServerPong;
