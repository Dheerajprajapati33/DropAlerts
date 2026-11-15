import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceItem } from '../components/DeviceItem';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { fetchDevices, unpairDevice } from '../redux/slices/deviceSlice';
import { triggerEmergencyAlert } from '../redux/slices/alertSlice';
import deviceService from '../services/deviceService';

interface DeviceData {
  id: string;
  name: string;
  lastActive: string;
  isOnline: boolean;
}

interface ConnectedDevicesScreenProps {
  onBack: () => void;
  onPairNewDevice: () => void;
  onNavigateToHome: () => void;
  onNavigateToHistory: () => void;
  onNavigateToSettings: () => void;
  devicesList?: DeviceData[];
}

export const ConnectedDevicesScreen: React.FC<ConnectedDevicesScreenProps> = ({
  onBack,
  onPairNewDevice,
  onNavigateToHome,
  onNavigateToHistory,
  onNavigateToSettings,
  devicesList,
}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const reduxDevices = useAppSelector((state) => state.device.devices);
  const isLoading = useAppSelector((state) => state.device.isLoading);
  const devices = devicesList ?? reduxDevices;

  const [activeTab, setActiveTab] = useState<'home' | 'devices' | 'history' | 'settings'>('devices');

  useEffect(() => {
    dispatch(fetchDevices());
  }, [dispatch]);

  const handleSendTestAlert = async (device: DeviceData) => {
    try {
      const ping = await deviceService.pingDevice(device.id);
      await dispatch(
        triggerEmergencyAlert({
          title: 'Test Alert',
          message: `Connectivity test alert sent to ${device.name}.`,
          severity: 'Medium',
          type: 'system',
        })
      ).unwrap();
      Alert.alert(
        'Test Alert Sent',
        `${device.name} responded (${ping.latencyMs}ms). Test notification dispatched.`
      );
    } catch (err: any) {
      Alert.alert('Test Failed', err?.message || `Could not reach ${device.name}.`);
    }
  };

  const handleDisconnect = async (device: DeviceData) => {
    try {
      await dispatch(unpairDevice(device.id)).unwrap();
      Alert.alert('Disconnected', `${device.name} unpaired successfully.`);
    } catch (err: any) {
      Alert.alert('Unpair Failed', err?.message || 'Unable to unpair device.');
    }
  };

  const handleDeviceMenu = (device: DeviceData) => {
    Alert.alert(device.name, 'Manage connected device:', [
      { text: 'Send Test Alert', onPress: () => handleSendTestAlert(device) },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => handleDisconnect(device),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <TouchableOpacity activeOpacity={0.7} onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Connected Devices</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPairNewDevice}
          style={styles.addBtn}
        >
          <Text style={styles.addGlyph}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 85, 100) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              dispatch(fetchDevices());
            }}
          />
        }
      >
        <Text style={styles.sectionTitle}>
          Your Connected Devices ({devices.length})
        </Text>

        {devices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Devices Connected Yet</Text>
            <Text style={styles.emptySubtitle}>
              Pair a family member or secondary phone using a QR code or 6-digit code.
            </Text>
          </View>
        ) : (
          devices.map((device) => (
            <DeviceItem
              key={device.id}
              name={device.name}
              lastActive={device.lastActive}
              isOnline={device.isOnline}
              onMenuPress={() => handleDeviceMenu(device)}
            />
          ))
        )}

        <TouchableOpacity
          style={styles.pairNewBtn}
          activeOpacity={0.8}
          onPress={onPairNewDevice}
        >
          <Text style={styles.pairNewText}>+  Pair New Device</Text>
        </TouchableOpacity>
      </ScrollView>

      <View
        style={[
          styles.bottomTabBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            setActiveTab('home');
            onNavigateToHome();
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabGlyph,
              activeTab === 'home' ? styles.tabGlyphActive : styles.tabGlyphInactive,
            ]}
          >
            ⌂
          </Text>
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
          onPress={() => setActiveTab('devices')}
          activeOpacity={0.7}
        >
          <View style={styles.tabIconCircleActive}>
            <Text style={[styles.tabGlyph, styles.tabGlyphActive]}>📱</Text>
          </View>
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Devices</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => {
            setActiveTab('history');
            onNavigateToHistory();
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
            onNavigateToSettings();
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: { fontSize: 28, color: '#0F172A', fontWeight: '300', marginTop: -4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addGlyph: { fontSize: 24, color: '#0F172A', fontWeight: '600', marginTop: -2 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 19 },
  pairNewBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0062FF',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  pairNewText: { color: '#0062FF', fontSize: 16, fontWeight: '700' },
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
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  tabIconCircleActive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabGlyph: { fontSize: 20, lineHeight: 24 },
  tabGlyphActive: { color: '#0062FF', fontWeight: '800' },
  tabGlyphInactive: { color: '#94A3B8' },
  tabLabel: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  tabLabelActive: { color: '#0062FF', fontWeight: '700' },
  tabLabelInactive: { color: '#94A3B8' },
});

export default ConnectedDevicesScreen;
