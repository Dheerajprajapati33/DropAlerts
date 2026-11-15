import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['phone', 'wearable', 'sensor', 'beacon'], default: 'phone' },
    model: { type: String, trim: true },
    platform: { type: String, enum: ['android'], default: 'android' },
    fcmToken: { type: String, select: false },
    isOnline: { type: Boolean, default: true },
    batteryLevel: { type: Number, min: 0, max: 100, default: 100 },
    lastActive: { type: String, default: 'Just now' },
    pairedAt: { type: Date, default: Date.now },
    settings: {
      sensitivity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
      notifications: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
      vibration: { type: Boolean, default: true },
    },
    lastSeenAt: Date,
  },
  { timestamps: true }
);

schema.index({ owner: 1, deviceId: 1 }, { unique: true });

export default mongoose.model('Device', schema);
