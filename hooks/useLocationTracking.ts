import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { useSosStore } from '../store/sosStore';

export function useLocationTracking() {
  const status = useSosStore((state) => state.status);
  const isLowBattery = useSosStore((state) => state.isLowBattery);
  const refreshLocation = useSosStore((state) => state.refreshLocation);
  
  // Track interval references to dynamically adjust frequency
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkPermissionsAndSetup() {
      if (status !== 'active') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      try {
        // Request foreground permission
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          useSosStore.setState({ locationStatus: 'unavailable' });
          return;
        }

        // Adjust polling rates: 30s for battery preservation, 5s for active high-accuracy tracing
        const pollingIntervalMs = isLowBattery ? 30000 : 5000;

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        // Initial fetch
        await refreshLocation();

        // Continuous tracing
        intervalRef.current = setInterval(async () => {
          if (isMounted) {
            await refreshLocation();
          }
        }, pollingIntervalMs);

      } catch (err) {
        console.warn('[LOCATION_TRACKING] Error during continuous GPS tracking:', err);
        useSosStore.setState({ locationStatus: 'error' });
      }
    }

    checkPermissionsAndSetup();

    return () => {
      isMounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, isLowBattery, refreshLocation]);
}
