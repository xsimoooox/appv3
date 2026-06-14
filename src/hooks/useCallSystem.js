import { useCallback, useEffect, useRef, useState } from 'react';
import { findUserByPhone } from '../lib/api';
import { canSpeakNow } from '../lib/turnTaking';
import { getVoxManusUser } from '../lib/voxmanusUser';
import { getSocket, initSocket, callUserById } from '../lib/socket';

const CALL_TIMEOUT_MS = 30000;
const CALL_START_TIMEOUT_MS = 8000;

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function playFallbackRingtone() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 440;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      ctx.close();
    }, 800);
  } catch {
    /* ignore */
  }
}

export function useCallSystem(myPhoneNumber, myRole, { onToast, myUserId } = {}) {
  const ringtoneRef = useRef(null);
  const timeoutRef = useRef(null);
  const recognitionRef = useRef(null);
  const micActiveRef = useRef(false);
  const ttsActiveRef = useRef(true);
  const fallbackAudioRef = useRef(null);
  const fallbackOscRef = useRef(null);
  const lastVoiceTextRef = useRef('');
  const voiceDebounceRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCallRef = useRef(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [onlineContacts, setOnlineContacts] = useState({});
  const [receivedText, setReceivedText] = useState('');
  const [sentVoiceText, setSentVoiceText] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [turnHolder, setTurnHolder] = useState(null);

  const resolvedUserId = myUserId || getVoxManusUser()?.id;

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current = null;
    }
    if (fallbackOscRef.current) {
      clearInterval(fallbackOscRef.current);
      fallbackOscRef.current = null;
    }
  }, []);

  const playRingtone = useCallback(() => {
    stopRingtone();
    try {
      const audio = new Audio('/sounds/ringtone.mp3');
      audio.loop = true;
      audio.volume = 0.8;
      ringtoneRef.current = audio;
      audio.play().catch(() => {
        fallbackOscRef.current = setInterval(playFallbackRingtone, 1600);
        playFallbackRingtone();
      });
    } catch {
      fallbackOscRef.current = setInterval(playFallbackRingtone, 1600);
      playFallbackRingtone();
    }
  }, [stopRingtone]);

  const vibratePhone = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([400, 200, 400, 200, 400, 200, 400]);
    }
  }, []);

  const showBrowserNotification = useCallback((callerName, callerPhone) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification('📞 Appel entrant — VoxManus', {
      body: `${callerName || callerPhone} vous appelle`,
      icon: '/icons/icon-192.png',
      tag: 'incoming-call',
      requireInteraction: true,
    });
  }, []);

  const clearCallTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    pendingCallRef.current = null;
  }, []);

  const stopMic = useCallback(() => {
    micActiveRef.current = false;
    clearTimeout(voiceDebounceRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setSentVoiceText('');
    lastVoiceTextRef.current = '';
  }, []);

  const speakText = useCallback((text) => {
    if (!ttsActiveRef.current || !text?.trim()) return;
    if (typeof window === 'undefined') return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find((v) => v.lang.startsWith('en'));
      if (enVoice) utterance.voice = enVoice;
      window.speechSynthesis.speak(utterance);
      return;
    }

    const enc = encodeURIComponent(text);
    const audio = new Audio(
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${enc}&tl=en&client=tw-ob`,
    );
    if (fallbackAudioRef.current) {
      fallbackAudioRef.current.pause();
    }
    fallbackAudioRef.current = audio;
    audio.play().catch(() => {});
  }, []);

  const setupPeerIceHandler = useCallback((targetUserId) => {
    const pc = peerConnectionRef.current;
    const socket = getSocket();
    if (!pc || !socket) return;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('ice_candidate', {
          targetUserId: String(targetUserId),
          candidate,
        });
      }
    };

    pc.ontrack = ({ streams }) => {
      const audio = document.getElementById('remote-audio');
      if (audio && streams[0]) {
        audio.srcObject = streams[0];
        audio.play().catch(() => {});
      }
    };
  }, []);

  const cleanupCall = useCallback(() => {
    clearCallTimeout();
    stopRingtone();
    stopMic();
    cleanupPeerConnection();
    window.speechSynthesis?.cancel();
    if (fallbackAudioRef.current) {
      fallbackAudioRef.current.pause();
      fallbackAudioRef.current = null;
    }
    setActiveCall(null);
    setIncomingCall(null);
    setOutgoingCall(null);
    setReceivedText('');
    setSentVoiceText('');
    lastVoiceTextRef.current = '';
    setTurnHolder(null);
  }, [clearCallTimeout, stopMic, stopRingtone, cleanupPeerConnection]);

  const startMic = useCallback(
    (targetPhone) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR || !targetPhone || !myPhoneNumber) return;

      stopMic();

      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      micActiveRef.current = true;

      recognition.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = result[0]?.transcript || '';
          if (result.isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }

        if (interimText.trim()) {
          const text = interimText.trim();
          setSentVoiceText(text);
          getSocket()?.emit('voice_text', {
            callerPhone: myPhoneNumber,
            targetPhone,
            text,
            isFinal: false,
          });
        }

        if (finalText.trim()) {
          const text = finalText.trim();
          if (text === lastVoiceTextRef.current) return;
          lastVoiceTextRef.current = text;
          setSentVoiceText(text);

          clearTimeout(voiceDebounceRef.current);
          voiceDebounceRef.current = setTimeout(() => {
            getSocket()?.emit('voice_text', {
              callerPhone: myPhoneNumber,
              targetPhone,
              text,
              isFinal: true,
            });
            setTimeout(() => setSentVoiceText(''), 2000);
          }, 300);
        }
      };

      recognition.onerror = (e) => {
        if ((e.error === 'no-speech' || e.error === 'network') && micActiveRef.current) {
          try {
            recognition.start();
          } catch {
            /* ignore */
          }
        }
      };

      recognition.onend = () => {
        if (micActiveRef.current && recognitionRef.current === recognition) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch {
              /* ignore */
            }
          }, 500);
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        /* ignore */
      }
    },
    [myPhoneNumber, stopMic],
  );

  const initiateWebRtcCall = useCallback(
    async (targetUserId, targetPhone, targetName) => {
      const socket = getSocket();
      if (!socket?.connected || !resolvedUserId) {
        onToast?.('Connexion serveur en cours…', 'error');
        return false;
      }

      try {
        cleanupPeerConnection();

        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        peerConnectionRef.current = new RTCPeerConnection(RTC_CONFIG);
        localStreamRef.current
          .getTracks()
          .forEach((t) => peerConnectionRef.current.addTrack(t, localStreamRef.current));

        setupPeerIceHandler(targetUserId);

        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);

        await new Promise((resolve, reject) => {
          const cleanup = () => {
            clearTimeout(timer);
            socket.off('call_sent', handleSent);
            socket.off('call_failed', handleFailed);
          };
          const handleSent = (data) => {
            if (String(data?.targetUserId || '') !== String(targetUserId)) return;
            cleanup();
            resolve();
          };
          const handleFailed = (data) => {
            if (data?.targetUserId && String(data.targetUserId) !== String(targetUserId)) return;
            cleanup();
            reject(new Error(data?.message || "L'utilisateur est injoignable"));
          };
          const timer = setTimeout(() => {
            cleanup();
            reject(new Error("Le serveur d'appel ne répond pas"));
          }, CALL_START_TIMEOUT_MS);

          socket.on('call_sent', handleSent);
          socket.on('call_failed', handleFailed);
          callUserById({
            callerId: resolvedUserId,
            targetUserId,
            targetPhone,
            offer,
            callType: 'voice',
            callerName: targetName,
          });
        });

        setOutgoingCall({
          targetPhone,
          targetUserId,
          status: 'ringing',
          startedAt: Date.now(),
        });
        onToast?.('📞 Appel en cours…', 'info');
        clearCallTimeout();
        timeoutRef.current = setTimeout(() => {
          socket.emit('call_timeout', {
            callerPhone: myPhoneNumber,
            targetPhone,
          });
          cleanupCall();
          onToast?.('Pas de réponse', 'info');
        }, CALL_TIMEOUT_MS);

        return true;
      } catch (err) {
        console.error('[APPEL]', err);
        onToast?.(`Impossible de démarrer l'appel : ${err.message}`, 'error');
        cleanupCall();
        return false;
      }
    },
    [
      resolvedUserId,
      myPhoneNumber,
      onToast,
      clearCallTimeout,
      cleanupCall,
      cleanupPeerConnection,
      setupPeerIceHandler,
    ],
  );

  useEffect(() => {
    if (!myPhoneNumber || myPhoneNumber.length < 8) {
      return undefined;
    }

    const voxmanusUser = getVoxManusUser();
    if (voxmanusUser?.id) {
      initSocket(voxmanusUser);
    }

    const socket = getSocket();
    if (!socket) {
      return undefined;
    }

    const register = () => {
      if (voxmanusUser?.id) {
        socket.emit('register_user', {
          userId: String(voxmanusUser.id),
          phoneNumber: voxmanusUser.phoneNumber,
        });
      } else {
        socket.emit('register_user', myPhoneNumber);
      }
    };

    socket.on('connect', register);
    socket.io.on('reconnect', register);

    socket.on('registered', () => setIsRegistered(true));
    socket.on('register_confirmed', () => setIsRegistered(true));

    socket.on('incoming_call', (data) => {
      pendingCallRef.current = data;
      setIncomingCall(data);
      playRingtone();
      vibratePhone();
      showBrowserNotification(
        data.callerName,
        data.callerPhone || data.callerId,
      );
      clearCallTimeout();
      timeoutRef.current = setTimeout(() => {
        setIncomingCall(null);
        stopRingtone();
        socket.emit('reject_call', {
          callerId: data.callerId,
          callerPhone: data.callerPhone,
          targetPhone: myPhoneNumber,
        });
      }, CALL_TIMEOUT_MS);
    });

    socket.on('call_answered', async ({ answer }) => {
      clearCallTimeout();
      stopRingtone();
      if (peerConnectionRef.current && answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer),
          );
        } catch (e) {
          console.error('[CALL_ANSWERED]', e);
        }
      }
    });

    socket.on('call_accepted', (data) => {
      clearCallTimeout();
      stopRingtone();
      const peerPhone = data.by || outgoingCall?.targetPhone;
      setOutgoingCall(null);
      setActiveCall({ withPhone: peerPhone, startTime: Date.now() });
      onToast?.('✅ Appel accepté', 'success');
    });

    socket.on('ice_candidate', async ({ candidate }) => {
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('[ICE]', e);
        }
      }
    });

    socket.on('turn_change', ({ canSpeak }) => {
      setTurnHolder(canSpeak);
      if (!canSpeakNow(canSpeak, myPhoneNumber)) {
        stopMic();
      }
    });

    socket.on('turn_denied', () => {
      onToast?.('⏳ Attendez votre tour pour parler', 'info');
    });

    socket.on('call_rejected', (data) => {
      clearCallTimeout();
      stopRingtone();
      setOutgoingCall(null);
      cleanupPeerConnection();
      onToast?.(`Appel refusé${data.by ? ` par ${data.by}` : ''}`, 'error');
    });

    socket.on('call_ended', () => {
      cleanupCall();
    });

    socket.on('call_cancelled', () => {
      clearCallTimeout();
      stopRingtone();
      setIncomingCall(null);
      setOutgoingCall(null);
    });

    socket.on('call_failed', (data) => {
      clearCallTimeout();
      stopRingtone();
      setOutgoingCall(null);
      cleanupPeerConnection();
      const msg =
        data.message ||
        (data.targetPhone ? `${data.targetPhone} injoignable` : 'Utilisateur injoignable');
      onToast?.(`📵 ${msg}`, 'error');
    });

    socket.on('receive_voice_text', ({ text }) => {
      setReceivedText(text || '');
      if (typeof window !== 'undefined' && window.voxmanusProcessAvatar) {
        window.voxmanusProcessAvatar(text);
      }
    });

    socket.on('receive_sign_text', ({ text }) => {
      setReceivedText(text || '');
      if (myRole === 'hearing') {
        speakText(text);
      }
    });

    socket.on('user_status_change', ({ phoneNumber, status }) => {
      setOnlineContacts((prev) => ({ ...prev, [phoneNumber]: status }));
    });

    socket.on('connect_error', () => setIsRegistered(false));
    socket.on('disconnect', () => setIsRegistered(false));

    if (socket.connected) {
      register();
    }

    return () => {
      cleanupCall();
      socket.off('connect');
      socket.off('registered');
      socket.off('register_confirmed');
      socket.off('incoming_call');
      socket.off('call_answered');
      socket.off('call_accepted');
      socket.off('ice_candidate');
      socket.off('turn_change');
      socket.off('turn_denied');
      socket.off('call_rejected');
      socket.off('call_ended');
      socket.off('call_cancelled');
      socket.off('call_failed');
      socket.off('receive_voice_text');
      socket.off('receive_sign_text');
      socket.off('user_status_change');
      socket.off('connect_error');
      socket.off('disconnect');
    };
  }, [
    myPhoneNumber,
    myRole,
    cleanupCall,
    cleanupPeerConnection,
    clearCallTimeout,
    onToast,
    playRingtone,
    showBrowserNotification,
    speakText,
    stopMic,
    stopRingtone,
    vibratePhone,
    outgoingCall,
  ]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    clearCallTimeout();
    stopRingtone();

    const callerId = incomingCall.callerId;
    const callerPhone = incomingCall.callerPhone || incomingCall.callerId;
    const offer = incomingCall.offer;
    const socket = getSocket();

    try {
      if (offer && callerId) {
        cleanupPeerConnection();
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        peerConnectionRef.current = new RTCPeerConnection(RTC_CONFIG);
        localStreamRef.current
          .getTracks()
          .forEach((t) => peerConnectionRef.current.addTrack(t, localStreamRef.current));

        setupPeerIceHandler(callerId);

        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socket?.emit('answer_call', {
          callerId: String(callerId),
          answer,
          callerPhone,
          targetPhone: myPhoneNumber,
        });
      } else {
        socket?.emit('accept_call', {
          callerPhone,
          targetPhone: myPhoneNumber,
        });
      }

      setActiveCall({
        withPhone: callerPhone,
        startTime: Date.now(),
      });
      setIncomingCall(null);
      pendingCallRef.current = null;
    } catch (err) {
      console.error('[ACCEPTER]', err);
      cleanupCall();
      onToast?.("Erreur lors de l'acceptation de l'appel", 'error');
    }
  }, [
    incomingCall,
    myPhoneNumber,
    clearCallTimeout,
    stopRingtone,
    cleanupCall,
    cleanupPeerConnection,
    setupPeerIceHandler,
    onToast,
  ]);

  const acceptCallFromPush = useCallback(
    async (callerPhone) => {
      const phone = (callerPhone || '').trim();
      if (!phone || !myPhoneNumber) return;
      clearCallTimeout();
      stopRingtone();
      setActiveCall({ withPhone: phone, startTime: Date.now() });
      setIncomingCall(null);

      const user = getVoxManusUser();
      const socket = getSocket() || (user?.id ? initSocket(user) : null);
      if (!socket) return;
      if (!socket.connected) {
        socket.connect();
      }

      const waitUntilReady = () => new Promise((resolve, reject) => {
        if (socket.connected) {
          socket.emit('register_user', {
            userId: String(user?.id || myPhoneNumber),
            phoneNumber: myPhoneNumber,
          });
          resolve();
          return;
        }
        const cleanup = () => {
          clearTimeout(timer);
          socket.off('connect', ready);
          socket.off('connect_error', failed);
        };
        const ready = () => {
          socket.emit('register_user', {
            userId: String(user?.id || myPhoneNumber),
            phoneNumber: myPhoneNumber,
          });
          cleanup();
          resolve();
        };
        const failed = () => {
          cleanup();
          reject(new Error('socket indisponible'));
        };
        const timer = setTimeout(failed, 5000);
        socket.once('connect', ready);
        socket.once('connect_error', failed);
      });

      try {
        await waitUntilReady();

        const offerPromise = new Promise((resolve) => {
          const timer = setTimeout(() => {
            socket.off('push_call_offer', handleOffer);
            resolve(null);
          }, 1500);
          const handleOffer = (payload) => {
            if (payload?.callerPhone && payload.callerPhone !== phone) return;
            clearTimeout(timer);
            socket.off('push_call_offer', handleOffer);
            resolve(payload);
          };
          socket.on('push_call_offer', handleOffer);
        });

        socket.emit('accept_call', {
          callerPhone: phone,
          targetPhone: myPhoneNumber,
        });

        const pending = await offerPromise;
        if (!pending?.offer) return;

        cleanupPeerConnection();
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        peerConnectionRef.current = new RTCPeerConnection(RTC_CONFIG);
        localStreamRef.current
          .getTracks()
          .forEach((track) => peerConnectionRef.current.addTrack(track, localStreamRef.current));
        setupPeerIceHandler(pending.callerId || phone);
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(pending.offer),
        );
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socket.emit('answer_call', {
          callerId: String(pending.callerId || phone),
          answer,
          callerPhone: phone,
          targetPhone: myPhoneNumber,
        });
      } catch (error) {
        onToast?.(`Audio en cours de connexion : ${error.message}`, 'info');
      }
    },
    [
      myPhoneNumber,
      clearCallTimeout,
      stopRingtone,
      cleanupPeerConnection,
      setupPeerIceHandler,
      onToast,
    ],
  );

  const callUser = useCallback(
    async (targetPhone, callerName) => {
      if (!targetPhone) {
        console.error('[CALL] targetPhone is undefined');
        return;
      }
      if (!myPhoneNumber) {
        console.error('[CALL] myPhone is undefined');
        return;
      }
      if (!getSocket()?.connected) {
        onToast?.('Connexion serveur en cours…', 'error');
        return;
      }

      if (!resolvedUserId) {
        onToast?.('Compte non enregistré — reconnectez-vous', 'error');
        return;
      }

      const { res, data } = await findUserByPhone(targetPhone);

      if (!res.ok || !data?.found) {
        onToast?.('Utilisateur introuvable. Il doit avoir un compte.', 'error');
        return;
      }

      const target = data.user;

      if (!target.isOnline) {
        onToast?.(`${target.name} n'est pas connecté — tentative d'appel…`, 'info');
      }

      return initiateWebRtcCall(
        target.id,
        target.phoneNumber || targetPhone,
        callerName || target.name,
      );
    },
    [myPhoneNumber, resolvedUserId, onToast, initiateWebRtcCall],
  );

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    clearCallTimeout();
    stopRingtone();
    getSocket()?.emit('reject_call', {
      callerId: incomingCall.callerId,
      callerPhone: incomingCall.callerPhone,
      targetPhone: myPhoneNumber,
    });
    setIncomingCall(null);
    pendingCallRef.current = null;
  }, [incomingCall, myPhoneNumber, clearCallTimeout, stopRingtone]);

  const endCall = useCallback(() => {
    const peer = activeCall?.withPhone;
    if (!peer || !myPhoneNumber) return;
    const socket = getSocket();
    socket?.emit('end_call', {
      callerPhone: myPhoneNumber,
      targetPhone: peer,
      targetUserId: outgoingCall?.targetUserId,
    });
    cleanupCall();
  }, [activeCall, myPhoneNumber, outgoingCall, cleanupCall]);

  const cancelOutgoing = useCallback(() => {
    if (!outgoingCall || !myPhoneNumber) return;
    clearCallTimeout();
    stopRingtone();
    const socket = getSocket();
    if (outgoingCall.status === 'ringing') {
      socket?.emit('call_timeout', {
        callerPhone: myPhoneNumber,
        targetPhone: outgoingCall.targetPhone,
      });
    } else {
      socket?.emit('end_call', {
        callerPhone: myPhoneNumber,
        targetPhone: outgoingCall.targetPhone,
      });
    }
    cleanupCall();
  }, [outgoingCall, myPhoneNumber, clearCallTimeout, stopRingtone, cleanupCall]);

  const sendSignText = useCallback(
    (text) => {
      if (!activeCall?.withPhone || !text?.trim()) return;
      if (!canSpeakNow(turnHolder, myPhoneNumber)) {
        onToast?.('⏳ Attendez votre tour pour envoyer un signe', 'info');
        return;
      }
      getSocket()?.emit('sign_text', {
        callerPhone: myPhoneNumber,
        targetPhone: activeCall.withPhone,
        text: text.trim(),
      });
    },
    [activeCall, myPhoneNumber, turnHolder, onToast],
  );

  const emitVoiceText = useCallback(
    (text, isFinal = true) => {
      if (!activeCall?.withPhone || !text?.trim()) return;
      const trimmed = text.trim();
      if (trimmed === lastVoiceTextRef.current) return;
      lastVoiceTextRef.current = trimmed;
      getSocket()?.emit('voice_text', {
        callerPhone: myPhoneNumber,
        targetPhone: activeCall.withPhone,
        text: trimmed,
        isFinal,
      });
      setSentVoiceText(trimmed);
    },
    [activeCall, myPhoneNumber],
  );

  const toggleMic = useCallback(() => {
    if (micActiveRef.current) {
      stopMic();
    } else if (activeCall?.withPhone) {
      if (!canSpeakNow(turnHolder, myPhoneNumber)) {
        onToast?.('⏳ Attendez votre tour pour parler', 'info');
        return;
      }
      startMic(activeCall.withPhone);
    }
  }, [activeCall, startMic, stopMic, turnHolder, myPhoneNumber, onToast]);

  const toggleTTS = useCallback(() => {
    ttsActiveRef.current = !ttsActiveRef.current;
    if (!ttsActiveRef.current) {
      window.speechSynthesis?.cancel();
    }
  }, []);

  const getRealtimeStatus = useCallback(
    (phoneNumber, fallbackStatus = 'offline') => {
      if (activeCall?.withPhone === phoneNumber) return 'busy';
      const live = onlineContacts[phoneNumber];
      if (live === 'online' || live === 'busy') return live;
      return fallbackStatus;
    },
    [activeCall, onlineContacts],
  );

  const disconnectSocket = useCallback(() => {
    cleanupCall();
    setIsRegistered(false);
  }, [cleanupCall]);

  return {
    incomingCall,
    outgoingCall,
    activeCall,
    onlineContacts,
    receivedText,
    sentVoiceText,
    isRegistered,
    turnHolder,
    canSpeakTurn: canSpeakNow(turnHolder, myPhoneNumber),
    callUser,
    acceptCall,
    acceptCallFromPush,
    rejectCall,
    endCall,
    cancelOutgoing,
    sendSignText,
    emitVoiceText,
    toggleMic,
    toggleTTS,
    disconnectSocket,
    getRealtimeStatus,
    myPhoneNumber,
    myUserId: resolvedUserId,
  };
}
