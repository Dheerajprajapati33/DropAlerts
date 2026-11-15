import FallEvent from '../models/FallEvent.js';
import Alert from '../models/Alert.js';
import Device from '../models/Device.js';
import User from '../models/User.js';
import { getAlertRecipients, deliverAlertToRecipients } from '../services/recipients.js';
import { asyncHandler, HttpError } from '../utils/http.js';

const ALLOWED_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const DEDUP_WINDOW_MS = 15 * 1000;

export function deriveFallSeverity(impactForce) {
  if (typeof impactForce !== 'number' || Number.isNaN(impactForce)) return 'High';
  if (impactForce >= 4.5) return 'Critical';
  if (impactForce >= 3.2) return 'High';
  if (impactForce >= 2.5) return 'Medium';
  return 'Low';
}

export function sanitizeSensorData(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out = {};

  if (raw.accelerometer && typeof raw.accelerometer === 'object') {
    const { x, y, z, magnitude } = raw.accelerometer;
    if ([x, y, z].every((v) => typeof v === 'number' && Number.isFinite(v))) {
      const mag =
        typeof magnitude === 'number' && Number.isFinite(magnitude)
          ? magnitude
          : Math.sqrt(x * x + y * y + z * z);
      out.accelerometer = { x, y, z, magnitude: Number(mag.toFixed(3)) };
    }
  }

  if (raw.gyroscope && typeof raw.gyroscope === 'object') {
    const { x, y, z, magnitude } = raw.gyroscope;
    if ([x, y, z].every((v) => typeof v === 'number' && Number.isFinite(v))) {
      const mag =
        typeof magnitude === 'number' && Number.isFinite(magnitude)
          ? magnitude
          : Math.sqrt(x * x + y * y + z * z);
      out.gyroscope = { x, y, z, magnitude: Number(mag.toFixed(3)) };
    }
  }

  if (typeof raw.freeFallDurationMs === 'number' && Number.isFinite(raw.freeFallDurationMs)) {
    out.freeFallDurationMs = Math.max(0, Math.round(raw.freeFallDurationMs));
  }
  if (typeof raw.peakImpactG === 'number' && Number.isFinite(raw.peakImpactG)) {
    out.peakImpactG = Number(raw.peakImpactG.toFixed(2));
  }
  if (typeof raw.peakRotationRad === 'number' && Number.isFinite(raw.peakRotationRad)) {
    out.peakRotationRad = Number(raw.peakRotationRad.toFixed(2));
  }
  if (typeof raw.postImpactStillnessMs === 'number' && Number.isFinite(raw.postImpactStillnessMs)) {
    out.postImpactStillnessMs = Math.max(0, Math.round(raw.postImpactStillnessMs));
  }
  if (Array.isArray(raw.stagesCompleted)) {
    out.stagesCompleted = raw.stagesCompleted.slice(0, 10).map((s) => String(s).trim());
  }
  if (typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)) {
    out.timestamp = raw.timestamp;
  }

  return Object.keys(out).length ? out : undefined;
}

const safeFall = (f) => ({
  id: String(f._id || f.id),
  userId: String(f.userId),
  deviceId: f.deviceId,
  deviceName: f.deviceName,
  timestamp: (f.timestamp || f.createdAt).toISOString(),
  severity: f.severity,
  confidence: f.confidence,
  impactForce: f.impactForce,
  location: f.location,
  status: f.status,
  ...(f.sensorData ? { sensorData: f.sensorData } : {}),
  ...(f.notes ? { notes: f.notes } : {}),
});

export const reportFall = asyncHandler(async (req, res) => {
  const { deviceId, deviceName, severity, impactForce, location, confidence, sensorData } = req.body || {};

  if (severity !== undefined && !ALLOWED_SEVERITIES.includes(severity)) {
    throw new HttpError(400, 'severity must be Low, Medium, High, or Critical');
  }
  if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) {
    throw new HttpError(400, 'confidence must be between 0 and 1');
  }
  if (impactForce !== undefined && (typeof impactForce !== 'number' || impactForce < 0 || impactForce > 100)) {
    throw new HttpError(400, 'impactForce must be between 0 and 100');
  }

  const now = new Date();
  const resolvedDeviceId = deviceId
    ? String(deviceId).trim()
    : req.headers['x-device-id']
    ? String(req.headers['x-device-id'])
    : 'DEV-SELF';

  // Deduplicate rapid retries / secondary bounce triggers from the same device
  const recentDuplicate = await FallEvent.findOne({
    userId: req.userId,
    deviceId: resolvedDeviceId,
    status: 'detected',
    timestamp: { $gte: new Date(now.getTime() - DEDUP_WINDOW_MS) },
  }).sort({ timestamp: -1 });

  if (recentDuplicate) {
    return res.status(200).json({
      success: true,
      deduplicated: true,
      data: safeFall(recentDuplicate),
      recipientCount: 0,
    });
  }

  const cleanSensorData = sanitizeSensorData(sensorData);
  const resolvedImpactForce =
    impactForce !== undefined ? impactForce : cleanSensorData?.peakImpactG;
  const resolvedSeverity = severity || deriveFallSeverity(resolvedImpactForce);

  const sourceDevice = await Device.findOne({ owner: req.userId, deviceId: resolvedDeviceId });

  const fall = await FallEvent.create({
    userId: req.userId,
    deviceId: resolvedDeviceId,
    deviceName: deviceName ? String(deviceName).trim() : sourceDevice?.name || 'Current Device',
    timestamp: now,
    severity: resolvedSeverity,
    confidence: confidence ?? 0.95,
    ...(resolvedImpactForce !== undefined ? { impactForce: resolvedImpactForce } : {}),
    ...(location ? { location: String(location).trim() } : {}),
    status: 'detected',
    ...(cleanSensorData ? { sensorData: cleanSensorData } : {}),
  });

  const [user, recipients] = await Promise.all([
    User.findById(req.userId),
    getAlertRecipients(req.userId, sourceDevice?._id || null),
  ]);

  const contactsNotified = [
    ...new Set([
      ...recipients.map((d) => d.name),
      ...(user?.emergencyContacts || []).map((c) => c.name),
    ]),
  ];

  const title = 'Fall Detected';
  const body = `${fall.severity} impact fall detected on ${fall.deviceName}.${
    fall.impactForce ? ` (${fall.impactForce}G)` : ''
  }`;

  const alert = await Alert.create({
    ...(sourceDevice ? { sourceDevice: sourceDevice._id } : {}),
    owner: req.userId,
    fallEventId: fall._id,
    eventId: `fall_${fall._id}`,
    detectedAt: now,
    impactG: fall.impactForce,
    title,
    message: body,
    severity: fall.severity,
    type: 'fall',
    status: 'sent',
    timestamp: now,
    device: fall.deviceName,
    location: fall.location
      ? `${fall.location}${fall.impactForce ? ` (Impact force: ${fall.impactForce}G)` : ''}`
      : undefined,
    isHighlighted: true,
    contactsNotified,
    recipients: recipients.map((d) => d._id),
  });

  const delivery = await deliverAlertToRecipients({
    recipients,
    alertId: alert._id,
    title,
    body,
    data: {
      type: 'FALL_ALERT',
      alertId: String(alert._id),
      fallEventId: String(fall._id),
      severity: fall.severity,
      ...(fall.impactForce !== undefined ? { impactForce: String(fall.impactForce) } : {}),
    },
  });

  alert.delivery = delivery;
  if (delivery.some((x) => x.status === 'sent')) {
    alert.status = 'delivered';
  }
  await alert.save();

  res.status(201).json({
    success: true,
    data: safeFall(fall),
    recipientCount: recipients.length,
  });
});

export const getFallHistory = asyncHandler(async (req, res) => {
  const falls = await FallEvent.find({ userId: req.userId }).sort({ timestamp: -1, createdAt: -1 });
  res.json({
    success: true,
    data: falls.map(safeFall),
  });
});

export const cancelFall = asyncHandler(async (req, res) => {
  const fall = await FallEvent.findOne({ _id: req.params.id, userId: req.userId });
  if (!fall) throw new HttpError(404, 'Fall event not found');

  fall.status = 'cancelled';
  fall.notes = String(req.body?.reason || 'False alarm clicked by user').trim();
  await fall.save();

  await Alert.updateMany(
    { fallEventId: fall._id, owner: req.userId },
    { $set: { status: 'dismissed', isHighlighted: false } }
  );

  const recipients = await getAlertRecipients(req.userId);
  if (recipients.length) {
    await deliverAlertToRecipients({
      recipients,
      title: 'Fall Alert Cancelled',
      body: `${fall.deviceName} marked as safe (False alarm).`,
      data: {
        type: 'FALL_CANCELLED',
        fallEventId: String(fall._id),
      },
    });
  }

  res.json({
    success: true,
    id: String(fall._id),
    data: safeFall(fall),
  });
});

export const acknowledgeFall = asyncHandler(async (req, res) => {
  const fall = await FallEvent.findOne({ _id: req.params.id, userId: req.userId });
  if (!fall) throw new HttpError(404, 'Fall event not found');

  fall.status = 'acknowledged';
  await fall.save();

  await Alert.updateMany(
    { fallEventId: fall._id, owner: req.userId },
    { $set: { status: 'acknowledged', isHighlighted: false } }
  );

  res.json({
    success: true,
    id: String(fall._id),
    data: safeFall(fall),
  });
});
