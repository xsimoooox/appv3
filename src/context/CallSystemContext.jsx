import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import IncomingCallModal from '../components/IncomingCallModal';
import OutgoingCallModal from '../components/OutgoingCallModal';
import FirebaseIncomingCallOverlay from '../components/FirebaseIncomingCallOverlay';
import { SYSTEM_PHONES } from '../data/callDirectory';
import { useCallSystem } from '../hooks/useCallSystem';
import { usePushNotification } from '../hooks/usePushNotification';
import { useFirebasePresence } from '../hooks/useFirebasePresence';
import { useGlobalCallListener } from '../hooks/useGlobalCallListener';
import { useFirebaseOutgoingCall } from '../hooks/useFirebaseOutgoingCall';
import { useFirebaseWebRtcCall } from '../hooks/useFirebaseWebRtcCall';
import { getCallRouteForPeer } from '../lib/callNavigation';
import {
  endRealtimeCall,
  getFirebaseData,
  listenFirebaseValue,
  liveTranscriptPathForPhone,
  storeSessionCode,
} from '../lib/firebaseRealtime';
import { setPresenceAvailable } from '../lib/presenceFirebase';
import { normalizePhoneNumber } from '../lib/phoneUtils';
import { getVoxManusUser, VOXMANUS_USER_CHANGED_EVENT } from '../lib/voxmanusUser';

const CallSystemContext = createContext(null);

export function CallSystemProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [callToast, setCallToast] = React.useState(null);
  const [globalLiveTranscript, setGlobalLiveTranscript] = React.useState(null);
  const [firebaseCallCode, setFirebaseCallCode] = React.useState('');
  const navigatedCallKeyRef = useRef(null);
  const pushAcceptHandledRef = useRef(false);
  const firebaseAcceptHandledRef = useRef(null);

  const [voxmanusUser, setVoxManusUser] = React.useState(
    () => (typeof window !== 'undefined' ? getVoxManusUser() : null),
  );

  useEffect(() => {
    const syncUser = () => setVoxManusUser(getVoxManusUser());
    window.addEventListener(VOXMANUS_USER_CHANGED_EVENT, syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener(VOXMANUS_USER_CHANGED_EVENT, syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  const myPhoneNumber = useMemo(() => {
    if (typeof window === 'undefined') return SYSTEM_PHONES.deaf;
    if (voxmanusUser?.phoneNumber) return voxmanusUser.phoneNumber;
    const profile = localStorage.getItem('voxmanus_profile');
    const defaultPhone = profile === 'entendant' ? SYSTEM_PHONES.hearing : SYSTEM_PHONES.deaf;
    return normalizePhoneNumber(localStorage.getItem('userPhone') || defaultPhone);
  }, [voxmanusUser]);

  const myRole = voxmanusUser?.role
    || (localStorage.getItem('voxmanus_profile') === 'entendant' ? 'hearing' : 'deaf');

  const onToast = useCallback((message, type = 'info') => {
    setCallToast({ message, type });
    setTimeout(() => setCallToast(null), 2500);
  }, []);

  const presenceByPhone = useFirebasePresence(voxmanusUser);
  const {
    startFirebaseCaller,
    startFirebaseCallee,
    stopFirebaseRtc,
  } = useFirebaseWebRtcCall({ onToast });
  const {
    firebaseIncomingCall,
    acceptFirebaseIncomingCall,
    rejectFirebaseIncomingCall,
    acceptingIncomingCall,
  } = useGlobalCallListener({
    onAcceptCall: startFirebaseCallee,
    onRejectCall: stopFirebaseRtc,
  });

  const {
    firebaseOutgoingCall,
    firebaseActiveCode,
    startFirebaseOutgoing,
    cancelFirebaseOutgoing,
  } = useFirebaseOutgoingCall({
    onToast,
    onStartCall: startFirebaseCaller,
    onStopCall: stopFirebaseRtc,
  });

  usePushNotification(myPhoneNumber);

  useEffect(() => {
    const path = liveTranscriptPathForPhone(myPhoneNumber);
    if (!path) return undefined;

    let latestTimestamp = 0;
    const applyTranscript = (transcript) => {
      if (!transcript || typeof transcript !== 'object') return;
      const timestamp = Number(transcript.timestamp) || 0;
      if (timestamp && timestamp < latestTimestamp) return;
      latestTimestamp = timestamp;
      if (transcript.code) storeSessionCode(transcript.code);
      setGlobalLiveTranscript(transcript);
    };

    const stop = listenFirebaseValue(path, applyTranscript);
    const poll = setInterval(() => {
      getFirebaseData(path).then(applyTranscript).catch(() => {});
    }, 300);

    return () => {
      stop();
      clearInterval(poll);
    };
  }, [myPhoneNumber]);

  const callSystem = useCallSystem(myPhoneNumber, myRole, {
    onToast,
    myUserId: voxmanusUser?.id,
  });

  const sharedSessionCode = (
    new URLSearchParams(location.search).get('code')
    || callSystem.activeCall?.sessionCode
    || firebaseCallCode
    || firebaseActiveCode
    || ''
  ).toUpperCase();

  useEffect(() => {
    if (!sharedSessionCode) return undefined;

    let latestTimestamp = 0;
    const applySessionTranscript = (transcript) => {
      if (!transcript || typeof transcript !== 'object' || !transcript.text) return;
      const timestamp = Number(transcript.timestamp) || 0;
      if (timestamp && timestamp < latestTimestamp) return;
      latestTimestamp = timestamp;
      storeSessionCode(sharedSessionCode);
      setGlobalLiveTranscript({ ...transcript, code: transcript.code || sharedSessionCode });
    };

    const path = `sessions/${sharedSessionCode}/liveTranscript`;
    const stop = listenFirebaseValue(path, applySessionTranscript);
    const poll = setInterval(() => {
      getFirebaseData(path).then(applySessionTranscript).catch(() => {});
    }, 250);

    return () => {
      stop();
      clearInterval(poll);
    };
  }, [sharedSessionCode]);

  const beginFirebaseOutgoing = useCallback((payload) => {
    setFirebaseCallCode(payload?.code || '');
    startFirebaseOutgoing(payload);
  }, [startFirebaseOutgoing]);

  const acceptIncomingFirebase = useCallback(async () => {
    const code = firebaseIncomingCall?.code || '';
    if (code) setFirebaseCallCode(code);
    try {
      await acceptFirebaseIncomingCall();
    } catch (error) {
      setFirebaseCallCode('');
      throw error;
    }
  }, [firebaseIncomingCall?.code, acceptFirebaseIncomingCall]);

  const endCurrentCall = useCallback(() => {
    callSystem.endCall();
    const code = firebaseCallCode
      || new URLSearchParams(location.search).get('code')
      || firebaseActiveCode;
    if (!code) return;

    setFirebaseCallCode('');
    stopFirebaseRtc();
    endRealtimeCall(code).catch(() => {});
    if (myPhoneNumber) {
      setPresenceAvailable(myPhoneNumber).catch(() => {});
    }
  }, [
    callSystem,
    firebaseCallCode,
    location.search,
    firebaseActiveCode,
    stopFirebaseRtc,
    myPhoneNumber,
  ]);

  useEffect(() => {
    if (!firebaseCallCode) return undefined;
    return listenFirebaseValue(`calls/${firebaseCallCode}/status`, (status) => {
      if (status !== 'ended') return;
      stopFirebaseRtc();
      setFirebaseCallCode('');
      if (myPhoneNumber) {
        setPresenceAvailable(myPhoneNumber).catch(() => {});
      }
    });
  }, [firebaseCallCode, stopFirebaseRtc, myPhoneNumber]);

  const getRealtimeStatus = useCallback(
    (phoneNumber, fallbackStatus = 'offline') => {
      const phone = normalizePhoneNumber(phoneNumber);
      if (callSystem.activeCall?.withPhone && normalizePhoneNumber(callSystem.activeCall.withPhone) === phone) {
        return 'busy';
      }
      if (firebaseIncomingCall?.code) {
        return fallbackStatus === 'busy' ? 'busy' : 'online';
      }
      const socketLive = callSystem.onlineContacts[phone];
      if (socketLive === 'online' || socketLive === 'busy') return socketLive;
      const firebaseLive = presenceByPhone[phone];
      if (firebaseLive) return firebaseLive;
      return fallbackStatus;
    },
    [callSystem.activeCall, callSystem.onlineContacts, presenceByPhone, firebaseIncomingCall],
  );

  useEffect(() => {
    if (myPhoneNumber && !localStorage.getItem('userPhone')) {
      localStorage.setItem('userPhone', myPhoneNumber);
    }
  }, [myPhoneNumber]);

  useEffect(() => {
    const peer = callSystem.activeCall?.withPhone;
    if (!peer || !voxmanusUser) {
      navigatedCallKeyRef.current = null;
      return;
    }

    const callKey = `${peer}-${callSystem.activeCall.startTime}`;
    if (navigatedCallKeyRef.current === callKey) return;

    const baseRoute = getCallRouteForPeer(peer, voxmanusUser.role);
    const route = callSystem.activeCall.sessionCode
      ? `${baseRoute}?code=${encodeURIComponent(callSystem.activeCall.sessionCode)}`
      : baseRoute;
    const onCallScreen = location.pathname.startsWith('/call/')
      || location.pathname.startsWith('/entendant/call/');
    const currentCode = new URLSearchParams(location.search).get('code') || '';
    const needsSharedSession = Boolean(
      callSystem.activeCall.sessionCode
      && currentCode !== callSystem.activeCall.sessionCode,
    );

    if (!onCallScreen || needsSharedSession) {
      navigate(route, { replace: true });
    }
    navigatedCallKeyRef.current = callKey;
  }, [callSystem.activeCall, voxmanusUser, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (pushAcceptHandledRef.current || !callSystem.myPhoneNumber) return undefined;

    const params = new URLSearchParams(location.search);
    if (params.get('action') !== 'accept_call') return undefined;

    const from = params.get('from');
    if (!from) return undefined;

    pushAcceptHandledRef.current = true;
    const callerPhone = decodeURIComponent(from);
    const code = params.get('code') || '';
    const cleanPath = location.pathname === '/' ? '/' : location.pathname;
    window.history.replaceState({}, '', cleanPath);

    callSystem.acceptCallFromPush(callerPhone, code);
    return undefined;
  }, [
    location.search,
    location.pathname,
    callSystem.myPhoneNumber,
    callSystem.acceptCallFromPush,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (params.get('accept') !== '1' || !code || firebaseAcceptHandledRef.current === code) {
      return;
    }
    firebaseAcceptHandledRef.current = code;
    startFirebaseCallee(code).catch(() => {
      firebaseAcceptHandledRef.current = null;
    });
  }, [location.search, startFirebaseCallee]);

  const value = useMemo(
    () => ({
      ...callSystem,
      endCall: endCurrentCall,
      getRealtimeStatus,
      firebaseIncomingCall,
      firebaseActiveCode: firebaseCallCode || firebaseActiveCode,
      globalLiveTranscript,
      acceptFirebaseIncomingCall: acceptIncomingFirebase,
      rejectFirebaseIncomingCall,
      presenceByPhone,
      startFirebaseOutgoing: beginFirebaseOutgoing,
      cancelFirebaseOutgoing,
    }),
    [
      callSystem,
      endCurrentCall,
      getRealtimeStatus,
      firebaseIncomingCall,
      firebaseCallCode,
      firebaseActiveCode,
      globalLiveTranscript,
      acceptIncomingFirebase,
      rejectFirebaseIncomingCall,
      presenceByPhone,
      beginFirebaseOutgoing,
      cancelFirebaseOutgoing,
    ],
  );

  return (
    <CallSystemContext.Provider value={value}>
      {children}
      <audio id="firebase-remote-audio" autoPlay playsInline className="hidden" />

      {callToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100000] px-4 py-2 rounded-full text-[12px] font-bold shadow-lg whitespace-nowrap"
          style={{
            background: callToast.type === 'error' ? '#3a1010' : '#EAF5EB',
            color: callToast.type === 'error' ? '#E53935' : '#2E7D32',
          }}
        >
          {callToast.message}
        </div>
      )}

      {firebaseIncomingCall && !callSystem.incomingCall && (
        <FirebaseIncomingCallOverlay
          incomingCall={firebaseIncomingCall}
          onAccept={acceptIncomingFirebase}
          onReject={rejectFirebaseIncomingCall}
          accepting={acceptingIncomingCall}
        />
      )}

      {callSystem.incomingCall && (
        <IncomingCallModal
          incomingCall={callSystem.incomingCall}
          onAccept={callSystem.acceptCall}
          onReject={callSystem.rejectCall}
        />
      )}

      {callSystem.outgoingCall && callSystem.outgoingCall.status === 'ringing' && (
        <OutgoingCallModal
          outgoingCall={callSystem.outgoingCall}
          onCancel={callSystem.cancelOutgoing}
        />
      )}

      {firebaseOutgoingCall?.status === 'ringing' && !callSystem.outgoingCall && (
        <OutgoingCallModal
          outgoingCall={firebaseOutgoingCall}
          onCancel={cancelFirebaseOutgoing}
        />
      )}
    </CallSystemContext.Provider>
  );
}

export function useCallSystemContext() {
  const ctx = useContext(CallSystemContext);
  if (!ctx) {
    throw new Error('useCallSystemContext must be used within CallSystemProvider');
  }
  return ctx;
}
