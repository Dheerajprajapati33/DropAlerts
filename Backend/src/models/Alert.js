import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    sourceDevice: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fallEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'FallEvent', index: true },
    eventId: { type: String },
    detectedAt: { type: Date },
    impactG: { type: Number, min: 0, max: 100 },
    title: { type: String, trim: true, default: 'Fall Detected' },
    message: { type: String, trim: true },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'High' },
    type: {
      type: String,
      enum: ['fall', 'received', 'sent', 'system', 'emergency'],
      default: 'fall',
    },
    status: {
      type: String,
      enum: [
        'detected',
        'pending',
        'sent',
        'delivered',
        'acknowledged',
        'resolved',
        'dismissed',
        'cancelled',
      ],
      default: 'sent',
    },
    timestamp: { type: Date, default: Date.now },
    device: { type: String, trim: true },
    location: { type: String, trim: true },
    isHighlighted: { type: Boolean, default: true },
    contactsNotified: { type: [String], default: [] },
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }],
    delivery: [
      {
        device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
        status: { type: String, enum: ['sent', 'failed', 'skipped'] },
        at: Date,
      },
    ],
  },
  { timestamps: true }
);

schema.index(
  { sourceDevice: 1, eventId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceDevice: { $exists: true },
      eventId: { $exists: true },
    },
  }
);

export default mongoose.model('Alert', schema);
