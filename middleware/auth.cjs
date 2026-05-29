const jwt = require('jsonwebtoken');
const userRepo = require('../lib/userRepository.cjs');

async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await userRepo.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    req.user = {
      id: String(user._id?.toString?.() || user._id),
      phoneNumber: user.phoneNumber,
      role: user.role,
      name: user.name,
    };

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token invalide ou expiré' });
  }
}

module.exports = { authenticateToken };
