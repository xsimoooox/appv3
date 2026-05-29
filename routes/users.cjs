const express = require('express');
const userRepo = require('../lib/userRepository.cjs');
const { authenticateToken } = require('../middleware/auth.cjs');
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

router.use(requireDb);

router.get('/find/:phoneNumber', authenticateToken, async (req, res) => {
  try {
    const cleanPhoneNum = normalizePhoneNumber(req.params.phoneNumber);

    const user = await userRepo.findByPhone(cleanPhoneNum);

    if (!user) {
      return res.status(404).json({ error: 'Aucun utilisateur avec ce numéro' });
    }

    const id = user._id?.toString?.() || user._id;

    res.json({
      found: true,
      user: {
        id: String(id),
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
      },
    });
  } catch (err) {
    console.error('[FIND_USER]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/contacts', authenticateToken, async (req, res) => {
  try {
    const { phoneNumber, name } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Numéro requis' });
    }

    const cleanPhoneNum = normalizePhoneNumber(phoneNumber);

    const targetUser = await userRepo.findByPhone(cleanPhoneNum);
    if (!targetUser) {
      return res.status(404).json({
        error: "Aucun utilisateur avec ce numéro. Ils doivent d'abord créer un compte.",
      });
    }

    const targetId = String(targetUser._id?.toString?.() || targetUser._id);

    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous ajouter vous-même' });
    }

    const currentUser = await userRepo.findById(req.user.id);
    const alreadyExists = (currentUser?.contacts || []).some(
      (c) => c.userId && String(c.userId) === targetId,
    );
    if (alreadyExists) {
      return res.status(409).json({ error: 'Contact déjà dans votre liste' });
    }

    const contacts = [...(currentUser.contacts || []), {
      userId: targetId,
      name: name || targetUser.name,
      phoneNumber: cleanPhoneNum,
      addedAt: new Date(),
    }];

    await userRepo.findByIdAndUpdate(req.user.id, { contacts });

    res.status(201).json({
      success: true,
      contact: {
        id: targetId,
        name: name || targetUser.name,
        phoneNumber: cleanPhoneNum,
        role: targetUser.role,
        isOnline: targetUser.isOnline,
      },
    });
  } catch (err) {
    console.error('[ADD_CONTACT]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/contacts', authenticateToken, async (req, res) => {
  try {
    const user = await userRepo.findById(req.user.id);

    const contacts = (user?.contacts || []).map((c) => ({
      id: c.userId ? String(c.userId) : null,
      name: c.name,
      phoneNumber: c.phoneNumber,
      addedAt: c.addedAt,
    }));

    res.json({ contacts });
  } catch (err) {
    console.error('[LIST_CONTACTS]', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
