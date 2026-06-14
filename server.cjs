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
  webpush.setVapidDetails('mailto:contact@wakwak.app', vapidPublic, vapidPrivate);
}

/** userId (MongoDB string) → socketId */
const onlineUsers = new Map();
/** phoneNumber → userId */
const phoneToUserId = new Map();
const pushSubscriptions = new Map();
const callTurns = new Map();
const pendingSocketCalls = new Map();

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

function joinCallRoom(phoneA, phoneB) {
  const room = callRoomName(phoneA, phoneB);
  if (!room) return '';
  [resolveSocketByPhone(phoneA), resolveSocketByPhone(phoneB)]
    .filter(Boolean)
    .forEach((socketId) => io.sockets.sockets.get(socketId)?.join(room));
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
  return onlineUsers.get(clean) || null;
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

    if (data?.offer && data?.targetPhone && socket.data.phoneNumber) {
      pendingSocketCalls.set(callPairKey(socket.data.phoneNumber, data.targetPhone), {
        callerId: data.callerId || socket.userId,
        callerPhone: socket.data.phoneNumber,
        targetPhone: cleanPhone(data.targetPhone),
        offer: data.offer,
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

      io.to(targetSocketId).emit('incoming_call', {
        callerId: callerStr,
        callerName,
        callerPhone,
        targetUserId: targetStr,
        offer: data.offer || null,
        callType: data.callType || 'voice',
        timestamp: Date.now(),
      });
      if (callerPhone && data.targetPhone) {
        joinCallRoom(callerPhone, data.targetPhone);
      }

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

      io.to(targetSocketId).emit('incoming_call', {
        callerPhone: cleanCaller,
        callerName: callerName || cleanCaller,
        targetPhone: cleanTarget,
        callerId: callerIdResolved,
        targetUserId: targetIdResolved,
        timestamp: Date.now(),
      });
      joinCallRoom(cleanCaller, cleanTarget);
      console.log(`[CALL] incoming_call sent to ${cleanTarget}`);
      return;
    }

    const subscription = pushSubscriptions.get(cleanTarget);
    if (subscription && vapidPublic && vapidPrivate) {
      const apiBase =
        process.env.WAKWAK_API_URL || `http://localhost:${process.env.PORT || 3001}`;
      const payload = JSON.stringify({
        type: 'incoming_call',
        callerPhone: cleanCaller,
        callerName: callerName || cleanCaller,
        targetPhone: cleanTarget,
        timestamp: Date.now(),
        url: `/?action=accept_call&from=${encodeURIComponent(cleanCaller)}`,
        apiBase,
      });
      try {
        await webpush.sendNotification(subscription, payload);
        console.log(`[CALL] Push sent to offline user: ${cleanTarget}`);
      } catch (err) {
        console.error('[CALL] Push error:', err);
        if (err.statusCode === 410) {
          pushSubscriptions.delete(cleanTarget);
        }
        socket.emit('call_failed', { reason: 'user_unreachable', targetPhone: cleanTarget });
      }
      return;
    }

    socket.emit('call_failed', { reason: 'user_offline', targetPhone: cleanTarget });
  });

  socket.on('answer_call', async ({ callerId, answer, callerPhone, targetPhone }) => {
    const callerUid = callerId ? String(callerId) : await resolveUserIdFromPhone(callerPhone);
    const callerSocketId = resolveSocketByUserId(callerUid) || resolveSocketByPhone(callerPhone);

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
      joinCallRoom(caller, target);
      callTurns.set(key, caller);
      emitTurnChange(caller, target, caller);
      io.to(callerSocketId).emit('call_accepted', {
        by: target,
        timestamp: Date.now(),
      });
      socket.emit('call_accepted', {
        by: caller,
        timestamp: Date.now(),
      });
      pendingSocketCalls.delete(callPairKey(caller, target));
      io.emit('user_status_change', { phoneNumber: caller, status: 'busy' });
      io.emit('user_status_change', { phoneNumber: target, status: 'busy' });
    }
  });

  socket.on('accept_call', async ({ callerPhone, targetPhone }) => {
    console.log(`[ACCEPT] ${targetPhone} accepts call from ${callerPhone}`);
    const callerSocketId = await resolveSocketReliable({ phone: callerPhone });
    const cleanCaller = cleanPhone(callerPhone);
    const cleanTarget = cleanPhone(targetPhone);
    const key = callPairKey(cleanCaller, cleanTarget);
    joinCallRoom(cleanCaller, cleanTarget);
    const pending = pendingSocketCalls.get(callPairKey(cleanCaller, cleanTarget));
    if (pending?.offer) {
      socket.emit('push_call_offer', pending);
    }
    callTurns.set(key, cleanCaller);
    emitTurnChange(cleanCaller, cleanTarget, cleanCaller);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_accepted', {
        by: cleanTarget,
        timestamp: Date.now(),
      });
      socket.emit('call_accepted', {
        by: cleanCaller,
        timestamp: Date.now(),
      });
      io.emit('user_status_change', { phoneNumber: cleanCaller, status: 'busy' });
      io.emit('user_status_change', { phoneNumber: cleanTarget, status: 'busy' });
    }
  });

  socket.on('ice_candidate', ({ targetUserId, candidate, targetPhone }) => {
    let targetSocketId = null;
    if (targetUserId) {
      targetSocketId = resolveSocketByUserId(targetUserId);
    }
    if (!targetSocketId && targetPhone) {
      targetSocketId = resolveSocketByPhone(targetPhone);
    }
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
  });

  socket.on('voice_text', ({ callerPhone, targetPhone, text, isFinal = true }) => {
    const room = joinCallRoom(callerPhone, targetPhone);
    const payload = {
      from: callerPhone,
      text,
      isFinal,
      timestamp: Date.now(),
    };
    if (room) {
      socket.to(room).emit('receive_voice_text', payload);
      return;
    }
    const targetSocketId = resolveSocketByPhone(targetPhone);
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive_voice_text', payload);
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
      callTurns.delete(callPairKey(callerPhone, targetPhone));
      pendingSocketCalls.delete(callPairKey(callerPhone, targetPhone));
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
      console.log(`WakWak server running on port ${PORT}`);
      console.log(`[API] Inscription prête (mode: ${mode})`);
    });
  })
  .catch((err) => {
    console.error('[DB] Erreur démarrage:', err.message);
    process.exit(1);
  });
