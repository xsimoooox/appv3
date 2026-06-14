import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ear, EarOff } from 'lucide-react';
import { SYSTEM_PHONES } from '../data/callDirectory';
import { getClientUid, registerNotificationPreference } from '../lib/firebaseRealtime';

export default function ProfileSelect() {
  const navigate = useNavigate();

  useEffect(() => {
    registerNotificationPreference(getClientUid('web')).catch(() => {});
  }, []);

  const chooseProfile = (profile) => {
    localStorage.setItem('voxmanus_profile', profile);
    localStorage.setItem(
      'userPhone',
      profile === 'entendant' ? SYSTEM_PHONES.hearing : SYSTEM_PHONES.deaf,
    );
    navigate(profile === 'entendant' ? '/entendant/accueil' : '/accueil');
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center px-5 text-[#111111] select-none">
      <div className="w-full max-w-[340px] flex flex-col items-center animate-fade-in">
        <div className="w-[100px] h-[64px] rounded-[12px] bg-white border border-[#D9D9E8] flex items-center justify-center shadow-[0_8px_18px_rgba(0,0,150,0.12)] overflow-hidden">
          <img src="/voxmanus-logo.png" alt="VoxManus" className="w-full h-full" />
        </div>

        <h1 className="mt-4 text-[16px] font-bold text-[#111111] leading-none">VoxManus</h1>
        <p className="mt-2 text-[11px] text-[#5F5F72] font-semibold">Choisissez votre profil pour continuer</p>

        <div className="mt-8 w-full space-y-3">
          <button
            type="button"
            onClick={() => chooseProfile('sourd')}
            className="w-full rounded-[14px] border border-[#0000B4] bg-[#ffffff] hover:bg-[#EEEEFF] active:scale-[0.98] transition-all p-3 flex items-center gap-3 text-left cursor-pointer"
          >
            <span className="w-10 h-10 rounded-[10px] bg-[#EEEEFF] text-[#0000B4] flex items-center justify-center shrink-0">
              <EarOff size={20} strokeWidth={2.1} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-extrabold text-[#111111] leading-tight">Personne sourde</span>
              <span className="block mt-1 text-[10px] font-semibold text-[#777] leading-snug">
                Communication LSF via gants + avatar 3D
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => chooseProfile('entendant')}
            className="w-full rounded-[14px] border border-[#2E7D32] bg-[#ffffff] hover:bg-[#EAF5EB] active:scale-[0.98] transition-all p-3 flex items-center gap-3 text-left cursor-pointer"
          >
            <span className="w-10 h-10 rounded-[10px] bg-[#EAF5EB] text-[#2E7D32] flex items-center justify-center shrink-0">
              <Ear size={20} strokeWidth={2.1} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-extrabold text-[#111111] leading-tight">Personne entendante</span>
              <span className="block mt-1 text-[10px] font-semibold text-[#777] leading-snug">
                Reçoit la traduction LSF en texte + voix
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
