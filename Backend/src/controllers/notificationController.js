import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Device from '../models/Device.js';
import NearbyPresence from '../models/NearbyPresence.js';
import { HttpError, asyncHandler } from '../utils/http.js';

export const registerToken = asyncHandler(async (req, res) => {
  const { fcmToken, deviceId } = req.body || {};
  if (typeof fcmToken !== 'string' || !fcmToken.trim() || fcmToken.length > 4096) {
    throw new HttpError(400, 'Valid fcmToken is required');
  }

  const cleanToken = fcmToken.trim();
  const resolvedDeviceId = deviceId
    ? String(deviceId)
    : req.headers['x-device-id']
    ? String(req.headers['x-device-id'])
    : null;

  if (req.userId) {
    await User.findByIdAndUpdate(req.userId, { fcmToken: cleanToken });
    if (resolvedDeviceId) {
      await Device.findOneAndUpdate(
        { owner: req.userId, deviceId: resolvedDeviceId },
        { $set: { fcmToken: cleanToken, lastSeenAt: new Date(), isOnline: true } }
      );
    } else {
      await Device.updateMany(
        { owner: req.userId },
        { $set: { fcmToken: cleanToken, lastSeenAt: new Date() } }
      );
    }
    await NearbyPresence.updateMany(
      { fcmToken: cleanToken },
      { $set: { userId: req.userId, lastSyncedAt: new Date() } }
    );
  }

  res.json({
    success: true,
    message: 'FCM token registered successfully',
  });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const notifications = await Notification.find({ user: req.userId })
    .sort({ createdAt: -1 })
    .limit(limit);
  res.json({
    success: true,
    data: notifications.map((n) => ({
      id: String(n._id),
      title: n.title,
      body: n.body,
      alertId: n.alert ? String(n.alert) : undefined,
      readAt: n.readAt || null,
      timestamp: n.createdAt.toISOString(),
    })),
  });
});

export const readNotification = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!n) throw new HttpError(404, 'Notification not found');
  res.json({ success: true, data: n });
});

export const readAllNotifications = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user: req.userId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  res.json({ success: true, message: 'All notifications marked as read' });
});
