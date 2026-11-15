import { PermissionsAndroid, Platform } from 'react-native';
import api from './api';
import { API_ENDPOINTS } from '../config/api.config';
import { getClientDeviceId } from './deviceIdentity';
import { Coordinates, NearbyAlert, BroadcastPayload } from '../types/NearbyAlert';
import locationService from './locationService';

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const nearbyAlertService = {
  async requestProximityPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const permissionsToRequest = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ];

        if (
          Platform.Version >= 33 &&
          (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS
        ) {
          permissionsToRequest.push(
            (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS
          );
        }

        const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);

        const fineGranted =
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const coarseGranted =
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;

        return fineGranted || coarseGranted;
      } catch (err) {
        console.warn('Error requesting location permissions:', err);
        return false;
      }
    }
    return true;
  },

  async isLocationEnabled(): Promise<boolean> {
    return locationService.isLocationEnabled();
  },

  async openLocationSettings(): Promise<boolean> {
    return locationService.openLocationSettings();
  },

  async getCurrentLocation(): Promise<Coordinates> {
    return locationService.getCurrentLocation({
      timeout: 12000,
      maximumAge: 15000,
      highAccuracy: true,
    });
  },

  watchLocation(
    onLocation: (coords: Coordinates) => void,
    intervalMs = 15000,
    minDistanceMeters = 20
  ): () => void {
    return locationService.startLocationUpdates(onLocation, intervalMs, minDistanceMeters);
  },

  async syncLocationToBackend(
    coords: Coordinates,
    fcmToken?: string | null,
    isActive = true
  ): Promise<boolean> {
    const resolvedToken =
      fcmToken && fcmToken.trim() ? fcmToken.trim() : `guest_${getClientDeviceId()}`;
    await api.post(API_ENDPOINTS.NEARBY.UPDATE_LOCATION, {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      fcmToken: resolvedToken,
      radiusPreferenceMeters: 3000,
      isActive,
      timestamp: new Date().toISOString(),
    });
    return true;
  },

  async broadcast100mSOS(
    payload: BroadcastPayload & { senderFcmToken?: string | null }
  ): Promise<{ success: boolean; devicesNotified: number; alertId?: string }> {
    const response = await api.post<{
      success: boolean;
      devicesNotified: number;
      alertId?: string;
    }>(API_ENDPOINTS.NEARBY.BROADCAST_100M, {
      ...payload,
      radiusMeters: payload.radiusMeters || 3000,
    });
    return response.data;
  },

  async getActiveCount(
    coords?: Coordinates | null,
    radiusMeters = 3000
  ): Promise<{ activeCount: number; radiusMeters: number }> {
    const response = await api.get<{
      success: boolean;
      activeCount: number;
      radiusMeters: number;
    }>(API_ENDPOINTS.NEARBY.ACTIVE_COUNT, {
      params: {
        radiusMeters,
        ...(coords
          ? { latitude: coords.latitude, longitude: coords.longitude }
          : {}),
      },
    });
    return {
      activeCount: response.data.activeCount,
      radiusMeters: response.data.radiusMeters,
    };
  },

  createMockNearbyAlert(userCoords: Coordinates, distanceMeters = 650): NearbyAlert {
    const latOffset = (distanceMeters / 111111) * (Math.random() > 0.5 ? 1 : -1);
    const lonOffset =
      (distanceMeters /
        (111111 * Math.cos((userCoords.latitude * Math.PI) / 180))) *
      (Math.random() > 0.5 ? 1 : -1);

    const distText =
      distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(1)}km`
        : `${distanceMeters}m`;

    return {
      id: 'nearby_' + Date.now(),
      incidentType: 'fall',
      title: '🚨 Nearby Emergency: Fall Detected!',
      message:
        'A person has experienced a hard fall near your location. Assistance may be needed.',
      latitude: userCoords.latitude + latOffset,
      longitude: userCoords.longitude + lonOffset,
      distanceMeters,
      approxLocation: `Within ~${distText} (Near your vicinity)`,
      timestamp: 'Just now',
      isPaired: false,
      impactG: 3.9,
      victimDeviceId: 'Device #8492 (Unpaired Bystander)',
      batteryLevel: 82,
    };
  },
};

export default nearbyAlertService;
