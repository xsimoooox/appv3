import { savePushSubscription } from './_lib/pushSubscriptions.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { phoneNumber, subscription } = req.body || {};
  if (!phoneNumber || !subscription) return res.status(400).json({ error: 'Données manquantes' });

  try {
    await savePushSubscription(phoneNumber, subscription);
    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(503).json({ error: error.message });
  }
}
