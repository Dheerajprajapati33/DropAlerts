import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export interface AlertCardProps {
  title: string;
  timestamp: string;
  severity: 'High' | 'Medium' | 'Low';
  type?: 'fall' | 'sent' | 'received';
  isHighlighted?: boolean;
  onPress?: () => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  title,
  timestamp,
  severity,
  isHighlighted = false,
  onPress,
}) => {
  const isHigh = severity === 'High';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.card,
        isHighlighted && styles.cardHighlighted,
      ]}
    >
      <View style={styles.leftRow}>
        {/* Falling Phone Icon Avatar with impact ripples */}
        <View
          style={[
            styles.iconWrapper,
            isHighlighted
              ? styles.iconWrapperHighlighted
              : isHigh
              ? styles.iconWrapperHigh
              : styles.iconWrapperMedium,
          ]}
        >
          {/* Tilted Falling Phone */}
          <View
            style={[
              styles.phoneFrame,
              isHighlighted || isHigh
                ? styles.phoneFrameRed
                : styles.phoneFrameBlue,
            ]}
          >
            <View
              style={[
                styles.phoneSpeaker,
                isHighlighted || isHigh
                  ? styles.phoneSpeakerRed
                  : styles.phoneSpeakerBlue,
              ]}
            />
          </View>
          {/* Ground Impact Sparkle */}
          <View
            style={[
              styles.impactBase,
              isHighlighted || isHigh
                ? styles.impactBaseRed
                : styles.impactBaseBlue,
            ]}
          />
        </View>

        {/* Text Details */}
        <View style={styles.textCol}>
          <Text
            style={[
              styles.title,
              isHighlighted && styles.titleHighlighted,
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.timestamp,
              isHighlighted && styles.timestampHighlighted,
            ]}
          >
            {timestamp}
          </Text>
        </View>
      </View>

      <View style={styles.rightRow}>
        {/* Severity Pill Badge */}
        <View
          style={[
            styles.severityBadge,
            isHigh ? styles.badgeHigh : styles.badgeMedium,
          ]}
        >
          <Text
            style={[
              styles.severityText,
              isHigh ? styles.textHigh : styles.textMedium,
            ]}
          >
            {severity}
          </Text>
        </View>

        {/* Chevron Arrow */}
        <Text
          style={[
            styles.chevron,
            isHighlighted ? styles.chevronHighlighted : styles.chevronNormal,
          ]}
        >
          ›
        </Text>
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
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHighlighted: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FFE4E6',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  iconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconWrapperHighlighted: {
    backgroundColor: '#FFE4E6',
  },
  iconWrapperHigh: {
    backgroundColor: '#FEE2E2',
  },
  iconWrapperMedium: {
    backgroundColor: '#EFF6FF',
  },
  phoneFrame: {
    width: 18,
    height: 28,
    borderRadius: 5,
    borderWidth: 2,
    transform: [{ rotate: '-18deg' }, { translateY: -2 }],
    alignItems: 'center',
    paddingTop: 2,
  },
  phoneFrameRed: {
    borderColor: '#DC2626',
    backgroundColor: '#FFFFFF',
  },
  phoneFrameBlue: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
  },
  phoneSpeaker: {
    width: 6,
    height: 1.5,
    borderRadius: 1,
  },
  phoneSpeakerRed: {
    backgroundColor: '#DC2626',
  },
  phoneSpeakerBlue: {
    backgroundColor: '#2563EB',
  },
  impactBase: {
    position: 'absolute',
    bottom: 8,
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
  impactBaseRed: {
    backgroundColor: '#DC2626',
  },
  impactBaseBlue: {
    backgroundColor: '#2563EB',
  },
  textCol: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  titleHighlighted: {
    color: '#881337',
  },
  timestamp: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  timestampHighlighted: {
    color: '#9F1239',
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  badgeHigh: {
    backgroundColor: '#FEE2E2',
  },
  badgeMedium: {
    backgroundColor: '#FEF3C7',
  },
  severityText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  textHigh: {
    color: '#DC2626',
  },
  textMedium: {
    color: '#D97706',
  },
  chevron: {
    fontSize: 22,
    fontWeight: '700',
  },
  chevronNormal: {
    color: '#94A3B8',
  },
  chevronHighlighted: {
    color: '#E11D48',
  },
});

export default AlertCard;
