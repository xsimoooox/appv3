import { normalizePhoneNumber } from '../../_lib/phoneUtils.js';
import { findUserByPhone } from '../../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone } = req.query;
    const normalizedPhone = normalizePhoneNumber(phone);
    const user = await findUserByPhone(normalizedPhone);

    if (!user) {
      return res.json({ exists: false, phoneNumber: normalizedPhone });
    }

    return res.json({
      exists: true,
      phoneNumber: normalizedPhone,
      user: {
        name: user.name,
        role: user.role,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (err) {
    console.error('[CHECK_PHONE]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
