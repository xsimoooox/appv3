import bcrypt from 'bcryptjs';
import { verifyToken } from '../_lib/auth.js';
import { findUserById, updateUser } from '../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.split(' ')[1];
  const auth = token ? verifyToken(token) : null;
  if (!auth?.id) return res.status(401).json({ error: 'Session invalide ou expirée' });

  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir 8 caractères, une majuscule et un chiffre' });
    }

    const user = await findUserById(auth.id);
    const valid = user && await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    await updateUser(auth.id, { passwordHash: await bcrypt.hash(newPassword, 12) });
    return res.json({ success: true });
  } catch (err) {
    console.error('[CHANGE_PASSWORD]', err);
    return res.status(500).json({ error: 'Impossible de modifier le mot de passe' });
  }
}
