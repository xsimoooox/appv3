import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production';

export function signToken(user) {
  const id = user.id;
  return jwt.sign(
    {
      id: String(id),
      phoneNumber: user.phoneNumber,
      role: user.role,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function userPayload(user) {
  return {
    id: String(user.id),
    name: user.name,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isOnline: user.isOnline ?? false,
    createdAt: user.createdAt,
  };
}
