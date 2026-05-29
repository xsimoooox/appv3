import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['deaf', 'hearing'], required: true },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    currentSocketId: { type: String, default: null },
    contacts: { type: Array, default: [] },
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

const globalForMongoose = globalThis;

if (!globalForMongoose._wakwakMongo) {
  globalForMongoose._wakwakMongo = { conn: null, promise: null };
}

const cached = globalForMongoose._wakwakMongo;

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const msg = process.env.VERCEL
      ? 'MONGODB_URI manquant sur Vercel. Ajoutez une base MongoDB Atlas dans les variables d\'environnement.'
      : 'MONGODB_URI non configuré. Créez un cluster gratuit sur MongoDB Atlas.';
    const err = new Error(msg);
    err.code = 'NO_DATABASE';
    throw err;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export { User };
