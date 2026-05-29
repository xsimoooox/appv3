const mongoose = require('mongoose');
const User = require('../models/User.cjs');
const fileStore = require('./fileUserStore.cjs');
const { connectDatabase } = require('./bootstrapDb.cjs');

let backend = null;

async function initRepository() {
  if (backend) return backend;

  try {
    await connectDatabase();
    backend = 'mongo';
    console.log('[DB] Mode MongoDB');
    return backend;
  } catch (err) {
    console.warn('[DB] MongoDB indisponible:', err.message);
    console.log('[DB] Mode fichier local : data/users.json');
    backend = 'file';
    return backend;
  }
}

function isReady() {
  if (backend === 'file') return true;
  return mongoose.connection.readyState === 1;
}

async function findByPhone(phoneNumber, select) {
  if (backend === 'mongo') {
    let q = User.findOne({ phoneNumber });
    if (select) q = q.select(select);
    return q;
  }
  const doc = fileStore.findByPhone(phoneNumber);
  if (!doc) return null;
  if (select === '-passwordHash') {
    const { passwordHash, ...safe } = doc;
    return safe;
  }
  return doc;
}

async function findById(id, select) {
  if (backend === 'mongo') {
    let q = User.findById(id);
    if (select) q = q.select(select);
    return q;
  }
  return fileStore.findById(id);
}

async function create(data) {
  if (backend === 'mongo') {
    return User.create(data);
  }
  return fileStore.create(data);
}

async function findByIdAndUpdate(id, patch) {
  if (backend === 'mongo') {
    return User.findByIdAndUpdate(id, patch, { new: true });
  }
  return fileStore.findByIdAndUpdate(id, patch);
}

function isValidObjectId(id) {
  if (backend === 'mongo') {
    return mongoose.Types.ObjectId.isValid(id);
  }
  return fileStore.isObjectIdValid(id);
}

async function findByIdPopulateContacts(id) {
  if (backend === 'mongo') {
    return User.findById(id).populate('contacts.userId', '_id');
  }
  const user = fileStore.findById(id);
  if (!user) return null;
  user.contacts = (user.contacts || []).map((c) => ({
    ...c,
    userId: c.userId ? { _id: c.userId } : null,
  }));
  return user;
}

module.exports = {
  initRepository,
  isReady,
  findByPhone,
  findById,
  create,
  findByIdAndUpdate,
  isValidObjectId,
  findByIdPopulateContacts,
  getBackend: () => backend,
};
