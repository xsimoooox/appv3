const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'users.json');

function readDb() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { users: [] };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { users: [] };
  }
}

function writeDb(db) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function toDoc(raw) {
  if (!raw) return null;
  return {
    _id: raw._id,
    id: raw._id,
    name: raw.name,
    phoneNumber: raw.phoneNumber,
    passwordHash: raw.passwordHash,
    role: raw.role,
    isOnline: raw.isOnline ?? false,
    lastSeen: raw.lastSeen ? new Date(raw.lastSeen) : new Date(),
    contacts: raw.contacts || [],
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
    save: async function save() {
      const db = readDb();
      const idx = db.users.findIndex((u) => u._id === this._id);
      const payload = {
        _id: this._id,
        name: this.name,
        phoneNumber: this.phoneNumber,
        passwordHash: this.passwordHash,
        role: this.role,
        isOnline: this.isOnline,
        lastSeen: this.lastSeen,
        contacts: this.contacts,
        createdAt: this.createdAt,
        updatedAt: new Date().toISOString(),
        currentSocketId: this.currentSocketId ?? null,
      };
      if (idx >= 0) {
        db.users[idx] = payload;
      } else {
        db.users.push(payload);
      }
      writeDb(db);
      return this;
    },
  };
}

function findByPhone(phoneNumber) {
  const db = readDb();
  const raw = db.users.find((u) => u.phoneNumber === phoneNumber);
  return toDoc(raw);
}

function findById(id) {
  const db = readDb();
  const raw = db.users.find((u) => u._id === id);
  return toDoc(raw);
}

function create(data) {
  const db = readDb();
  if (db.users.some((u) => u.phoneNumber === data.phoneNumber)) {
    const err = new Error('duplicate');
    err.code = 11000;
    throw err;
  }
  const now = new Date().toISOString();
  const raw = {
    _id: crypto.randomUUID(),
    name: data.name,
    phoneNumber: data.phoneNumber,
    passwordHash: data.passwordHash,
    role: data.role,
    isOnline: data.isOnline ?? false,
    contacts: [],
    createdAt: now,
    updatedAt: now,
    currentSocketId: null,
  };
  db.users.push(raw);
  writeDb(db);
  return toDoc(raw);
}

function findByIdAndUpdate(id, patch) {
  const db = readDb();
  const idx = db.users.findIndex((u) => u._id === id);
  if (idx < 0) return null;
  db.users[idx] = {
    ...db.users[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeDb(db);
  return toDoc(db.users[idx]);
}

function selectFields(doc, fields) {
  if (!doc) return null;
  if (!fields || fields === '-passwordHash') {
    const { passwordHash, ...rest } = doc;
    return rest;
  }
  return doc;
}

module.exports = {
  findByPhone,
  findById,
  create,
  findByIdAndUpdate,
  isObjectIdValid: (id) => typeof id === 'string' && id.length >= 8,
};
