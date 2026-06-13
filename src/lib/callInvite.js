import { normalizePhoneNumber } from './phoneUtils';

/** Durée de validité d'une invitation d'appel (5 minutes). */
export const CALL_INVITE_TTL_MS = 5 * 60 * 1000;

export function invitePhoneKey(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return '';
  return encodeURIComponent(normalized);
}

export function invitePathForPhone(phone) {
  const key = invitePhoneKey(phone);
  return key ? `invites/${key}` : '';
}

export function isInviteValid(invite) {
  if (!invite || invite.status !== 'ringing') return false;
  const expiresAt = invite.expiresAt || 0;
  // Allow up to 10 minutes of clock skew between devices
  if (expiresAt && Date.now() > expiresAt + 10 * 60 * 1000) return false;
  const createdAt = invite.createdAt || 0;
  if (!expiresAt && Date.now() - createdAt > CALL_INVITE_TTL_MS + 10 * 60 * 1000) return false;
  return true;
}

const NOTIFIED_PREFIX = 'wakwak_notified_invite_';

export function wasInviteNotified(code) {
  try {
    return sessionStorage.getItem(`${NOTIFIED_PREFIX}${code}`) === '1';
  } catch {
    return false;
  }
}

export function markInviteNotified(code) {
  try {
    sessionStorage.setItem(`${NOTIFIED_PREFIX}${code}`, '1');
  } catch {
    /* ignore */
  }
}

export function findContactIdForIncoming(role, callerPhone, fallbackId) {
  try {
    if (role === 'hearing') {
      const raw = localStorage.getItem('wakwak_contacts');
      if (raw) {
        const list = JSON.parse(raw);
        const match = list.find(
          (c) => normalizePhoneNumber(c.phoneNumber || c.phone) === normalizePhoneNumber(callerPhone),
        );
        if (match?.id) return match.id;
      }
      return fallbackId || 'amina';
    }
    const raw = localStorage.getItem('contacts');
    if (raw) {
      const list = JSON.parse(raw);
      const match = list.find(
        (c) => normalizePhoneNumber(c.phone || c.phoneNumber) === normalizePhoneNumber(callerPhone),
      );
      if (match?.id) return match.id;
    }
    return fallbackId || 'c1';
  } catch {
    return fallbackId || (role === 'hearing' ? 'amina' : 'c1');
  }
}

export function buildCallJoinPath(role, contactId, code) {
  const prefix = role === 'hearing' ? '/entendant/call' : '/call';
  const safeContactId = contactId || 'unknown';
  return `${prefix}/${encodeURIComponent(safeContactId)}?code=${encodeURIComponent(code)}`;
}
