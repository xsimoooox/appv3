import bcrypt from 'bcryptjs';
import { normalizePhoneNumber } from '../_lib/phoneUtils.js';
import { signToken, userPayload } from '../_lib/auth.js';
import { findUserByPhone, createUser } from '../_lib/db.js';

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
    const { name, phoneNumber, password, role } = req.body;

    if (!name || !phoneNumber || !password || !role) {
      return res.status(400).json({
        error: 'Tous les champs sont requis : name, phoneNumber, password, role',
      });
    }

    if (!['deaf', 'hearing'].includes(role)) {
      return res.status(400).json({ error: "Rôle invalide : 'deaf' ou 'hearing'" });
    }

    const cleanPhoneNum = normalizePhoneNumber(phoneNumber);
    const existing = findUserByPhone(cleanPhoneNum);

    if (existing) {
      return res.status(409).json({
        error: 'Ce numéro de téléphone est déjà utilisé',
        code: 'phone_exists',
        existingAccount: true,
        user: {
          name: existing.name,
          role: existing.role,
          phoneNumber: existing.phoneNumber,
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = createUser({
      name: name.trim(),
      phoneNumber: cleanPhoneNum,
      passwordHash,
      role,
      isOnline: false,
    });

    console.log('[REGISTER] Nouveau compte créé :', {
      id: newUser.id,
      name: newUser.name,
      phoneNumber: newUser.phoneNumber,
      role: newUser.role,
    });

    const token = signToken(newUser);

    return res.status(201).json({
      success: true,
      token,
      user: userPayload(newUser),
    });
  } catch (err) {
    console.error('[REGISTER] Erreur:', err);
    return res.status(500).json({
      error: 'Erreur serveur',
      code: 'server_error',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}
