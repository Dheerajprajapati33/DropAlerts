import { AppDispatch } from '../redux/store';
import {
  setDetectorStage,
  setSensorAvailability,
  triggerPendingFall,
} from '../redux/slices/fallSlice';
import {
  buildSimulatedFallWaveform,
  FallDetectedResult,
  FallDetectorEngine,
} from './fallDetection';
import motionSensorService from './motionSensor';
import { FallDetectionStage, FallSensitivity } from '../types/FallEvent';

class FallMonitorRuntime {
  private engine: FallDetectorEngine | null = null;
  private unsubscribeSensor: (() => void) | null = null;
  private simulationTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private activeDispatch: AppDispatch | null = null;

  private ensureEngine(sensitivity: FallSensitivity, dispatch: AppDispatch): FallDetectorEngine {
    this.activeDispatch = dispatch;
    if (!this.engine) {
      this.engine = new FallDetectorEngine(sensitivity, {
        onStageChange: (stage: FallDetectionStage) => {
          this.activeDispatch?.(setDetectorStage(stage));
        },
        onFallDetected: (result: FallDetectedResult) => {
          this.activeDispatch?.(
            triggerPendingFall({
              id: `pending_${Date.now()}`,
              detectedAt: Date.now(),
              severity: result.severity,
              confidence: result.confidence,
              impactForce: result.impactForce,
              sensorData: result.sensorData,
            })
          );
        },
      });
    } else {
      this.engine.setSensitivity(sensitivity);
    }
    return this.engine;
  }

  async start(sensitivity: FallSensitivity, dispatch: AppDispatch): Promise<void> {
    const engine = this.ensureEngine(sensitivity, dispatch);

    if (this.isRunning) {
      return;
    }

    const availability = await motionSensorService.isAvailable();
    dispatch(setSensorAvailability(availability));

    if (!motionSensorService.isSupportedPlatform() || !availability.accelerometer) {
      return;
    }

    this.isRunning = true;
    this.unsubscribeSensor = motionSensorService.subscribe((sample) => {
      engine.processSample(sample);
    });

    const started = await motionSensorService.startMonitoring(20);
    if (!started) {
      this.stop(dispatch);
    }
  }

  stop(dispatch?: AppDispatch): void {
    this.stopSimulation();
    if (this.unsubscribeSensor) {
      this.unsubscribeSensor();
      this.unsubscribeSensor = null;
    }
    if (this.isRunning) {
      this.isRunning = false;
      motionSensorService.stopMonitoring();
    }
    this.engine?.reset();
    (dispatch || this.activeDispatch)?.(setDetectorStage('normal'));
  }

  updateSensitivity(sensitivity: FallSensitivity): void {
    this.engine?.setSensitivity(sensitivity);
  }

  resetEngine(dispatch?: AppDispatch): void {
    this.engine?.reset(Date.now());
    (dispatch || this.activeDispatch)?.(setDetectorStage('normal'));
  }

  stopSimulation(): void {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
  }

  /**
   * Feeds a realistic 5-stage synthetic waveform through FallDetectorEngine at 50Hz
   * (accelerated 4x so full simulation finishes in ~0.7s) for safe end-to-end testing.
   */
  simulateFiveStageFall(sensitivity: FallSensitivity, dispatch: AppDispatch): void {
    this.stopSimulation();
    const simEngine = new FallDetectorEngine(sensitivity, {
      onStageChange: (stage: FallDetectionStage) => {
        dispatch(setDetectorStage(stage));
      },
      onFallDetected: (result: FallDetectedResult) => {
        dispatch(
          triggerPendingFall({
            id: `sim_${Date.now()}`,
            detectedAt: Date.now(),
            severity: result.severity,
            confidence: result.confidence,
            impactForce: result.impactForce,
            sensorData: result.sensorData,
            isSimulated: true,
          })
        );
      },
    });

    const samples = buildSimulatedFallWaveform(Date.now());
    let idx = 0;

    this.simulationTimer = setInterval(() => {
      // Process 4 samples per 20ms tick (~0.65s total for full 5-stage sequence)
      for (let i = 0; i < 4 && idx < samples.length; i++) {
        simEngine.processSample(samples[idx]);
        idx += 1;
      }
      if (idx >= samples.length) {
        this.stopSimulation();
      }
    }, 20);
  }
}

export const fallMonitorRuntime = new FallMonitorRuntime();
export default fallMonitorRuntime;
