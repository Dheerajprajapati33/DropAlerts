import api from './api';
import { API_ENDPOINTS } from '../config/api.config';
import { getClientDeviceId } from './deviceIdentity';
import {
  FallDetectionStage,
  FallEvent,
  FallSensitivity,
  FallSensorData,
  FallSeverity,
  MotionSample,
  ReportFallPayload,
} from '../types/FallEvent';

const GRAVITY_MS2 = 9.80665;

export interface SensitivityProfile {
  freeFallThresholdG: number;
  minFreeFallMs: number;
  freeFallTimeoutMs: number;
  impactThresholdG: number;
  gyroThresholdRad: number;
  impactWindowMs: number;
  stillnessDurationMs: number;
  cooldownMs: number;
}

export const SENSITIVITY_PROFILES: Record<FallSensitivity, SensitivityProfile> = {
  High: {
    freeFallThresholdG: 0.55,
    minFreeFallMs: 60,
    freeFallTimeoutMs: 900,
    impactThresholdG: 2.2,
    gyroThresholdRad: 1.6,
    impactWindowMs: 300,
    stillnessDurationMs: 1500,
    cooldownMs: 10000,
  },
  Medium: {
    freeFallThresholdG: 0.5,
    minFreeFallMs: 80,
    freeFallTimeoutMs: 900,
    impactThresholdG: 2.8,
    gyroThresholdRad: 2.0,
    impactWindowMs: 300,
    stillnessDurationMs: 1800,
    cooldownMs: 10000,
  },
  Low: {
    freeFallThresholdG: 0.45,
    minFreeFallMs: 100,
    freeFallTimeoutMs: 900,
    impactThresholdG: 3.5,
    gyroThresholdRad: 2.5,
    impactWindowMs: 300,
    stillnessDurationMs: 2000,
    cooldownMs: 10000,
  },
};

export interface FallDetectedResult {
  severity: FallSeverity;
  impactForce: number;
  confidence: number;
  sensorData: FallSensorData;
}

export interface FallDetectorCallbacks {
  onStageChange?: (stage: FallDetectionStage) => void;
  onFallDetected?: (result: FallDetectedResult) => void;
}

export function deriveSeverityFromG(gForce: number): FallSeverity {
  if (gForce >= 4.5) return 'Critical';
  if (gForce >= 3.2) return 'High';
  if (gForce >= 2.5) return 'Medium';
  return 'Low';
}

/**
 * 5-Stage Smartphone Fall Detection State Machine:
 * 1. normal       -> Baseline monitoring (~1.0G)
 * 2. free_fall    -> Low acceleration magnitude (< ~0.5G) sustained for 60-100ms
 * 3. impact       -> Sudden G-force spike + gyroscope rotational movement
 * 4. confirmation -> Post-impact stationary window (low accel variance & low gyro)
 * 5. alert        -> Confirmed fall event emitted to countdown / alert pipeline
 */
export class FallDetectorEngine {
  private sensitivity: FallSensitivity;
  private callbacks: FallDetectorCallbacks;
  private stage: FallDetectionStage = 'normal';

  private freeFallCandidateStartMs: number | null = null;
  private freeFallConfirmedMs: number | null = null;
  private freeFallDurationMs = 0;

  private impactStartMs = 0;
  private peakImpactG = 0;
  private peakRotationRad = 0;
  private peakSample: MotionSample | null = null;

  private confirmationStartMs = 0;
  private stillnessGValues: number[] = [];
  private stillnessGyroValues: number[] = [];
  private activeMovementSamples = 0;

  private cooldownUntilMs = 0;

  constructor(
    sensitivity: FallSensitivity = 'Medium',
    callbacks: FallDetectorCallbacks = {}
  ) {
    this.sensitivity = sensitivity;
    this.callbacks = callbacks;
  }

  setSensitivity(sensitivity: FallSensitivity): void {
    this.sensitivity = sensitivity;
  }

  getStage(): FallDetectionStage {
    return this.stage;
  }

  reset(timestamp?: number): void {
    this.freeFallCandidateStartMs = null;
    this.freeFallConfirmedMs = null;
    this.freeFallDurationMs = 0;
    this.impactStartMs = 0;
    this.peakImpactG = 0;
    this.peakRotationRad = 0;
    this.peakSample = null;
    this.confirmationStartMs = 0;
    this.stillnessGValues = [];
    this.stillnessGyroValues = [];
    this.activeMovementSamples = 0;
    if (timestamp !== undefined) {
      this.cooldownUntilMs = 0;
    }
    this.setStage('normal');
  }

  processSample(sample: MotionSample): FallDetectionStage {
    const profile = SENSITIVITY_PROFILES[this.sensitivity];
    const ts = sample.timestamp;

    if (this.stage === 'alert') {
      if (ts >= this.cooldownUntilMs) {
        this.reset();
      }
      return this.stage;
    }

    if (ts < this.cooldownUntilMs) {
      return this.stage;
    }

    const accelMag = Math.sqrt(
      sample.ax * sample.ax + sample.ay * sample.ay + sample.az * sample.az
    );
    const gForce = accelMag / GRAVITY_MS2;
    const gyroMag = Math.sqrt(
      sample.gx * sample.gx + sample.gy * sample.gy + sample.gz * sample.gz
    );

    switch (this.stage) {
      case 'normal':
        this.handleNormal(sample, gForce, gyroMag, ts, profile);
        break;

      case 'free_fall':
        this.handleFreeFall(sample, gForce, gyroMag, ts, profile);
        break;

      case 'impact':
        this.handleImpact(sample, gForce, gyroMag, ts, profile);
        break;

      case 'confirmation':
        this.handleConfirmation(sample, gForce, gyroMag, ts, profile);
        break;
    }

    return this.stage;
  }

  private handleNormal(
    _sample: MotionSample,
    gForce: number,
    gyroMag: number,
    ts: number,
    profile: SensitivityProfile
  ): void {
    if (gForce <= profile.freeFallThresholdG) {
      if (this.freeFallCandidateStartMs === null) {
        this.freeFallCandidateStartMs = ts;
        this.peakRotationRad = gyroMag;
      } else {
        this.peakRotationRad = Math.max(this.peakRotationRad, gyroMag);
        if (ts - this.freeFallCandidateStartMs >= profile.minFreeFallMs) {
          this.freeFallConfirmedMs = this.freeFallCandidateStartMs;
          this.freeFallDurationMs = ts - this.freeFallCandidateStartMs;
          this.setStage('free_fall');
        }
      }
    } else {
      this.freeFallCandidateStartMs = null;
      this.peakRotationRad = 0;
    }
  }

  private handleFreeFall(
    sample: MotionSample,
    gForce: number,
    gyroMag: number,
    ts: number,
    profile: SensitivityProfile
  ): void {
    this.peakRotationRad = Math.max(this.peakRotationRad, gyroMag);

    if (gForce <= profile.freeFallThresholdG && this.freeFallConfirmedMs !== null) {
      this.freeFallDurationMs = ts - this.freeFallConfirmedMs;
    }

    const freeFallElapsed =
      this.freeFallConfirmedMs !== null ? ts - this.freeFallConfirmedMs : 0;

    if (freeFallElapsed > profile.freeFallTimeoutMs) {
      this.reset();
      return;
    }

    if (gForce >= profile.impactThresholdG) {
      const hasGyro = sample.hasGyroscope !== false;
      const gyroVerified = !hasGyro || this.peakRotationRad >= profile.gyroThresholdRad;

      if (!gyroVerified) {
        // High acceleration spike without rotational tumble (e.g., flat tap)
        return;
      }

      this.impactStartMs = ts;
      this.peakImpactG = gForce;
      this.peakSample = sample;
      this.setStage('impact');
    }
  }

  private handleImpact(
    sample: MotionSample,
    gForce: number,
    gyroMag: number,
    ts: number,
    profile: SensitivityProfile
  ): void {
    this.peakRotationRad = Math.max(this.peakRotationRad, gyroMag);
    if (gForce > this.peakImpactG) {
      this.peakImpactG = gForce;
      this.peakSample = sample;
    }

    if (ts - this.impactStartMs >= profile.impactWindowMs) {
      this.confirmationStartMs = ts;
      this.stillnessGValues = [];
      this.stillnessGyroValues = [];
      this.activeMovementSamples = 0;
      this.setStage('confirmation');
    }
  }

  private handleConfirmation(
    sample: MotionSample,
    gForce: number,
    gyroMag: number,
    ts: number,
    profile: SensitivityProfile
  ): void {
    const elapsed = ts - this.confirmationStartMs;
    const hasGyro = sample.hasGyroscope !== false;

    this.stillnessGValues.push(gForce);
    this.stillnessGyroValues.push(gyroMag);

    const isMovingActively =
      gForce > 1.55 ||
      gForce < 0.65 ||
      (hasGyro && gyroMag > 2.5);

    if (isMovingActively) {
      this.activeMovementSamples += 1;
      // User picked up the phone or kept moving actively -> false alarm
      if (this.activeMovementSamples >= 8) {
        this.reset();
        return;
      }
    }

    if (elapsed < profile.stillnessDurationMs) {
      return;
    }

    if (this.stillnessGValues.length < 5) {
      this.reset();
      return;
    }

    const meanG =
      this.stillnessGValues.reduce((sum, v) => sum + v, 0) /
      this.stillnessGValues.length;
    const varianceG =
      this.stillnessGValues.reduce((sum, v) => sum + (v - meanG) ** 2, 0) /
      this.stillnessGValues.length;
    const stdDevG = Math.sqrt(varianceG);

    const meanGyro =
      this.stillnessGyroValues.reduce((sum, v) => sum + v, 0) /
      this.stillnessGyroValues.length;

    const isStationary =
      meanG >= 0.72 &&
      meanG <= 1.28 &&
      stdDevG <= 0.25 &&
      (!hasGyro || meanGyro <= 1.1);

    if (!isStationary) {
      this.reset();
      return;
    }

    const impactSnapshot = this.peakSample || sample;
    const impactAccelMag = Math.sqrt(
      impactSnapshot.ax ** 2 + impactSnapshot.ay ** 2 + impactSnapshot.az ** 2
    );
    const impactGyroMag = Math.sqrt(
      impactSnapshot.gx ** 2 + impactSnapshot.gy ** 2 + impactSnapshot.gz ** 2
    );

    const roundedPeakG = Number(this.peakImpactG.toFixed(2));
    const roundedPeakGyro = Number(this.peakRotationRad.toFixed(2));
    const stillnessMs = Math.round(elapsed);
    const freeFallMs = Math.round(this.freeFallDurationMs);

    const gMargin = Math.max(0, roundedPeakG - profile.impactThresholdG);
    const confidence = Number(
      Math.min(0.99, 0.78 + gMargin * 0.08 + (hasGyro ? 0.06 : 0)).toFixed(2)
    );

    const result: FallDetectedResult = {
      severity: deriveSeverityFromG(roundedPeakG),
      impactForce: roundedPeakG,
      confidence,
      sensorData: {
        accelerometer: {
          x: Number(impactSnapshot.ax.toFixed(3)),
          y: Number(impactSnapshot.ay.toFixed(3)),
          z: Number(impactSnapshot.az.toFixed(3)),
          magnitude: Number(impactAccelMag.toFixed(3)),
        },
        gyroscope: {
          x: Number(impactSnapshot.gx.toFixed(3)),
          y: Number(impactSnapshot.gy.toFixed(3)),
          z: Number(impactSnapshot.gz.toFixed(3)),
          magnitude: Number(impactGyroMag.toFixed(3)),
        },
        freeFallDurationMs: freeFallMs,
        peakImpactG: roundedPeakG,
        peakRotationRad: roundedPeakGyro,
        postImpactStillnessMs: stillnessMs,
        stagesCompleted: ['normal', 'free_fall', 'impact', 'confirmation', 'alert'],
        timestamp: ts,
      },
    };

    this.cooldownUntilMs = ts + profile.cooldownMs;
    this.setStage('alert');
    this.callbacks.onFallDetected?.(result);
  }

  private setStage(next: FallDetectionStage): void {
    if (this.stage === next) return;
    this.stage = next;
    this.callbacks.onStageChange?.(next);
  }
}

/**
 * Generates a realistic 50Hz synthetic 5-stage fall waveform (normal -> free fall ->
 * impact + rotation -> stationary confirmation) for safe testing without dropping the phone.
 */
export function buildSimulatedFallWaveform(startTimestamp = Date.now()): MotionSample[] {
  const samples: MotionSample[] = [];
  const stepMs = 20;
  let t = startTimestamp;

  const pushSample = (
    ax: number,
    ay: number,
    az: number,
    gx: number,
    gy: number,
    gz: number
  ) => {
    samples.push({
      ax,
      ay,
      az,
      gx,
      gy,
      gz,
      hasGyroscope: true,
      timestamp: t,
    });
    t += stepMs;
  };

  // Stage 1: Normal (~1.0G, 200ms)
  for (let i = 0; i < 10; i++) {
    pushSample(0.2, 0.4, 9.75, 0.05, 0.04, 0.03);
  }

  // Stage 2: Free fall (~0.25G, 200ms) + rotational tumble
  for (let i = 0; i < 10; i++) {
    pushSample(0.8, 1.1, 1.9, 2.4, 1.8, 1.2);
  }

  // Stage 3: Sudden Impact (~3.85G peak, 340ms) + angular spike
  pushSample(16.0, 14.5, 29.8, 3.8, 2.9, 1.5);
  pushSample(11.0, 9.5, 22.0, 2.1, 1.4, 0.8);
  for (let i = 0; i < 15; i++) {
    pushSample(0.9, 1.2, 10.1, 0.25, 0.18, 0.1);
  }

  // Stage 4: Post-impact stillness (~1.0G, 2000ms)
  for (let i = 0; i < 100; i++) {
    pushSample(0.15, 0.25, 9.8, 0.02, 0.01, 0.01);
  }

  return samples;
}

export const fallDetectionService = {
  async reportFall(payload: ReportFallPayload): Promise<FallEvent> {
    const response = await api.post<{ success: boolean; data: FallEvent }>(
      API_ENDPOINTS.FALLS.REPORT,
      {
        ...payload,
        deviceId: payload.deviceId || getClientDeviceId(),
      }
    );
    return response.data.data;
  },

  async getFallHistory(): Promise<FallEvent[]> {
    const response = await api.get<{ success: boolean; data: FallEvent[] }>(
      API_ENDPOINTS.FALLS.HISTORY
    );
    return response.data.data;
  },

  async cancelFalseAlarm(
    fallId: string,
    reason = 'False alarm clicked by user'
  ): Promise<{ success: boolean; id: string }> {
    await api.post(API_ENDPOINTS.FALLS.CANCEL(fallId), { reason });
    return { success: true, id: fallId };
  },

  async acknowledgeFall(fallId: string): Promise<{ success: boolean; id: string }> {
    await api.post(API_ENDPOINTS.FALLS.ACKNOWLEDGE(fallId));
    return { success: true, id: fallId };
  },

  /**
   * Single-sample magnitude helper retained for quick threshold checks.
   */
  evaluateFallThreshold(
    sensorData: { x: number; y: number; z: number },
    sensitivity: FallSensitivity = 'Medium'
  ): { isFall: boolean; gForce: number; confidence: number } {
    const magnitude = Math.sqrt(
      sensorData.x * sensorData.x +
        sensorData.y * sensorData.y +
        sensorData.z * sensorData.z
    );
    const gForce = magnitude / GRAVITY_MS2;

    const threshold = SENSITIVITY_PROFILES[sensitivity].impactThresholdG;
    const isFall = gForce >= threshold;
    const confidence = isFall ? Math.min(1.0, 0.7 + (gForce - threshold) * 0.15) : 0;

    return {
      isFall,
      gForce: parseFloat(gForce.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(2)),
    };
  },
};

export default fallDetectionService;
