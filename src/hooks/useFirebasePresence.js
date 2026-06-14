import { useEffect, useState } from 'react';
import { listenFirebaseValue } from '../lib/firebaseRealtime';
import { mapPresenceSnapshot, startPresenceHeartbeat } from '../lib/presenceFirebase';

export function useFirebasePresence(user) {
  const [presenceByPhone, setPresenceByPhone] = useState({});

  useEffect(() => {
    if (!user) return undefined;

    const stopHeartbeat = startPresenceHeartbeat(user) || (() => {});
    const stopListen = listenFirebaseValue('presence', (data) => {
      setPresenceByPhone(mapPresenceSnapshot(data));
    });

    return () => {
      stopHeartbeat?.();
      stopListen?.();
    };
  }, [user]);

  return presenceByPhone;
}
