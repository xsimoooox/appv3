const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepo = require('../lib/userRepository.cjs');
const { normalizePhoneNumber } = require('../lib/phoneNormalize.cjs');

const router = express.Router();

function requireDb(req, res, next) {
  if (!userRepo.isReady()) {
    return res.status(503).json({
      error: 'Base de données en cours de démarrage. Réessayez dans quelques secondes.',
      code: 'db_not_ready',
    });
  }
  next();
}

function signToken(user) {
  const id = user._id?.toString?.() || user._id || user.id;
  return jwt.sign(
    {
      id: String(id),
      phoneNumber: user.phoneNumber,
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' },
  );
}

function userPayload(user) {
  const id = user._id?.toString?.() || user._id || user.id;
  return {
    id: String(id),
    name: user.name,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isOnline: user.isOnline ?? false,
    createdAt: user.createdAt,
  };
}

router.use(requireDb);

router.get('/check-phone/:phoneNumber', async (req, res) => {
  try {
    const phone = normalizePhoneNumber(req.params.phoneNumber);
    const user = await userRepo.findByPhone(phone);
    if (!user) {
      return res.json({ exists: false, phoneNumber: phone });
    }
    return res.json({
      exists: true,
      phoneNumber: phone,
      user: {
        name: user.name,
        role: user.role,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (err) {
    console.error('[CHECK_PHONE]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/register', async (req, res) => {
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

    const existing = await userRepo.findByPhone(cleanPhoneNum);
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

    const newUser = await userRepo.create({
      name: name.trim(),
      phoneNumber: cleanPhoneNum,
      passwordHash,
      role,
      isOnline: false,
    });

    console.log('[REGISTER] Nouveau compte créé :', {
      id: newUser._id,
      name: newUser.name,
      phoneNumber: newUser.phoneNumber,
      role: newUser.role,
      backend: userRepo.getBackend(),
    });

    const token = signToken(newUser);

    res.status(201).json({
      success: true,
      token,
      user: userPayload(newUser),
    });
  } catch (err) {
    console.error('[REGISTER] Erreur:', err);
    if (err.code === 11000) {
      return res.status(409).json({
        error: 'Ce numéro est déjà utilisé',
        code: 'phone_exists',
        existingAccount: true,
      });
    }
    res.status(500).json({
      error: 'Erreur serveur',
      code: 'server_error',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res.status(400).json({ error: 'Numéro et mot de passe requis' });
    }

    const cleanPhoneNum = normalizePhoneNumber(phoneNumber);
    const user = await userRepo.findByPhone(cleanPhoneNum);

    if (!user) {
      return res.status(404).json({ error: 'Aucun compte avec ce numéro' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    await userRepo.findByIdAndUpdate(user._id, {
      isOnline: true,
      lastSeen: new Date(),
    });

    const token = signToken(user);

    res.json({
      success: true,
      token,
      user: { ...userPayload(user), isOnline: true },
    });
  } catch (err) {
    console.error('[LOGIN] Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
