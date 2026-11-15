import { Platform } from 'react-native';

let cachedDeviceId: string | null = null;

/**
 * Generates a stable installation/session identifier for this Android client.
 * Sent via `x-device-id` header and `/devices` registration so the backend can
 * distinguish the caller's own phone from paired remote devices.
 */
export function getClientDeviceId(): string {
  if (!cachedDeviceId) {
    const rand = Math.random().toString(36).slice(2, 10);
    cachedDeviceId = `${Platform.OS}-${Platform.Version}-${Date.now().toString(36)}-${rand}`;
  }
  return cachedDeviceId;
}

export function setClientDeviceId(id: string): void {
  if (id && id.trim()) {
    cachedDeviceId = id.trim();
  }
}
