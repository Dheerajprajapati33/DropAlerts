export interface DeviceSettings {
  sensitivity: 'low' | 'medium' | 'high';
  notifications: boolean;
  sound: boolean;
  vibration: boolean;
}

export interface Device {
  id: string;
  userId?: string;
  name: string;
  type?: 'phone' | 'wearable' | 'sensor' | 'beacon';
  model?: string;
  deviceId?: string;
  isOnline: boolean;
  batteryLevel?: number;
  lastActive: string;
  pairedAt?: string;
  pairingId?: string;
  isPaired?: boolean;
  isOwn?: boolean;
  settings?: DeviceSettings;
}

export interface PairDeviceRequest {
  deviceName?: string;
  pairingCode?: string;
  qrPayload?: string;
  deviceType?: 'phone' | 'wearable' | 'sensor' | 'beacon';
  localDeviceId?: string;
}

export interface PairCodeResponse {
  code: string;
  formattedCode: string;
  qrPayload: string;
  expiresAt: string;
  deviceName: string;
}
