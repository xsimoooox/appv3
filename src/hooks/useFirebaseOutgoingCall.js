import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearCallInvite,
  endRealtimeCall,
  getFirebaseData,
  listenFirebaseValue,
} from '../lib/firebaseRealtime';
import { setPresenceAvailable } from '../lib/presenceFirebase';
import { getWakwakUser } from '../lib/wakwakUser';
import { playJoinedChime } from '../lib/callAlerts';

const OUTGOING_TIMEOUT_MS = 30000;

/**
 * Appel sortant Firebase : écran « sonnerie » jusqu'à réponse (calleeJoined), puis navigation.
 */
export function useFirebaseOutgoingCall({ onToast, onStartCall, onStopCall } = {}) {
  const navigate = useNavigate();
  const [outgoing, setOutgoing] = useState(null);
  const outgoingRef = useRef(null);
  const joinedRef = useRef(false);

  const startFirebaseOutgoing = useCallback((payload) => {
    joinedRef.current = false;
    const next = {
      ...payload,
      status: 'ringing',
      startedAt: Date.now(),
    };
    outgoingRef.current = next;
    setOutgoing(next);
    onStartCall?.(payload.code);
  }, [onStartCall]);

  const cancelFirebaseOutgoing = useCallback(async () => {
    const current = outgoingRef.current;
    if (!current?.code) {
      setOutgoing(null);
      outgoingRef.current = null;
      return;
    }

    await endRealtimeCall(current.code).catch(() => {});
    if (current.targetPhone) {
      await clearCallInvite(current.targetPhone, current.code).catch(() => {});
    }

    const user = getWakwakUser();
    if (user?.phoneNumber) {
      await setPresenceAvailable(user.phoneNumber).catch(() => {});
    }

    setOutgoing(null);
    outgoingRef.current = null;
    joinedRef.current = false;
    onStopCall?.();
  }, [onStopCall]);

  const completeOutgoing = useCallback(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    playJoinedChime();
    const path = outgoingRef.current?.path;
    setOutgoing(null);
    outgoingRef.current = null;
    onToast?.('Appel accepté', 'success');
    if (path) {
      try {
        navigate(path, { replace: true });
      } catch {
        window.location.assign(path);
      }
    }
  }, [navigate, onToast]);

  useEffect(() => {
    const code = outgoing?.code;
    if (!code || outgoing?.status !== 'ringing') return undefined;

    const stopCall = listenFirebaseValue(`calls/${code}`, (call) => {
      if (call?.status === 'ended' && !joinedRef.current) {
        cancelFirebaseOutgoing();
        onToast?.('Appel terminé', 'info');
        return;
      }
      if (!call?.calleeJoined && !call?.joinedAt) return;
      completeOutgoing();
    });

    const stopSession = listenFirebaseValue(`sessions/${code}`, (session) => {
      if (!session?.calleeJoined && !session?.participants?.B) return;
      completeOutgoing();
    });

    const stopAccepted = listenFirebaseValue(`calls/${code}/accepted`, (accepted) => {
      if (accepted?.accepted) completeOutgoing();
    });

    const pollAccepted = setInterval(() => {
      getFirebaseData(`calls/${code}/accepted`)
        .then((accepted) => {
          if (accepted?.accepted) completeOutgoing();
        })
        .catch(() => {});
    }, 250);

    return () => {
      stopCall();
      stopSession();
      stopAccepted();
      clearInterval(pollAccepted);
    };
  }, [outgoing?.code, outgoing?.status, completeOutgoing, cancelFirebaseOutgoing, onToast]);

  useEffect(() => {
    if (!outgoing || outgoing.status !== 'ringing') return undefined;

    const timer = setTimeout(() => {
      cancelFirebaseOutgoing();
      onToast?.('Pas de réponse', 'error');
    }, OUTGOING_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [outgoing, cancelFirebaseOutgoing, onToast]);

  return {
    firebaseOutgoingCall: outgoing,
    firebaseActiveCode: outgoing?.code || '',
    startFirebaseOutgoing,
    cancelFirebaseOutgoing,
  };
}
