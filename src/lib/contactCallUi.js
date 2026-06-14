/** Classes du bouton d'appel — appels autorisés sauf si occupé (en appel). */
export function getContactCallState(realtimeStatus) {
  if (realtimeStatus === 'busy') {
    return {
      disabled: true,
      buttonClass:
        'w-7 h-7 rounded-full flex items-center justify-center text-white opacity-80 cursor-not-allowed bg-[#f97316]',
      useLucidePhone: false,
      themifyIcon: 'ti-control-pause',
    };
  }
  return {
    disabled: false,
    buttonClass:
      'w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer bg-[#2E7D32] hover:bg-emerald-600',
    useLucidePhone: true,
  };
}

export function getEntendantCallState(realtimeStatus) {
  if (realtimeStatus === 'busy') {
    return {
      disabled: true,
      className:
        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-[#f97316] text-white opacity-80',
    };
  }
  return {
    disabled: false,
    className: 'w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-[#2E7D32] text-white',
  };
}

export function getPresenceLabel(status) {
  if (status === 'online') return 'En ligne';
  if (status === 'busy') return 'Occupé';
  return 'Hors ligne';
}
