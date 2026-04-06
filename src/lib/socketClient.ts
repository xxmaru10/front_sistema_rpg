import { io, Socket } from 'socket.io-client';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
const WS_URL = apiUrl.replace(/\/api$/, ''); // strip trailing /api if present

console.log('[SocketClient] WS_URL:', WS_URL);

let socket: Socket | null = null;

export function getSocket(userId?: string): Socket {
  if (!socket) {
    if (!WS_URL) {
      console.error('[SocketClient] WS_URL is empty — NEXT_PUBLIC_API_URL not set');
    }
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

export function connectSocket(userId: string): Socket {
  const s = getSocket(userId);
  if (!s.connected) {
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