import crypto from 'node:crypto';
import Device from '../models/Device.js';
import Pairing from '../models/Pairing.js';
import PairCode from '../models/PairCode.js';
import User from '../models/User.js';
import { asyncHandler, HttpError, requireFields } from '../utils/http.js';
import { ownDevice } from '../services/deviceAccess.js';

const safeDevice = (d, extra = {}) => ({
  id: String(d._id || d.id),
  userId: String(d.owner),
  name: d.name,
  type: d.type || 'phone',
  model: d.model || undefined,
  deviceId: d.deviceId,
  isOnline: d.isOnline ?? true,
  batteryLevel: d.batteryLevel ?? 100,
  lastActive: d.lastActive || 'Just now',
  pairedAt: d.pairedAt || d.createdAt,
  settings: d.settings || {
    sensitivity: 'medium',
    notifications: true,
    sound: true,
    vibration: true,
  },
  ...extra,
});

async function ensureCallerDevice(userId, preferredDeviceId, fallbackName) {
  if (preferredDeviceId) {
    const byId = await Device.findOne({ owner: userId, deviceId: String(preferredDeviceId) });
    if (byId) return byId;
  }

  const existing = await Device.findOne({ owner: userId }).sort({ createdAt: 1 });
  if (existing) return existing;

  const user = await User.findById(userId).select('name');
  const resolvedName = fallbackName || `${user?.name || 'My'}'s Phone`;
  const generatedId = preferredDeviceId || `DEV-${crypto.randomInt(1000, 9999)}-${Date.now().toString().slice(-4)}`;

  return Device.create({
    owner: userId,
    deviceId: generatedId,
    name: resolvedName,
    type: 'phone',
    platform: 'android',
    isOnline: true,
    batteryLevel: 100,
    lastActive: 'Just now',
    lastSeenAt: new Date(),
  });
}

async function resolveAccessibleDevice(id, userId) {
  const own = await Device.findOne({ _id: id, owner: userId });
  if (own) return { device: own, isOwn: true, pairing: null };

  const ownDevices = await Device.find({ owner: userId }).select('_id');
  const ownIds = ownDevices.map((d) => d._id);
  if (!ownIds.length) throw new HttpError(404, 'Device not found');

  const pairing = await Pairing.findOne({
    active: true,
    $or: [
      { deviceA: { $in: ownIds }, deviceB: id },
      { deviceB: { $in: ownIds }, deviceA: id },
    ],
  });

  if (!pairing) throw new HttpError(404, 'Device not found');
  const remote = await Device.findById(id);
  if (!remote) throw new HttpError(404, 'Device not found');

  return { device: remote, isOwn: false, pairing };
}

export const registerDevice = asyncHandler(async (req, res) => {
  requireFields(req.body, ['deviceId', 'name']);
  if (req.body.platform && req.body.platform !== 'android') {
    throw new HttpError(400, 'Android only');
  }
  const { deviceId, name, fcmToken, type, model, batteryLevel } = req.body;
  if (deviceId.length > 200 || name.length > 80) {
    throw new HttpError(400, 'Invalid device fields');
  }

  const d = await Device.findOneAndUpdate(
    { owner: req.userId, deviceId },
    {
      $set: {
        name: name.trim(),
        platform: 'android',
        isOnline: true,
        lastActive: 'Just now',
        lastSeenAt: new Date(),
        ...(type && ['phone', 'wearable', 'sensor', 'beacon'].includes(type) ? { type } : {}),
        ...(model ? { model: String(model).trim() } : {}),
        ...(typeof batteryLevel === 'number' ? { batteryLevel } : {}),
        ...(typeof fcmToken === 'string' && fcmToken.trim() ? { fcmToken: fcmToken.trim() } : {}),
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  res.json({ success: true, data: safeDevice(d) });
});

export const getSelfDevice = asyncHandler(async (req, res) => {
  const headerDeviceId = req.headers['x-device-id'] ? String(req.headers['x-device-id']) : null;
  const device = await ensureCallerDevice(req.userId, headerDeviceId);
  res.json({ success: true, data: safeDevice(device) });
});

export const listDevices = asyncHandler(async (req, res) => {
  const ownDevices = await Device.find({ owner: req.userId }).sort({ createdAt: -1 });
  const ownIds = ownDevices.map((d) => d._id);
  const ownIdSet = new Set(ownIds.map((id) => String(id)));

  const pairings = ownIds.length
    ? await Pairing.find({
        active: true,
        $or: [{ deviceA: { $in: ownIds } }, { deviceB: { $in: ownIds } }],
      })
        .populate('deviceA')
        .populate('deviceB')
    : [];

  const resultMap = new Map();

  for (const p of pairings) {
    if (!p.deviceA || !p.deviceB) continue;
    const isAOwn = ownIdSet.has(String(p.deviceA._id));
    const remote = isAOwn ? p.deviceB : p.deviceA;
    if (!remote) continue;
    resultMap.set(String(remote._id), safeDevice(remote, { pairingId: String(p._id), isPaired: true }));
  }

  const currentClientDeviceId = req.headers['x-device-id']
    ? String(req.headers['x-device-id'])
    : null;
  const includeSelf = req.query.includeSelf === 'true';

  for (const d of ownDevices) {
    if (!includeSelf && currentClientDeviceId && d.deviceId === currentClientDeviceId) {
      continue;
    }
    if (!resultMap.has(String(d._id))) {
      resultMap.set(String(d._id), safeDevice(d, { isOwn: true }));
    }
  }

  res.json({ success: true, data: [...resultMap.values()] });
});

export const deviceDetail = asyncHandler(async (req, res) => {
  const { device } = await resolveAccessibleDevice(req.params.id, req.userId);
  res.json({ success: true, data: safeDevice(device) });
});

export const generatePairCode = asyncHandler(async (req, res) => {
  const headerDeviceId = req.headers['x-device-id'] ? String(req.headers['x-device-id']) : null;
  const requestedDeviceId = req.body?.deviceId ? String(req.body.deviceId) : headerDeviceId;

  const user = await User.findById(req.userId).select('name');
  const deviceName = String(req.body?.deviceName || `${user?.name || 'My'}'s Phone`).trim();

  const sourceDevice = await ensureCallerDevice(req.userId, requestedDeviceId, deviceName);

  await PairCode.deleteMany({ userId: req.userId, usedAt: null });

  let code;
  for (let i = 0; i < 8; i++) {
    code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    if (!(await PairCode.exists({ code }))) break;
  }

  const expiresAt = new Date(Date.now() + Number(process.env.PAIR_CODE_TTL_MINUTES || 10) * 60000);
  const qrPayload = JSON.stringify({
    type: 'fallalert_pair',
    version: 1,
    code,
    deviceName: sourceDevice.name || deviceName,
  });

  await PairCode.create({
    userId: req.userId,
    device: sourceDevice._id,
    deviceName: sourceDevice.name || deviceName,
    code,
    qrPayload,
    expiresAt,
  });

  res.status(201).json({
    success: true,
    data: {
      code,
      formattedCode: `${code.slice(0, 3)} - ${code.slice(3)}`,
      qrPayload,
      expiresAt,
      deviceName: sourceDevice.name || deviceName,
    },
  });
});

export const pairDevice = asyncHandler(async (req, res) => {
  const { deviceName, pairingCode, qrPayload, deviceType, model, batteryLevel, localDeviceId } =
    req.body || {};

  let parsedQr = null;
  if (typeof qrPayload === 'string' && qrPayload.trim()) {
    try {
      parsedQr = JSON.parse(qrPayload);
    } catch {
      parsedQr = null;
    }
  }

  const rawCode = String(pairingCode || parsedQr?.code || '').replace(/[\s-]/g, '');
  if (!rawCode) {
    throw new HttpError(400, 'pairingCode or valid qrPayload is required');
  }
  if (!/^\d{6,8}$/.test(rawCode)) {
    throw new HttpError(400, 'pairingCode must be a 6-digit code');
  }

  const entry = await PairCode.findOneAndUpdate(
    { code: rawCode, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true }
  );

  if (!entry) {
    throw new HttpError(400, 'Pairing code is invalid, expired, or already used');
  }

  const headerDeviceId = req.headers['x-device-id'] ? String(req.headers['x-device-id']) : null;
  const localDevice = await ensureCallerDevice(
    req.userId,
    localDeviceId || headerDeviceId,
    deviceName
  );

  let remoteDevice = entry.device ? await Device.findById(entry.device) : null;
  if (!remoteDevice && entry.userId) {
    remoteDevice = await ensureCallerDevice(entry.userId, null, entry.deviceName);
  }

  if (!remoteDevice) {
    throw new HttpError(404, 'Target device for this pairing code is unavailable');
  }

  if (String(remoteDevice._id) === String(localDevice._id)) {
    throw new HttpError(400, 'Cannot pair a device with itself');
  }

  if (deviceName && String(deviceName).trim() && !remoteDevice.name) {
    remoteDevice.name = String(deviceName).trim();
  }
  if (deviceType && ['phone', 'wearable', 'sensor', 'beacon'].includes(deviceType)) {
    remoteDevice.type = deviceType;
  }
  if (model) remoteDevice.model = String(model).trim();
  if (typeof batteryLevel === 'number') remoteDevice.batteryLevel = batteryLevel;
  remoteDevice.pairedAt = new Date();
  await remoteDevice.save();

  const [deviceA, deviceB] = [String(localDevice._id), String(remoteDevice._id)].sort();
  const pairing = await Pairing.findOneAndUpdate(
    { deviceA, deviceB },
    { $set: { active: true } },
    { upsert: true, new: true }
  );

  res.status(201).json({
    success: true,
    data: safeDevice(remoteDevice, { pairingId: String(pairing._id), isPaired: true }),
  });
});

export const updateDevice = asyncHandler(async (req, res) => {
  const d = await ownDevice(req.params.id, req.userId);
  const { name, type, model, isOnline, batteryLevel, lastActive } = req.body || {};

  if (name !== undefined) {
    const clean = String(name).trim();
    if (!clean || clean.length > 80) throw new HttpError(400, 'Invalid device name');
    d.name = clean;
  }
  if (type !== undefined) {
    if (!['phone', 'wearable', 'sensor', 'beacon'].includes(type)) {
      throw new HttpError(400, 'Invalid device type');
    }
    d.type = type;
  }
  if (model !== undefined) d.model = String(model).trim();
  if (isOnline !== undefined) {
    if (typeof isOnline !== 'boolean') throw new HttpError(400, 'isOnline must be boolean');
    d.isOnline = isOnline;
  }
  if (batteryLevel !== undefined) {
    if (typeof batteryLevel !== 'number' || batteryLevel < 0 || batteryLevel > 100) {
      throw new HttpError(400, 'batteryLevel must be 0-100');
    }
    d.batteryLevel = batteryLevel;
  }
  if (lastActive !== undefined) d.lastActive = String(lastActive);

  d.lastSeenAt = new Date();
  await d.save();

  res.json({ success: true, data: safeDevice(d) });
});

export const unpairDevice = asyncHandler(async (req, res) => {
  const { device, isOwn } = await resolveAccessibleDevice(req.params.id, req.userId);

  if (isOwn) {
    await Pairing.updateMany(
      { $or: [{ deviceA: device._id }, { deviceB: device._id }] },
      { $set: { active: false } }
    );
    await Device.deleteOne({ _id: device._id, owner: req.userId });
  } else {
    const ownDevices = await Device.find({ owner: req.userId }).select('_id');
    const ownIds = ownDevices.map((d) => d._id);
    await Pairing.updateMany(
      {
        $or: [
          { deviceA: { $in: ownIds }, deviceB: device._id },
          { deviceB: { $in: ownIds }, deviceA: device._id },
        ],
      },
      { $set: { active: false } }
    );
  }

  res.json({
    success: true,
    id: String(device._id),
    message: 'Device unpaired successfully',
  });
});

export const pingDevice = asyncHandler(async (req, res) => {
  const start = Date.now();
  const { device, isOwn } = await resolveAccessibleDevice(req.params.id, req.userId);

  if (isOwn) {
    device.lastSeenAt = new Date();
    device.lastActive = 'Just now';
    device.isOnline = true;
    await device.save();
  }

  const latencyMs = Math.max(1, Date.now() - start);
  res.json({
    success: true,
    isOnline: device.isOnline ?? true,
    latencyMs,
    data: {
      isOnline: device.isOnline ?? true,
      latencyMs,
    },
  });
});

export const updateToken = asyncHandler(async (req, res) => {
  const d = await ownDevice(req.params.id, req.userId);
  if (typeof req.body.fcmToken !== 'string' || req.body.fcmToken.length > 4096) {
    throw new HttpError(400, 'Invalid FCM token');
  }
  d.fcmToken = req.body.fcmToken.trim();
  d.lastSeenAt = new Date();
  await d.save();
  res.json({ success: true, message: 'Token updated' });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const d = await ownDevice(req.params.id, req.userId);
  const s = req.body || {};
  if (s.sensitivity !== undefined) {
    const normalized = String(s.sensitivity).toLowerCase();
    if (!['low', 'medium', 'high'].includes(normalized)) {
      throw new HttpError(400, 'Invalid sensitivity');
    }
    d.settings.sensitivity = normalized;
  }
  for (const key of ['notifications', 'sound', 'vibration']) {
    if (s[key] !== undefined) {
      if (typeof s[key] !== 'boolean') throw new HttpError(400, `Invalid ${key}`);
      d.settings[key] = s[key];
    }
  }
  await d.save();
  res.json({ success: true, settings: d.settings, data: d.settings });
});

export const pairedDevices = asyncHandler(async (req, res) => {
  await ownDevice(req.params.id, req.userId);
  const pairs = await Pairing.find({
    active: true,
    $or: [{ deviceA: req.params.id }, { deviceB: req.params.id }],
  })
    .populate('deviceA')
    .populate('deviceB');
  const devices = pairs
    .filter((p) => p.deviceA && p.deviceB)
    .map((p) => (String(p.deviceA._id) === req.params.id ? p.deviceB : p.deviceA));
  res.json({ success: true, data: devices.map((d) => safeDevice(d, { isPaired: true })) });
});
