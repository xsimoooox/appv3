/* global process */

import webpush from 'web-push';
import {
  getPushSubscription,
  removePushSubscription,
} from '../_lib/pushSubscriptions.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { targetPhone, callerPhone, callerName, code, acceptUrl } = req.body || {};
  if (!targetPhone || !code) return res.status(400).json({ error: 'Cible ou code manquant' });
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: 'VAPID non configuré' });
  }

  try {
    const subscription = await getPushSubscription(targetPhone);
    if (!subscription) return res.status(404).json({ error: 'Téléphone non abonné aux notifications' });

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:contact@voxmanus.app',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    await webpush.sendNotification(subscription, JSON.stringify({
      type: 'incoming_call',
      code,
      callerPhone,
      callerName,
      targetPhone,
      acceptUrl,
      url: acceptUrl,
    }));
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await removePushSubscription(targetPhone).catch(() => {});
    }
    return res.status(503).json({ error: error.message });
  }
}
