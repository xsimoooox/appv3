import { useEffect } from 'react';

const PUSH_API = import.meta.env.PROD ? '/api' : 'http://localhost:3001';
const RETRY_MS = 30000;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export function usePushNotification(phoneNumber) {
  useEffect(() => {
    if (!phoneNumber || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return undefined;
    }

    let stopped = false;
    let retryTimer = null;

    const registerPush = async () => {
      try {
        const response = await fetch(`${PUSH_API}/vapid-public-key`);
        if (!response.ok) throw new Error(`VAPID indisponible (${response.status})`);
        const { publicKey } = await response.json();
        if (!publicKey) throw new Error('VAPID_PUBLIC_KEY manquante sur Vercel');

        const swRegistration = await navigator.serviceWorker.ready;
        let subscription = await swRegistration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        const subscribeResponse = await fetch(`${PUSH_API}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber, subscription }),
        });
        if (!subscribeResponse.ok) {
          throw new Error(`Abonnement notification refusé (${subscribeResponse.status})`);
        }
      } catch (error) {
        console.error('Erreur enregistrement push:', error);
        if (!stopped) retryTimer = setTimeout(registerPush, RETRY_MS);
      }
    };

    const enableNotifications = async () => {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission === 'granted') registerPush();
    };

    if (Notification.permission === 'granted') {
      registerPush();
    } else {
      window.addEventListener('pointerdown', enableNotifications, { once: true });
    }

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      window.removeEventListener('pointerdown', enableNotifications);
    };
  }, [phoneNumber]);
}
