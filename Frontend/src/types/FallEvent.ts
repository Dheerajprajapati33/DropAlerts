export type FallSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type FallStatus = 'detected' | 'acknowledged' | 'cancelled' | 'resolved';
export type FallSensitivity = 'Low' | 'Medium' | 'High';

export type FallDetectionStage =
  | 'normal'
  | 'free_fall'
  | 'impact'
  | 'confirmation'
  | 'alert';

export interface MotionSample {
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
  timestamp: number;
  hasGyroscope?: boolean;
}

export interface FallSensorData {
  accelerometer?: {
    x: number;
    y: number;
    z: number;
    magnitude: number;
  };
  gyroscope?: {
    x: number;
    y: number;
    z: number;
    magnitude?: number;
  };
  freeFallDurationMs?: number;
  peakImpactG?: number;
  peakRotationRad?: number;
  postImpactStillnessMs?: number;
  stagesCompleted?: FallDetectionStage[];
  timestamp: number;
}

export interface PendingFallAlert {
  id: string;
  detectedAt: number;
  severity: FallSeverity;
  confidence: number;
  impactForce: number;
  sensorData: FallSensorData;
  isSimulated?: boolean;
}

export interface FallEvent {
  id: string;
  userId?: string;
  deviceId?: string;
  deviceName?: string;
  timestamp: string;
  severity: FallSeverity;
  confidence: number; // 0.0 to 1.0
  impactForce?: number; // In Gs (e.g. 3.8G)
  location?: string;
  status: FallStatus;
  sensorData?: FallSensorData;
  notes?: string;
}

export interface ReportFallPayload {
  deviceId?: string;
  deviceName?: string;
  severity?: FallSeverity;
  impactForce?: number;
  location?: string;
  confidence?: number;
  sensorData?: FallSensorData;
}
