import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export interface DeviceItemProps {
  name: string;
  lastActive: string;
  isOnline?: boolean;
  onPress?: () => void;
  onMenuPress?: () => void;
}

export const DeviceItem: React.FC<DeviceItemProps> = ({
  name,
  lastActive,
  isOnline = true,
  onPress,
  onMenuPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.leftContent}>
        {/* Phone Icon Avatar with soft blue glow */}
        <View style={styles.avatarWrap}>
          <View style={styles.phoneIcon}>
            <View style={styles.phoneSpeaker} />
            <View style={styles.phoneScreen} />
          </View>
        </View>

        {/* Device Information */}
        <View style={styles.infoCol}>
          <Text style={styles.deviceName}>{name}</Text>
          <Text style={styles.lastActiveText}>Last active: {lastActive}</Text>
        </View>
      </View>

      <View style={styles.rightContent}>
        {/* Online Status Badge */}
        <View
          style={[
            styles.statusBadge,
            isOnline ? styles.onlineBadge : styles.offlineBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isOnline ? styles.onlineText : styles.offlineText,
            ]}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        {/* 3-dots Menu Button */}
        <TouchableOpacity
          onPress={onMenuPress}
          activeOpacity={0.6}
          style={styles.menuBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
  },
  phoneIcon: {
    width: 20,
    height: 32,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    padding: 2,
  },
  phoneSpeaker: {
    width: 8,
    height: 1.5,
    backgroundColor: '#2563EB',
    borderRadius: 1,
    marginBottom: 2,
  },
  phoneScreen: {
    flex: 1,
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderRadius: 2,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  lastActiveText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onlineBadge: {
    backgroundColor: '#DCFCE7',
  },
  offlineBadge: {
    backgroundColor: '#F1F5F9',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  onlineText: {
    color: '#16A34A',
  },
  offlineText: {
    color: '#94A3B8',
  },
  menuBtn: {
    width: 24,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#64748B',
  },
});

export default DeviceItem;
