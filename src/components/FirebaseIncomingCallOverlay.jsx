import React from 'react';
import { LogIn, PhoneIncoming, PhoneOff } from 'lucide-react';

export default function FirebaseIncomingCallOverlay({
  incomingCall,
  onAccept,
  onReject,
}) {
  if (!incomingCall?.code) return null;

  return (
    <div className="fixed inset-0 z-[100002] flex items-start justify-center pt-4 px-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm rounded-[16px] border-2 border-[#6366f1] bg-[#f5f0ff] p-4 shadow-2xl animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-[#6366f1] flex items-center justify-center shrink-0 animate-pulse">
            <PhoneIncoming className="text-white" size={22} strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold text-[#111111] m-0">Appel entrant LSF</p>
            <p className="text-[12px] font-bold text-[#555555] mt-1 m-0">
              {incomingCall.callerName || 'Un utilisateur WakWak'}
            </p>
            <p className="text-[11px] text-[#6366f1] font-bold mt-0.5 m-0">
              Code : {incomingCall.code}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="h-11 flex-1 rounded-[12px] bg-[#16a34a] text-white text-[12px] font-extrabold flex items-center justify-center gap-1.5 active:scale-95"
          >
            <LogIn size={16} strokeWidth={2.5} />
            Accepter
          </button>
          <button
            type="button"
            onClick={onReject}
            className="h-11 flex-1 rounded-[12px] bg-[#ef4444] text-white text-[12px] font-extrabold flex items-center justify-center gap-1.5 active:scale-95"
          >
            <PhoneOff size={16} strokeWidth={2.5} />
            Refuser
          </button>
        </div>
      </div>
    </div>
  );
}
