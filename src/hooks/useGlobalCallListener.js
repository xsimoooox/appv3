import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  endRealtimeCall,
  getClientUid,
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

export function useGlobalCallListener() {
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const ringingRef = useRef(null);
  const dismissedRef = useRef(loadDismissed());

  const user = getWakwakUser();
  const myPhone = normalizePhoneNumber(user?.phoneNumber || '');
  const myUidRef = useRef(
    user?.id || getClientUid(user?.role === 'hearing' ? 'hearing' : 'deaf'),
  );
  const myRoleRef = useRef(user?.role === 'hearing' ? 'hearing' : 'deaf');

  const processInvites = useCallback(
    (invitesMap) => {
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
        const acceptUrl = buildCallJoinPath(myRoleRef.current, contactId, latest.code);
        notifyIncomingCall({
          code: latest.code,
          callerName: latest.callerName,
          acceptUrl,
          role: myRoleRef.current,
        });
      }
    },
    [],
  );

  useEffect(() => {
    if (!myPhone) return undefined;

    const path = invitePathForPhone(myPhone);
    if (!path) return undefined;

    const stopInvites = listenFirebaseValue(path, processInvites);

    return () => {
      stopInvites();
      stopIncomingRingtone();
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

    try {
      await joinRealtimeCall({ code: call.code, uid, calleeName });
    } catch {
      /* déjà joint */
    }

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

    try {
      navigate(joinPath);
    } catch {
      window.location.assign(joinPath);
    }
  }, [navigate, accepting]);

  const rejectIncomingCall = useCallback(async () => {
    const call = ringingRef.current;
    if (!call?.code) return;

    stopIncomingRingtone();
    dismissCode(call.code);
    await endRealtimeCall(call.code).catch(() => {});
    setIncomingCall(null);
    ringingRef.current = null;
  }, []);

  return {
    firebaseIncomingCall: incomingCall,
    acceptFirebaseIncomingCall: acceptIncomingCall,
    rejectFirebaseIncomingCall: rejectIncomingCall,
    acceptingIncomingCall: accepting,
  };
}
