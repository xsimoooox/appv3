import React from 'react';
import { LogIn, PhoneIncoming, PhoneOff, Loader2 } from 'lucide-react';
import { CALL_INVITE_TTL_MS } from '../lib/callInvite';

function formatRemaining(expiresAt) {
  const ms = Math.max(0, (expiresAt || 0) - Date.now());
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function FirebaseIncomingCallOverlay({
  incomingCall,
  onAccept,
  onReject,
  accepting = false,
}) {
  const [remaining, setRemaining] = React.useState('');

  React.useEffect(() => {
    if (!incomingCall?.expiresAt) return undefined;
    const tick = () => setRemaining(formatRemaining(incomingCall.expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [incomingCall?.expiresAt]);

  if (!incomingCall?.code) return null;

  const expired = incomingCall.expiresAt && Date.now() > incomingCall.expiresAt;

  return (
    <div className="fixed inset-0 z-[100002] flex items-start justify-center pt-4 px-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm rounded-[16px] border-2 border-[#0000B4] bg-[#f5f0ff] p-4 shadow-2xl animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-[#0000B4] flex items-center justify-center shrink-0 animate-pulse">
            <PhoneIncoming className="text-white" size={22} strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold text-[#111111] m-0">Appel entrant LSF</p>
            <p className="text-[12px] font-bold text-[#666680555] mt-1 m-0">
              {incomingCall.callerName || 'Un utilisateur VoxManus'}
            </p>
            <p className="text-[11px] text-[#0000B4] font-bold mt-0.5 m-0">
              Code : {incomingCall.code}
            </p>
            {remaining && !expired && (
              <p className="text-[10px] text-[#5F5F72] mt-1 m-0">
                Valide encore {remaining} (max {CALL_INVITE_TTL_MS / 60000} min)
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={accepting || expired}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAccept();
            }}
            className="h-11 flex-1 rounded-[12px] bg-[#2E7D32] disabled:opacity-50 text-white text-[12px] font-extrabold flex items-center justify-center gap-1.5 active:scale-95"
          >
            {accepting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogIn size={16} strokeWidth={2.5} />
            )}
            {accepting ? 'Connexion…' : 'Accepter'}
          </button>
          <button
            type="button"
            disabled={accepting}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onReject();
            }}
            className="h-11 flex-1 rounded-[12px] bg-[#E53935] text-white text-[12px] font-extrabold flex items-center justify-center gap-1.5 active:scale-95"
          >
            <PhoneOff size={16} strokeWidth={2.5} />
            Refuser
          </button>
        </div>
      </div>
    </div>
  );
}
