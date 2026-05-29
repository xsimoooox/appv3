const mongoose = require('mongoose');

const contactSubSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String },
    phoneNumber: { type: String },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['deaf', 'hearing'],
      required: true,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    currentSocketId: {
      type: String,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    contacts: [contactSubSchema],
    profilePicture: {
      type: String,
      default: null,
    },
    avatarPreference: {
      type: String,
      enum: ['frizitta', 'alex', null],
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ phoneNumber: 1 });
userSchema.index({ isOnline: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
