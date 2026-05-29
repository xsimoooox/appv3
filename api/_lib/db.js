import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMongo, User } from './mongo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = Boolean(process.env.VERCEL);

function useMongo() {
  return Boolean(process.env.MONGODB_URI) || isVercel;
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
  if (useMongo()) {
    await connectMongo();
  }
}

export async function findUserByPhone(phoneNumber) {
  await ensureDb();

  if (useMongo()) {
    const doc = await User.findOne({ phoneNumber });
    return toPlainUser(doc);
  }

  const users = getUsersFromFile();
  const user = users.find((u) => u.phoneNumber === phoneNumber);
  return user ? toPlainUser(user) : null;
}

export async function findUserById(id) {
  await ensureDb();

  if (useMongo()) {
    const doc = await User.findById(id);
    return toPlainUser(doc);
  }

  const users = getUsersFromFile();
  const user = users.find((u) => u.id === id);
  return user ? toPlainUser(user) : null;
}

export async function createUser(userData) {
  await ensureDb();

  if (useMongo()) {
    const doc = await User.create(userData);
    return toPlainUser(doc);
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
  await ensureDb();

  if (useMongo()) {
    const doc = await User.findByIdAndUpdate(id, updates, { new: true });
    return toPlainUser(doc);
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
    await ensureDb();
    if (useMongo()) {
      await User.findOne().limit(1).lean();
    }
    return { ok: true, backend: useMongo() ? 'mongodb' : 'file' };
  } catch (err) {
    return {
      ok: false,
      backend: useMongo() ? 'mongodb' : 'file',
      error: err.message,
      code: err.code,
    };
  }
}
