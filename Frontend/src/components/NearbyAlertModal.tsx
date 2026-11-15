import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Vibration,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { dismissIncomingAlert } from '../redux/slices/nearbyAlertSlice';

export const NearbyAlertModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const incomingAlert = useAppSelector((state) => state.nearbyAlert.incomingAlert);

  if (!incomingAlert) {
    return null;
  }

  // Trigger brief vibration alert when incoming alert is received
  try {
    Vibration.vibrate([0, 500, 200, 500]);
  } catch {
    // ignore
  }

  const handleOpenMaps = () => {
    const lat = incomingAlert.latitude;
    const lng = incomingAlert.longitude;
    const label = encodeURIComponent('Nearby Emergency - Person Fallen');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
    }) || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    Linking.openURL(url).catch((err) =>
      console.warn('Could not open map URL:', err)
    );
  };

  const handleCallEmergency = () => {
    Linking.openURL('tel:112').catch((err) =>
      console.warn('Could not open dialer:', err)
    );
  };

  const handleDismiss = () => {
    dispatch(dismissIncomingAlert());
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={!!incomingAlert}
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.cardContainer}>
          {/* Header Badge */}
          <View style={styles.topBadgeRow}>
            <View style={styles.flashingBadge}>
              <Text style={styles.flashingDot}>●</Text>
              <Text style={styles.flashingText}>3KM BYSTANDER SOS</Text>
            </View>
            <Text style={styles.distancePill}>
              📍 ~{incomingAlert.distanceMeters >= 1000
                ? `${(incomingAlert.distanceMeters / 1000).toFixed(1)}km`
                : `${incomingAlert.distanceMeters}m`} away
            </Text>
          </View>

          {/* Title & Icon */}
          <View style={styles.titleSection}>
            <Text style={styles.sirenIcon}>🚨</Text>
            <Text style={styles.titleText}>Nearby Fall Detected!</Text>
            <Text style={styles.subtitleText}>
              A person has suffered a high-impact fall right near your current location.
            </Text>
          </View>

          {/* Details Box */}
          <View style={styles.detailsBox}>
            {/* Dedicated Alert Box for Device Not Paired Status */}
            <View style={styles.unpairedAlertBox}>
              <View style={styles.unpairedBadgeHeader}>
                <Text style={styles.unpairedBadgeDot}>🛡️</Text>
                <Text style={styles.unpairedBadgeText}>
                  Device Not Paired (Community Alert)
                </Text>
              </View>
              <Text style={styles.unpairedBadgeSubtext}>
                Unpaired device alert received because you are within ~3km.
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Safety Distance:</Text>
              <Text style={styles.detailValue}>
                {incomingAlert.distanceMeters >= 1000
                  ? `${(incomingAlert.distanceMeters / 1000).toFixed(1)} km`
                  : `${incomingAlert.distanceMeters} meters`} (within 3km range)
              </Text>
            </View>

            {incomingAlert.impactG ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Impact Force:</Text>
                <Text style={styles.detailValueDanger}>
                  {incomingAlert.impactG}G (Severe Impact)
                </Text>
              </View>
            ) : null}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Time:</Text>
              <Text style={styles.detailValue}>{incomingAlert.timestamp}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.mapButton}
              activeOpacity={0.8}
              onPress={handleOpenMaps}
            >
              <Text style={styles.mapButtonText}>🧭 Open Map / Locate (~{incomingAlert.distanceMeters}m)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.callButton}
              activeOpacity={0.8}
              onPress={handleCallEmergency}
            >
              <Text style={styles.callButtonText}>📞 Call Emergency (112)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissButton}
              activeOpacity={0.7}
              onPress={handleDismiss}
            >
              <Text style={styles.dismissButtonText}>Dismiss / I am Responding</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 2,
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 20,
  },
  topBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  flashingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  flashingDot: {
    color: '#EF4444',
    fontSize: 12,
    marginRight: 6,
  },
  flashingText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  distancePill: {
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '700',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sirenIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitleText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  detailsBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  unpairedAlertBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  unpairedBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  unpairedBadgeDot: {
    fontSize: 14,
  },
  unpairedBadgeText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  unpairedBadgeSubtext: {
    color: '#94A3B8',
    fontSize: 11.5,
    lineHeight: 16,
    marginLeft: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  detailLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  detailValue: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  detailValueHighlight: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  detailValueDanger: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
  actionButtonsContainer: {
    gap: 10,
  },
  mapButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  mapButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  callButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dismissButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default NearbyAlertModal;
