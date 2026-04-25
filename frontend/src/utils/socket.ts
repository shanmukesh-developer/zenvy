import { io } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
const DEFAULT_SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_URL;

// Ensure we don't have trailing slashes for the socket connection if using standard path
const socketUrl = DEFAULT_SOCKET_URL.replace(/\/$/, "");

export const socket = io(socketUrl, {
  transports: ['polling', 'websocket'], // Allow fallback for better resilience
  withCredentials: true,
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 45000,
});

export default socket;
