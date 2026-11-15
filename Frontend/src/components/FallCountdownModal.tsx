import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { clearPendingFall, reportFallEvent } from '../redux/slices/fallSlice';
import { broadcast100mSOSThunk } from '../redux/slices/nearbyAlertSlice';
import fallMonitorRuntime from '../services/fallMonitorRuntime';
import nearbyAlertService from '../services/nearbyAlertService';
import motionSensorService from '../services/motionSensor';

const COUNTDOWN_SECONDS = 10;

export const FallCountdownModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const pendingFall = useAppSelector((state) => state.fall.pendingFall);
  const vibrationEnabled = useAppSelector((state) => state.notification.vibrationEnabled);
  const isCommunityNetworkActive = useAppSelector(
    (state) => state.nearbyAlert.isCommunityNetworkActive
  );
  const currentCoords = useAppSelector((state) => state.nearbyAlert.currentCoords);
  const userName = useAppSelector((state) => state.auth.user?.name);

  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [isSending, setIsSending] = useState(false);
  const dispatchedRef = useRef<string | null>(null);

  const sendEmergencyFallAlert = async (fallSnapshot: NonNullable<typeof pendingFall>) => {
    if (dispatchedRef.current === fallSnapshot.id) return;
    dispatchedRef.current = fallSnapshot.id;
    setIsSending(true);

    try {
      Vibration.cancel();
    } catch {
      // Ignore
    }

    let resolvedCoords = currentCoords;
    if (!resolvedCoords) {
      try {
        resolvedCoords = await nearbyAlertService.getCurrentLocation();
      } catch {
        resolvedCoords = null;
      }
    }

    const locationStr = resolvedCoords
      ? `${resolvedCoords.latitude.toFixed(5)}, ${resolvedCoords.longitude.toFixed(5)}`
      : undefined;

    try {
      await dispatch(
        reportFallEvent({
          deviceName: userName ? `${userName}'s Phone` : 'Current Device',
          severity: fallSnapshot.severity,
          impactForce: fallSnapshot.impactForce,
          confidence: fallSnapshot.confidence,
          location: locationStr,
          sensorData: fallSnapshot.sensorData,
        })
      ).unwrap();

      if (isCommunityNetworkActive && resolvedCoords) {
        dispatch(
          broadcast100mSOSThunk({
            latitude: resolvedCoords.latitude,
            longitude: resolvedCoords.longitude,
            incidentType: 'fall',
            message: `Confirmed ${fallSnapshot.severity} impact fall (${fallSnapshot.impactForce}G) nearby.`,
            impactG: fallSnapshot.impactForce,
          })
        );
      }
    } catch {
      dispatch(clearPendingFall());
    } finally {
      setIsSending(false);
      fallMonitorRuntime.resetEngine(dispatch);
    }
  };

  useEffect(() => {
    if (!pendingFall) {
      dispatchedRef.current = null;
      setSecondsLeft(COUNTDOWN_SECONDS);
      setIsSending(false);
      try {
        Vibration.cancel();
      } catch {
        // Ignore
      }
      return;
    }

    setSecondsLeft(COUNTDOWN_SECONDS);
    if (vibrationEnabled) {
      try {
        Vibration.vibrate([0, 600, 400], true);
      } catch {
        // Ignore
      }
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          sendEmergencyFallAlert(pendingFall);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      try {
        Vibration.cancel();
      } catch {
        // Ignore
      }
    };
  }, [pendingFall?.id]);

  if (!pendingFall) {
    return null;
  }

  const handleCancelFalseAlarm = () => {
    try {
      Vibration.cancel();
    } catch {
      // Ignore
    }
    motionSensorService.cancelPendingFall('User cancelled in app');
    dispatch(clearPendingFall());
    fallMonitorRuntime.resetEngine(dispatch);
  };

  const handleSendNow = () => {
    sendEmergencyFallAlert(pendingFall);
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={!!pendingFall}
      onRequestClose={handleCancelFalseAlarm}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {pendingFall.isSimulated ? 'SIMULATED 5-STAGE FALL' : 'FALL DETECTED'}
            </Text>
          </View>

          <Text style={styles.title}>Are you okay?</Text>
          <Text style={styles.subtitle}>
            Free fall, impact ({pendingFall.impactForce}G), and stillness confirmed.
            Emergency alert will be sent automatically in:
          </Text>

          <View style={styles.countdownCircle}>
            <Text style={styles.countdownNumber}>{secondsLeft}</Text>
            <Text style={styles.countdownUnit}>SEC</Text>
          </View>

          <View style={styles.telemetryBox}>
            <View style={styles.telemetryRow}>
              <Text style={styles.telemetryLabel}>Severity</Text>
              <Text style={styles.telemetryDanger}>{pendingFall.severity}</Text>
            </View>
            <View style={styles.telemetryRow}>
              <Text style={styles.telemetryLabel}>Impact Peak</Text>
              <Text style={styles.telemetryValue}>{pendingFall.impactForce}G</Text>
            </View>
            <View style={styles.telemetryRow}>
              <Text style={styles.telemetryLabel}>Confidence</Text>
              <Text style={styles.telemetryValue}>
                {Math.round(pendingFall.confidence * 100)}%
              </Text>
            </View>
            <View style={styles.telemetryRow}>
              <Text style={styles.telemetryLabel}>Stages</Text>
              <Text style={styles.telemetryValue}>
                Free Fall → Impact → Stillness
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            activeOpacity={0.85}
            disabled={isSending}
            onPress={handleCancelFalseAlarm}
          >
            <Text style={styles.cancelButtonText}>I'm OK — Cancel Alert</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sendNowButton}
            activeOpacity={0.85}
            disabled={isSending}
            onPress={handleSendNow}
          >
            <Text style={styles.sendNowButtonText}>
              {isSending ? 'Sending Alert...' : 'Send Emergency Alert Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 14,
  },
  badgeText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  countdownCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 3,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 42,
  },
  countdownUnit: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  telemetryBox: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetryLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  telemetryValue: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  telemetryDanger: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelButton: {
    width: '100%',
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  sendNowButton: {
    width: '100%',
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  sendNowButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default FallCountdownModal;
