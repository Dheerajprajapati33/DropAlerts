import mongoose from 'mongoose';

const emergencyContactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  relation: { type: String, trim: true, default: 'Emergency' },
  isPrimary: { type: Boolean, default: false },
});

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    avatar: String,
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    fcmToken: { type: String, select: false },
    resetOtpHash: { type: String, select: false },
    resetOtpExpiresAt: { type: Date, select: false },
    emergencyContacts: { type: [emergencyContactSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('User', schema);
