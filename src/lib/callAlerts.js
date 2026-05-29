let ringtoneInterval = null;
let ringtoneAudio = null;
let lastRingingCode = null;

export function playIncomingRingtone() {
  stopIncomingRingtone();
  try {
    ringtoneAudio = new Audio('/sounds/ringtone.mp3');
    ringtoneAudio.loop = true;
    ringtoneAudio.volume = 1;
    ringtoneAudio.play().catch(() => playBeepRingtone());
  } catch {
    playBeepRingtone();
  }
}

function playBeepRingtone() {
  const beep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.value = 0.35;
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 400);
    } catch {
      /* ignore */
    }
  };
  beep();
  ringtoneInterval = setInterval(beep, 1200);
}

export function stopIncomingRingtone() {
  lastRingingCode = null;
  if (ringtoneAudio) {
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
    ringtoneAudio = null;
  }
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

/**
 * Une seule notification système par code d'appel (évite le spam).
 */
export async function notifyIncomingCall({
  code,
  callerName,
  acceptUrl,
  role = 'deaf',
}) {
  if (!code) return;

  const isSameRinging = lastRingingCode === code;
  lastRingingCode = code;

  if (!isSameRinging) {
    playIncomingRingtone();
  }

  const title = '📞 Appel entrant — WakWak';
  const body = `${callerName || 'Quelqu\'un'} vous appelle · Code ${code}`;

  const notifyOptions = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: `wakwak-call-${code}`,
    renotify: false,
    requireInteraction: true,
    vibrate: [400, 200, 400, 200, 400],
    silent: false,
    data: { code, acceptUrl, type: 'incoming_call', role },
  };

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, notifyOptions);
      n.onclick = () => {
        window.focus();
        if (acceptUrl) window.location.href = acceptUrl;
      };
    } catch {
      /* ignore */
    }
  }

  try {
    const reg = navigator.serviceWorker?.controller
      ? { showNotification: (t, o) => navigator.serviceWorker.ready.then((r) => r.showNotification(t, o)) }
      : await navigator.serviceWorker?.ready;

    if (reg?.showNotification) {
      await reg.showNotification(title, notifyOptions);
    }
  } catch {
    /* ignore */
  }
}

export function playJoinedChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 523;
    osc.type = 'sine';
    gain.gain.value = 0.25;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 280);
  } catch {
    /* ignore */
  }
}
