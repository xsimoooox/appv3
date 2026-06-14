import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearCallInvite,
  endRealtimeCall,
  getClientUid,
  getFirebaseData,
  joinRealtimeCall,
  listenFirebaseValue,
  storeSessionCode,
} from '../lib/firebaseRealtime';
import { notifyIncomingCall, stopIncomingRingtone } from '../lib/callAlerts';
import {
  buildCallJoinPath,
  findContactIdForIncoming,
  invitePathForPhone,
  isInviteValid,
  markInviteNotified,
  wasInviteNotified,
} from '../lib/callInvite';
import { getWakwakUser } from '../lib/wakwakUser';
import { normalizePhoneNumber } from '../lib/phoneUtils';

const DISMISSED_KEY = 'wakwak_dismissed_calls';
const POLL_INTERVAL_MS = 1000;

function loadDismissed() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function dismissCode(code) {
  const set = loadDismissed();
  set.add(code);
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}

function resolveMyPhone() {
  const user = getWakwakUser();
  return normalizePhoneNumber(
    user?.phoneNumber || localStorage.getItem('userPhone') || ''
  );
}

export function useGlobalCallListener({ onAcceptCall, onRejectCall } = {}) {
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);
  const [accepting, setAccepting] = useState(false);

  // Reactive phone state so the effect re-runs when user logs in
  const [myPhone, setMyPhone] = useState(() => resolveMyPhone());

  const ringingRef = useRef(null);
  const dismissedRef = useRef(loadDismissed());

  const user = getWakwakUser();
  const myUidRef = useRef(
    user?.id || getClientUid(user?.role === 'hearing' ? 'hearing' : 'deaf'),
  );
  const myRoleRef = useRef(user?.role === 'hearing' ? 'hearing' : 'deaf');

  // Re-resolve phone every few seconds in case user logs in after mount
  useEffect(() => {
    const id = setInterval(() => {
      const phone = resolveMyPhone();
      if (phone) {
        setMyPhone(phone);
        // Update role and uid refs too
        const u = getWakwakUser();
        if (u?.id) myUidRef.current = u.id;
        if (u?.role) myRoleRef.current = u.role === 'hearing' ? 'hearing' : 'deaf';
      }
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const processInvites = useCallback(
    (invitesMap, currentMyPhone) => {
      const phone = currentMyPhone || myPhone;
      if (!invitesMap || typeof invitesMap !== 'object') {
        if (ringingRef.current) {
          ringingRef.current = null;
          setIncomingCall(null);
          stopIncomingRingtone();
        }
        return;
      }

      const valid = Object.entries(invitesMap)
        .map(([code, invite]) => ({ code, ...invite }))
        .filter((inv) => isInviteValid(inv))
        .filter((inv) => !dismissedRef.current.has(inv.code))
        .filter((inv) => String(inv.callerUid || inv.caller || '') !== String(myUidRef.current))
        .filter((inv) => {
          const target = normalizePhoneNumber(inv.targetPhone || '');
          if (target && phone && target !== phone) return false;
          const caller = normalizePhoneNumber(inv.callerPhone || '');
          if (caller && phone && caller === phone) return false;
          return true;
        })
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const latest = valid[0];
      if (!latest) {
        if (ringingRef.current) {
          ringingRef.current = null;
          setIncomingCall(null);
          stopIncomingRingtone();
        }
        return;
      }

      // Don't re-trigger if same call is already ringing
      if (ringingRef.current?.code === latest.code) return;

      const payload = {
        ...latest,
        expiresAt: latest.expiresAt || (latest.createdAt || 0) + 5 * 60 * 1000,
      };
      ringingRef.current = payload;
      setIncomingCall(payload);

      if (!wasInviteNotified(latest.code)) {
        markInviteNotified(latest.code);
        const contactId = findContactIdForIncoming(
          myRoleRef.current,
          latest.callerPhone,
          latest.targetContactId,
        );
        const acceptUrl = `${buildCallJoinPath(myRoleRef.current, contactId, latest.code)}&accept=1`;
        notifyIncomingCall({
          code: latest.code,
          callerName: latest.callerName,
          acceptUrl,
          role: myRoleRef.current,
        });
      }
    },
    [myPhone],
  );

  // Main EventSource listener
  useEffect(() => {
    if (!myPhone) return undefined;

    const path = invitePathForPhone(myPhone);
    if (!path) return undefined;

    const stopInvites = listenFirebaseValue(path, (data) => processInvites(data, myPhone));

    return () => {
      stopInvites();
      stopIncomingRingtone();
    };
  }, [myPhone, processInvites]);

  // Polling fallback: re-fetch invites from Firebase every POLL_INTERVAL_MS
  // This catches cases where the EventSource connection is lost silently
  useEffect(() => {
    if (!myPhone) return undefined;

    const path = invitePathForPhone(myPhone);
    if (!path) return undefined;

    const poll = async () => {
      try {
        const data = await getFirebaseData(path);
        processInvites(data, myPhone);
      } catch {
        /* ignore network errors */
      }
    };

    const pollWhenVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    const id = setInterval(poll, POLL_INTERVAL_MS);
    poll();
    window.addEventListener('focus', poll);
    window.addEventListener('online', poll);
    document.addEventListener('visibilitychange', pollWhenVisible);

    return () => {
      clearInterval(id);
      window.removeEventListener('focus', poll);
      window.removeEventListener('online', poll);
      document.removeEventListener('visibilitychange', pollWhenVisible);
    };
  }, [myPhone, processInvites]);

  const acceptIncomingCall = useCallback(async () => {
    const call = ringingRef.current;
    if (!call?.code || accepting) return;

    setAccepting(true);
    stopIncomingRingtone();

    const uid = getClientUid(myRoleRef.current === 'hearing' ? 'hearing' : 'deaf');
    const calleeName = getWakwakUser()?.name || '';
    storeSessionCode(call.code);

    dismissCode(call.code);
    dismissedRef.current.add(call.code);

    const contactId = findContactIdForIncoming(
      myRoleRef.current,
      call.callerPhone,
      call.targetContactId,
    );
    const joinPath = buildCallJoinPath(myRoleRef.current, contactId, call.code);

    setIncomingCall(null);
    ringingRef.current = null;
    setAccepting(false);

    // Open the call UI first. Firebase join and WebRTC negotiation continue in
    // the background without delaying the user's acceptance.
    try {
      navigate(joinPath);
    } catch {
      window.location.assign(joinPath);
    }

    joinRealtimeCall({
      code: call.code,
      uid,
      calleeName,
      calleePhone: myPhone,
    }).catch(() => {});
    Promise.resolve(onAcceptCall?.(call.code)).catch(() => {});
  }, [navigate, accepting, myPhone, onAcceptCall]);

  const rejectIncomingCall = useCallback(async () => {
    const call = ringingRef.current;
    if (!call?.code) return;

    stopIncomingRingtone();
    dismissCode(call.code);
    if (myPhone) {
      await clearCallInvite(myPhone, call.code).catch(() => {});
    }
    await endRealtimeCall(call.code).catch(() => {});
    onRejectCall?.();
    setIncomingCall(null);
    ringingRef.current = null;
  }, [myPhone, onRejectCall]);

  return {
    firebaseIncomingCall: incomingCall,
    acceptFirebaseIncomingCall: acceptIncomingCall,
    rejectFirebaseIncomingCall: rejectIncomingCall,
    acceptingIncomingCall: accepting,
  };
}
