import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import fallMonitorRuntime from '../services/fallMonitorRuntime';
import motionSensorService from '../services/motionSensor';
import { clearPendingFall, triggerPendingFall } from '../redux/slices/fallSlice';

/**
 * Connects Redux monitoring state & sensitivity to the hardware motion sensor
 * runtime and 5-stage FallDetectorEngine while the user is authenticated,
 * and keeps native Android background configuration in sync.
 */
export function useFallDetector(isAuthenticated: boolean): void {
  const dispatch = useAppDispatch();
  const isMonitoring = useAppSelector((state) => state.fall.isMonitoring);
  const sensitivity = useAppSelector((state) => state.fall.sensitivity);

  useEffect(() => {
    fallMonitorRuntime.updateSensitivity(sensitivity);
    motionSensorService.syncNativeConfig({ sensitivity });
  }, [sensitivity]);

  useEffect(() => {
    motionSensorService.syncNativeConfig({ isMonitoring });
    if (!isAuthenticated || !isMonitoring) {
      fallMonitorRuntime.stop(dispatch);
      return;
    }

    fallMonitorRuntime.start(sensitivity, dispatch);

    return () => {
      fallMonitorRuntime.stop(dispatch);
    };
  }, [isAuthenticated, isMonitoring, dispatch]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubCancelled = motionSensorService.subscribeNativeFallCancelled(() => {
      dispatch(clearPendingFall());
      fallMonitorRuntime.resetEngine(dispatch);
    });

    const unsubDetected = motionSensorService.subscribeNativeFallDetected((evt: any) => {
      if (!evt) return;
      dispatch(
        triggerPendingFall({
          id: `native_${evt.timestamp || Date.now()}`,
          detectedAt: evt.timestamp || Date.now(),
          severity: evt.severity || 'High',
          confidence: evt.confidence || 0.95,
          impactForce: evt.impactForce || 3.0,
          sensorData: {
            timestamp: evt.timestamp || Date.now(),
          },
        })
      );
    });

    return () => {
      unsubCancelled();
      unsubDetected();
    };
  }, [isAuthenticated, dispatch]);
}

export default useFallDetector;
