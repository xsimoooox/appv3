import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket = null;
let registeredUserId = null;

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

  if (socket && socket.connected && registeredUserId === user.id) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
    registeredUserId = null;
  }

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
    registerUser(user);
  });

  socket.on('registered', (data) => {
    console.log('[SOCKET] Enregistré en base:', data);
    registeredUserId = user.id;
  });

  socket.on('register_confirmed', () => {
    registeredUserId = user.id;
  });

  socket.on('disconnect', () => {
    registeredUserId = null;
  });

  socket.io.on('reconnect', () => {
    registerUser(user);
  });

  return socket;
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
