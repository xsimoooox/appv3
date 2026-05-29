let ringtoneInterval = null;
let ringtoneAudio = null;

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

export async function notifyIncomingCall({
  code,
  callerName,
  acceptUrl,
  role = 'deaf',
}) {
  playIncomingRingtone();

  const title = '📞 Appel entrant — WakWak';
  const body = `${callerName || 'Quelqu\'un'} vous appelle${code ? ` · Code ${code}` : ''}`;

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: `wakwak-call-${code}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [400, 200, 400, 200, 400],
        silent: false,
        data: { code, acceptUrl, type: 'incoming_call', role },
      });
      n.onclick = () => {
        window.focus();
        if (acceptUrl) window.location.href = acceptUrl;
      };
    } catch {
      /* ignore */
    }
  }

  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'INCOMING_CALL',
      code,
      callerName,
      acceptUrl,
      role,
      title,
      body,
    });
  } else if (navigator.serviceWorker?.ready) {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      tag: `wakwak-call-${code}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [400, 200, 400, 200, 400],
      silent: false,
      data: { code, acceptUrl, type: 'incoming_call', role },
    }).catch(() => {});
  }
}
