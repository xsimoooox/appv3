import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMongo, User } from './mongo.js';
import * as firebaseDb from './firebaseDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = Boolean(process.env.VERCEL);

function getBackend() {
  if (process.env.MONGODB_URI) return 'mongodb';
  if (
    process.env.USE_FIREBASE_DB === '1'
    || process.env.FIREBASE_DATABASE_URL
    || process.env.FIREBASE_DATABASE_AUTH_TOKEN
  ) {
    return 'firebase';
  }
  if (isVercel) return 'unconfigured';
  return 'file';
}

function toPlainUser(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  const id = obj._id?.toString?.() || obj._id || obj.id;
  return {
    id: String(id),
    name: obj.name,
    phoneNumber: obj.phoneNumber,
    passwordHash: obj.passwordHash,
    role: obj.role,
    isOnline: obj.isOnline ?? false,
    createdAt: obj.createdAt,
    lastSeen: obj.lastSeen,
  };
}

// --- Fichier local (dev sans MongoDB) ---
const dataDir = path.join(__dirname, '../../data');
const usersFile = path.join(dataDir, 'users.json');

function ensureUsersFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
  }
}

function getUsersFromFile() {
  ensureUsersFile();
  try {
    return JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  } catch {
    return [];
  }
}

function saveUsersToFile(users) {
  ensureUsersFile();
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

async function ensureDb() {
  const backend = getBackend();
  if (backend === 'mongodb') {
    await connectMongo();
  } else if (backend === 'firebase') {
    await firebaseDb.checkFirebaseHealth();
  } else if (backend === 'unconfigured') {
    const err = new Error(
      'Base de données Vercel non configurée. Ajoutez MONGODB_URI dans Settings > Environment Variables.',
    );
    err.code = 'NO_DATABASE';
    throw err;
  }
}

export async function findUserByPhone(phoneNumber) {
  const backend = getBackend();
  await ensureDb();

  if (backend === 'mongodb') {
    const doc = await User.findOne({ phoneNumber });
    return toPlainUser(doc);
  }

  if (backend === 'firebase') {
    return firebaseDb.findUserByPhone(phoneNumber);
  }

  const users = getUsersFromFile();
  const user = users.find((u) => u.phoneNumber === phoneNumber);
  return user ? toPlainUser(user) : null;
}

export async function findUserById(id) {
  const backend = getBackend();
  await ensureDb();

  if (backend === 'mongodb') {
    const doc = await User.findById(id);
    return toPlainUser(doc);
  }

  if (backend === 'firebase') {
    return firebaseDb.findUserById(id);
  }

  const users = getUsersFromFile();
  const user = users.find((u) => u.id === id);
  return user ? toPlainUser(user) : null;
}

export async function createUser(userData) {
  const backend = getBackend();
  await ensureDb();

  if (backend === 'mongodb') {
    const doc = await User.create(userData);
    return toPlainUser(doc);
  }

  if (backend === 'firebase') {
    return firebaseDb.createUser(userData);
  }

  const users = getUsersFromFile();
  const newUser = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    ...userData,
  };
  users.push(newUser);
  saveUsersToFile(users);
  return toPlainUser(newUser);
}

export async function updateUser(id, updates) {
  const backend = getBackend();
  await ensureDb();

  if (backend === 'mongodb') {
    const doc = await User.findByIdAndUpdate(id, updates, { new: true });
    return toPlainUser(doc);
  }

  if (backend === 'firebase') {
    return firebaseDb.updateUser(id, updates);
  }

  const users = getUsersFromFile();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;
  users[index] = { ...users[index], ...updates };
  saveUsersToFile(users);
  return toPlainUser(users[index]);
}

export async function checkDbHealth() {
  try {
    const backend = getBackend();
    if (backend === 'mongodb') {
      await ensureDb();
      await User.findOne().limit(1).lean();
    } else if (backend === 'firebase') {
      return firebaseDb.checkFirebaseHealth();
    } else if (backend === 'unconfigured') {
      await ensureDb();
    }
    return { ok: true, backend };
  } catch (err) {
    return {
      ok: false,
      backend: getBackend(),
      error: err.message,
      code: err.code,
    };
  }
}
