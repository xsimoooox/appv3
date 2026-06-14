import { useEffect } from 'react';

const PUSH_API = import.meta.env.PROD ? '/api' : 'http://localhost:3001';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotification(phoneNumber) {
  useEffect(() => {
    if (!phoneNumber || !('serviceWorker' in navigator)) return undefined;
    if (!('PushManager' in window)) {
      console.warn('Push notifications non supportées');
      return undefined;
    }

    const registerPush = async () => {
      try {
        const res = await fetch(`${PUSH_API}/vapid-public-key`);
        const { publicKey } = await res.json();
        if (!publicKey) return;

        const convertedKey = urlBase64ToUint8Array(publicKey);
        const swReg = await navigator.serviceWorker.ready;
        let subscription = await swReg.pushManager.getSubscription();

        if (!subscription) {
          subscription = await swReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey,
          });
        }

        await fetch(`${PUSH_API}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber, subscription }),
        });

        console.log('Push subscription enregistrée pour:', phoneNumber);
      } catch (err) {
        console.error('Erreur enregistrement push:', err);
      }
    };

    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        registerPush();
      }
    });

    return undefined;
  }, [phoneNumber]);
}
