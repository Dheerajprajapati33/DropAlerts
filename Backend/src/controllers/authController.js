import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import Device from '../models/Device.js';
import Pairing from '../models/Pairing.js';
import Alert from '../models/Alert.js';
import FallEvent from '../models/FallEvent.js';
import Notification from '../models/Notification.js';
import NearbyPresence from '../models/NearbyPresence.js';
import { HttpError, asyncHandler, requireFields } from '../utils/http.js';
import { signToken } from '../middleware/auth.js';

const safe = (u) => ({
  id: String(u._id || u.id),
  name: u.name,
  email: u.email,
  phone: u.phone || undefined,
  avatar: u.avatar || undefined,
  role: u.role || 'user',
  emergencyContacts: (u.emergencyContacts || []).map((c) => ({
    id: String(c._id || c.id),
    name: c.name,
    phone: c.phone,
    relation: c.relation || 'Emergency',
    isPrimary: Boolean(c.isPrimary),
  })),
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

export const register = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'email', 'password']);
  const { name, email, password } = req.body;
  const phone = typeof req.body.phone === 'string' && req.body.phone.trim() ? req.body.phone.trim() : undefined;

  if (password.length < 6 || password.length > 128) {
    throw new HttpError(400, 'Password must be 6-128 characters');
  }
  if (await User.exists({ email: email.toLowerCase().trim() })) {
    throw new HttpError(409, 'Email already registered');
  }
  if (phone && (await User.exists({ phone }))) {
    throw new HttpError(409, 'Phone number already registered');
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    ...(phone ? { phone } : {}),
    passwordHash: await bcrypt.hash(password, 12),
  });

  res.status(201).json({
    success: true,
    data: {
      user: safe(user),
      token: signToken(user),
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const identifier = String(req.body?.identifier ?? req.body?.email ?? '').trim();
  const password = req.body?.password;

  if (!identifier) throw new HttpError(400, 'identifier is required');
  if (typeof password !== 'string' || !password) throw new HttpError(400, 'password is required');

  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
  }).select('+passwordHash');

  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid credentials');
  }

  res.json({
    success: true,
    data: {
      user: safe(user),
      token: signToken(user),
    },
  });
});

export const googleLogin = asyncHandler(async (req, res) => {
  requireFields(req.body, ['idToken']);
  if (!process.env.GOOGLE_CLIENT_ID) throw new HttpError(503, 'Google login not configured');

  const ticket = await new OAuth2Client(process.env.GOOGLE_CLIENT_ID).verifyIdToken({
    idToken: req.body.idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload.email_verified) throw new HttpError(401, 'Unverified Google email');

  let user = await User.findOne({ email: payload.email.toLowerCase() });
  if (user && user.googleId && user.googleId !== payload.sub) {
    throw new HttpError(409, 'Google account conflict');
  }
  if (!user) {
    user = await User.create({
      name: payload.name || 'User',
      email: payload.email,
      googleId: payload.sub,
      avatar: payload.picture,
    });
  } else if (!user.googleId) {
    user.googleId = payload.sub;
    await user.save();
  }

  res.json({
    success: true,
    data: {
      user: safe(user),
      token: signToken(user),
    },
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(404, 'User not found');

  res.json({
    success: true,
    data: safe(user),
  });
});

export const updateMe = asyncHandler(async (req, res) => {
  const updates = {};

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name || name.length > 80) throw new HttpError(400, 'Invalid name');
    updates.name = name;
  }

  if (req.body.email !== undefined) {
    const email = String(req.body.email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Invalid email');
    const existing = await User.findOne({ email, _id: { $ne: req.userId } });
    if (existing) throw new HttpError(409, 'Email already registered');
    updates.email = email;
  }

  if (req.body.phone !== undefined) {
    const phone = String(req.body.phone).trim();
    if (phone) {
      const existing = await User.findOne({ phone, _id: { $ne: req.userId } });
      if (existing) throw new HttpError(409, 'Phone number already registered');
      updates.phone = phone;
    } else {
      updates.phone = undefined;
    }
  }

  if (req.body.avatar !== undefined) {
    updates.avatar = typeof req.body.avatar === 'string' ? req.body.avatar.trim() : undefined;
  }

  if (req.body.emergencyContacts !== undefined) {
    if (!Array.isArray(req.body.emergencyContacts)) {
      throw new HttpError(400, 'emergencyContacts must be an array');
    }
    updates.emergencyContacts = req.body.emergencyContacts.map((c) => {
      const contactName = String(c?.name || '').trim();
      const contactPhone = String(c?.phone || '').trim();
      if (!contactName || !contactPhone) {
        throw new HttpError(400, 'Each emergency contact must include name and phone');
      }
      return {
        name: contactName,
        phone: contactPhone,
        relation: String(c?.relation || 'Emergency').trim(),
        isPrimary: Boolean(c?.isPrimary),
      };
    });
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpError(400, 'No valid fields provided to update');
  }

  const user = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true });
  if (!user) throw new HttpError(404, 'User not found');

  res.json({
    success: true,
    data: safe(user),
  });
});

export const logout = asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const identifier = String(req.body?.identifier ?? req.body?.email ?? '').trim();
  if (!identifier) throw new HttpError(400, 'Email or phone is required');

  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
  });

  if (!user) {
    // Generic success response to prevent user enumeration
    return res.json({
      success: true,
      message: 'If an account matches, a 6-digit reset OTP has been generated.',
    });
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  user.resetOtpHash = crypto.createHash('sha256').update(otp).digest('hex');
  user.resetOtpExpiresAt = new Date(Date.now() + 15 * 60000);
  await user.save();

  res.json({
    success: true,
    message: 'Password reset OTP generated (valid for 15 minutes).',
    ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const identifier = String(req.body?.identifier ?? req.body?.email ?? '').trim();
  const otp = String(req.body?.otp ?? '').trim();
  const newPassword = req.body?.newPassword;

  if (!identifier || !otp || typeof newPassword !== 'string') {
    throw new HttpError(400, 'identifier, otp, and newPassword are required');
  }
  if (newPassword.length < 6 || newPassword.length > 128) {
    throw new HttpError(400, 'Password must be 6-128 characters');
  }

  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
  }).select('+resetOtpHash +resetOtpExpiresAt');

  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  if (
    !user ||
    !user.resetOtpHash ||
    !user.resetOtpExpiresAt ||
    user.resetOtpExpiresAt <= new Date() ||
    user.resetOtpHash !== otpHash
  ) {
    throw new HttpError(400, 'Invalid or expired reset OTP');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.resetOtpHash = undefined;
  user.resetOtpExpiresAt = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Password reset successful. Please log in with your new password.',
  });
});

export const deleteMe = asyncHandler(async (req, res) => {
  const userDevices = await Device.find({ owner: req.userId }).select('_id');
  const deviceIds = userDevices.map((d) => d._id);

  await Promise.all([
    deviceIds.length
      ? Pairing.deleteMany({ $or: [{ deviceA: { $in: deviceIds } }, { deviceB: { $in: deviceIds } }] })
      : Promise.resolve(),
    Device.deleteMany({ owner: req.userId }),
    Notification.deleteMany({ user: req.userId }),
    FallEvent.deleteMany({ userId: req.userId }),
    Alert.deleteMany({ owner: req.userId }),
    NearbyPresence.deleteMany({ userId: req.userId }),
    User.findByIdAndDelete(req.userId),
  ]);

  res.json({ success: true, message: 'Account deleted permanently' });
});
