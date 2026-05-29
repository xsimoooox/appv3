import { normalizePhoneNumber } from './phoneUtils';

/** Préfixe API : `/api` en prod (Vercel) et en dev (proxy Vite). */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function getAuthToken() {
  return localStorage.getItem('token') || localStorage.getItem('wakwak_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('wakwak_token', token);
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('wakwak_token');
  }
}

export function getAuthErrorMessage(res, data) {
  if (data?.error) return data.error;
  if (data?.code === 'db_not_configured') {
    return 'Base de données non configurée sur le serveur (MONGODB_URI manquant sur Vercel).';
  }
  if (res.status === 404) {
    return 'Service inscription indisponible.';
  }
  if (res.status === 503) {
    return data?.message || 'Serveur ou base de données indisponible. Réessayez dans quelques secondes.';
  }
  if (res.status === 409) {
    return 'Ce numéro est déjà enregistré.';
  }
  if (res.status >= 500) {
    return 'Erreur serveur. Réessayez ou contactez le support.';
  }
  return 'Erreur lors de la création du compte';
}

export async function apiFetch(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    return {
      res: { ok: false, status: 0 },
      data: { error: 'Impossible de joindre le serveur. Lancez : npm run server' },
    };
  }

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  return { res, data };
}

export async function checkApiHealth() {
  return apiFetch('/health');
}

export async function checkPhoneExists(phoneNumber) {
  const phone = normalizePhoneNumber(phoneNumber);
  return apiFetch(`/auth/check-phone/${encodeURIComponent(phone)}`);
}

export async function registerAccount({ name, phoneNumber, password, role }) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name,
      phoneNumber: normalizePhoneNumber(phoneNumber),
      password,
      role,
    }),
  });
}

export async function loginAccount({ phoneNumber, password }) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      phoneNumber: normalizePhoneNumber(phoneNumber),
      password,
    }),
  });
}

export async function findUserByPhone(phoneNumber) {
  const phone = normalizePhoneNumber(phoneNumber);
  return apiFetch(`/users/find/${encodeURIComponent(phone)}`);
}
