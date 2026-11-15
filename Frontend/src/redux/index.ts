export { store, default } from './store';
export type { RootState, AppDispatch } from './store';
export { useAppDispatch, useAppSelector } from './hooks';

// Auth Slice exports
export * from './slices/authSlice';

// Device Slice exports
export * from './slices/deviceSlice';

// Fall Slice exports
export * from './slices/fallSlice';

// Alert Slice exports
export * from './slices/alertSlice';

// Notification Slice exports
export * from './slices/notificationSlice';

// Nearby Proximity Alert Slice exports
export * from './slices/nearbyAlertSlice';
