const mongoose = require('mongoose');

let memoryServer = null;

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  let uri = process.env.MONGODB_URI;

  if (!uri && process.env.USE_MEMORY_MONGO === '1') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({
      instance: { launchTimeout: 60000 },
    });
    uri = memoryServer.getUri('wakwak');
    console.log('[DB] MongoDB mémoire (développement)');
  }

  if (!uri) {
    throw new Error('MONGODB_URI absente, utilisation du stockage local');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
  console.log('[DB] MongoDB connecté');
  return mongoose.connection;
}

function ensureJwtSecret() {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'wakwak-dev-jwt-secret-local-only';
    console.warn('[AUTH] JWT_SECRET absent — secret de développement utilisé');
  }
}

module.exports = { connectDatabase, ensureJwtSecret };
