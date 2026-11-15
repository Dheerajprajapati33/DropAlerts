import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { FallAlertLogo } from '../components/Icons';
import { useAppSelector } from '../redux/hooks';
import authService from '../services/auth';

interface SignInScreenProps {
  onLoginSubmit: (identifier: string, password: string) => Promise<void>;
  onNavigateToSignUp: () => void;
  onBack: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onLoginSubmit,
  onNavigateToSignUp,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const isLoading = useAppSelector((state) => state.auth.isLoading);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Forgot password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      setErrorMessage('Please enter your email or mobile number.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }
    setErrorMessage('');
    try {
      await onLoginSubmit(identifier.trim(), password);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleRequestOtp = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Required', 'Please enter your registered email or phone.');
      return;
    }
    setForgotBusy(true);
    try {
      const res = await authService.forgotPassword(resetEmail.trim());
      setForgotStep('reset');
      Alert.alert(
        'Reset OTP Generated',
        res.devOtp
          ? `${res.message}\n\nDev OTP: ${res.devOtp}`
          : res.message
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to generate reset OTP.');
    } finally {
      setForgotBusy(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetOtp.trim() || newPassword.length < 6) {
      Alert.alert('Invalid Input', 'Enter the 6-digit OTP and a password (6+ chars).');
      return;
    }
    setForgotBusy(true);
    try {
      const res = await authService.resetPassword(
        resetEmail.trim(),
        resetOtp.trim(),
        newPassword
      );
      setForgotOpen(false);
      setForgotStep('request');
      setResetOtp('');
      setNewPassword('');
      Alert.alert('Success', res.message);
    } catch (err: any) {
      Alert.alert('Reset Failed', err?.message || 'Invalid or expired OTP.');
    } finally {
      setForgotBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 10, 20),
            paddingBottom: Math.max(insets.bottom + 16, 24),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity activeOpacity={0.7} onPress={onBack} style={styles.backButton}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <FallAlertLogo size={36} />
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.titleText}>Sign In</Text>
          <Text style={styles.subtitleText}>
            Enter your credentials to access FallAlert
          </Text>
        </View>

        <View style={styles.card}>
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address / Mobile Number</Text>
            <TextInput
              style={styles.input}
              placeholder="rahul@example.com or 9876543210"
              placeholderTextColor="#94A3B8"
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                if (errorMessage) setErrorMessage('');
              }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage('');
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.forgotBtn}
            activeOpacity={0.7}
            onPress={() => {
              setResetEmail(identifier.trim());
              setForgotStep('request');
              setForgotOpen(true);
            }}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button
            title={isLoading ? 'Logging in...' : 'Log In'}
            variant="primary"
            loading={isLoading}
            onPress={handleLogin}
            style={styles.loginBtn}
          />

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={onNavigateToSignUp} activeOpacity={0.7}>
              <Text style={styles.signupLink}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={forgotOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setForgotOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalSubtitle}>
              {forgotStep === 'request'
                ? 'Enter your email or phone to receive a 6-digit OTP.'
                : 'Enter the 6-digit OTP and your new password.'}
            </Text>

            <TextInput
              style={[styles.input, { marginBottom: 12 }]}
              placeholder="Email or phone"
              placeholderTextColor="#94A3B8"
              value={resetEmail}
              onChangeText={setResetEmail}
              autoCapitalize="none"
            />

            {forgotStep === 'reset' && (
              <>
                <TextInput
                  style={[styles.input, { marginBottom: 12 }]}
                  placeholder="6-digit OTP"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  value={resetOtp}
                  onChangeText={setResetOtp}
                />
                <TextInput
                  style={[styles.input, { marginBottom: 12 }]}
                  placeholder="New password (min 6 chars)"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </>
            )}

            <Button
              title={
                forgotBusy
                  ? 'Please wait...'
                  : forgotStep === 'request'
                  ? 'Send Reset OTP'
                  : 'Confirm Reset'
              }
              variant="primary"
              loading={forgotBusy}
              onPress={forgotStep === 'request' ? handleRequestOtp : handleConfirmReset}
              style={{ backgroundColor: '#0062FF', marginBottom: 10 }}
            />
            <TouchableOpacity
              onPress={() => setForgotOpen(false)}
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ color: '#64748B', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070E1E' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', marginTop: -4 },
  headerSpacer: { width: 40 },
  titleSection: { marginBottom: 24, alignItems: 'center' },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  subtitleText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 15,
    color: '#0F172A',
  },
  passwordWrapper: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 60 },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
  },
  eyeText: { color: '#0062FF', fontSize: 13, fontWeight: '600' },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { color: '#0062FF', fontSize: 13, fontWeight: '600' },
  loginBtn: { backgroundColor: '#0062FF', marginBottom: 18 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: '#64748B', fontSize: 14 },
  signupLink: { color: '#0062FF', fontSize: 14, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 16 },
});

export default SignInScreen;
