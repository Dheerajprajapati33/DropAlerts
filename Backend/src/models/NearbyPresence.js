import mongoose from 'mongoose';

const ttlMinutes = Number(process.env.NEARBY_TTL_MINUTES || 30);

const schema = new mongoose.Schema(
  {
    fcmToken: { type: String, required: true, unique: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point', required: true },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    accuracy: { type: Number },
    radiusPreferenceMeters: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

schema.index({ location: '2dsphere' });
schema.index({ lastSyncedAt: 1 }, { expireAfterSeconds: ttlMinutes * 60 });

export default mongoose.model('NearbyPresence', schema);
