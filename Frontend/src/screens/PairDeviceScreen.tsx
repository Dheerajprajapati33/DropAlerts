import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { Camera, CameraType } from 'react-native-camera-kit';
import { Button } from '../components/Button';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { generatePairCode, pairDevice } from '../redux/slices/deviceSlice';

interface PairDeviceScreenProps {
  onBack: () => void;
  onDeviceConnected: (deviceName: string) => void;
}

export const PairDeviceScreen: React.FC<PairDeviceScreenProps> = ({
  onBack,
  onDeviceConnected,
}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { pairCodeData, isPairing, isGeneratingCode, error: deviceError } = useAppSelector(
    (state) => state.device
  );

  const [activeTab, setActiveTab] = useState<'qr' | 'code'>('qr');
  const [qrSubMode, setQrSubMode] = useState<'scan' | 'my_qr'>('scan');
  const [torchOn, setTorchOn] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [qrInputModalOpen, setQrInputModalOpen] = useState(false);
  const [qrRawInput, setQrRawInput] = useState('');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const isScanningRef = useRef(false);
  const inputRefs = useRef<any[]>([]);

  const requestCameraPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'DropAlert needs camera access to scan device pairing QR codes.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        setHasCameraPermission(isGranted);
        return isGranted;
      } catch (err) {
        console.warn('Failed to request camera permission:', err);
        setHasCameraPermission(false);
        return false;
      }
    }
    setHasCameraPermission(true);
    return true;
  }, []);

  useEffect(() => {
    if (activeTab === 'qr' && qrSubMode === 'scan') {
      requestCameraPermission();
    }
  }, [activeTab, qrSubMode, requestCameraPermission]);

  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeTab === 'qr' && qrSubMode === 'scan') {
      const scanLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 200,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      );
      scanLoop.start();
      return () => scanLoop.stop();
    }
  }, [activeTab, qrSubMode, scanAnim]);

  const latestPairCodeRef = useRef(pairCodeData);
  const isGeneratingRef = useRef(isGeneratingCode);
  latestPairCodeRef.current = pairCodeData;
  isGeneratingRef.current = isGeneratingCode;

  useEffect(() => {
    if (activeTab !== 'qr' || qrSubMode !== 'my_qr' || isGeneratingRef.current) {
      return;
    }
    const current = latestPairCodeRef.current;
    const isExpired =
      !current?.expiresAt || new Date(current.expiresAt).getTime() <= Date.now();
    if (!current?.qrPayload || isExpired) {
      dispatch(generatePairCode(`${user?.name || 'My'}'s Phone`));
    }
  }, [activeTab, qrSubMode, dispatch, user?.name]);

  const handleDigitChange = (value: string, index: number) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...codeDigits];
    newDigits[index] = clean;
    setCodeDigits(newDigits);

    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus?.();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus?.();
    }
  };

  const submitPairing = async (payload: { pairingCode?: string; qrPayload?: string }) => {
    try {
      const paired = await dispatch(pairDevice(payload)).unwrap();
      setScanSuccess(true);
      Alert.alert(
        'Device Paired! 🎉',
        `Successfully connected to ${paired.name}.`,
        [
          {
            text: 'View Devices',
            onPress: () => onDeviceConnected(paired.name),
          },
        ]
      );
    } catch (err: any) {
      setScanSuccess(false);
      Alert.alert(
        'Pairing Failed',
        err?.message || 'Invalid or expired pairing code. Please check and try again.'
      );
    }
  };

  const handleConnectByCode = async () => {
    const code = codeDigits.join('');
    if (code.length < 6) {
      Alert.alert('Incomplete Code', 'Please enter all 6 digits from the other device.');
      return;
    }
    await submitPairing({ pairingCode: code });
  };

  const handleQrSubmit = async () => {
    const trimmed = qrRawInput.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Paste the QR payload JSON or enter the 6-digit code.');
      return;
    }
    setQrInputModalOpen(false);
    if (/^\d{6,8}$/.test(trimmed.replace(/[\s-]/g, ''))) {
      await submitPairing({ pairingCode: trimmed.replace(/[\s-]/g, '') });
    } else {
      await submitPairing({ qrPayload: trimmed });
    }
    setQrRawInput('');
  };

  const handleBarCodeRead = useCallback(
    async (event: any) => {
      const scannedValue = event?.nativeEvent?.codeStringValue;
      if (!scannedValue || isScanningRef.current || isPairing) {
        return;
      }

      isScanningRef.current = true;
      const clean = String(scannedValue).trim();

      if (/^\d{6,8}$/.test(clean.replace(/[\s-]/g, ''))) {
        await submitPairing({ pairingCode: clean.replace(/[\s-]/g, '') });
      } else {
        await submitPairing({ qrPayload: clean });
      }

      setTimeout(() => {
        isScanningRef.current = false;
      }, 3000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPairing]
  );

  return (
    <View
      style={[
        styles.container,
        activeTab === 'code' ? styles.containerLight : styles.containerDark,
        torchOn && activeTab === 'qr' && styles.containerTorchOn,
      ]}
    >
      <StatusBar barStyle={activeTab === 'code' ? 'dark-content' : 'light-content'} />

      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onBack}
          style={[
            styles.backBtn,
            activeTab === 'code' ? styles.backBtnLight : styles.backBtnDark,
          ]}
        >
          <Text
            style={[
              styles.backArrow,
              activeTab === 'code' ? styles.textDark : styles.textLight,
            ]}
          >
            ‹
          </Text>
        </TouchableOpacity>
        <Text
          style={[
            styles.headerTitle,
            activeTab === 'code' ? styles.textDark : styles.textLight,
          ]}
        >
          Pair a Device
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Segmented Control */}
      <View style={styles.tabContainer}>
        <View
          style={
            activeTab === 'code' ? styles.segmentedWrapLight : styles.segmentedWrapDark
          }
        >
          <TouchableOpacity
            style={[styles.segmentItem, activeTab === 'qr' && styles.segmentItemActive]}
            onPress={() => setActiveTab('qr')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'qr'
                  ? styles.segmentTextActive
                  : styles.segmentTextInactiveDark,
              ]}
            >
              Scan QR
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentItem, activeTab === 'code' && styles.segmentItemActive]}
            onPress={() => setActiveTab('code')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'code'
                  ? styles.segmentTextActive
                  : styles.segmentTextInactiveLight,
              ]}
            >
              Enter Code
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'qr' ? (
        <View style={styles.qrContent}>
          <View style={styles.subModeRow}>
            <TouchableOpacity
              style={[styles.subModeBtn, qrSubMode === 'scan' && styles.subModeBtnActive]}
              onPress={() => setQrSubMode('scan')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.subModeText,
                  qrSubMode === 'scan' && styles.subModeTextActive,
                ]}
              >
                📷 Scan Other Phone
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subModeBtn, qrSubMode === 'my_qr' && styles.subModeBtnActive]}
              onPress={() => setQrSubMode('my_qr')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.subModeText,
                  qrSubMode === 'my_qr' && styles.subModeTextActive,
                ]}
              >
                🪪 Show My QR
              </Text>
            </TouchableOpacity>
          </View>

          {qrSubMode === 'scan' ? (
            <>
              <View style={styles.viewfinderWrapper}>
                {hasCameraPermission ? (
                  <Camera
                    style={StyleSheet.absoluteFill}
                    cameraType={CameraType.Back}
                    scanBarcode={true}
                    onReadCode={handleBarCodeRead}
                    torchMode={torchOn ? 'on' : 'off'}
                    showFrame={false}
                  />
                ) : (
                  <View style={styles.permissionBox}>
                    <Text style={styles.permissionIcon}>📷</Text>
                    <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                    <Text style={styles.permissionSubtitle}>
                      Camera access is needed to scan QR codes on other devices.
                    </Text>
                    <TouchableOpacity
                      style={styles.permissionBtn}
                      onPress={requestCameraPermission}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.permissionBtnText}>Enable Camera</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View
                  style={[
                    styles.corner,
                    styles.cornerTopLeft,
                    scanSuccess && styles.cornerSuccess,
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerTopRight,
                    scanSuccess && styles.cornerSuccess,
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerBottomLeft,
                    scanSuccess && styles.cornerSuccess,
                  ]}
                />
                <View
                  style={[
                    styles.corner,
                    styles.cornerBottomRight,
                    scanSuccess && styles.cornerSuccess,
                  ]}
                />

                <Animated.View
                  style={[styles.laserBeam, { transform: [{ translateY: scanAnim }] }]}
                >
                  <View style={styles.laserCore} />
                </Animated.View>

                {isPairing && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#00E5FF" />
                    <Text style={styles.loadingText}>Connecting device...</Text>
                  </View>
                )}
              </View>

              <Text style={styles.qrInstruction}>
                Point your camera at the QR code shown on the other phone.
              </Text>

              <View
                style={[
                  styles.scanActionsRow,
                  { marginBottom: Math.max(insets.bottom + 16, 28) },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.torchBtn,
                    torchOn && styles.torchBtnActive,
                  ]}
                  onPress={() => setTorchOn((prev) => !prev)}
                  activeOpacity={0.7}
                  disabled={!hasCameraPermission}
                >
                  <Text style={[styles.torchGlyph, torchOn && { color: '#0F172A' }]}>
                    {torchOn ? '🔦 Flash ON' : '🔦 Flash'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.manualEntryBtn}
                  onPress={() => setQrInputModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.manualEntryBtnText}>⌨️ Enter Code Manually</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.myQrContainer}>
              <View style={styles.myQrCard}>
                <Text style={styles.myQrTitle}>
                  {pairCodeData?.deviceName || `${user?.name || 'My'}'s Phone`}
                </Text>
                <Text style={styles.myQrSub}>
                  Enter this code on the other phone to link both devices
                </Text>

                <View style={styles.myQrBox}>
                  {isGeneratingCode && !pairCodeData?.qrPayload ? (
                    <ActivityIndicator size="large" color="#0062FF" />
                  ) : pairCodeData?.qrPayload ? (
                    <QRCode
                      value={pairCodeData.qrPayload}
                      size={156}
                      color="#0F172A"
                      backgroundColor="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.qrErrorPlaceholder}>
                      {deviceError || 'Tap below to generate QR'}
                    </Text>
                  )}
                </View>

                <View style={styles.pairingCodeBox}>
                  <Text style={styles.pairingCodeLabel}>Live 6-Digit Pairing Code:</Text>
                  {isGeneratingCode ? (
                    <ActivityIndicator color="#0062FF" style={{ marginVertical: 4 }} />
                  ) : (
                    <Text style={styles.pairingCodeVal}>
                      {pairCodeData?.formattedCode || '--- - ---'}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.refreshCodeBtn}
                  onPress={() => dispatch(generatePairCode(`${user?.name || 'My'}'s Phone`))}
                  disabled={isGeneratingCode}
                >
                  <Text style={styles.refreshCodeText}>↻ Generate New Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.codeContent,
            { paddingBottom: Math.max(insets.bottom + 20, 36) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.linkCircle}>
            <Text style={styles.linkGlyph}>🔗</Text>
          </View>

          <Text style={styles.codeTitle}>Enter Pairing Code</Text>
          <Text style={styles.codeSubtitle}>
            Enter the 6-digit code shown on the other device.
          </Text>

          <View style={styles.otpRow}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <TextInput
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                style={[styles.otpBox, codeDigits[index] ? styles.otpBoxFilled : null]}
                keyboardType="number-pad"
                maxLength={1}
                value={codeDigits[index]}
                placeholder={['8', '4', '2', '7', '1', '9'][index]}
                placeholderTextColor="#CBD5E1"
                onChangeText={(val) => handleDigitChange(val, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                textAlign="center"
              />
            ))}
          </View>

          <Button
            title={isPairing ? 'Connecting...' : 'Connect Device'}
            variant="primary"
            loading={isPairing}
            onPress={handleConnectByCode}
            style={styles.connectBtn}
          />
        </ScrollView>
      )}

      <Modal
        visible={qrInputModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setQrInputModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Connect via QR / Code</Text>
            <Text style={styles.modalSub}>
              Paste the QR payload or enter the 6-digit pairing code shown on the other phone.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 842719 or QR JSON"
              placeholderTextColor="#94A3B8"
              value={qrRawInput}
              onChangeText={setQrRawInput}
              autoCapitalize="none"
            />
            <Button
              title={isPairing ? 'Pairing...' : 'Pair Device'}
              variant="primary"
              loading={isPairing}
              onPress={handleQrSubmit}
              style={{ backgroundColor: '#0062FF', marginBottom: 8 }}
            />
            <TouchableOpacity
              onPress={() => setQrInputModalOpen(false)}
              style={{ alignItems: 'center', paddingVertical: 8 }}
            >
              <Text style={{ color: '#64748B', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDark: { backgroundColor: '#070E1E' },
  containerTorchOn: { backgroundColor: '#0F1D38' },
  containerLight: { backgroundColor: '#FFFFFF' },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnDark: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  backBtnLight: { backgroundColor: '#F1F5F9' },
  backArrow: { fontSize: 28, fontWeight: '300', marginTop: -4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSpacer: { width: 40 },
  textLight: { color: '#FFFFFF' },
  textDark: { color: '#0F172A' },
  tabContainer: { paddingHorizontal: 20, marginBottom: 18 },
  segmentedWrapDark: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 4,
  },
  segmentedWrapLight: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#0062FF',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  segmentText: { fontSize: 15, fontWeight: '600' },
  segmentTextActive: { color: '#FFFFFF', fontWeight: '700' },
  segmentTextInactiveDark: { color: '#64748B' },
  segmentTextInactiveLight: { color: '#94A3B8' },
  subModeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  subModeBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  subModeBtnActive: {
    backgroundColor: 'rgba(0, 98, 255, 0.3)',
    borderWidth: 1,
    borderColor: '#0062FF',
  },
  subModeText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  subModeTextActive: { color: '#38BDF8', fontWeight: '700' },
  qrContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  viewfinderWrapper: {
    width: 260,
    height: 260,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginTop: 10,
    backgroundColor: '#000000',
  },
  permissionBox: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionIcon: { fontSize: 36, marginBottom: 8 },
  permissionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  permissionSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  permissionBtn: {
    backgroundColor: '#0062FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  permissionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  scanActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  manualEntryBtn: {
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualEntryBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '600' },
  corner: { position: 'absolute', width: 38, height: 38, borderColor: '#FFFFFF' },
  cornerSuccess: { borderColor: '#00E676' },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  laserBeam: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    height: 24,
    zIndex: 10,
    justifyContent: 'center',
  },
  laserCore: {
    height: 3,
    backgroundColor: '#00E5FF',
    borderRadius: 1.5,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  qrCard: {
    width: 190,
    height: 190,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0062FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  qrGrid: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  finderBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 44,
    height: 44,
    borderWidth: 4,
    borderColor: '#000000',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finderTopRight: { left: undefined, right: 0 },
  finderBottomLeft: { top: undefined, bottom: 0 },
  finderInner: {
    width: 22,
    height: 22,
    backgroundColor: '#000000',
    borderRadius: 4,
  },
  qrModules: { width: 70, height: 60, gap: 4 },
  moduleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 3 },
  modBlack: { width: 10, height: 10, backgroundColor: '#000000', borderRadius: 2 },
  modWhite: { width: 10, height: 10, backgroundColor: 'transparent' },
  qrLogoBadge: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  qrLogoPhone: { fontSize: 18 },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 14, 30, 0.85)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  loadingText: { color: '#FFFFFF', marginTop: 10, fontSize: 14, fontWeight: '600' },
  qrInstruction: {
    color: '#94A3B8',
    fontSize: 13.5,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 19,
    marginTop: 14,
  },
  torchBtn: {
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  torchBtnActive: { backgroundColor: '#FFFFFF' },
  torchGlyph: { fontSize: 16, color: '#FFFFFF', fontWeight: '700' },
  myQrContainer: { width: '100%', alignItems: 'center', paddingVertical: 10 },
  myQrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  myQrTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  myQrSub: { fontSize: 12.5, color: '#64748B', textAlign: 'center', marginBottom: 18 },
  myQrBox: {
    width: 184,
    height: 184,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrErrorPlaceholder: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  pairingCodeBox: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  pairingCodeLabel: { fontSize: 11, color: '#64748B', fontWeight: '500', marginBottom: 2 },
  pairingCodeVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0062FF',
    letterSpacing: 2,
  },
  refreshCodeBtn: { marginTop: 12, paddingVertical: 6, paddingHorizontal: 12 },
  refreshCodeText: { color: '#0062FF', fontSize: 13, fontWeight: '700' },
  codeContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  linkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  linkGlyph: { fontSize: 36 },
  codeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  codeSubtitle: {
    fontSize: 14.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 28,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 36,
    width: '100%',
    justifyContent: 'center',
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  otpBoxFilled: { borderColor: '#0062FF', backgroundColor: '#EFF6FF' },
  connectBtn: { backgroundColor: '#0062FF', width: '100%' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#64748B', marginBottom: 14 },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 14,
  },
});

export default PairDeviceScreen;
