import { Alert, PermissionsAndroid, Platform } from 'react-native';
import api from './api';
import { API_ENDPOINTS } from '../config/api.config';
import { getClientDeviceId } from './deviceIdentity';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface InboxNotificationItem {
  id: string;
  title: string;
  body: string;
  alertId?: string;
  readAt?: string | null;
  timestamp: string;
}

function getFirebaseMessaging(): any | null {
  try {
    // Lazy-require so Jest/non-native test runners do not fail at import time
    const mod = require('@react-native-firebase/messaging');
    return typeof mod?.default === 'function' ? mod.default() : null;
  } catch {
    return null;
  }
}

export const notificationService = {
  async requestNotificationPermission(): Promise<boolean> {
    try {
      if (
        Platform.OS === 'android' &&
        Platform.Version >= 33 &&
        (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS
      ) {
        const res = await PermissionsAndroid.request(
          (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS
        );
        if (res !== PermissionsAndroid.RESULTS.GRANTED) {
          return false;
        }
      }

      const msg = getFirebaseMessaging();
      if (msg && typeof msg.requestPermission === 'function') {
        await msg.requestPermission();
      }
      return true;
    } catch {
      return false;
    }
  },

  async getFcmToken(): Promise<string | null> {
    try {
      const msg = getFirebaseMessaging();
      if (!msg) return null;
      if (typeof msg.registerDeviceForRemoteMessages === 'function') {
        await msg.registerDeviceForRemoteMessages();
      }
      const token = await msg.getToken();
      return typeof token === 'string' && token.trim() ? token.trim() : null;
    } catch (err) {
      console.warn('Could not obtain FCM token:', err);
      return null;
    }
  },

  subscribeToForegroundMessages(
    onRemoteMessage: (remoteMessage: any) => void
  ): () => void {
    try {
      const msg = getFirebaseMessaging();
      if (msg && typeof msg.onMessage === 'function') {
        return msg.onMessage(onRemoteMessage);
      }
    } catch {
      // Ignore if Firebase messaging unavailable
    }
    return () => {};
  },

  subscribeToTokenRefresh(onToken: (token: string) => void): () => void {
    try {
      const msg = getFirebaseMessaging();
      if (msg && typeof msg.onTokenRefresh === 'function') {
        return msg.onTokenRefresh(onToken);
      }
    } catch {
      // Ignore
    }
    return () => {};
  },

  async registerDeviceToken(token: string): Promise<boolean> {
    await api.post(API_ENDPOINTS.NOTIFICATIONS.TOKEN, {
      fcmToken: token,
      deviceId: getClientDeviceId(),
    });
    return true;
  },

  async getNotifications(limit = 30): Promise<InboxNotificationItem[]> {
    const response = await api.get<{
      success: boolean;
      data: InboxNotificationItem[];
    }>(API_ENDPOINTS.NOTIFICATIONS.BASE, { params: { limit } });
    return response.data.data;
  },

  async markAsRead(id: string): Promise<void> {
    await api.patch(API_ENDPOINTS.NOTIFICATIONS.READ(id));
  },

  async markAllAsRead(): Promise<void> {
    await api.patch(API_ENDPOINTS.NOTIFICATIONS.READ_ALL);
  },

  displayEmergencyNotification(payload: NotificationPayload): void {
    Alert.alert(
      `🚨 ${payload.title}`,
      `${payload.body}\n\nCheck connected device status immediately.`,
      [{ text: 'OK' }]
    );
  },
};

export default notificationService;
