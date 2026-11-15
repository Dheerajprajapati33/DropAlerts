import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { MotionSample } from '../types/FallEvent';

export interface SensorAvailability {
  accelerometer: boolean;
  gyroscope: boolean;
}

export interface NativeConfigPayload {
  authToken?: string | null;
  deviceId?: string;
  deviceName?: string;
  apiBaseUrl?: string;
  sensitivity?: 'Low' | 'Medium' | 'High';
  isMonitoring?: boolean;
  latitude?: number;
  longitude?: number;
}

const MOTION_SENSOR_EVENT = 'MotionSensorData';
const EVENT_NATIVE_FALL_DETECTED = 'NativeFallDetected';
const EVENT_NATIVE_FALL_CANCELLED = 'NativeFallCancelled';

function getNativeModule(): any | null {
  try {
    return NativeModules?.MotionSensorModule ?? null;
  } catch {
    return null;
  }
}

export const motionSensorService = {
  isSupportedPlatform(): boolean {
    return Platform.OS === 'android' && getNativeModule() !== null;
  },

  async isAvailable(): Promise<SensorAvailability> {
    const mod = getNativeModule();
    if (!mod || typeof mod.isAvailable !== 'function') {
      return { accelerometer: false, gyroscope: false };
    }
    try {
      const res = await mod.isAvailable();
      return {
        accelerometer: Boolean(res?.accelerometer),
        gyroscope: Boolean(res?.gyroscope),
      };
    } catch {
      return { accelerometer: false, gyroscope: false };
    }
  },

  async syncNativeConfig(config: NativeConfigPayload): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod || typeof mod.syncConfig !== 'function') {
      return false;
    }
    try {
      return Boolean(await mod.syncConfig(config));
    } catch (err) {
      console.warn('Failed to syncNativeConfig:', err);
      return false;
    }
  },

  async cancelPendingFall(reason = 'Cancelled by user in app'): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod || typeof mod.cancelPendingFall !== 'function') {
      return false;
    }
    try {
      return Boolean(await mod.cancelPendingFall(reason));
    } catch (err) {
      console.warn('Failed to cancelPendingFall:', err);
      return false;
    }
  },

  async simulateNativeFall(): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod || typeof mod.simulateNativeFall !== 'function') {
      return false;
    }
    try {
      return Boolean(await mod.simulateNativeFall());
    } catch (err) {
      console.warn('Failed to simulateNativeFall:', err);
      return false;
    }
  },

  async isBatteryOptimized(): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod || typeof mod.isBatteryOptimized !== 'function') {
      return false;
    }
    try {
      return Boolean(await mod.isBatteryOptimized());
    } catch {
      return false;
    }
  },

  async requestBatteryExemption(): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod || typeof mod.requestBatteryExemption !== 'function') {
      return false;
    }
    try {
      return Boolean(await mod.requestBatteryExemption());
    } catch (err) {
      console.warn('Failed to requestBatteryExemption:', err);
      return false;
    }
  },

  async startMonitoring(intervalMs = 20): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod || typeof mod.startMonitoring !== 'function') {
      return false;
    }
    try {
      return Boolean(await mod.startMonitoring(intervalMs));
    } catch (err) {
      console.warn('Failed to start MotionSensorModule:', err);
      return false;
    }
  },

  async stopMonitoring(): Promise<boolean> {
    const mod = getNativeModule();
    if (!mod || typeof mod.stopMonitoring !== 'function') {
      return false;
    }
    try {
      return Boolean(await mod.stopMonitoring());
    } catch {
      return false;
    }
  },

  subscribe(onSample: (sample: MotionSample) => void): () => void {
    const mod = getNativeModule();
    if (!mod) {
      return () => {};
    }

    const emitter = new NativeEventEmitter(mod);
    const sub = emitter.addListener(MOTION_SENSOR_EVENT, (raw: any) => {
      if (!raw || typeof raw !== 'object') return;
      onSample({
        ax: Number(raw.ax) || 0,
        ay: Number(raw.ay) || 0,
        az: Number(raw.az) || 0,
        gx: Number(raw.gx) || 0,
        gy: Number(raw.gy) || 0,
        gz: Number(raw.gz) || 0,
        hasGyroscope: raw.hasGyroscope !== false,
        timestamp: Number(raw.timestamp) || Date.now(),
      });
    });

    return () => {
      try {
        sub.remove();
      } catch {
        // Ignore cleanup errors
      }
    };
  },

  subscribeNativeFallDetected(onDetected: (payload: any) => void): () => void {
    const mod = getNativeModule();
    if (!mod) return () => {};
    const emitter = new NativeEventEmitter(mod);
    const sub = emitter.addListener(EVENT_NATIVE_FALL_DETECTED, onDetected);
    return () => {
      try {
        sub.remove();
      } catch {
        // Ignore
      }
    };
  },

  subscribeNativeFallCancelled(onCancelled: () => void): () => void {
    const mod = getNativeModule();
    if (!mod) return () => {};
    const emitter = new NativeEventEmitter(mod);
    const sub = emitter.addListener(EVENT_NATIVE_FALL_CANCELLED, onCancelled);
    return () => {
      try {
        sub.remove();
      } catch {
        // Ignore
      }
    };
  },
};

export default motionSensorService;
