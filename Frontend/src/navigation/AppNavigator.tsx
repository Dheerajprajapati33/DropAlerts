import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { NearbyAlertModal } from '../components/NearbyAlertModal';
import { FallCountdownModal } from '../components/FallCountdownModal';
import { useFallDetector } from '../hooks/useFallDetector';
import {
  initializeProximityNetwork,
  receiveIncomingNearbyAlert,
  setCurrentCoords,
} from '../redux/slices/nearbyAlertSlice';
import {
  addNotificationItem,
  fetchNotifications,
  registerFcmToken,
  setFcmToken,
} from '../redux/slices/notificationSlice';
import { clearAuth } from '../redux/slices/authSlice';
import {
  fetchDevices,
  generatePairCode,
  registerSelfDevice,
  resetDevices,
} from '../redux/slices/deviceSlice';
import { fetchAlerts, fetchEmergencyContacts, resetAlerts } from '../redux/slices/alertSlice';
import { fetchFallHistory, resetFalls } from '../redux/slices/fallSlice';
import { setUnauthorizedHandler } from '../services/api';
import notificationService from '../services/notifications';
import motionSensorService from '../services/motionSensor';
import nearbyAlertService from '../services/nearbyAlertService';
import { getClientDeviceId } from '../services/deviceIdentity';
import { API_BASE_URL } from '../config/api.config';
import { NearbyAlert } from '../types/NearbyAlert';

export const AppNavigator: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const user = useAppSelector((state) => state.auth.user);
  const fcmToken = useAppSelector((state) => state.notification.fcmToken);

  useFallDetector(isAuthenticated);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      dispatch(clearAuth());
      dispatch(resetDevices());
      dispatch(resetAlerts());
      dispatch(resetFalls());
    });
    return () => setUnauthorizedHandler(null);
  }, [dispatch]);

  useEffect(() => {
    let active = true;

    const bootstrapMessagingAndProximity = async () => {
      await notificationService.requestNotificationPermission();
      const token = await notificationService.getFcmToken();
      if (!active) return;

      if (token) {
        dispatch(setFcmToken(token));
      }
      dispatch(initializeProximityNetwork(token));
    };

    bootstrapMessagingAndProximity();

    const stopLocationWatch = nearbyAlertService.watchLocation((coords) => {
      if (active) {
        dispatch(setCurrentCoords(coords));
      }
    });

    const unsubscribeMessage = notificationService.subscribeToForegroundMessages(
      (remoteMessage) => {
        const data = remoteMessage?.data || {};
        const title =
          remoteMessage?.notification?.title || data.title || 'FallAlert Notification';
        const body =
          remoteMessage?.notification?.body || data.message || 'Emergency update received.';

        dispatch(
          addNotificationItem({
            title,
            body,
            timestamp: 'Just now',
          })
        );

        if (data.type === 'NEARBY_SOS') {
          const nearbyPayload: NearbyAlert = {
            id: String(data.id || `nearby_${Date.now()}`),
            incidentType: (data.incidentType as NearbyAlert['incidentType']) || 'fall',
            title,
            message: body,
            latitude: Number(data.latitude) || 28.6139,
            longitude: Number(data.longitude) || 77.209,
            distanceMeters: Number(data.distanceMeters) || 50,
            approxLocation: data.approxLocation || 'Within ~3km (Near your vicinity)',
            timestamp: data.timestamp || 'Just now',
            isPaired: false,
            ...(data.impactG ? { impactG: Number(data.impactG) } : {}),
          };
          dispatch(receiveIncomingNearbyAlert(nearbyPayload));
          return;
        }

        if (data.type === 'FALL_ALERT' || data.type === 'EMERGENCY_SOS') {
          dispatch(fetchAlerts());
          notificationService.displayEmergencyNotification({ title, body, data });
        } else if (data.type === 'FALL_CANCELLED' || data.type === 'ALERT_CANCELLED') {
          dispatch(fetchAlerts());
        }
      }
    );

    const unsubscribeRefresh = notificationService.subscribeToTokenRefresh((newToken) => {
      dispatch(setFcmToken(newToken));
      dispatch(registerFcmToken(newToken));
    });

    return () => {
      active = false;
      unsubscribeMessage();
      unsubscribeRefresh();
      stopLocationWatch();
    };
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let cancelled = false;
    const deviceName = `${user.name || 'My'}'s Phone`;

    const bootstrapSession = async () => {
      try {
        await dispatch(registerSelfDevice({ name: deviceName, fcmToken })).unwrap();
      } catch {
        // Keep loading remaining session resources even if self registration retries later
      }
      if (cancelled) return;

      const authToken = (user as any)?.token;
      motionSensorService.syncNativeConfig({
        authToken,
        deviceId: getClientDeviceId(),
        deviceName,
        apiBaseUrl: API_BASE_URL,
      });

      if (fcmToken) {
        dispatch(registerFcmToken(fcmToken));
      }
      dispatch(generatePairCode(deviceName));
      dispatch(fetchDevices());
      dispatch(fetchAlerts());
      dispatch(fetchFallHistory());
      dispatch(fetchEmergencyContacts());
      dispatch(fetchNotifications());
    };

    bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, fcmToken, dispatch, user]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
      <NearbyAlertModal />
      <FallCountdownModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070B14',
  },
});

export default AppNavigator;
