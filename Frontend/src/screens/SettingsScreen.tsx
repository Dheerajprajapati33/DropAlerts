import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Switch,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { syncCommunityNetworkToggle } from '../redux/slices/nearbyAlertSlice';
import { deleteUserAccount, updateUserProfile } from '../redux/slices/authSlice';
import { setSensitivity } from '../redux/slices/fallSlice';
import {
  setAlertSoundEnabled,
  setVibrationEnabled,
} from '../redux/slices/notificationSlice';
import { resetDevices, updateSelfDeviceSettings } from '../redux/slices/deviceSlice';
import { resetAlerts } from '../redux/slices/alertSlice';
import { resetFalls } from '../redux/slices/fallSlice';

interface SettingsScreenProps {
  onBack: () => void;
  onNavigateToHome: () => void;
  onNavigateToDevices: () => void;
  onNavigateToHistory: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToDevices,
  onNavigateToHistory,
}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const user = useAppSelector((state) => state.auth.user);
  const isAuthLoading = useAppSelector((state) => state.auth.isLoading);
  const sensitivity = useAppSelector((state) => state.fall.sensitivity);
  const alertSound = useAppSelector((state) => state.notification.alertSoundEnabled);
  const vibration = useAppSelector((state) => state.notification.vibrationEnabled);
  const isCommunityNetworkActive = useAppSelector(
    (state) => state.nearbyAlert.isCommunityNetworkActive
  );

  const [activeTab, setActiveTab] = useState<'home' | 'devices' | 'history' | 'settings'>('settings');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formName, setFormName] = useState(user?.name || '');
  const [formEmail, setFormEmail] = useState(user?.email || '');
  const [formPhone, setFormPhone] = useState(user?.phone || '');
  const [formEmergencyName, setFormEmergencyName] = useState(
    user?.emergencyContacts?.[0]?.name || ''
  );
  const [formEmergencyPhone, setFormEmergencyPhone] = useState(
    user?.emergencyContacts?.[0]?.phone || ''
  );

  const openEditModal = () => {
    setFormName(user?.name || '');
    setFormEmail(user?.email || '');
    setFormPhone(user?.phone || '');
    setFormEmergencyName(user?.emergencyContacts?.[0]?.name || '');
    setFormEmergencyPhone(user?.emergencyContacts?.[0]?.phone || '');
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!formName.trim()) {
      Alert.alert('Validation Error', 'Full Name cannot be empty.');
      return;
    }
    try {
      const emergencyContacts =
        formEmergencyName.trim() && formEmergencyPhone.trim()
          ? [
              {
                name: formEmergencyName.trim(),
                phone: formEmergencyPhone.trim(),
                relation: 'Emergency',
                isPrimary: true,
              },
            ]
          : undefined;

      await dispatch(
        updateUserProfile({
          name: formName.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
          ...(emergencyContacts ? { emergencyContacts } : {}),
        })
      ).unwrap();

      setIsEditModalOpen(false);
      Alert.alert(
        'Profile Updated 🎉',
        'Your profile has been successfully saved to your account.'
      );
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Unable to update profile.');
    }
  };

  const handleSensitivityChange = (level: 'Low' | 'Medium' | 'High') => {
    dispatch(setSensitivity(level));
    dispatch(
      updateSelfDeviceSettings({
        sensitivity: level.toLowerCase() as 'low' | 'medium' | 'high',
      })
    );
  };

  const handleSensitivitySelect = () => {
    Alert.alert('Fall Detection Sensitivity', 'Select sensor threshold sensitivity:', [
      { text: 'Low (Less sensitive to drops)', onPress: () => handleSensitivityChange('Low') },
      { text: 'Medium (Recommended)', onPress: () => handleSensitivityChange('Medium') },
      { text: 'High (Triggers on slight falls)', onPress: () => handleSensitivityChange('High') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSoundToggle = (val: boolean) => {
    dispatch(setAlertSoundEnabled(val));
    dispatch(updateSelfDeviceSettings({ sound: val }));
  };

  const handleVibrationToggle = (val: boolean) => {
    dispatch(setVibrationEnabled(val));
    dispatch(updateSelfDeviceSettings({ vibration: val }));
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, devices, pairings, and alert history. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deleteUserAccount()).unwrap();
              dispatch(resetDevices());
              dispatch(resetAlerts());
              dispatch(resetFalls());
            } catch (err: any) {
              Alert.alert('Delete Failed', err?.message || 'Unable to delete account.');
            }
          },
        },
      ]
    );
  };

  const displayName = user?.name || 'User';
  const displayEmail = user?.email || 'No email';
  const displayPhone = user?.phone || 'No phone added';
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <TouchableOpacity activeOpacity={0.7} onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Settings</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 85, 100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.8}
          onPress={openEditModal}
        >
          <View style={styles.profileAvatarContainer}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarInitial}>{avatarInitial}</Text>
            </View>
            <View style={styles.profileEditBadge}>
              <Text style={styles.profileEditBadgeIcon}>✎</Text>
            </View>
          </View>

          <View style={styles.profileInfoCol}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileNameText}>{displayName}</Text>
              <View style={styles.profileVerifiedBadge}>
                <Text style={styles.profileVerifiedText}>Active</Text>
              </View>
            </View>
            <Text style={styles.profileDetailText}>{displayEmail}</Text>
            <Text style={styles.profileDetailText}>{displayPhone}</Text>
          </View>

          <View style={styles.profileActionWrap}>
            <Text style={styles.profileEditText}>Edit</Text>
            <Text style={styles.profileEditChevron}>›</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={handleSensitivitySelect}
          >
            <View style={styles.leftRow}>
              <View style={styles.iconBox}>
                <View style={styles.phoneIconSmall}>
                  <View style={styles.phoneSpeakerSmall} />
                </View>
                <View style={styles.impactLineSmall} />
              </View>
              <View style={styles.textGroup}>
                <Text style={styles.rowTitle}>Fall Detection</Text>
                <Text style={styles.rowSubtitle}>Enable detection & set sensitivity</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={handleSensitivitySelect}
          >
            <View style={styles.leftRow}>
              <View style={styles.iconBox}>
                <Text style={styles.waveIconGlyph}>〰</Text>
              </View>
              <Text style={styles.rowTitle}>Sensitivity</Text>
            </View>
            <View style={styles.rightRow}>
              <Text style={styles.valueText}>{sensitivity}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <View style={styles.settingRow}>
            <View style={styles.leftRow}>
              <View style={styles.iconBox}>
                <Text style={styles.speakerIconGlyph}>🔊</Text>
              </View>
              <Text style={styles.rowTitle}>Alert Sound</Text>
            </View>
            <Switch
              value={alertSound}
              onValueChange={handleSoundToggle}
              trackColor={{ false: '#CBD5E1', true: '#0062FF' }}
              thumbColor="#FFFFFF"
              style={Platform.OS === 'ios' ? {} : { transform: [{ scale: 1.05 }] }}
            />
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.settingRow}>
            <View style={styles.leftRow}>
              <View style={styles.iconBox}>
                <Text style={styles.vibrationIconGlyph}>📳</Text>
              </View>
              <Text style={styles.rowTitle}>Vibration</Text>
            </View>
            <Switch
              value={vibration}
              onValueChange={handleVibrationToggle}
              trackColor={{ false: '#CBD5E1', true: '#0062FF' }}
              thumbColor="#FFFFFF"
              style={Platform.OS === 'ios' ? {} : { transform: [{ scale: 1.05 }] }}
            />
          </View>
        </View>

        <View style={styles.cardGroup}>
          <View style={styles.settingRow}>
            <View style={styles.leftRow}>
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <Text style={{ fontSize: 18 }}>🛡️</Text>
              </View>
              <View style={styles.textGroup}>
                <Text style={styles.rowTitle}>3km Bystander Network</Text>
                <Text style={styles.rowSubtitle}>
                  Alert nearby un-paired devices within 3km
                </Text>
              </View>
            </View>
            <Switch
              value={isCommunityNetworkActive}
              onValueChange={(val) => {
                dispatch(syncCommunityNetworkToggle(val));
              }}
              trackColor={{ false: '#CBD5E1', true: '#0062FF' }}
              thumbColor="#FFFFFF"
              style={Platform.OS === 'ios' ? {} : { transform: [{ scale: 1.05 }] }}
            />
          </View>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert(
                '3km Safety Mesh',
                'When active, your phone will alert any user within 3 kilometers if a severe fall or SOS occurs, even if they are not in your paired contacts.\n\nRange: ~3 Kilometers\nNetwork: Geo-Targeted Push',
                [{ text: 'Got It' }]
              )
            }
          >
            <View style={styles.leftRow}>
              <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                <Text style={{ fontSize: 18 }}>📍</Text>
              </View>
              <Text style={styles.rowTitle}>Proximity Radius</Text>
            </View>
            <View style={styles.rightRow}>
              <Text style={styles.valueText}>100 Meters</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.cardGroup}>
          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert(
                'Notification Settings',
                'Emergency notifications use Android priority channel fall_alerts so alarms sound promptly.',
                [{ text: 'OK' }]
              )
            }
          >
            <View style={styles.leftRow}>
              <View style={styles.iconBox}>
                <Text style={styles.bellIconGlyph}>🔔</Text>
              </View>
              <Text style={styles.rowTitle}>Notification Settings</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={onNavigateToDevices}
          >
            <View style={styles.leftRow}>
              <View style={styles.iconBox}>
                <Text style={styles.devicesIconGlyph}>👥</Text>
              </View>
              <Text style={styles.rowTitle}>Connected Devices</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert(
                'About FallAlert',
                'FallAlert v1.0.0\n\nInstant fall detection and paired + 100m bystander emergency alerts.',
                [{ text: 'Close' }]
              )
            }
          >
            <View style={styles.leftRow}>
              <View style={styles.iconBox}>
                <Text style={styles.infoIconGlyph}>ⓘ</Text>
              </View>
              <Text style={styles.rowTitle}>About FallAlert</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.settingRow}
            activeOpacity={0.7}
            onPress={handleDeleteAccount}
          >
            <View style={styles.leftRow}>
              <View style={styles.iconBox}>
                <Text style={{ fontSize: 17 }}>🗑️</Text>
              </View>
              <Text style={[styles.rowTitle, { color: '#EF4444' }]}>Delete Account</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
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
          onPress={() => {
            setActiveTab('devices');
            onNavigateToDevices();
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
          onPress={() => setActiveTab('settings')}
          activeOpacity={0.7}
        >
          <View style={styles.tabIconCircleActive}>
            <Text style={[styles.tabGlyph, styles.tabGlyphActive]}>⚙</Text>
          </View>
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Settings</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(insets.bottom + 16, 24) },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <View style={styles.modalAvatarWrap}>
                <View style={styles.modalAvatarCircle}>
                  <Text style={styles.modalAvatarInitial}>
                    {formName.trim().charAt(0).toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={styles.modalAvatarBadge}>
                  <Text style={styles.modalAvatarBadgeText}>✎</Text>
                </View>
              </View>
              <Text style={styles.modalAvatarHint}>
                Your profile updates sync directly with the backend
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="Your full name"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.textInput}
                  value={formEmail}
                  onChangeText={setFormEmail}
                  placeholder="name@example.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Number</Text>
                <TextInput
                  style={styles.textInput}
                  value={formPhone}
                  onChangeText={setFormPhone}
                  placeholder="+91 98765 43210"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Emergency Contact Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={formEmergencyName}
                  onChangeText={setFormEmergencyName}
                  placeholder="e.g. Mom / Brother / Doctor"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Emergency Contact Phone</Text>
                <TextInput
                  style={styles.textInput}
                  value={formEmergencyPhone}
                  onChangeText={setFormEmergencyPhone}
                  placeholder="+91 98765 00001"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveProfileBtn, isAuthLoading && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={isAuthLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.saveProfileText}>
                  {isAuthLoading ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerSpacer: { width: 40 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 18 },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  iconBox: { width: 32, alignItems: 'center', justifyContent: 'center' },
  phoneIconSmall: {
    width: 16,
    height: 24,
    borderRadius: 4,
    borderWidth: 1.8,
    borderColor: '#0F172A',
    transform: [{ rotate: '-16deg' }],
    alignItems: 'center',
    paddingTop: 2,
  },
  phoneSpeakerSmall: { width: 5, height: 1.2, backgroundColor: '#0F172A', borderRadius: 0.6 },
  impactLineSmall: {
    width: 18,
    height: 2,
    backgroundColor: '#0F172A',
    borderRadius: 1,
    marginTop: 2,
  },
  waveIconGlyph: { fontSize: 18, color: '#0F172A', fontWeight: '900' },
  speakerIconGlyph: { fontSize: 18 },
  vibrationIconGlyph: { fontSize: 18 },
  bellIconGlyph: { fontSize: 18 },
  devicesIconGlyph: { fontSize: 18 },
  infoIconGlyph: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  textGroup: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  rowSubtitle: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueText: { fontSize: 14.5, color: '#64748B', fontWeight: '500' },
  chevron: { fontSize: 22, color: '#94A3B8', fontWeight: '700' },
  rowDivider: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 46 },
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
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileAvatarContainer: { position: 'relative' },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0062FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarInitial: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  profileEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileEditBadgeIcon: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  profileInfoCol: { flex: 1 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  profileNameText: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  profileVerifiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  profileVerifiedText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  profileDetailText: { fontSize: 13, color: '#64748B', marginTop: 1 },
  profileActionWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profileEditText: { fontSize: 14, fontWeight: '700', color: '#0062FF' },
  profileEditChevron: { fontSize: 20, fontWeight: '700', color: '#0062FF' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: { fontSize: 16, fontWeight: '700', color: '#475569' },
  modalAvatarWrap: { alignSelf: 'center', position: 'relative', marginBottom: 8 },
  modalAvatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0062FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarInitial: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  modalAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modalAvatarBadgeText: { color: '#FFFFFF', fontSize: 11 },
  modalAvatarHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 18,
  },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
  },
  saveProfileBtn: {
    backgroundColor: '#0062FF',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveProfileText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default SettingsScreen;
