import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../data');
const usersFile = path.join(dataDir, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function ensureUsersFile() {
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
  }
}

export function getUsers() {
  ensureUsersFile();
  try {
    const data = fs.readFileSync(usersFile, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[DB] Error reading users file:', err);
    return [];
  }
}

export function saveUsers(users) {
  ensureUsersFile();
  try {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('[DB] Error writing users file:', err);
  }
}

export function findUserByPhone(phoneNumber) {
  const users = getUsers();
  return users.find((u) => u.phoneNumber === phoneNumber) || null;
}

export function findUserById(id) {
  const users = getUsers();
  return users.find((u) => u.id === id) || null;
}

export function createUser(userData) {
  const users = getUsers();
  const newUser = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    ...userData,
  };
  users.push(newUser);
  saveUsers(users);
  return newUser;
}

export function updateUser(id, updates) {
  const users = getUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;
  const updated = { ...users[index], ...updates };
  users[index] = updated;
  saveUsers(users);
  return updated;
}
