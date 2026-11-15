import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FallAlertLogo } from '../components/Icons';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import {
  syncCommunityNetworkToggle,
  simulateNearbyTestAlert,
  broadcast100mSOSThunk,
  refreshCurrentLocation,
} from '../redux/slices/nearbyAlertSlice';
import { setMonitoring } from '../redux/slices/fallSlice';
import { triggerEmergencyAlert } from '../redux/slices/alertSlice';
import fallMonitorRuntime from '../services/fallMonitorRuntime';
import motionSensorService from '../services/motionSensor';

interface HomeScreenProps {
  userName?: string;
  onLogout?: () => void;
  onNavigateToDevices?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToSettings?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  userName = 'User',
  onLogout,
  onNavigateToDevices,
  onNavigateToHistory,
  onNavigateToSettings,
}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const authUser = useAppSelector((state) => state.auth.user);
  const devices = useAppSelector((state) => state.device.devices);
  const isMonitoringActive = useAppSelector((state) => state.fall.isMonitoring);
  const sensitivity = useAppSelector((state) => state.fall.sensitivity);
  const detectorStage = useAppSelector((state) => state.fall.detectorStage);
  const sensorAvailable = useAppSelector((state) => state.fall.sensorAvailable);
  const hasGyroscope = useAppSelector((state) => state.fall.hasGyroscope);
  const unreadCount = useAppSelector((state) => state.alert.unreadCount);
  const { isCommunityNetworkActive, isBroadcasting, currentCoords, activeMeshCount, isLocating } =
    useAppSelector((state) => state.nearbyAlert);

  const displayName = authUser?.name || userName || 'User';
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || 'U';
  const [activeTab, setActiveTab] = useState<'home' | 'devices' | 'history' | 'settings'>('home');

  const toggleMonitoring = (val: boolean) => {
    dispatch(setMonitoring(val));
  };

  const handleSimulateFiveStageFall = () => {
    if (!isMonitoringActive) {
      Alert.alert(
        'Monitoring Paused',
        'Please enable Fall Detection first to test the 5-stage fall detector.',
        [{ text: 'OK' }]
      );
      return;
    }
    fallMonitorRuntime.simulateFiveStageFall(sensitivity, dispatch);
  };

  const handleTestNativeLockscreenAlert = () => {
    if (!isMonitoringActive) {
      Alert.alert(
        'Monitoring Paused',
        'Please enable Fall Detection first.',
        [{ text: 'OK' }]
      );
      return;
    }
    motionSensorService.simulateNativeFall();
  };

  const stageLabelMap: Record<string, string> = {
    normal: 'Normal (Monitoring)',
    free_fall: 'Stage 2: Free Fall...',
    impact: 'Stage 3: Impact Spike!',
    confirmation: 'Stage 4: Checking Stillness...',
    alert: 'Stage 5: Alert Triggered',
  };

  const handleToggleCommunity = (val: boolean) => {
    dispatch(syncCommunityNetworkToggle(val));
  };

  const handleTest100mAlert = async () => {
    if (!isCommunityNetworkActive) {
      Alert.alert(
        '3km Network Paused',
        'Please enable the 3km Bystander Network toggle first to receive and test nearby alerts.',
        [{ text: 'OK' }]
      );
      return;
    }
    try {
      await dispatch(simulateNearbyTestAlert(650)).unwrap();
    } catch (err: any) {
      Alert.alert('Location Needed', err?.message || err || 'Please allow GPS location to test nearby alerts.');
    }
  };

  const handleBroadcastSOS = async () => {
    try {
      const nearbyRes = await dispatch(broadcast100mSOSThunk()).unwrap();
      let pairedNote = '';
      if (devices.length > 0) {
        try {
          await dispatch(
            triggerEmergencyAlert({
              title: 'Emergency SOS Triggered',
              message: `${displayName} requested urgent emergency assistance.`,
              severity: 'Critical',
              type: 'emergency',
              location: currentCoords
                ? `${currentCoords.latitude.toFixed(4)}, ${currentCoords.longitude.toFixed(4)}`
                : undefined,
            })
          ).unwrap();
          pairedNote = `\nPaired devices notified: ${devices.length}`;
        } catch {
          // Non-fatal if paired alert fails while nearby succeeds
        }
      }
      Alert.alert(
        '🚨 3km Broadcast Sent',
        `Emergency SOS sent to DropAlert devices within 3 kilometers.\n\nNearby active devices reached: ${nearbyRes.devicesNotified}${pairedNote}`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Broadcast Failed', err?.message || 'Unable to reach backend server.');
    }
  };

  const handleBellPress = () => {
    if (unreadCount > 0 && onNavigateToHistory) {
      onNavigateToHistory();
    } else {
      Alert.alert('FallAlert', 'No new emergency notifications.', [
        ...(onNavigateToHistory
          ? [{ text: 'View History', onPress: onNavigateToHistory }]
          : []),
        { text: 'OK' },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 8, 16),
            paddingBottom: Math.max(insets.bottom + 80, 96),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header Bar */}
        <View style={styles.topHeader}>
          <View style={styles.brandGroup}>
            <FallAlertLogo size={36} />
            <View style={styles.brandTextGroup}>
              <Text style={styles.brandTitle}>
                Fall<Text style={styles.brandAccent}>Alert</Text>
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.bellButton}
            activeOpacity={0.7}
            onPress={handleBellPress}
          >
            <View style={styles.bellIcon}>
              <View style={styles.bellHead} />
              <View style={styles.bellRim} />
              <View style={styles.bellClapper} />
            </View>
            {unreadCount > 0 && (
              <View style={styles.unreadDot}>
                <Text style={styles.unreadDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* User Profile Avatar & Greeting Header */}
        <TouchableOpacity
          style={styles.greetingSection}
          activeOpacity={0.8}
          onPress={onNavigateToSettings}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            </View>
            <View style={styles.avatarStatusDot} />
          </View>
          <View style={styles.greetingTextGroup}>
            <Text style={styles.greetingText}>Hi, {displayName} 👋</Text>
            <Text style={styles.greetingSubText}>
              {isMonitoringActive ? 'Fall protection active' : 'Fall protection paused'} • View profile ›
            </Text>
          </View>
        </TouchableOpacity>

        {/* Central Circular Monitoring Gauge */}
        <View style={styles.gaugeContainer}>
          <View
            style={[
              styles.gaugeArc,
              isMonitoringActive ? styles.gaugeArcActive : styles.gaugeArcInactive,
            ]}
          >
            <View style={styles.gaugeInner}>
              <View style={styles.phoneIcon}>
                <View style={styles.phoneSpeaker} />
                <View style={styles.phoneScreen} />
                <View
                  style={[
                    styles.checkBadge,
                    isMonitoringActive ? styles.checkBadgeActive : styles.checkBadgeInactive,
                  ]}
                >
                  <Text style={styles.checkMark}>{isMonitoringActive ? '✓' : '❚❚'}</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.monitoringTitle}>
            {isMonitoringActive ? 'Monitoring Active' : 'Monitoring Paused'}
          </Text>
          <Text style={styles.monitoringSubtitle}>
            {isMonitoringActive
              ? 'Your phone is being continuously monitored for falls.'
              : 'Fall detection is temporarily paused on this device.'}
          </Text>
        </View>

        {/* Fall Detection Toggle Card */}
        <View style={styles.fallCard}>
          <View style={styles.fallCardHeader}>
            <View style={styles.toggleLeft}>
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: isMonitoringActive ? '#DCFCE7' : '#F1F5F9' },
                ]}
              >
                <Text
                  style={{
                    color: isMonitoringActive ? '#16A34A' : '#64748B',
                    fontSize: 18,
                    fontWeight: '800',
                  }}
                >
                  ✔
                </Text>
              </View>
              <View>
                <Text style={styles.cardTitle}>Fall Detection</Text>
                <Text style={styles.sensorMetaText}>
                  {isMonitoringActive
                    ? `${stageLabelMap[detectorStage] || 'Monitoring'} • ${
                        sensorAvailable
                          ? hasGyroscope
                            ? 'Accel + Gyro 50Hz'
                            : 'Accel 50Hz'
                          : 'Waiting for hardware sensor'
                      }`
                    : 'Sensors paused'}
                </Text>
              </View>
            </View>

            <Switch
              value={isMonitoringActive}
              onValueChange={toggleMonitoring}
              trackColor={{ false: '#CBD5E1', true: '#22C55E' }}
              thumbColor="#FFFFFF"
              style={Platform.OS === 'ios' ? {} : { transform: [{ scale: 1.1 }] }}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.simulateFallBtn, { flex: 1 }]}
              activeOpacity={0.8}
              onPress={handleSimulateFiveStageFall}
            >
              <Text style={styles.simulateFallBtnText}>
                🧪 In-App Demo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.simulateFallBtn,
                { flex: 1, backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
              ]}
              activeOpacity={0.8}
              onPress={handleTestNativeLockscreenAlert}
            >
              <Text style={[styles.simulateFallBtnText, { color: '#DC2626' }]}>
                🔔 Lock-Screen Demo
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Row */}
        <View style={styles.metricRow}>
          <TouchableOpacity
            style={[styles.card, styles.metricCard]}
            activeOpacity={0.8}
            onPress={onNavigateToSettings}
          >
            <View style={styles.metricIconWrapBlue}>
              <Text style={styles.waveGlyph}>〰</Text>
            </View>
            <View style={styles.metricTextGroup}>
              <Text style={styles.metricLabel}>Sensitivity</Text>
              <Text style={styles.metricValue}>{sensitivity}</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.card, styles.metricCard]}>
            <View
              style={[
                styles.metricIconWrapGreen,
                !isMonitoringActive && styles.metricIconWrapPaused,
              ]}
            >
              <View style={styles.batteryIconBody}>
                <View
                  style={[
                    styles.batteryLevel,
                    !isMonitoringActive && { backgroundColor: '#94A3B8' },
                  ]}
                />
              </View>
              <View style={styles.batteryCap} />
            </View>
            <View style={styles.metricTextGroup}>
              <Text style={styles.metricLabel}>Status</Text>
              <Text
                style={[styles.metricValue, !isMonitoringActive && { color: '#64748B' }]}
              >
                {isMonitoringActive ? 'Running' : 'Paused'}
              </Text>
            </View>
          </View>
        </View>

        {/* Connected Devices Card */}
        <TouchableOpacity
          style={[styles.card, styles.devicesCard]}
          activeOpacity={0.8}
          onPress={onNavigateToDevices}
        >
          <View style={styles.devicesLeft}>
            <View style={styles.usersIconBadge}>
              <Text style={styles.usersGlyph}>👥</Text>
            </View>
            <Text style={styles.cardTitle}>Connected Devices ({devices.length})</Text>
          </View>
          <Text style={styles.chevronRight}>›</Text>
        </TouchableOpacity>

        {/* 3km Bystander Community Network Card */}
        <View style={[styles.card, styles.proximityCard]}>
          <View style={styles.proximityHeader}>
            <View style={styles.proximityLeft}>
              <View style={styles.proximityIconBadge}>
                <Text style={styles.proximityGlyph}>🛡️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>3km Bystander Network</Text>
                <Text style={styles.proximitySubtitle}>
                  {isCommunityNetworkActive
                    ? `Active • Alerting devices within ~3km${
                        activeMeshCount !== null ? ` (${activeMeshCount} nearby)` : ''
                      }`
                    : 'Disabled • Not listening to nearby devices'}
                </Text>
              </View>
            </View>
            <Switch
              value={isCommunityNetworkActive}
              onValueChange={handleToggleCommunity}
              trackColor={{ false: '#CBD5E1', true: '#0062FF' }}
              thumbColor="#FFFFFF"
              style={Platform.OS === 'ios' ? {} : { transform: [{ scale: 1.05 }] }}
            />
          </View>

          <View style={styles.bystanderInfoBox}>
            <Text style={styles.bystanderInfoText}>
              💡 <Text style={{ fontWeight: '700' }}>No pairing needed:</Text> Even if other users haven't paired with you, if they have DropAlert installed, any emergency within ~3km will alert both of you.
            </Text>
            {currentCoords ? (
              <TouchableOpacity
                onPress={() => dispatch(refreshCurrentLocation())}
                activeOpacity={0.7}
              >
                <Text style={styles.gpsCoordsText}>
                  📍 Location: {currentCoords.latitude.toFixed(4)}°N, {currentCoords.longitude.toFixed(4)}°E (Safety Radius: 3km)
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => dispatch(refreshCurrentLocation())}
                activeOpacity={0.7}
              >
                <Text style={[styles.gpsCoordsText, styles.gpsCoordsAcquiring]}>
                  {isLocating
                    ? '📍 Acquiring real GPS location...'
                    : '📍 Location: Tap to acquire GPS location 🔄'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.proximityActionRow}>
            <TouchableOpacity
              style={styles.testAlertBtn}
              activeOpacity={0.8}
              onPress={handleTest100mAlert}
            >
              <Text style={styles.testAlertBtnText}>🔔 Test 3km Alert</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.broadcastSosBtn, isBroadcasting && { opacity: 0.7 }]}
              activeOpacity={0.8}
              disabled={isBroadcasting}
              onPress={handleBroadcastSOS}
            >
              <Text style={styles.broadcastSosBtnText}>
                {isBroadcasting ? 'Broadcasting...' : '🚨 Broadcast 3km SOS'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {onLogout ? (
          <TouchableOpacity
            style={styles.signOutCard}
            onPress={onLogout}
            activeOpacity={0.8}
          >
            <View style={styles.signOutLeft}>
              <View style={styles.signOutIconBadge}>
                <Text style={styles.signOutGlyph}>⎋</Text>
              </View>
              <Text style={styles.signOutTitle}>Sign Out</Text>
            </View>
            <Text style={styles.signOutArrow}>›</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View
        style={[
          styles.bottomTabBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('home')}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.tabIconCircle,
              activeTab === 'home' && styles.tabIconCircleActive,
            ]}
          >
            <Text
              style={[
                styles.tabGlyph,
                activeTab === 'home' ? styles.tabGlyphActive : styles.tabGlyphInactive,
              ]}
            >
              ⌂
            </Text>
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'home' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            setActiveTab('devices');
            if (onNavigateToDevices) onNavigateToDevices();
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabGlyph,
              activeTab === 'devices' ? styles.tabGlyphActive : styles.tabGlyphInactive,
            ]}
          >
            📱
          </Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'devices' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Devices
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            setActiveTab('history');
            if (onNavigateToHistory) onNavigateToHistory();
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabGlyph,
              activeTab === 'history' ? styles.tabGlyphActive : styles.tabGlyphInactive,
            ]}
          >
            ⏱
          </Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'history' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            setActiveTab('settings');
            if (onNavigateToSettings) onNavigateToSettings();
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabGlyph,
              activeTab === 'settings' ? styles.tabGlyphActive : styles.tabGlyphInactive,
            ]}
          >
            ⚙
          </Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'settings' ? styles.tabLabelActive : styles.tabLabelInactive,
            ]}
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  scrollContent: { paddingHorizontal: 20 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandTextGroup: { justifyContent: 'center' },
  brandTitle: { fontSize: 25, fontWeight: '800', color: '#0F172A', letterSpacing: 0.3 },
  brandAccent: { color: '#0062FF' },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadDotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  bellIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  bellHead: {
    width: 15,
    height: 13,
    borderTopLeftRadius: 7.5,
    borderTopRightRadius: 7.5,
    borderWidth: 2,
    borderColor: '#0062FF',
    borderBottomWidth: 0,
  },
  bellRim: { width: 20, height: 3, borderRadius: 1.5, backgroundColor: '#0062FF' },
  bellClapper: {
    width: 4.5,
    height: 3.5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: '#0062FF',
    marginTop: 1,
  },
  greetingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    gap: 14,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: { position: 'relative' },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0062FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarInitial: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  avatarStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2.2,
    borderColor: '#FFFFFF',
  },
  greetingTextGroup: { flex: 1, justifyContent: 'center' },
  greetingText: { fontSize: 19, fontWeight: '800', color: '#0F172A', letterSpacing: 0.2 },
  greetingSubText: { fontSize: 12.5, color: '#64748B', fontWeight: '500', marginTop: 2 },
  gaugeContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  gaugeArc: {
    width: 216,
    height: 216,
    borderRadius: 108,
    borderWidth: 5.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  gaugeArcActive: {
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },
  gaugeArcInactive: { borderColor: '#CBD5E1', opacity: 0.6 },
  gaugeInner: {
    width: 174,
    height: 174,
    borderRadius: 87,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneIcon: {
    width: 64,
    height: 104,
    borderRadius: 15,
    borderWidth: 3.2,
    borderColor: '#0062FF',
    backgroundColor: '#FFFFFF',
    padding: 3,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  phoneSpeaker: {
    width: 18,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#0062FF',
    marginTop: 2,
  },
  phoneScreen: {
    flex: 1,
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginTop: 4,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -6,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  checkBadgeActive: { backgroundColor: '#10B981' },
  checkBadgeInactive: { backgroundColor: '#EF4444' },
  checkMark: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  monitoringTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  monitoringSubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 21,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  fallCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  fallCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sensorMetaText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  simulateFallBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  simulateFallBtnText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 17.5, fontWeight: '700', color: '#0F172A' },
  metricRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  metricCard: { flex: 1, marginBottom: 0, justifyContent: 'flex-start', gap: 12 },
  metricIconWrapBlue: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveGlyph: { color: '#2563EB', fontSize: 20, fontWeight: '900' },
  metricIconWrapGreen: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DCFCE7',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricIconWrapPaused: { backgroundColor: '#F1F5F9' },
  batteryIconBody: {
    width: 20,
    height: 12,
    borderRadius: 3,
    borderWidth: 1.8,
    borderColor: '#16A34A',
    padding: 1.5,
  },
  batteryLevel: { flex: 1, backgroundColor: '#16A34A', borderRadius: 1.2 },
  batteryCap: {
    width: 2.2,
    height: 6,
    backgroundColor: '#16A34A',
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
  },
  metricTextGroup: { justifyContent: 'center' },
  metricLabel: { fontSize: 12.5, color: '#64748B', fontWeight: '500', marginBottom: 2 },
  metricValue: { fontSize: 16.5, fontWeight: '800', color: '#0F172A' },
  devicesCard: { marginBottom: 14 },
  devicesLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  usersIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  usersGlyph: { fontSize: 19 },
  chevronRight: { fontSize: 24, color: '#0062FF', fontWeight: '700' },
  proximityCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
    backgroundColor: '#F8FAFC',
    marginBottom: 14,
  },
  proximityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  proximityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  proximityIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proximityGlyph: { fontSize: 20 },
  proximitySubtitle: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '500' },
  bystanderInfoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    width: '100%',
  },
  bystanderInfoText: { fontSize: 12, color: '#1E3A8A', lineHeight: 18 },
  gpsCoordsText: { fontSize: 11, color: '#2563EB', fontWeight: '700', marginTop: 6 },
  gpsCoordsAcquiring: { color: '#0062FF' },
  proximityActionRow: { flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' },
  testAlertBtn: {
    flex: 1,
    backgroundColor: '#0062FF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  testAlertBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  broadcastSosBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  broadcastSosBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  signOutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  signOutLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  signOutIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutGlyph: { color: '#EF4444', fontSize: 20, fontWeight: '800' },
  signOutTitle: { fontSize: 17, fontWeight: '700', color: '#EF4444' },
  signOutArrow: { fontSize: 24, color: '#EF4444', fontWeight: '700' },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  tabIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconCircleActive: { backgroundColor: '#EFF6FF' },
  tabGlyph: { fontSize: 20, lineHeight: 24 },
  tabGlyphActive: { color: '#0062FF', fontWeight: '800' },
  tabGlyphInactive: { color: '#94A3B8' },
  tabLabel: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  tabLabelActive: { color: '#0062FF', fontWeight: '700' },
  tabLabelInactive: { color: '#94A3B8' },
});

export default HomeScreen;
