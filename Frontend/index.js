/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

try {
  const messaging = require('@react-native-firebase/messaging')?.default;
  if (typeof messaging === 'function') {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background FCM message received:', remoteMessage?.data?.type || remoteMessage?.messageId);
    });
  }
} catch {
  // Ignore if Firebase messaging native module is unavailable in test environment
}

AppRegistry.registerComponent(appName, () => App);
