import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import {
  FallAlertLogo,
  FloatingPhoneWithWaves,
} from '../components/Icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LoginScreenProps {
  onLoginPress?: () => void;
  onCreateAccountPress?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginPress = () => {},
  onCreateAccountPress = () => {},
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Dark Hero Section */}
        <View style={[styles.heroSection, { paddingTop: Math.max(insets.top + 10, 24) }]}>
          {/* Header Branding */}
          <View style={styles.header}>
            <FallAlertLogo size={48} />
            <Text style={styles.brandTitle}>FallAlert</Text>
            <Text style={styles.brandSubtitle}>
              Phone Fall Detection & Instant Alert
            </Text>
          </View>

          {/* Central Hero Illustration (Floating phone + concentric shockwaves) */}
          <View style={styles.illustrationWrapper}>
            <FloatingPhoneWithWaves />
          </View>
        </View>

        {/* Bottom White Card */}
        <View
          style={[
            styles.bottomCard,
            { paddingBottom: Math.max(insets.bottom + 16, 28) },
          ]}
        >
          {/* Welcome Text */}
          <View style={styles.textContainer}>
            <Text style={styles.welcomeTitle}>Welcome to FallAlert</Text>
            <Text style={styles.welcomeSubtitle}>
              Stay connected and get instant alerts when your phone falls.
            </Text>
          </View>

          {/* Main Action Buttons */}
          <View style={styles.actionsContainer}>
            <Button
              title="Log In"
              variant="primary"
              onPress={onLoginPress}
              style={styles.primaryBtn}
            />

            <Button
              title="Create Account"
              variant="outline"
              onPress={onCreateAccountPress}
              style={styles.createAccountBtn}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070E1E',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    minHeight: SCREEN_HEIGHT,
  },
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 6,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginTop: 8,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  illustrationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 22,
  },
  primaryBtn: {
    backgroundColor: '#0062FF',
  },
  createAccountBtn: {
    borderColor: '#E2E8F0',
  },
});

export default LoginScreen;
