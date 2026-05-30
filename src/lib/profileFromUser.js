import { getWakwakUser } from './wakwakUser';
import { normalizePhoneNumber } from './phoneUtils';

export function parseDisplayName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
}

export function formatDisplayPhone(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return '';
  const digits = normalized.replace(/\D/g, '');
  if (digits.length >= 11 && digits.startsWith('212')) {
    const local = digits.slice(3);
    return `+212 ${local.replace(/(\d{2})(?=\d)/g, '$1 ').trim()}`;
  }
  if (normalized.startsWith('+')) {
    return normalized.replace(/(\d{2,3})(?=(\d{2}){2,})/g, '$1 ').trim();
  }
  return normalized;
}

const emptyProfile = {
  firstName: '',
  lastName: '',
  birthDate: '',
  phone: '',
  email: '',
  city: '',
  signLanguage: 'LSF',
};

/**
 * Profil affiché dans Paramètres : nom/téléphone du compte connecté + champs sauvegardés.
 */
export function loadSettingsProfile(storageKey = 'wakwak_profile_data') {
  const user = getWakwakUser();
  let saved = {};

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) saved = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  const fromName = parseDisplayName(user?.name);
  const base = {
    ...emptyProfile,
    ...(saved.profile || {}),
  };

  if (user) {
    return {
      ...base,
      firstName: fromName.firstName || base.firstName,
      lastName: fromName.lastName || base.lastName,
      phone: formatDisplayPhone(user.phoneNumber) || base.phone,
    };
  }

  return base;
}

export function getProfileStorageKey(role) {
  return role === 'hearing' ? 'wakwak_profile_data_hearing' : 'wakwak_profile_data';
}
