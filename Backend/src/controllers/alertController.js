import crypto from 'node:crypto';
import Device from '../models/Device.js';
import Alert from '../models/Alert.js';
import User from '../models/User.js';
import { ownDevice } from '../services/deviceAccess.js';
import { getAlertRecipients, deliverAlertToRecipients } from '../services/recipients.js';
import { HttpError, asyncHandler } from '../utils/http.js';

const ALLOWED_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const ALLOWED_TYPES = ['fall', 'received', 'sent', 'system', 'emergency'];

const safeAlert = (a, viewerId = null) => {
  const isOwner = viewerId ? String(a.owner) === String(viewerId) : true;
  // If viewer is a recipient (not owner) and alert type was 'fall'/'sent', show as 'received' or preserve 'fall'
  const resolvedType =
    !isOwner && a.type === 'sent' ? 'received' : a.type || 'fall';

  return {
    id: String(a._id || a.id),
    userId: String(a.owner),
    ...(a.fallEventId ? { fallEventId: String(a.fallEventId) } : {}),
    title: a.title || 'Fall Detected',
    ...(a.message ? { message: a.message } : {}),
    severity: a.severity || 'High',
    type: resolvedType,
    status: a.status || 'sent',
    timestamp: (a.timestamp || a.detectedAt || a.createdAt).toISOString(),
    ...(a.device || a.sourceDevice?.name ? { device: a.device || a.sourceDevice?.name } : {}),
    ...(a.location ? { location: a.location } : {}),
    isHighlighted: Boolean(a.isHighlighted),
    contactsNotified: a.contactsNotified || [],
  };
};

const safeContact = (c) => ({
  id: String(c._id || c.id),
  name: c.name,
  phone: c.phone,
  relation: c.relation || 'Emergency',
  isPrimary: Boolean(c.isPrimary),
});

export const createAlert = asyncHandler(async (req, res) => {
  const { deviceId, eventId, detectedAt, impactG } = req.body;
  if (!eventId || typeof eventId !== 'string' || eventId.length > 128) {
    throw new HttpError(400, 'eventId required');
  }
  const date = new Date(detectedAt);
  if (!detectedAt || isNaN(date.getTime()) || Math.abs(Date.now() - date.getTime()) > 5 * 60000) {
    throw new HttpError(400, 'detectedAt must be within 5 minutes');
  }
  if (impactG !== undefined && (!Number.isFinite(impactG) || impactG < 0 || impactG > 100)) {
    throw new HttpError(400, 'Invalid impactG');
  }
  const source = await ownDevice(deviceId, req.userId);
  const existing = await Alert.findOne({ sourceDevice: source._id, eventId });
  if (existing) return res.json({ success: true, data: safeAlert(existing, req.userId), duplicate: true });

  const recipients = await getAlertRecipients(req.userId, source._id);

  const title = 'FallAlert – Impact Detected!';
  const body = `Possible fall detected on ${source.name}. Check on them.`;

  let alert;
  try {
    alert = await Alert.create({
      sourceDevice: source._id,
      owner: req.userId,
      eventId,
      detectedAt: date,
      timestamp: date,
      impactG,
      title,
      message: body,
      severity: 'High',
      type: 'fall',
      status: 'sent',
      device: source.name,
      recipients: recipients.map((d) => d._id),
      contactsNotified: recipients.map((d) => d.name),
    });
  } catch (e) {
    if (e.code === 11000) {
      const dup = await Alert.findOne({ sourceDevice: source._id, eventId });
      return res.json({ success: true, data: safeAlert(dup, req.userId), duplicate: true });
    }
    throw e;
  }

  const delivery = await deliverAlertToRecipients({
    recipients,
    alertId: alert._id,
    title,
    body,
    data: {
      type: 'FALL_ALERT',
      alertId: alert.id,
      sourceDeviceId: source.id,
    },
  });

  alert.delivery = delivery;
  if (delivery.some((x) => x.status === 'sent')) {
    alert.status = 'delivered';
  }
  await alert.save();

  res.status(201).json({
    success: true,
    data: safeAlert(alert, req.userId),
    recipientCount: recipients.length,
  });
});

export const triggerAlert = asyncHandler(async (req, res) => {
  const { title, message, severity, type, device, location } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new HttpError(400, 'title is required');
  }
  if (severity !== undefined && !ALLOWED_SEVERITIES.includes(severity)) {
    throw new HttpError(400, 'severity must be Low, Medium, High, or Critical');
  }
  if (type !== undefined && !ALLOWED_TYPES.includes(type)) {
    throw new HttpError(400, 'Invalid alert type');
  }

  const headerDeviceId = req.headers['x-device-id'] ? String(req.headers['x-device-id']) : null;
  const sourceDevice = headerDeviceId
    ? await Device.findOne({ owner: req.userId, deviceId: headerDeviceId })
    : null;

  const [user, recipients] = await Promise.all([
    User.findById(req.userId),
    getAlertRecipients(req.userId, sourceDevice?._id || null),
  ]);

  const contactsNotified = [
    ...new Set([
      ...(user?.emergencyContacts || []).map((c) => c.name),
      ...recipients.map((d) => d.name),
    ]),
  ];

  const now = new Date();
  const alertTitle = title.trim();
  const alertMessage = message ? String(message).trim() : 'Emergency assistance requested';

  const alert = await Alert.create({
    ...(sourceDevice ? { sourceDevice: sourceDevice._id } : {}),
    owner: req.userId,
    eventId: `sos_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    detectedAt: now,
    timestamp: now,
    title: alertTitle,
    message: alertMessage,
    severity: severity || 'Critical',
    type: type || 'emergency',
    status: 'sent',
    device: device ? String(device).trim() : sourceDevice?.name || `${user?.name || 'User'}'s Phone`,
    location: location ? String(location).trim() : 'Current GPS Location',
    isHighlighted: true,
    contactsNotified,
    recipients: recipients.map((d) => d._id),
  });

  const delivery = await deliverAlertToRecipients({
    recipients,
    alertId: alert._id,
    title: alertTitle,
    body: alertMessage,
    data: {
      type: 'EMERGENCY_SOS',
      alertId: String(alert._id),
      severity: severity || 'Critical',
    },
  });

  alert.delivery = delivery;
  if (delivery.some((x) => x.status === 'sent')) {
    alert.status = 'delivered';
  }
  await alert.save();

  res.status(201).json({
    success: true,
    data: safeAlert(alert, req.userId),
    recipientCount: recipients.length,
  });
});

export const listAlerts = asyncHandler(async (req, res) => {
  const devices = await Device.find({ owner: req.userId }).select('_id');
  const ids = devices.map((d) => d._id);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const filter = { $or: [{ owner: req.userId }, { recipients: { $in: ids } }] };
  if (req.query.type && ALLOWED_TYPES.includes(req.query.type)) {
    if (req.query.type === 'received') {
      filter.$and = [{ owner: { $ne: req.userId } }, { recipients: { $in: ids } }];
    } else if (req.query.type === 'sent') {
      filter.$and = [{ owner: req.userId }];
    } else {
      filter.type = req.query.type;
    }
  }
  if (req.query.severity && ALLOWED_SEVERITIES.includes(req.query.severity)) {
    filter.severity = req.query.severity;
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const alerts = await Alert.find(filter)
    .sort({ timestamp: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('sourceDevice', 'name');

  res.json({
    success: true,
    data: alerts.map((a) => safeAlert(a, req.userId)),
  });
});

export const alertDetail = asyncHandler(async (req, res) => {
  const a = await Alert.findById(req.params.id).populate('sourceDevice', 'name');
  if (!a) throw new HttpError(404, 'Alert not found');

  const own = String(a.owner) === req.userId;
  const devices = await Device.find({ owner: req.userId }).select('_id');
  if (!own && !devices.some((d) => a.recipients.some((r) => String(r) === String(d._id)))) {
    throw new HttpError(403, 'Forbidden');
  }

  res.json({ success: true, data: safeAlert(a, req.userId) });
});

export const dismissAlert = asyncHandler(async (req, res) => {
  const devices = await Device.find({ owner: req.userId }).select('_id');
  const ids = devices.map((d) => d._id);

  const alert = await Alert.findOneAndUpdate(
    { _id: req.params.id, $or: [{ owner: req.userId }, { recipients: { $in: ids } }] },
    { $set: { status: 'dismissed', isHighlighted: false } },
    { new: true }
  );
  if (!alert) throw new HttpError(404, 'Alert not found');

  res.json({
    success: true,
    id: String(alert._id),
  });
});

export const cancelAlert = asyncHandler(async (req, res) => {
  const a = await Alert.findOne({ _id: req.params.id, owner: req.userId });
  if (!a) throw new HttpError(404, 'Alert not found');
  a.status = 'cancelled';
  a.isHighlighted = false;
  await a.save();

  const recipients = await getAlertRecipients(req.userId, a.sourceDevice || null);
  if (recipients.length) {
    await deliverAlertToRecipients({
      recipients,
      title: 'Alert Cancelled',
      body: `${a.device || 'User'} cancelled the alert (Safe).`,
      data: { type: 'ALERT_CANCELLED', alertId: String(a._id) },
    });
  }

  res.json({ success: true, data: safeAlert(a, req.userId) });
});

export const getEmergencyContacts = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(404, 'User not found');

  res.json({
    success: true,
    data: (user.emergencyContacts || []).map(safeContact),
  });
});

export const addEmergencyContact = asyncHandler(async (req, res) => {
  const { name, phone, relation, isPrimary } = req.body || {};
  if (!name || !String(name).trim() || !phone || !String(phone).trim()) {
    throw new HttpError(400, 'name and phone are required');
  }

  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(404, 'User not found');

  if (isPrimary) {
    user.emergencyContacts.forEach((c) => {
      c.isPrimary = false;
    });
  }

  user.emergencyContacts.push({
    name: String(name).trim(),
    phone: String(phone).trim(),
    relation: relation ? String(relation).trim() : 'Emergency',
    isPrimary: Boolean(isPrimary),
  });

  await user.save();
  const created = user.emergencyContacts[user.emergencyContacts.length - 1];

  res.status(201).json({
    success: true,
    data: safeContact(created),
  });
});

export const updateEmergencyContact = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(404, 'User not found');

  const contact = user.emergencyContacts.id(req.params.id);
  if (!contact) throw new HttpError(404, 'Emergency contact not found');

  const { name, phone, relation, isPrimary } = req.body || {};
  if (name !== undefined) {
    if (!String(name).trim()) throw new HttpError(400, 'Invalid contact name');
    contact.name = String(name).trim();
  }
  if (phone !== undefined) {
    if (!String(phone).trim()) throw new HttpError(400, 'Invalid contact phone');
    contact.phone = String(phone).trim();
  }
  if (relation !== undefined) {
    contact.relation = String(relation).trim() || 'Emergency';
  }
  if (isPrimary !== undefined) {
    if (Boolean(isPrimary)) {
      user.emergencyContacts.forEach((c) => {
        c.isPrimary = false;
      });
    }
    contact.isPrimary = Boolean(isPrimary);
  }

  await user.save();
  res.json({ success: true, data: safeContact(contact) });
});

export const deleteEmergencyContact = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(404, 'User not found');

  const contact = user.emergencyContacts.id(req.params.id);
  if (!contact) throw new HttpError(404, 'Emergency contact not found');

  contact.deleteOne();
  await user.save();

  res.json({
    success: true,
    id: req.params.id,
    message: 'Emergency contact deleted',
  });
});
