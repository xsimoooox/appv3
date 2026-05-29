import bcrypt from 'bcryptjs';
import { normalizePhoneNumber } from '../_lib/phoneUtils.js';
import { signToken, userPayload } from '../_lib/auth.js';
import { findUserByPhone, updateUser } from '../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res.status(400).json({ error: 'Numéro et mot de passe requis' });
    }

    const cleanPhoneNum = normalizePhoneNumber(phoneNumber);
    const user = await findUserByPhone(cleanPhoneNum);

    if (!user) {
      return res.status(404).json({ error: 'Aucun compte avec ce numéro' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    const updated = await updateUser(user.id, {
      isOnline: true,
      lastSeen: new Date().toISOString(),
    });

    const token = signToken(updated);

    return res.json({
      success: true,
      token,
      user: { ...userPayload(updated), isOnline: true },
    });
  } catch (err) {
    console.error('[LOGIN] Erreur:', err);

    if (err.code === 'NO_DATABASE' || err.code === 'FIREBASE_ERROR') {
      return res.status(503).json({
        error: err.message || 'Base de données indisponible.',
        code: err.code || 'db_error',
      });
    }

    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
