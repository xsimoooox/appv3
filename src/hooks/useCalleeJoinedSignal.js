import { useEffect, useRef, useState } from 'react';
import { listenFirebaseValue } from '../lib/firebaseRealtime';
import { playJoinedChime } from '../lib/callAlerts';

/**
 * Écoute quand l'autre participant rejoint l'appel (côté appelant).
 */
export function useCalleeJoinedSignal(sessionCode) {
  const [joined, setJoined] = useState(false);
  const [joinedName, setJoinedName] = useState('');
  const signaledRef = useRef(false);

  useEffect(() => {
    if (!sessionCode) {
      setJoined(false);
      setJoinedName('');
      signaledRef.current = false;
      return undefined;
    }

    const stopCall = listenFirebaseValue(`calls/${sessionCode}`, (call) => {
      if (!call?.calleeJoined && !call?.joinedAt) return;
      setJoined(true);
      setJoinedName(call.calleeName || 'Interlocuteur');
      if (!signaledRef.current) {
        signaledRef.current = true;
        playJoinedChime();
      }
    });

    const stopSession = listenFirebaseValue(`sessions/${sessionCode}`, (session) => {
      if (!session?.calleeJoined && !session?.participants?.B) return;
      setJoined(true);
      setJoinedName(session.calleeName || 'Interlocuteur');
      if (!signaledRef.current) {
        signaledRef.current = true;
        playJoinedChime();
      }
    });

    return () => {
      stopCall();
      stopSession();
    };
  }, [sessionCode]);

  return { calleeJoined: joined, calleeJoinedName: joinedName };
}
