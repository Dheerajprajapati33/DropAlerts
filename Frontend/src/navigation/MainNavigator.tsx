import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { PairDeviceScreen } from '../screens/PairDeviceScreen';
import { ConnectedDevicesScreen } from '../screens/ConnectedDevicesScreen';
import { AlertHistoryScreen } from '../screens/AlertHistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { logoutUser } from '../redux/slices/authSlice';
import { resetDevices } from '../redux/slices/deviceSlice';
import { resetAlerts } from '../redux/slices/alertSlice';
import { resetFalls } from '../redux/slices/fallSlice';

export type MainScreenType =
  | 'home'
  | 'pair-device'
  | 'connected-devices'
  | 'history'
  | 'settings';

export interface MainNavigatorProps {
  initialScreen?: MainScreenType;
  onLogout?: () => void;
}

export const MainNavigator: React.FC<MainNavigatorProps> = ({
  initialScreen = 'home',
  onLogout,
}) => {
  const [currentScreen, setCurrentScreen] = useState<MainScreenType>(initialScreen);
  const dispatch = useAppDispatch();

  const user = useAppSelector((state) => state.auth.user);
  const devices = useAppSelector((state) => state.device.devices);
  const hasPairedFirstDevice = useAppSelector((state) => state.device.hasPairedFirstDevice);

  const userName = user?.name || 'User';

  const handleDevicesNavigation = () => {
    if (!hasPairedFirstDevice || devices.length === 0) {
      setCurrentScreen('pair-device');
    } else {
      setCurrentScreen('connected-devices');
    }
  };

  const handleDeviceConnected = () => {
    setCurrentScreen('connected-devices');
  };

  const handleLogout = async () => {
    await dispatch(logoutUser());
    dispatch(resetDevices());
    dispatch(resetAlerts());
    dispatch(resetFalls());
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <View style={styles.container}>
      {currentScreen === 'home' && (
        <HomeScreen
          userName={userName}
          onLogout={handleLogout}
          onNavigateToDevices={handleDevicesNavigation}
          onNavigateToHistory={() => setCurrentScreen('history')}
          onNavigateToSettings={() => setCurrentScreen('settings')}
        />
      )}

      {currentScreen === 'pair-device' && (
        <PairDeviceScreen
          onBack={() => setCurrentScreen('home')}
          onDeviceConnected={handleDeviceConnected}
        />
      )}

      {currentScreen === 'connected-devices' && (
        <ConnectedDevicesScreen
          devicesList={devices}
          onBack={() => setCurrentScreen('home')}
          onPairNewDevice={() => setCurrentScreen('pair-device')}
          onNavigateToHome={() => setCurrentScreen('home')}
          onNavigateToHistory={() => setCurrentScreen('history')}
          onNavigateToSettings={() => setCurrentScreen('settings')}
        />
      )}

      {currentScreen === 'history' && (
        <AlertHistoryScreen
          onBack={() => setCurrentScreen('home')}
          onNavigateToHome={() => setCurrentScreen('home')}
          onNavigateToDevices={handleDevicesNavigation}
          onNavigateToSettings={() => setCurrentScreen('settings')}
        />
      )}

      {currentScreen === 'settings' && (
        <SettingsScreen
          onBack={() => setCurrentScreen('home')}
          onNavigateToHome={() => setCurrentScreen('home')}
          onNavigateToDevices={handleDevicesNavigation}
          onNavigateToHistory={() => setCurrentScreen('history')}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070B14',
  },
});

export default MainNavigator;
