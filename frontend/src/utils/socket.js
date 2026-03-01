import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:5000';

/**
 * Create Socket.IO client for real-time updates (SignalR equivalent in MERN).
 * Connect to the same origin as the API server.
 */
export function createSocket() {
  return io(API_BASE, {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });
}
