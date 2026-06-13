import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env.PROD) return '';
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

const SOCKET_URL = getSocketUrl();
const IS_PRODUCTION = import.meta.env.PROD;

let socket = null;
let registeredUserId = null;
let socketError = null;

export function getSocket() {
  return socket;
}

function registerUser(user) {
  if (!socket?.connected || !user?.id) return;
  socket.emit('register_user', {
    userId: String(user.id),
    phoneNumber: user.phoneNumber,
  });
}

export function initSocket(user) {
  if (!user?.id) {
    console.error('[SOCKET] initSocket: user.id manquant');
    return null;
  }

  // Skip socket on production if no env URL is set
  if (IS_PRODUCTION && !SOCKET_URL) {
    console.warn('[SOCKET] Socket disabled in production (no VITE_SOCKET_URL configured). App will use Firebase fallback.');
    socketError = 'Socket service not available';
    return null;
  }

  if (socket && socket.connected && registeredUserId === user.id) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
    registeredUserId = null;
  }

  try {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('[SOCKET] Connecté:', socket.id);
      socketError = null;
      registerUser(user);
    });

    socket.on('connect_error', (error) => {
      console.warn('[SOCKET] Erreur de connexion:', error);
      socketError = error?.message || 'Connection error';
    });

    socket.on('error', (error) => {
      console.warn('[SOCKET] Erreur:', error);
      socketError = error;
    });
  } catch (err) {
    console.error('[SOCKET] Erreur lors de l\'initialisation:', err);
    socketError = err?.message || 'Failed to initialize socket';
    socket = null;
  }

  return socket;
}

export function getSocketError() {
  return socketError;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  registeredUserId = null;
}

export function callUserById({ callerId, targetUserId, offer, callType = 'voice', callerName }) {
  if (!socket?.connected) {
    console.error('[SOCKET] callUserById: socket non connecté');
    return false;
  }
  if (!targetUserId || String(targetUserId) === 'undefined') {
    console.error('[SOCKET] callUserById: targetUserId invalide:', targetUserId);
    return false;
  }
  socket.emit('call_user', {
    callerId: String(callerId),
    targetUserId: String(targetUserId),
    callerName,
    offer: offer || null,
    callType,
  });
  return true;
}
