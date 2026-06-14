/* global process */

const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL || 'https://sign-langage-default-rtdb.firebaseio.com';
const DATABASE_AUTH_TOKEN = process.env.FIREBASE_DATABASE_AUTH_TOKEN || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { code, targetPhone } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code manquant' });

  const updates = {
    [`calls/${code}/status`]: 'ended',
    [`calls/${code}/endedAt`]: Date.now(),
    [`sessions/${code}/status`]: 'ended',
  };
  if (targetPhone) {
    updates[`invites/${String(targetPhone).trim()}/${code}/status`] = 'ended';
  }

  const url = new URL(`${DATABASE_URL}/.json`);
  if (DATABASE_AUTH_TOKEN) url.searchParams.set('auth', DATABASE_AUTH_TOKEN);
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return response.ok
    ? res.status(200).json({ ok: true })
    : res.status(503).json({ error: 'Firebase indisponible' });
}
