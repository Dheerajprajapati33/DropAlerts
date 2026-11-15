import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export const FallAlertLogo = ({ size = 48 }: { size?: number }) => {
  return (
    <Image
      source={require('../../assets/logo.png')}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
      }}
      resizeMode="contain"
    />
  );
};

export const GoogleIcon = ({ size = 20 }: { size?: number }) => {
  return (
    <View style={[styles.googleBadge, { width: size + 4, height: size + 4 }]}>
      <Text style={[styles.googleText, { fontSize: size * 0.85 }]}>G</Text>
    </View>
  );
};

export const AppleIcon = ({ size = 20 }: { size?: number }) => {
  return (
    <View style={[styles.appleContainer, { width: size + 2, height: size + 2 }]}>
      <Text style={[styles.appleGlyph, { fontSize: size * 1.1 }]}></Text>
    </View>
  );
};

export const FloatingPhoneWithWaves = () => {
  return (
    <View style={styles.heroContainer}>
      {/* Concentric Glow Ripples (Perspective Oval Rings) */}
      <View style={styles.rippleOuter}>
        <View style={styles.rippleMiddle}>
          <View style={styles.rippleInner} />
        </View>
      </View>

      {/* Floating Tilted Smartphone */}
      <View style={styles.phoneFloatingWrapper}>
        <View style={styles.phoneBody}>
          {/* Dynamic Island / Notch */}
          <View style={styles.phoneNotch} />

          {/* Screen Content */}
          <View style={styles.phoneScreen}>
            <View style={styles.pulseOuter}>
              <View style={styles.pulseInner} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  googleBadge: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  googleText: {
    fontWeight: '900',
    color: '#4285F4',
    textAlign: 'center',
  },
  appleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  appleGlyph: {
    color: '#000000',
    fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 22,
  },
  heroContainer: {
    width: 240,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  rippleOuter: {
    position: 'absolute',
    bottom: 15,
    width: 220,
    height: 70,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleMiddle: {
    width: 160,
    height: 50,
    borderRadius: 80,
    borderWidth: 2.5,
    borderColor: 'rgba(56, 189, 248, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleInner: {
    width: 100,
    height: 32,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 98, 255, 0.45)',
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  phoneFloatingWrapper: {
    transform: [{ rotate: '-14deg' }, { translateY: -18 }],
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 12,
  },
  phoneBody: {
    width: 76,
    height: 128,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#38BDF8',
    backgroundColor: '#0F172A',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneNotch: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
    marginTop: 2,
  },
  phoneScreen: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginTop: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 98, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#38BDF8',
  },
});
