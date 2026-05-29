const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL || 'https://sign-langage-default-rtdb.firebaseio.com';

const USERS_ROOT = 'wakwak_auth/users';
const PHONE_INDEX = 'wakwak_auth/phone_index';

function phoneKey(phoneNumber) {
  return encodeURIComponent(phoneNumber);
}

function pathUrl(path) {
  return `${DATABASE_URL}/${path}.json`;
}

async function firebaseRequest(path, { method = 'GET', body } = {}) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(pathUrl(path), options);
  if (!res.ok) {
    const err = new Error(`Firebase error ${res.status}`);
    err.code = 'FIREBASE_ERROR';
    throw err;
  }

  if (method === 'DELETE') return null;

  const text = await res.text();
  if (!text || text === 'null') return null;
  return JSON.parse(text);
}

function toPlainUser(raw) {
  if (!raw) return null;
  return {
    id: String(raw.id),
    name: raw.name,
    phoneNumber: raw.phoneNumber,
    passwordHash: raw.passwordHash,
    role: raw.role,
    isOnline: raw.isOnline ?? false,
    createdAt: raw.createdAt,
    lastSeen: raw.lastSeen,
  };
}

export async function findUserByPhone(phoneNumber) {
  const id = await firebaseRequest(`${PHONE_INDEX}/${phoneKey(phoneNumber)}`);
  if (!id) return null;
  const user = await firebaseRequest(`${USERS_ROOT}/${id}`);
  return toPlainUser(user);
}

export async function findUserById(id) {
  const user = await firebaseRequest(`${USERS_ROOT}/${id}`);
  return toPlainUser(user);
}

export async function createUser(userData) {
  const existing = await findUserByPhone(userData.phoneNumber);
  if (existing) {
    const err = new Error('duplicate');
    err.code = 11000;
    throw err;
  }

  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const newUser = {
    id,
    createdAt: new Date().toISOString(),
    isOnline: false,
    ...userData,
  };

  await firebaseRequest(`${USERS_ROOT}/${id}`, { method: 'PUT', body: newUser });
  await firebaseRequest(`${PHONE_INDEX}/${phoneKey(userData.phoneNumber)}`, {
    method: 'PUT',
    body: id,
  });

  return toPlainUser(newUser);
}

export async function updateUser(id, updates) {
  const existing = await firebaseRequest(`${USERS_ROOT}/${id}`);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  await firebaseRequest(`${USERS_ROOT}/${id}`, { method: 'PUT', body: updated });
  return toPlainUser(updated);
}

export async function checkFirebaseHealth() {
  await firebaseRequest(`${USERS_ROOT}`);
  return { ok: true, backend: 'firebase' };
}
