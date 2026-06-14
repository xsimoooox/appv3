import { normalizePhoneNumber } from './phoneUtils';
import { getClientUid, updateFirebaseData, setFirebaseData } from './firebaseRealtime';

const HEARTBEAT_MS = 15000;
const OFFLINE_AFTER_MS = 45000;

let heartbeatTimer = null;
let currentPresenceKey = null;

export function phonePresenceKey(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return '';
  return normalized;
}

export async function setPresence(payload) {
  const key = phonePresenceKey(payload.phoneNumber);
  if (!key) return;
  await updateFirebaseData(`presence/${key}`, {
    ...payload,
    phoneNumber: normalizePhoneNumber(payload.phoneNumber),
    lastSeen: Date.now(),
  });
}

export function startPresenceHeartbeat(user) {
  if (!user?.phoneNumber) return () => {};

  const phoneNumber = normalizePhoneNumber(user.phoneNumber);
  const role = user.role === 'hearing' ? 'hearing' : 'deaf';
  const uid = user.id || getClientUid(role === 'hearing' ? 'hearing' : 'deaf');
  currentPresenceKey = phonePresenceKey(phoneNumber);

  const beat = async (state = 'online', inCallCode = null) => {
    try {
      await setFirebaseData(`presence/${currentPresenceKey}`, {
        phoneNumber,
        name: user.name || '',
        role,
        uid: String(uid),
        state,
        inCallCode,
        lastSeen: Date.now(),
      });
    } catch {
      /* réseau */
    }
  };

  beat('online', null);

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => beat('online', null), HEARTBEAT_MS);

  const onUnload = () => {
    beat('offline', null).catch(() => {});
  };
  window.addEventListener('beforeunload', onUnload);

  return () => {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    window.removeEventListener('beforeunload', onUnload);
    beat('offline', null).catch(() => {});
  };
}

export async function setPresenceInCall(phoneNumber, callCode) {
  const key = phonePresenceKey(phoneNumber);
  if (!key) return;
  await updateFirebaseData(`presence/${key}`, {
    state: 'busy',
    inCallCode: callCode || null,
    lastSeen: Date.now(),
  });
}

export async function setPresenceAvailable(phoneNumber) {
  const key = phonePresenceKey(phoneNumber);
  if (!key) return;
  await updateFirebaseData(`presence/${key}`, {
    state: 'online',
    inCallCode: null,
    lastSeen: Date.now(),
  });
}

export function readPresenceEntry(entry) {
  if (!entry || typeof entry !== 'object') return 'offline';
  const age = Date.now() - (entry.lastSeen || 0);
  if (entry.state === 'offline' || age > OFFLINE_AFTER_MS) return 'offline';
  if (entry.state === 'busy' || entry.inCallCode) return 'busy';
  return 'online';
}

export function mapPresenceSnapshot(snapshot) {
  const byPhone = {};
  if (!snapshot || typeof snapshot !== 'object') return byPhone;
  Object.values(snapshot).forEach((entry) => {
    if (!entry?.phoneNumber) return;
    byPhone[normalizePhoneNumber(entry.phoneNumber)] = readPresenceEntry(entry);
  });
  return byPhone;
}
