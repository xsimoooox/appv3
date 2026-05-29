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
import { getWakwakUser } from '../lib/wakwakUser';
import { normalizePhoneNumber } from '../lib/phoneUtils';

const DISMISSED_KEY = 'wakwak_dismissed_calls';
const RINGING_MAX_AGE_MS = 15 * 60 * 1000;

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
  const ringingRef = useRef(null);
  const dismissedRef = useRef(loadDismissed());

  const user = getWakwakUser();
  const myUidRef = useRef(
    user?.id || getClientUid(user?.role === 'hearing' ? 'hearing' : 'deaf'),
  );
  const myRoleRef = useRef(user?.role === 'hearing' ? 'hearing' : 'deaf');

  const buildAcceptUrl = useCallback((call) => {
    const role = myRoleRef.current;
    const code = call.code;
    const contactId = call.targetContactId || (role === 'hearing' ? 'amina' : 'c1');
    const prefix = role === 'hearing' ? '/entendant/call' : '/call';
    return `${prefix}/${contactId}?code=${encodeURIComponent(code)}`;
  }, []);

  const handleRingingCall = useCallback(
    (code, call) => {
      if (!call || call.status !== 'ringing') return;
      if (Date.now() - (call.createdAt || 0) > RINGING_MAX_AGE_MS) return;
      if (dismissedRef.current.has(code)) return;

      const callerUid = String(call.caller || '');
      if (callerUid && callerUid === String(myUidRef.current)) return;

      const payload = { code, ...call };
      const same = ringingRef.current?.code === code;
      ringingRef.current = payload;
      setIncomingCall(payload);

      if (!same) {
        const acceptUrl = buildAcceptUrl(payload);
        notifyIncomingCall({
          code,
          callerName: call.callerName,
          acceptUrl,
          role: myRoleRef.current,
        });
      }
    },
    [buildAcceptUrl],
  );

  useEffect(() => {
    const stopCalls = listenFirebaseValue('calls', (calls) => {
      if (!calls || typeof calls !== 'object') {
        if (ringingRef.current) {
          ringingRef.current = null;
          setIncomingCall(null);
          stopIncomingRingtone();
        }
        return;
      }

      const entries = Object.entries(calls)
        .map(([code, call]) => ({ code, ...call }))
        .filter((c) => c.status === 'ringing')
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const latest = entries[0];
      if (latest) {
        handleRingingCall(latest.code, latest);
        return;
      }

      if (ringingRef.current) {
        ringingRef.current = null;
        setIncomingCall(null);
        stopIncomingRingtone();
      }
    });

    const notifyPath =
      myRoleRef.current === 'hearing' ? 'notifications/hearing_user' : 'notifications/deaf_user';

    const stopNotify = listenFirebaseValue(notifyPath, (items) => {
      if (!items || typeof items !== 'object') return;
      const list = Object.values(items)
        .filter((n) => n?.status === 'pending' && n?.code)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const latest = list[0];
      if (!latest) return;
      handleRingingCall(latest.code, {
        status: 'ringing',
        callerName: latest.callerName,
        createdAt: latest.timestamp,
        caller: latest.callerUid,
        targetContactId: latest.targetContactId,
      });
    });

    return () => {
      stopCalls();
      stopNotify();
      stopIncomingRingtone();
    };
  }, [handleRingingCall]);

  const acceptIncomingCall = useCallback(async () => {
    const call = ringingRef.current;
    if (!call?.code) return;

    stopIncomingRingtone();
    const uid = getClientUid(myRoleRef.current === 'hearing' ? 'hearing' : 'deaf');
    storeSessionCode(call.code);

    try {
      await joinRealtimeCall({ code: call.code, uid });
    } catch {
      /* session peut déjà exister */
    }

    dismissedRef.current.add(call.code);
    setIncomingCall(null);
    ringingRef.current = null;
    navigate(buildAcceptUrl(call));
  }, [navigate, buildAcceptUrl]);

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
  };
}
