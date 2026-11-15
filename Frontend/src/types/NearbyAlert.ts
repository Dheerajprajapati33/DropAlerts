export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  speed?: number | null;
  timestamp?: number;
}

export type NearbyIncidentType = 'fall' | 'sos' | 'emergency';

export interface NearbyAlert {
  id: string;
  incidentType: NearbyIncidentType;
  title: string;
  message: string;
  latitude: number;
  longitude: number;
  distanceMeters: number; // e.g. 68m away (<= 100m)
  approxLocation: string; // e.g. "Main Street near Park"
  timestamp: string;
  isPaired: false; // Indicates this is an un-paired bystander community alert
  impactG?: number; // e.g. 3.9G impact for falls
  victimDeviceId?: string;
  batteryLevel?: number;
}

export interface BroadcastPayload {
  latitude: number;
  longitude: number;
  radiusMeters?: number; // Default 3000 meters (3km)
  incidentType?: NearbyIncidentType;
  message?: string;
  impactG?: number;
}
