import Device from '../models/Device.js';
import Pairing from '../models/Pairing.js';
import Notification from '../models/Notification.js';
import { sendPush } from './push.js';

/**
 * Returns all devices that should receive alerts triggered by `userId`:
 * 1. Actively paired remote devices linked via Pairing (excluding devices owned by `userId` if already listed, deduplicated by _id)
 * 2. Other devices owned by `userId` (excluding `sourceDeviceId` when provided)
 */
export async function getAlertRecipients(userId, sourceDeviceId = null) {
  const ownDevices = await Device.find({ owner: userId }).select('+fcmToken');
  const ownIds = ownDevices.map((d) => d._id);

  const pairings = ownIds.length
    ? await Pairing.find({
        active: true,
        $or: [{ deviceA: { $in: ownIds } }, { deviceB: { $in: ownIds } }],
      })
    : [];

  const ownIdSet = new Set(ownIds.map((id) => String(id)));
  const remoteIds = new Set();

  for (const p of pairings) {
    const a = String(p.deviceA);
    const b = String(p.deviceB);
    if (!ownIdSet.has(a)) remoteIds.add(a);
    if (!ownIdSet.has(b)) remoteIds.add(b);
  }

  const remoteDevices = remoteIds.size
    ? await Device.find({ _id: { $in: [...remoteIds] } }).select('+fcmToken')
    : [];

  const combined = new Map();
  for (const d of [...remoteDevices, ...ownDevices]) {
    if (sourceDeviceId && String(d._id) === String(sourceDeviceId)) continue;
    combined.set(String(d._id), d);
  }

  // If user only has 1 device and no paired devices yet, return empty or own?
  // For single-device solo testing, keep other devices; if none, remoteDevices + other ownDevices = [].
  return [...combined.values()];
}

/**
 * Persists in-app notifications and delivers FCM push messages to recipient devices.
 */
export async function deliverAlertToRecipients({
  recipients,
  alertId,
  title,
  body,
  data = {},
}) {
  const delivery = [];

  for (const d of recipients) {
    if (alertId && d.owner) {
      await Notification.create({
        user: d.owner,
        device: d._id,
        alert: alertId,
        title,
        body,
      });
    }

    const notificationsEnabled = d.settings?.notifications !== false;
    const result =
      notificationsEnabled && d.fcmToken
        ? await sendPush(d.fcmToken, title, body, data)
        : { status: 'skipped' };

    delivery.push({
      device: d._id,
      status: result.status,
      at: new Date(),
    });
  }

  return delivery;
}
