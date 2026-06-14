import { getSocket } from './socket';
import { getVoxManusUser } from './voxmanusUser';
import {
  createRealtimeCall,
  generateSessionCode,
  getClientUid,
  storeSessionCode,
  touchRealtimeCall,
} from './firebaseRealtime';
import { setPresenceInCall } from './presenceFirebase';
import { normalizePhoneNumber } from './phoneUtils';

/** Socket.io disponible (serveur local ou VITE_SOCKET_URL configuré). */
export function isSocketCallAvailable() {
  const user = getVoxManusUser();
  return Boolean(getSocket()?.connected && user?.id);
}

/**
 * Démarre un appel LSF via Firebase (fonctionne sur Vercel sans serveur Socket.io).
 * @returns {{ code: string, path: string }}
 */
export async function startFirebaseCall({
  role,
  contactId,
  routePrefix,
  targetPhone = '',
}) {
  const normalizedTargetPhone = normalizePhoneNumber(targetPhone);
  if (!normalizedTargetPhone) {
    throw new Error("Le contact n'a pas de numéro valide");
  }

  const code = generateSessionCode();
  const uid = getClientUid(role === 'deaf' ? 'deaf' : 'hearing');
  const user = getVoxManusUser();
  const callerName = user?.name || (role === 'deaf' ? 'Personne sourde' : 'Personne entendante');
  const callerPhone = normalizePhoneNumber(user?.phoneNumber || '');

  await createRealtimeCall({
    code,
    callerUid: uid,
    callerName,
    lang: 'fr-FR',
    callerPhone,
    callerRole: role === 'deaf' ? 'deaf' : 'hearing',
    targetContactId: contactId,
    targetPhone: normalizedTargetPhone,
  });

  await touchRealtimeCall(code).catch(() => {});

  if (callerPhone) {
    await setPresenceInCall(callerPhone, code);
  }

  storeSessionCode(code);

  return {
    code,
    path: `${routePrefix}/${contactId}?code=${encodeURIComponent(code)}`,
  };
}

/**
 * Tente Socket.io, sinon Firebase. Retourne le mode utilisé.
 */
export async function startContactCall({
  role,
  contactId,
  routePrefix,
  targetPhone,
  contactName,
  socketCallUser,
  onError,
}) {
  if (isSocketCallAvailable() && socketCallUser) {
    try {
      const started = await socketCallUser(targetPhone, contactName);
      if (started) return { mode: 'socket' };
    } catch (err) {
      console.warn('[CALL] Socket indisponible, passage à Firebase:', err);
      /* fallback firebase */
    }
  }

  try {
    const result = await startFirebaseCall({ role, contactId, routePrefix, targetPhone });
    return { mode: 'firebase', ...result };
  } catch (err) {
    onError?.(err);
    throw err;
  }
}
