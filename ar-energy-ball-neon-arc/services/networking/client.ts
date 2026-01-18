import type {
  ClientMessage,
  ClientJoinRoom,
  ClientLeaveRoom,
  ServerMessage
} from './types';
import { createLatencyWrapper, type LatencyOptions } from './latency';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error' | 'reconnecting';

export type NetworkClientOptions = {
  url: string;
  roomId: string;
  name?: string;
  teamId?: string;
  latency?: LatencyOptions;
  autoReconnect?: boolean;
  maxBackoffMs?: number;
  onStatusChange?: (status: ConnectionStatus) => void;
  onMessage?: (message: ServerMessage) => void;
};

export class NetworkClient {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = 'idle';
  private backoffMs = 1000;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private manualClose = false;
  private options: NetworkClientOptions;
  private deliverMessage: (message: ServerMessage) => void;
  private enqueueSend: (message: ClientMessage) => void;

  constructor(options: NetworkClientOptions) {
    this.options = {
      autoReconnect: true,
      maxBackoffMs: 20000,
      ...options
    };

    const deliver = (message: ServerMessage) => {
      this.options.onMessage?.(message);
    };

    const sendNow = (message: ClientMessage) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      }
    };

    if (this.options.latency) {
      const wrap = createLatencyWrapper(this.options.latency);
      this.deliverMessage = wrap(deliver);
      this.enqueueSend = wrap(sendNow);
    } else {
      this.deliverMessage = deliver;
      this.enqueueSend = sendNow;
    }
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.manualClose = false;
    this.setStatus(this.status === 'error' || this.status === 'closed' ? 'reconnecting' : 'connecting');

    this.ws = new WebSocket(this.options.url);

    this.ws.onopen = () => {
      this.backoffMs = 1000;
      this.setStatus('open');
      const joinMessage: ClientJoinRoom = {
        type: 'join_room',
        roomId: this.options.roomId,
        name: this.options.name,
        teamId: this.options.teamId
      };
      this.send(joinMessage);
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ServerMessage;
        this.deliverMessage(payload);
      } catch (error) {
        this.setStatus('error');
      }
    };

    this.ws.onerror = () => {
      this.setStatus('error');
    };

    this.ws.onclose = () => {
      this.stopPing();
      this.setStatus('closed');
      if (!this.manualClose && this.options.autoReconnect) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect() {
    this.manualClose = true;
    this.clearReconnect();
    const leaveMessage: ClientLeaveRoom = { type: 'leave_room' };
    this.send(leaveMessage);
    this.ws?.close();
    this.ws = null;
    this.stopPing();
    this.setStatus('closed');
  }

  send(message: ClientMessage) {
    this.enqueueSend(message);
  }

  isOpen() {
    return this.status === 'open';
  }

  getStatus() {
    return this.status;
  }

  private setStatus(next: ConnectionStatus) {
    this.status = next;
    this.options.onStatusChange?.(next);
  }

  private scheduleReconnect() {
    this.clearReconnect();
    const delay = Math.min(this.backoffMs, this.options.maxBackoffMs ?? 20000);
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
    this.backoffMs = Math.min(this.backoffMs * 2, this.options.maxBackoffMs ?? 20000);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 10000);
  }

  private stopPing() {
    if (this.pingTimer) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

export const createNetworkClient = (options: NetworkClientOptions) => new NetworkClient(options);
