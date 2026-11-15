import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { Coordinates } from '../types/NearbyAlert';

const { LocationModule } = NativeModules;

const locationEmitter =
  Platform.OS === 'android' && LocationModule
    ? new NativeEventEmitter(LocationModule)
    : null;

export interface LocationOptions {
  timeout?: number;
  maximumAge?: number;
  highAccuracy?: boolean;
}

export const locationService = {
  isSupportedPlatform(): boolean {
    return Platform.OS === 'android' && LocationModule !== null;
  },

  async isLocationEnabled(): Promise<boolean> {
    if (LocationModule?.isLocationEnabled) {
      try {
        return Boolean(await LocationModule.isLocationEnabled());
      } catch {
        return false;
      }
    }
    return true;
  },

  async openLocationSettings(): Promise<boolean> {
    if (LocationModule?.openLocationSettings) {
      try {
        return Boolean(await LocationModule.openLocationSettings());
      } catch {
        return false;
      }
    }
    return false;
  },

  async getCurrentLocation(options?: LocationOptions): Promise<Coordinates> {
    // 1. Android Native LocationModule (GPS + Network triangulated)
    if (LocationModule?.getCurrentLocation) {
      const res = await LocationModule.getCurrentLocation({
        timeout: options?.timeout ?? 12000,
        maximumAge: options?.maximumAge ?? 15000,
      });

      if (res && typeof res.latitude === 'number' && typeof res.longitude === 'number') {
        return {
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy ?? 10,
          altitude: res.altitude,
          speed: res.speed,
          timestamp: res.timestamp ?? Date.now(),
        };
      }
    }

    // 2. Web fallback (if running in browser preview)
    const nav = typeof globalThis !== 'undefined' ? (globalThis as any).navigator : undefined;
    if (nav && 'geolocation' in nav) {
      return new Promise<Coordinates>((resolve, reject) => {
        nav.geolocation.getCurrentPosition(
          (pos: any) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              altitude: pos.coords.altitude,
              speed: pos.coords.speed,
              timestamp: pos.timestamp || Date.now(),
            });
          },
          (err: any) => {
            reject(new Error(err?.message || 'Failed to acquire location'));
          },
          {
            enableHighAccuracy: options?.highAccuracy ?? true,
            timeout: options?.timeout ?? 12000,
            maximumAge: options?.maximumAge ?? 15000,
          }
        );
      });
    }

    throw new Error('Location services are not available on this device');
  },

  startLocationUpdates(
    onLocation: (coords: Coordinates) => void,
    intervalMs = 15000,
    minDistanceMeters = 15
  ): () => void {
    if (LocationModule?.startLocationUpdates && locationEmitter) {
      LocationModule.startLocationUpdates(intervalMs, minDistanceMeters).catch(
        (err: any) => console.warn('startLocationUpdates error:', err)
      );

      const sub = locationEmitter.addListener('onLocationChange', (res: any) => {
        if (res && typeof res.latitude === 'number' && typeof res.longitude === 'number') {
          onLocation({
            latitude: res.latitude,
            longitude: res.longitude,
            accuracy: res.accuracy ?? 10,
            altitude: res.altitude,
            speed: res.speed,
            timestamp: res.timestamp ?? Date.now(),
          });
        }
      });

      return () => {
        sub.remove();
        LocationModule?.stopLocationUpdates?.().catch(() => {});
      };
    }

    return () => {};
  },
};

export default locationService;
