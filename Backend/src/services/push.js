import { messaging } from '../config/firebase.js';
import Device from '../models/Device.js';
import NearbyPresence from '../models/NearbyPresence.js';

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

async function cleanupInvalidToken(token) {
  try {
    await Promise.all([
      Device.updateMany({ fcmToken: token }, { $unset: { fcmToken: 1 } }),
      NearbyPresence.updateMany({ fcmToken: token }, { $set: { isActive: false } }),
    ]);
  } catch (cleanupErr) {
    console.error('Token cleanup error:', cleanupErr.message);
  }
}

export async function sendPush(token, title, body, data = {}) {
  if (!messaging || !token) return { status: 'skipped' };
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: {
        priority: 'high',
        notification: {
          channelId: 'fall_alerts',
          sound: 'fall_alert',
        },
      },
    });
    return { status: 'sent' };
  } catch (e) {
    const code = e.code || e.errorInfo?.code;
    console.error('FCM send error', code || e.message);
    if (INVALID_TOKEN_CODES.has(code)) {
      await cleanupInvalidToken(token);
    }
    return { status: 'failed', code };
  }
}
