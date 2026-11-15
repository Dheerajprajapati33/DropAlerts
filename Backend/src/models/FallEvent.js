import mongoose from 'mongoose';

const sensorDataSchema = new mongoose.Schema(
  {
    accelerometer: {
      x: Number,
      y: Number,
      z: Number,
      magnitude: Number,
    },
    gyroscope: {
      x: Number,
      y: Number,
      z: Number,
      magnitude: Number,
    },
    freeFallDurationMs: Number,
    peakImpactG: Number,
    peakRotationRad: Number,
    postImpactStillnessMs: Number,
    stagesCompleted: [String],
    timestamp: Number,
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: String, trim: true, default: 'DEV-SELF' },
    deviceName: { type: String, trim: true, default: 'Current Device' },
    timestamp: { type: Date, default: Date.now },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'High' },
    confidence: { type: Number, min: 0, max: 1, default: 0.95 },
    impactForce: { type: Number, min: 0, max: 100 },
    location: { type: String, trim: true },
    status: {
      type: String,
      enum: ['detected', 'acknowledged', 'cancelled', 'resolved'],
      default: 'detected',
    },
    sensorData: sensorDataSchema,
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('FallEvent', schema);
