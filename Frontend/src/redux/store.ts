import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import deviceReducer from './slices/deviceSlice';
import fallReducer from './slices/fallSlice';
import alertReducer from './slices/alertSlice';
import notificationReducer from './slices/notificationSlice';
import nearbyAlertReducer from './slices/nearbyAlertSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    device: deviceReducer,
    fall: fallReducer,
    alert: alertReducer,
    notification: notificationReducer,
    nearbyAlert: nearbyAlertReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // For flexibility in React Native timestamp / complex payloads
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
