const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const webpush = require('web-push');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.cjs');
const userRoutes = require('./routes/users.cjs');
const userRepo = require('./lib/userRepository.cjs');
const { normalizePhoneNumber } = require('./lib/phoneNormalize.cjs');
const { ensureJwtSecret } = require('./lib/bootstrapDb.cjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors());
app.use(express.json());

const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails('mailto:contact@voxmanus.app', vapidPublic, vapidPrivate);
}

/** userId (MongoDB string) → socketId */
const onlineUsers = new Map();
/** phoneNumber → userId */
const phoneToUserId = new Map();
const pushSubscriptions = new Map();
const callTurns = new Map();
const pendingSocketCalls = new Map();
const callTranscriptSequences = new Map();
const PENDING_CALL_TTL_MS = 60_000;

function cleanPhone(phoneNumber) {
  return normalizePhoneNumber(phoneNumber);
}

function callPairKey(phoneA, phoneB) {
  return [phoneA, phoneB].filter(Boolean).sort().join('|');
}

function callRoomName(phoneA, phoneB) {
  const key = callPairKey(cleanPhone(phoneA), cleanPhone(phoneB));
  return key ? `call:${key}` : '';
}

async function joinCallRoom(phoneA, phoneB) {
  const room = callRoomName(phoneA, phoneB);
  if (!room) return '';
  const socketIds = await Promise.all([
    resolveSocketIdByPhone(phoneA),
    resolveSocketIdByPhone(phoneB),
  ]);
  const joinedSocketIds = [];
  await Promise.all(
    socketIds.filter(Boolean).map(async (socketId) => {
      const liveSocket = io.sockets.sockets.get(socketId);
      if (liveSocket && !liveSocket.rooms.has(room)) {
        await liveSocket.join(room);
        joinedSocketIds.push(socketId);
      }
    }),
  );
  if (joinedSocketIds.length > 0) {
    console.log(`[CALL_ROOM] joined ${room}: ${joinedSocketIds.join(', ')}`);
  }
  return room;
}

function leaveCallRoom(phoneA, phoneB) {
  const room = callRoomName(phoneA, phoneB);
  if (!room) return;
  [resolveSocketByPhone(phoneA), resolveSocketByPhone(phoneB)]
    .filter(Boolean)
    .forEach((socketId) => io.sockets.sockets.get(socketId)?.leave(room));
}

function emitTurnChange(phoneA, phoneB, canSpeak) {
  const socketA = resolveSocketByPhone(phoneA);
  const socketB = resolveSocketByPhone(phoneB);
  if (socketA) io.to(socketA).emit('turn_change', { canSpeak });
  if (socketB) io.to(socketB).emit('turn_change', { canSpeak });
}

function resolveSocketByUserId(userId) {
  if (!userId) return null;
  const uid = String(userId);
  let socketId = onlineUsers.get(uid);
  if (socketId) {
    const live = io.sockets.sockets.get(socketId);
    if (live) return socketId;
    onlineUsers.delete(uid);
  }
  return null;
}

function resolveSocketByPhone(phone) {
  const clean = cleanPhone(phone);
  const uid = phoneToUserId.get(clean);
  if (uid) {
    const sid = resolveSocketByUserId(uid);
    if (sid) return sid;
  }
  const socketId = onlineUsers.get(clean);
  if (socketId && io.sockets.sockets.get(socketId)) return socketId;
  if (socketId) onlineUsers.delete(clean);
  return null;
}

async function resolveUserIdFromPhone(phone) {
  const clean = cleanPhone(phone);
  const cached = phoneToUserId.get(clean);
  if (cached) return cached;
  try {
    const user = await userRepo.findByPhone(clean);
    if (user) {
      const id = String(user._id?.toString?.() || user._id);
      phoneToUserId.set(clean, id);
      return id;
    }
  } catch (e) {
    console.error('[RESOLVE_PHONE]', e.message);
  }
  return null;
}

async function resolveSocketReliable({ userId, phone } = {}) {
  const direct = resolveSocketByUserId(userId) || resolveSocketByPhone(phone);
  if (direct) return direct;

  try {
    let user = null;
    if (userId && userRepo.isValidObjectId(String(userId))) {
      user = await userRepo.findById(String(userId));
    }
    if (!user && phone) {
      user = await userRepo.findByPhone(cleanPhone(phone));
    }
    const socketId = user?.currentSocketId;
    if (!socketId || !io.sockets.sockets.get(socketId)) return null;

    const uid = String(user._id?.toString?.() || user._id || userId || '');
    const clean = cleanPhone(user.phoneNumber || phone);
    if (uid) onlineUsers.set(uid, socketId);
    if (clean && uid) phoneToUserId.set(clean, uid);
    return socketId;
  } catch (error) {
    console.error('[RESOLVE_SOCKET]', error.message);
    return null;
  }
}

async function resolveSocketIdByPhone(phone) {
  if (!phone) return null;
  return resolveSocketReliable({ phone: cleanPhone(phone) });
}

async function autoJoinActiveCallRooms(socket) {
  const phone = cleanPhone(socket.data.phoneNumber);
  if (!phone) return;

  const activePairs = new Map();
  pendingSocketCalls.forEach((call, key) => {
    if (Date.now() - Number(call?.createdAt || 0) > PENDING_CALL_TTL_MS) {
      pendingSocketCalls.delete(key);
      return;
    }
    const caller = cleanPhone(call?.callerPhone);
    const target = cleanPhone(call?.targetPhone);
    if (caller && target && (caller === phone || target === phone)) {
      activePairs.set(callPairKey(caller, target), [caller, target]);
    }
  });
  callTurns.forEach((_holder, key) => {
    const [phoneA, phoneB] = key.split('|');
    if (phoneA && phoneB && (phoneA === phone || phoneB === phone)) {
      activePairs.set(key, [phoneA, phoneB]);
    }
  });

  await Promise.all(
    [...activePairs.values()].map(async ([phoneA, phoneB]) => {
      const room = callRoomName(phoneA, phoneB);
      if (room) await socket.join(room);
    }),
  );
}

async function sendIncomingCallPush({ callerPhone, targetPhone, callerName, sessionCode = '' }) {
  const cleanCaller = cleanPhone(callerPhone);
  const cleanTarget = cleanPhone(targetPhone);
  const subscription = pushSubscriptions.get(cleanTarget);
  if (!cleanCaller || !cleanTarget || !subscription || !vapidPublic || !vapidPrivate) {
    return false;
  }

  const apiBase =
    process.env.VOXMANUS_API_URL || `http://localhost:${process.env.PORT || 3001}`;
  const payload = JSON.stringify({
    type: 'incoming_call',
    callerPhone: cleanCaller,
    callerName: callerName || cleanCaller,
    targetPhone: cleanTarget,
    timestamp: Date.now(),
    url: `/?action=accept_call&from=${encodeURIComponent(cleanCaller)}${sessionCode ? `&code=${encodeURIComponent(sessionCode)}` : ''}`,
    apiBase,
  });

  try {
    await webpush.sendNotification(subscription, payload);
    console.log(`[CALL] Push sent to offline user: ${cleanTarget}`);
    return true;
  } catch (error) {
    console.error('[CALL] Push error:', error);
    if (error.statusCode === 410) {
      pushSubscriptions.delete(cleanTarget);
    }
    return false;
  }
}

async function broadcastOnlineStatus(userId, isOnline) {
  try {
    const user = await userRepo.findByIdPopulateContacts(userId);
    if (!user) return;

    user.contacts.forEach((c) => {
      const contactId = c.userId?._id?.toString();
      const contactSocketId = contactId ? resolveSocketByUserId(contactId) : null;
      if (contactSocketId) {
        io.to(contactSocketId).emit('contact_status_changed', {
          userId,
          isOnline,
        });
      }
    });
  } catch (e) {
    /* ignore */
  }
}

ensureJwtSecret();
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    ok: userRepo.isReady(),
    db: userRepo.getBackend() || 'starting',
  });
});

app.post('/subscribe', (req, res) => {
  const { phoneNumber, subscription } = req.body;
  if (!phoneNumber || !subscription) {
    return res.status(400).json({ error: 'Missing data' });
  }
  pushSubscriptions.set(cleanPhone(phoneNumber), subscription);
  console.log(`Push subscription saved: ${phoneNumber}`);
  return res.status(201).json({ message: 'Subscription saved' });
});

app.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidPublic || '' });
});

app.post('/reject-call', (req, res) => {
  const { callerPhone, targetPhone, callerId, targetUserId } = req.body;
  const callerSocketId =
    (callerId && resolveSocketByUserId(callerId)) || resolveSocketByPhone(callerPhone);
  if (callerSocketId) {
    io.to(callerSocketId).emit('call_rejected', {
      by: targetUserId || targetPhone,
    });
  }
  res.json({ ok: true });
});

app.get('/debug/online', (req, res) => {
  const users = {};
  onlineUsers.forEach((sid, uid) => {
    users[uid] = sid;
  });
  res.json({ total: onlineUsers.size, users, phoneToUserId: Object.fromEntries(phoneToUserId) });
});

app.get('/debug/users', (req, res) => {
  const users = {};
  for (const [uid, sid] of onlineUsers.entries()) {
    users[uid] = sid;
  }
  res.json({ total: onlineUsers.size, users });
});

io.on('connection', (socket) => {
  console.log(`[SOCKET] Connexion: ${socket.id}`);

  socket.on('register_user', async (payload) => {
    let uid = null;
    let phone = null;

    if (typeof payload === 'string' || typeof payload === 'number') {
      phone = cleanPhone(payload);
    } else if (payload && typeof payload === 'object') {
      if (payload.userId) {
        uid = String(payload.userId);
      }
      if (payload.phoneNumber) {
        phone = cleanPhone(payload.phoneNumber);
      }
    }

    if (!uid && phone) {
      uid = await resolveUserIdFromPhone(phone);
      if (!uid) {
        uid = phone;
      }
    }

    if (!uid || uid === 'undefined' || uid === 'null') {
      console.error('[SOCKET] register_user: userId invalide', payload);
      socket.emit('register_error', { message: 'userId invalide' });
      return;
    }

    onlineUsers.set(uid, socket.id);
    socket.userId = uid;
    if (phone) {
      phoneToUserId.set(phone, uid);
      socket.data.phoneNumber = phone;
    } else if (userRepo.isValidObjectId(uid)) {
      try {
        const user = await userRepo.findById(uid);
        if (user?.phoneNumber) {
          phoneToUserId.set(user.phoneNumber, uid);
          socket.data.phoneNumber = user.phoneNumber;
        }
      } catch (e) {
        /* ignore */
      }
    } else {
      socket.data.phoneNumber = uid;
      phoneToUserId.set(uid, uid);
    }

    if (userRepo.isValidObjectId(uid)) {
      try {
        await userRepo.findByIdAndUpdate(uid, {
          currentSocketId: socket.id,
          isOnline: true,
          lastSeen: new Date(),
        });
      } catch (e) {
        console.error('[SOCKET] Erreur update user:', e.message);
      }
      broadcastOnlineStatus(uid, true);
    }

    console.log(
      `[SOCKET] Enregistré: userId=${uid}, phone=${socket.data.phoneNumber || 'n/a'}, socketId=${socket.id}, total=${onlineUsers.size}`,
    );

    await autoJoinActiveCallRooms(socket);

    socket.emit('registered', { userId: uid, socketId: socket.id });
    socket.emit('register_confirmed', {
      phoneNumber: socket.data.phoneNumber,
      userId: uid,
      socketId: socket.id,
    });

    if (socket.data.phoneNumber) {
      io.emit('user_status_change', {
        phoneNumber: socket.data.phoneNumber,
        status: 'online',
      });
    }
  });

  socket.on('call_user', async (data) => {
    const hasUserIds = data?.callerId && data?.targetUserId;
    const pendingCallerPhone = cleanPhone(socket.data.phoneNumber || data?.callerPhone);
    const pendingTargetPhone = cleanPhone(data?.targetPhone);

    if (pendingCallerPhone && pendingTargetPhone) {
      pendingSocketCalls.set(callPairKey(pendingCallerPhone, pendingTargetPhone), {
        callerId: data.callerId || socket.userId,
        callerPhone: pendingCallerPhone,
        targetPhone: pendingTargetPhone,
        offer: data.offer || null,
        sessionCode: data.sessionCode || '',
        createdAt: Date.now(),
      });
    }

    if (hasUserIds) {
      const callerStr = String(data.callerId);
      const targetStr = String(data.targetUserId);

      console.log(`[CALL] call_user (id): ${callerStr} → ${targetStr}`);

      if (!targetStr || targetStr === 'undefined') {
        socket.emit('call_failed', {
          reason: 'invalid_target',
          message: 'Cible invalide',
          targetUserId: targetStr,
        });
        return;
      }

      const targetSocketId = await resolveSocketReliable({
        userId: targetStr,
        phone: data.targetPhone,
      });

      if (!targetSocketId) {
        const pushed = await sendIncomingCallPush({
          callerPhone: socket.data.phoneNumber,
          targetPhone: data.targetPhone,
          callerName: data.callerName,
          sessionCode: data.sessionCode || '',
        });
        if (pushed) {
          socket.emit('call_sent', { targetUserId: targetStr, timestamp: Date.now() });
          return;
        }

        console.log(`[CALL] Target offline: ${targetStr}`);
        socket.emit('call_failed', {
          reason: 'user_offline',
          message: "Cet utilisateur n'est pas connecté en ce moment",
          targetUserId: targetStr,
        });
        return;
      }

      const liveTargetSocket = io.sockets.sockets.get(targetSocketId);
      if (!liveTargetSocket) {
        onlineUsers.delete(targetStr);
        if (userRepo.isValidObjectId(targetStr)) {
          await userRepo.findByIdAndUpdate(targetStr, {
            isOnline: false,
            currentSocketId: null,
          });
        }
        socket.emit('call_failed', {
          reason: 'user_disconnected',
          message: "L'utilisateur s'est déconnecté",
          targetUserId: targetStr,
        });
        return;
      }

      let callerName = data.callerName || 'Inconnu';
      let callerPhone = socket.data.phoneNumber || null;
      if (userRepo.isValidObjectId(callerStr)) {
        try {
          const caller = await userRepo.findById(callerStr);
          callerName = caller?.name || callerName;
          callerPhone = caller?.phoneNumber || callerPhone;
        } catch (e) {
          /* ignore */
        }
      }

      const targetPhone = cleanPhone(data.targetPhone || liveTargetSocket.data.phoneNumber);
      if (callerPhone && targetPhone) {
        await joinCallRoom(callerPhone, targetPhone);
      }

      io.to(targetSocketId).emit('incoming_call', {
        callerId: callerStr,
        callerName,
        callerPhone,
        targetPhone,
        targetUserId: targetStr,
        offer: data.offer || null,
        callType: data.callType || 'voice',
        sessionCode: data.sessionCode || '',
        timestamp: Date.now(),
      });

      console.log(`[CALL] incoming_call envoyé à socket ${targetSocketId}`);
      socket.emit('call_sent', { targetUserId: targetStr, timestamp: Date.now() });
      return;
    }

    const { callerPhone, targetPhone, callerName } = data || {};
    console.log(`[CALL] ${callerPhone} → ${targetPhone}`);

    if (!callerPhone || !targetPhone) {
      socket.emit('call_failed', { reason: 'invalid_phones', targetPhone });
      return;
    }

    const cleanCaller = cleanPhone(callerPhone);
    const cleanTarget = cleanPhone(targetPhone);

    const targetSocketId = await resolveSocketReliable({ phone: cleanTarget });
    console.log(`[CALL] Target socketId: ${targetSocketId || 'NOT FOUND'}`);

    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!targetSocket) {
        onlineUsers.delete(phoneToUserId.get(cleanTarget) || cleanTarget);
        io.emit('user_status_change', { phoneNumber: cleanTarget, status: 'offline' });
        socket.emit('call_failed', { reason: 'user_offline', targetPhone: cleanTarget });
        return;
      }

      const callerIdResolved = (await resolveUserIdFromPhone(cleanCaller)) || cleanCaller;
      const targetIdResolved = (await resolveUserIdFromPhone(cleanTarget)) || cleanTarget;

      await joinCallRoom(cleanCaller, cleanTarget);
      io.to(targetSocketId).emit('incoming_call', {
        callerPhone: cleanCaller,
        callerName: callerName || cleanCaller,
        targetPhone: cleanTarget,
        callerId: callerIdResolved,
        targetUserId: targetIdResolved,
        sessionCode: data.sessionCode || '',
        timestamp: Date.now(),
      });
      console.log(`[CALL] incoming_call sent to ${cleanTarget}`);
      return;
    }

    if (
      await sendIncomingCallPush({
        callerPhone: cleanCaller,
        targetPhone: cleanTarget,
        callerName,
        sessionCode: data.sessionCode || '',
      })
    ) {
      return;
    }

    socket.emit('call_failed', { reason: 'user_offline', targetPhone: cleanTarget });
  });

  socket.on('answer_call', async ({ callerId, answer, callerPhone, targetPhone }) => {
    const callerUid = callerId ? String(callerId) : await resolveUserIdFromPhone(callerPhone);
    const callerSocketId = await resolveSocketReliable({
      userId: callerUid,
      phone: callerPhone,
    });

    if (callerSocketId) {
      io.to(callerSocketId).emit('call_answered', {
        from: socket.userId,
        answer,
      });
      console.log(`[CALL] Réponse WebRTC envoyée à ${callerUid || callerPhone}`);
    }

    if (callerPhone && (targetPhone || socket.data.phoneNumber)) {
      const target = cleanPhone(targetPhone || socket.data.phoneNumber);
      const caller = cleanPhone(callerPhone);
      const key = callPairKey(caller, target);
      const sessionCode = pendingSocketCalls.get(key)?.sessionCode || '';
      await joinCallRoom(caller, target);
      callTurns.set(key, caller);
      emitTurnChange(caller, target, caller);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_accepted', {
          by: target,
          sessionCode,
          timestamp: Date.now(),
        });
      }
      socket.emit('call_accepted', {
        by: caller,
        sessionCode,
        timestamp: Date.now(),
      });
      pendingSocketCalls.delete(callPairKey(caller, target));
      io.emit('user_status_change', { phoneNumber: caller, status: 'busy' });
      io.emit('user_status_change', { phoneNumber: target, status: 'busy' });
    }
  });

  socket.on('accept_call', async ({ callerPhone, targetPhone }) => {
    console.log(`[ACCEPT] ${targetPhone} accepts call from ${callerPhone}`);
    const callerSocketId = await resolveSocketIdByPhone(callerPhone);
    const cleanCaller = cleanPhone(callerPhone);
    const cleanTarget = cleanPhone(targetPhone);
    const key = callPairKey(cleanCaller, cleanTarget);
    await joinCallRoom(cleanCaller, cleanTarget);
    const pending = pendingSocketCalls.get(callPairKey(cleanCaller, cleanTarget));
    const sessionCode = pending?.sessionCode || '';
    if (pending?.offer) {
      socket.emit('push_call_offer', pending);
    }
    callTurns.set(key, cleanCaller);
    emitTurnChange(cleanCaller, cleanTarget, cleanCaller);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_accepted', {
        by: cleanTarget,
        sessionCode,
        timestamp: Date.now(),
      });
      io.emit('user_status_change', { phoneNumber: cleanCaller, status: 'busy' });
      io.emit('user_status_change', { phoneNumber: cleanTarget, status: 'busy' });
    }
    socket.emit('call_accepted', {
      by: cleanCaller,
      sessionCode,
      timestamp: Date.now(),
    });
  });

  socket.on('ice_candidate', async ({ targetUserId, candidate, targetPhone }) => {
    const targetSocketId = await resolveSocketReliable({
      userId: targetUserId,
      phone: targetPhone,
    });
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice_candidate', {
        candidate,
        from: socket.userId,
      });
    }
  });

  socket.on('reject_call', async ({ callerId, callerPhone, targetPhone, targetUserId }) => {
    const callerSocketId =
      (callerId && resolveSocketByUserId(callerId)) || resolveSocketByPhone(callerPhone);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_rejected', {
        by: targetUserId || targetPhone || socket.userId,
      });
    }
    if (callerPhone && targetPhone) {
      const key = callPairKey(callerPhone, targetPhone);
      pendingSocketCalls.delete(key);
      callTranscriptSequences.delete(key);
      leaveCallRoom(callerPhone, targetPhone);
    }
  });

  socket.on('voice_text', async ({ callerPhone, targetPhone, text, isFinal = true }) => {
    const cleanCaller = cleanPhone(callerPhone || socket.data.phoneNumber);
    const cleanTarget = cleanPhone(targetPhone);
    const cleanText = String(text || '').trim();
    if (!cleanCaller || !cleanTarget || !cleanText) return;

    const key = callPairKey(cleanCaller, cleanTarget);
    const sequence = (callTranscriptSequences.get(key) || 0) + 1;
    callTranscriptSequences.set(key, sequence);

    const room = await joinCallRoom(cleanCaller, cleanTarget);
    const targetSocketId = await resolveSocketIdByPhone(targetPhone);
    const payload = {
      from: cleanCaller,
      targetPhone: cleanTarget,
      text: cleanText,
      isFinal: Boolean(isFinal),
      sequence,
      timestamp: Date.now(),
    };

    const targetJoinedRoom =
      room && targetSocketId && io.sockets.adapter.rooms.get(room)?.has(targetSocketId);
    if (targetJoinedRoom) {
      socket.to(room).emit('receive_voice_text', payload);
      if (isFinal) console.log(`[VOICE_TEXT] ${cleanCaller} -> ${room} final #${sequence}`);
    } else if (targetSocketId) {
      io.to(targetSocketId).emit('receive_voice_text', payload);
      if (isFinal) {
        console.log(`[VOICE_TEXT] ${cleanCaller} -> ${targetSocketId} fallback final #${sequence}`);
      }
    }

    if (isFinal) {
      callTurns.set(key, cleanTarget);
      emitTurnChange(cleanCaller, cleanTarget, cleanTarget);
    }
  });

  socket.on('sign_text', ({ callerPhone, targetPhone, text }) => {
    const key = callPairKey(callerPhone, targetPhone);
    const holder = callTurns.get(key);
    if (holder && holder !== callerPhone) {
      socket.emit('turn_denied', { reason: 'not_your_turn', canSpeak: holder });
      return;
    }
    const targetSocketId = resolveSocketByPhone(targetPhone);
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive_sign_text', {
        from: callerPhone,
        text,
        timestamp: Date.now(),
      });
      callTurns.set(key, targetPhone);
      emitTurnChange(callerPhone, targetPhone, targetPhone);
    }
  });

  socket.on('end_call', async ({ targetUserId, callerPhone, targetPhone }) => {
    if (targetUserId) {
      const targetSocketId = resolveSocketByUserId(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_ended', { by: socket.userId });
      }
    }
    if (callerPhone && targetPhone) {
      const key = callPairKey(callerPhone, targetPhone);
      callTurns.delete(key);
      pendingSocketCalls.delete(key);
      callTranscriptSequences.delete(key);
      leaveCallRoom(callerPhone, targetPhone);
      const otherPhone =
        socket.data.phoneNumber === cleanPhone(callerPhone)
          ? cleanPhone(targetPhone)
          : cleanPhone(callerPhone);
      const otherSocket = resolveSocketByPhone(otherPhone);
      if (otherSocket) {
        io.to(otherSocket).emit('call_ended', { by: socket.data.phoneNumber });
      }
      io.emit('user_status_change', { phoneNumber: cleanPhone(callerPhone), status: 'online' });
      io.emit('user_status_change', { phoneNumber: cleanPhone(targetPhone), status: 'online' });
    }
  });

  socket.on('call_timeout', ({ callerPhone, targetPhone }) => {
    const targetSocketId = resolveSocketByPhone(targetPhone);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call_cancelled', { by: callerPhone });
    }
    if (callerPhone) {
      io.emit('user_status_change', { phoneNumber: cleanPhone(callerPhone), status: 'online' });
    }
    if (callerPhone && targetPhone) {
      const key = callPairKey(callerPhone, targetPhone);
      pendingSocketCalls.delete(key);
      callTranscriptSequences.delete(key);
      leaveCallRoom(callerPhone, targetPhone);
    }
  });

  socket.on('disconnect', async (reason) => {
    console.log(`[SOCKET] Déconnecté: ${socket.id}, userId: ${socket.userId}, raison: ${reason}`);

    if (socket.userId) {
      const current = onlineUsers.get(socket.userId);
      if (current === socket.id) {
        onlineUsers.delete(socket.userId);
        if (socket.data.phoneNumber) {
          const clean = cleanPhone(socket.data.phoneNumber);
          if (phoneToUserId.get(clean) === socket.userId) {
            phoneToUserId.delete(clean);
          }
          io.emit('user_status_change', { phoneNumber: clean, status: 'offline' });
        }
        if (userRepo.isValidObjectId(socket.userId)) {
          try {
            await userRepo.findByIdAndUpdate(socket.userId, {
              isOnline: false,
              currentSocketId: null,
              lastSeen: new Date(),
            });
          } catch (e) {
            /* ignore */
          }
          broadcastOnlineStatus(socket.userId, false);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

userRepo
  .initRepository()
  .then((mode) => {
    server.listen(PORT, () => {
      console.log(`VoxManus server running on port ${PORT}`);
      console.log(`[API] Inscription prête (mode: ${mode})`);
    });
  })
  .catch((err) => {
    console.error('[DB] Erreur démarrage:', err.message);
    process.exit(1);
  });
