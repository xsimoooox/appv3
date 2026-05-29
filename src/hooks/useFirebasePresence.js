import { useEffect, useState } from 'react';
import { listenFirebaseValue } from '../lib/firebaseRealtime';
import { mapPresenceSnapshot, startPresenceHeartbeat } from '../lib/presenceFirebase';
import { getWakwakUser } from '../lib/wakwakUser';

export function useFirebasePresence() {
  const [presenceByPhone, setPresenceByPhone] = useState({});

  useEffect(() => {
    const user = getWakwakUser();
    if (!user) return undefined;

    const stopHeartbeat = startPresenceHeartbeat(user) || (() => {});
    const stopListen = listenFirebaseValue('presence', (data) => {
      setPresenceByPhone(mapPresenceSnapshot(data));
    });

    return () => {
      stopHeartbeat?.();
      stopListen?.();
    };
  }, []);

  return presenceByPhone;
}
