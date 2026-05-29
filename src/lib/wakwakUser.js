import { normalizePhoneNumber } from './phoneUtils';
import { setAuthToken } from './api';

export const WAKWAK_USER_KEY = 'wakwak_user';

export function isValidWakwakUser(user) {
  if (!user || typeof user !== 'object') return false;
  const name = String(user.name || '').trim();
  const phone = normalizePhoneNumber(user.phoneNumber || '');
  const role = user.role;
  const id = String(user.id || '').trim();
  return (
    id.length >= 12 &&
    name.length >= 3 &&
    /^[\p{L}\s'-]+$/u.test(name) &&
    phone.length >= 11 &&
    (role === 'deaf' || role === 'hearing')
  );
}

export function getWakwakUser() {
  try {
    const raw = localStorage.getItem(WAKWAK_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!isValidWakwakUser(user)) return null;
    return {
      ...user,
      id: String(user.id),
      phoneNumber: normalizePhoneNumber(user.phoneNumber),
    };
  } catch {
    return null;
  }
}

export function saveWakwakUser(user) {
  const payload = {
    id: String(user.id),
    name: user.name.trim(),
    phoneNumber: normalizePhoneNumber(user.phoneNumber),
    role: user.role,
    createdAt: user.createdAt || new Date().toISOString(),
    avatar: user.avatar ?? null,
    isOnline: user.isOnline ?? false,
  };
  localStorage.setItem(WAKWAK_USER_KEY, JSON.stringify(payload));
  localStorage.setItem('user', JSON.stringify(payload));
  localStorage.setItem('wakwak_profile', payload.role === 'hearing' ? 'entendant' : 'sourd');
  localStorage.setItem('userPhone', payload.phoneNumber);
  if (user.token) {
    setAuthToken(user.token);
  }
  return payload;
}

export function clearWakwakUser() {
  localStorage.removeItem(WAKWAK_USER_KEY);
  localStorage.removeItem('user');
  localStorage.removeItem('wakwak_profile');
  localStorage.removeItem('userPhone');
  localStorage.removeItem('token');
  localStorage.removeItem('wakwak_token');
}

export function getHomeRoute(role) {
  return role === 'hearing' ? '/entendant/accueil' : '/accueil';
}
