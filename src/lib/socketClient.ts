import { io, Socket } from 'socket.io-client';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace('/api', '');

let socket: Socket | null = null;

export function getSocket(userId?: string): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: userId ? { userId } : {},
    });
  }
  return socket;
}

export function connectSocket(userId: string) {
  const s = getSocket(userId);
  if (!s.connected) {
    // Update auth before connecting
    (s.auth as any).userId = userId;
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}