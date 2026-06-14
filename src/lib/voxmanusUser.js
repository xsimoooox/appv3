import { normalizePhoneNumber } from './phoneUtils';
import { setAuthToken } from './api';

export const VOXMANUS_USER_KEY = 'voxmanus_user';
export const VOXMANUS_USER_CHANGED_EVENT = 'voxmanus-user-changed';

function notifyUserChanged(user) {
  window.dispatchEvent(new CustomEvent(VOXMANUS_USER_CHANGED_EVENT, { detail: user }));
}

export function isValidVoxManusUser(user) {
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

export function getVoxManusUser() {
  try {
    const raw = localStorage.getItem(VOXMANUS_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!isValidVoxManusUser(user)) return null;
    return {
      ...user,
      id: String(user.id),
      phoneNumber: normalizePhoneNumber(user.phoneNumber),
    };
  } catch {
    return null;
  }
}

export function saveVoxManusUser(user) {
  const payload = {
    id: String(user.id),
    name: user.name.trim(),
    phoneNumber: normalizePhoneNumber(user.phoneNumber),
    role: user.role,
    createdAt: user.createdAt || new Date().toISOString(),
    avatar: user.avatar ?? null,
    isOnline: user.isOnline ?? false,
  };
  localStorage.setItem(VOXMANUS_USER_KEY, JSON.stringify(payload));
  localStorage.setItem('user', JSON.stringify(payload));
  localStorage.setItem('voxmanus_profile', payload.role === 'hearing' ? 'entendant' : 'sourd');
  localStorage.setItem('userPhone', payload.phoneNumber);
  if (user.token) {
    setAuthToken(user.token);
  }
  notifyUserChanged(payload);
  return payload;
}

export function clearVoxManusUser() {
  localStorage.removeItem(VOXMANUS_USER_KEY);
  localStorage.removeItem('user');
  localStorage.removeItem('voxmanus_profile');
  localStorage.removeItem('userPhone');
  localStorage.removeItem('token');
  localStorage.removeItem('voxmanus_token');
  notifyUserChanged(null);
}

export function getHomeRoute(role) {
  return role === 'hearing' ? '/entendant/accueil' : '/accueil';
}
