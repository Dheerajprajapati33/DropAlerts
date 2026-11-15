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
import { AlertCard } from '../components/AlertCard';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { dismissAlert, fetchAlerts } from '../redux/slices/alertSlice';
import { Alert as AlertModel } from '../types/Alert';

interface AlertHistoryScreenProps {
  onBack: () => void;
  onNavigateToHome: () => void;
  onNavigateToDevices: () => void;
  onNavigateToSettings: () => void;
}

type FilterType = 'All' | 'Falls' | 'Sent' | 'Received';

function formatAlertTime(isoOrText: string): string {
  const date = new Date(isoOrText);
  if (isNaN(date.getTime())) return isoOrText;
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today, ${timeStr}`;
  const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${dateStr}, ${timeStr}`;
}

export const AlertHistoryScreen: React.FC<AlertHistoryScreenProps> = ({
  onBack,
  onNavigateToHome,
  onNavigateToDevices,
  onNavigateToSettings,
}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const alerts = useAppSelector((state) => state.alert.alerts);
  const isLoading = useAppSelector((state) => state.alert.isLoading);
  const currentUserId = useAppSelector((state) => state.auth.user?.id);

  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All');
  const [activeTab, setActiveTab] = useState<'home' | 'devices' | 'history' | 'settings'>('history');

  useEffect(() => {
    dispatch(fetchAlerts());
  }, [dispatch]);

  const filteredAlerts = alerts.filter((item) => {
    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'Falls') return item.type === 'fall';
    if (selectedFilter === 'Sent') {
      return (
        item.type === 'sent' ||
        item.type === 'emergency' ||
        (currentUserId ? item.userId === currentUserId : false)
      );
    }
    if (selectedFilter === 'Received') {
      return (
        item.type === 'received' ||
        (currentUserId ? Boolean(item.userId && item.userId !== currentUserId) : false)
      );
    }
    return true;
  });

  const handleCardPress = (item: AlertModel) => {
    Alert.alert(
      item.title,
      `Time: ${formatAlertTime(item.timestamp)}\nSeverity: ${item.severity}\nStatus: ${item.status}\nDevice: ${item.device || 'Unknown'}\nDetails: ${item.location || item.message || 'Fall alert event'}`,
      [
        ...(item.status !== 'dismissed'
          ? [
              {
                text: 'Dismiss',
                onPress: () => dispatch(dismissAlert(item.id)),
              },
            ]
          : []),
        { text: 'OK' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <TouchableOpacity activeOpacity={0.7} onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Alert History</Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filterRow}>
        {(['All', 'Falls', 'Sent', 'Received'] as FilterType[]).map((filter) => {
          const isSelected = selectedFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                isSelected ? styles.filterChipActive : styles.filterChipInactive,
              ]}
              onPress={() => setSelectedFilter(filter)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterText,
                  isSelected ? styles.filterTextActive : styles.filterTextInactive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          );
        })}
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
              dispatch(fetchAlerts());
            }}
          />
        }
      >
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((item) => (
            <AlertCard
              key={item.id}
              title={item.title}
              timestamp={formatAlertTime(item.timestamp)}
              severity={item.severity === 'Critical' ? 'High' : item.severity}
              isHighlighted={item.isHighlighted}
              onPress={() => handleCardPress(item)}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No Alerts Found</Text>
            <Text style={styles.emptySubtitle}>
              There are no fall alerts under the '{selectedFilter}' category.
            </Text>
          </View>
        )}
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
          onPress={() => setActiveTab('history')}
          activeOpacity={0.7}
        >
          <View style={styles.tabIconCircleActive}>
            <Text style={[styles.tabGlyph, styles.tabGlyphActive]}>⏱</Text>
          </View>
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>History</Text>
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
  headerSpacer: { width: 40 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: '#F8FAFC',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: '#0062FF',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  filterChipInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterText: { fontSize: 14, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF', fontWeight: '700' },
  filterTextInactive: { color: '#475569' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 6 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 20,
  },
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

export default AlertHistoryScreen;
