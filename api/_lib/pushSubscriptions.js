/* global process */

const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL || 'https://sign-langage-default-rtdb.firebaseio.com';
const DATABASE_AUTH_TOKEN = process.env.FIREBASE_DATABASE_AUTH_TOKEN || '';

function pathUrl(phoneNumber) {
  const key = encodeURIComponent(phoneNumber);
  const url = new URL(`${DATABASE_URL}/wakwak_push/${key}.json`);
  if (DATABASE_AUTH_TOKEN) url.searchParams.set('auth', DATABASE_AUTH_TOKEN);
  return url.toString();
}

async function request(phoneNumber, options = {}) {
  const response = await fetch(pathUrl(phoneNumber), {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(`Firebase push storage error ${response.status}`);
  const text = await response.text();
  return text && text !== 'null' ? JSON.parse(text) : null;
}

export function savePushSubscription(phoneNumber, subscription) {
  return request(phoneNumber, { method: 'PUT', body: JSON.stringify(subscription) });
}

export function getPushSubscription(phoneNumber) {
  return request(phoneNumber);
}

export function removePushSubscription(phoneNumber) {
  return request(phoneNumber, { method: 'DELETE' });
}
