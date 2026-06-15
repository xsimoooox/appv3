import { useCallback, useRef } from 'react';
import {
  getFirebaseData,
  listenFirebaseValue,
  pushFirebaseData,
  updateFirebaseData,
} from '../lib/firebaseRealtime';

const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
if (import.meta.env.VITE_TURN_URL) {
  iceServers.push({
    urls: import.meta.env.VITE_TURN_URL,
    username: import.meta.env.VITE_TURN_USERNAME || '',
    credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
  });
}
const RTC_CONFIG = { iceServers };

async function waitForOffer(code) {
  const path = `calls/${code}/rtc/offer`;
  const existing = await getFirebaseData(path).catch(() => null);
  if (existing?.type) return existing;

  return new Promise((resolve, reject) => {
    let settled = false;
    let stop = () => {};
    const finish = (offer) => {
      if (settled || !offer?.type) return;
      settled = true;
      clearTimeout(timeout);
      stop();
      resolve(offer);
    };
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      stop();
      reject(new Error("L'offre audio n'est pas disponible"));
    }, 20000);
    stop = listenFirebaseValue(path, finish);
  });
}

export function useFirebaseWebRtcCall({ onToast } = {}) {
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const stopsRef = useRef([]);
  const seenCandidatesRef = useRef(new Set());
  const pendingCandidatesRef = useRef([]);

  const cleanup = useCallback(() => {
    stopsRef.current.forEach((stop) => stop());
    stopsRef.current = [];
    seenCandidatesRef.current.clear();
    pendingCandidatesRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    const audio = document.getElementById('firebase-remote-audio');
    if (audio) audio.srcObject = null;
  }, []);

  const createPeer = useCallback(async (code, side) => {
    cleanup();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone non supporté sur cet appareil');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const peer = new RTCPeerConnection(RTC_CONFIG);
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.ontrack = ({ streams }) => {
      const audio = document.getElementById('firebase-remote-audio');
      if (!audio || !streams[0]) return;
      audio.srcObject = streams[0];
      audio.play().catch(() => {});
    };
    peer.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      const path = `calls/${code}/rtc/${side}Candidates`;
      pushFirebaseData(path, candidate.toJSON()).catch(() => {});
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') onToast?.('Appel audio connecté', 'success');
      if (peer.connectionState === 'failed') onToast?.('Connexion audio interrompue', 'error');
    };

    streamRef.current = stream;
    peerRef.current = peer;
    return peer;
  }, [cleanup, onToast]);

  const flushPendingCandidates = useCallback(async (peer) => {
    if (!peer.remoteDescription) return;
    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const { key, candidate } of pending) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        seenCandidatesRef.current.delete(key);
      }
    }
  }, []);

  const listenCandidates = useCallback((code, side, peer) => {
    const stop = listenFirebaseValue(`calls/${code}/rtc/${side}Candidates`, (map) => {
      if (!map || typeof map !== 'object') return;
      Object.entries(map).forEach(([key, candidate]) => {
        if (seenCandidatesRef.current.has(key)) return;
        seenCandidatesRef.current.add(key);
        if (!peer.remoteDescription) {
          pendingCandidatesRef.current.push({ key, candidate });
          return;
        }
        peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {
          seenCandidatesRef.current.delete(key);
        });
      });
    });
    stopsRef.current.push(stop);
  }, []);

  const listenForEnd = useCallback((code) => {
    const stop = listenFirebaseValue(`calls/${code}/status`, (status) => {
      if (status === 'ended') cleanup();
    });
    stopsRef.current.push(stop);
  }, [cleanup]);

  const startCaller = useCallback(async (code) => {
    try {
      const peer = await createPeer(code, 'caller');
      listenForEnd(code);
      listenCandidates(code, 'callee', peer);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await updateFirebaseData(`calls/${code}/rtc`, {
        offer: { type: offer.type, sdp: offer.sdp },
        updatedAt: Date.now(),
      });

      const stopAnswer = listenFirebaseValue(`calls/${code}/rtc/answer`, async (answer) => {
        if (!answer?.type || peer.currentRemoteDescription) return;
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
          await flushPendingCandidates(peer);
        } catch {
          /* wait for a valid answer */
        }
      });
      stopsRef.current.push(stopAnswer);
    } catch (error) {
      cleanup();
      onToast?.(`Microphone indisponible : ${error.message}`, 'error');
      throw error;
    }
  }, [cleanup, createPeer, listenCandidates, listenForEnd, onToast]);

  const startCallee = useCallback(async (code) => {
    try {
      const offer = await waitForOffer(code);

      const peer = await createPeer(code, 'callee');
      listenForEnd(code);
      listenCandidates(code, 'caller', peer);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingCandidates(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await updateFirebaseData(`calls/${code}/rtc`, {
        answer: { type: answer.type, sdp: answer.sdp },
        updatedAt: Date.now(),
      });
    } catch (error) {
      cleanup();
      onToast?.(`Impossible de connecter l'audio : ${error.message}`, 'error');
      throw error;
    }
  }, [cleanup, createPeer, flushPendingCandidates, listenCandidates, listenForEnd, onToast]);

  return { startFirebaseCaller: startCaller, startFirebaseCallee: startCallee, stopFirebaseRtc: cleanup };
}
