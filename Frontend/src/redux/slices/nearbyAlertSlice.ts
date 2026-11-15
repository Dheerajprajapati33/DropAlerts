import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Coordinates, NearbyAlert, BroadcastPayload } from '../../types/NearbyAlert';
import nearbyAlertService from '../../services/nearbyAlertService';

export interface NearbyAlertState {
  isCommunityNetworkActive: boolean;
  maxRadiusMeters: number;
  currentCoords: Coordinates | null;
  hasLocationPermission: boolean;
  isLocating: boolean;
  incomingAlert: NearbyAlert | null;
  nearbyAlertsHistory: NearbyAlert[];
  isBroadcasting: boolean;
  activeMeshCount: number | null;
  lastBroadcastResult: { success: boolean; devicesNotified: number } | null;
  error: string | null;
}

const initialState: NearbyAlertState = {
  isCommunityNetworkActive: true,
  maxRadiusMeters: 3000,
  currentCoords: null,
  hasLocationPermission: false,
  isLocating: false,
  incomingAlert: null,
  nearbyAlertsHistory: [],
  isBroadcasting: false,
  activeMeshCount: null,
  lastBroadcastResult: null,
  error: null,
};

export const initializeProximityNetwork = createAsyncThunk<
  { hasPermission: boolean; coords: Coordinates | null; activeCount: number | null },
  string | null | undefined,
  { state: { nearbyAlert: NearbyAlertState; notification: { fcmToken: string | null } } }
>('nearbyAlert/initializeProximityNetwork', async (explicitToken, { getState }) => {
  const state = getState();
  const fcmToken = explicitToken ?? state.notification.fcmToken;
  const hasPermission = await nearbyAlertService.requestProximityPermissions();

  let coords: Coordinates | null = null;
  if (hasPermission) {
    try {
      coords = await nearbyAlertService.getCurrentLocation();
    } catch (err) {
      console.warn('Initial GPS location fetch skipped/timed out:', err);
    }
  }

  if (coords) {
    try {
      await nearbyAlertService.syncLocationToBackend(
        coords,
        fcmToken,
        state.nearbyAlert.isCommunityNetworkActive
      );
    } catch {
      // Non-fatal if offline at cold boot
    }
  }

  let activeCount: number | null = null;
  if (coords) {
    try {
      const res = await nearbyAlertService.getActiveCount(
        coords,
        state.nearbyAlert.maxRadiusMeters
      );
      activeCount = res.activeCount;
    } catch {
      activeCount = null;
    }
  }

  return { hasPermission, coords, activeCount };
});

export const refreshCurrentLocation = createAsyncThunk<
  Coordinates,
  void,
  {
    state: { nearbyAlert: NearbyAlertState; notification: { fcmToken: string | null } };
    rejectValue: string;
  }
>('nearbyAlert/refreshCurrentLocation', async (_, { getState, rejectWithValue }) => {
  try {
    const coords = await nearbyAlertService.getCurrentLocation();
    const { nearbyAlert, notification } = getState();
    try {
      await nearbyAlertService.syncLocationToBackend(
        coords,
        notification.fcmToken,
        nearbyAlert.isCommunityNetworkActive
      );
    } catch {
      // Non-fatal
    }
    return coords;
  } catch (err: any) {
    return rejectWithValue(err?.message || 'Failed to acquire GPS location');
  }
});

export const syncCommunityNetworkToggle = createAsyncThunk<
  boolean,
  boolean,
  {
    state: {
      nearbyAlert: NearbyAlertState;
      notification: { fcmToken: string | null };
    };
  }
>('nearbyAlert/syncCommunityNetworkToggle', async (isActive, { getState }) => {
  const { nearbyAlert, notification } = getState();
  let coords = nearbyAlert.currentCoords;
  if (!coords) {
    try {
      coords = await nearbyAlertService.getCurrentLocation();
    } catch {
      coords = null;
    }
  }

  if (coords) {
    try {
      await nearbyAlertService.syncLocationToBackend(coords, notification.fcmToken, isActive);
    } catch {
      // Keep local toggle responsive even if offline
    }
  }
  return isActive;
});

export const broadcast100mSOSThunk = createAsyncThunk<
  { success: boolean; devicesNotified: number },
  BroadcastPayload | undefined,
  {
    state: {
      nearbyAlert: NearbyAlertState;
      notification: { fcmToken: string | null };
    };
    rejectValue: string;
  }
>('nearbyAlert/broadcast100mSOS', async (payload, { getState, rejectWithValue }) => {
  try {
    const { nearbyAlert, notification } = getState();
    let coords = nearbyAlert.currentCoords;
    if (!coords) {
      try {
        coords = await nearbyAlertService.getCurrentLocation();
      } catch {
        return rejectWithValue(
          'Real GPS location is unavailable. Please enable device GPS / Location.'
        );
      }
    }

    if (!coords) {
      return rejectWithValue('GPS location unavailable.');
    }

    return await nearbyAlertService.broadcast100mSOS({
      latitude: coords.latitude,
      longitude: coords.longitude,
      radiusMeters: nearbyAlert.maxRadiusMeters,
      incidentType: payload?.incidentType || 'fall',
      message: payload?.message || 'Emergency assistance requested within 3km',
      impactG: payload?.impactG || 3.8,
      ...(notification.fcmToken ? { senderFcmToken: notification.fcmToken } : {}),
    });
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to broadcast 3km SOS');
  }
});

export const simulateNearbyTestAlert = createAsyncThunk<
  NearbyAlert,
  number | undefined,
  { state: { nearbyAlert: NearbyAlertState }; rejectValue: string }
>('nearbyAlert/simulateNearbyTestAlert', async (customDistance = 650, { getState, rejectWithValue }) => {
  let coords = getState().nearbyAlert.currentCoords;
  if (!coords) {
    try {
      coords = await nearbyAlertService.getCurrentLocation();
    } catch (e: any) {
      return rejectWithValue(
        'Cannot test 3km alert without location: ' + (e?.message || 'GPS location unavailable')
      );
    }
  }

  if (!coords) {
    return rejectWithValue('Real GPS location unavailable. Turn on device location.');
  }

  return nearbyAlertService.createMockNearbyAlert(coords, customDistance);
});

export const nearbyAlertSlice = createSlice({
  name: 'nearbyAlert',
  initialState,
  reducers: {
    setCommunityNetworkActive: (state, action: PayloadAction<boolean>) => {
      state.isCommunityNetworkActive = action.payload;
    },
    setCurrentCoords: (state, action: PayloadAction<Coordinates>) => {
      state.currentCoords = action.payload;
      state.isLocating = false;
    },
    dismissIncomingAlert: (state) => {
      state.incomingAlert = null;
    },
    receiveIncomingNearbyAlert: (state, action: PayloadAction<NearbyAlert>) => {
      if (state.isCommunityNetworkActive) {
        state.incomingAlert = action.payload;
        state.nearbyAlertsHistory.unshift(action.payload);
      }
    },
    clearNearbyHistory: (state) => {
      state.nearbyAlertsHistory = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(initializeProximityNetwork.pending, (state) => {
      state.isLocating = true;
    });
    builder.addCase(initializeProximityNetwork.fulfilled, (state, action) => {
      state.isLocating = false;
      state.hasLocationPermission = action.payload.hasPermission;
      if (action.payload.coords) {
        state.currentCoords = action.payload.coords;
      }
      state.activeMeshCount = action.payload.activeCount;
    });
    builder.addCase(initializeProximityNetwork.rejected, (state) => {
      state.isLocating = false;
    });

    builder.addCase(refreshCurrentLocation.pending, (state) => {
      state.isLocating = true;
    });
    builder.addCase(refreshCurrentLocation.fulfilled, (state, action) => {
      state.isLocating = false;
      state.currentCoords = action.payload;
    });
    builder.addCase(refreshCurrentLocation.rejected, (state, action) => {
      state.isLocating = false;
      state.error = action.payload || 'Failed to acquire location';
    });

    builder.addCase(syncCommunityNetworkToggle.fulfilled, (state, action) => {
      state.isCommunityNetworkActive = action.payload;
    });

    builder.addCase(broadcast100mSOSThunk.pending, (state) => {
      state.isBroadcasting = true;
      state.error = null;
    });
    builder.addCase(broadcast100mSOSThunk.fulfilled, (state, action) => {
      state.isBroadcasting = false;
      state.lastBroadcastResult = action.payload;
    });
    builder.addCase(broadcast100mSOSThunk.rejected, (state, action) => {
      state.isBroadcasting = false;
      state.error = action.payload || 'Broadcast failed';
    });

    builder.addCase(simulateNearbyTestAlert.fulfilled, (state, action) => {
      if (state.isCommunityNetworkActive) {
        state.incomingAlert = action.payload;
        state.nearbyAlertsHistory.unshift(action.payload);
      }
    });
  },
});

export const {
  setCommunityNetworkActive,
  setCurrentCoords,
  dismissIncomingAlert,
  receiveIncomingNearbyAlert,
  clearNearbyHistory,
} = nearbyAlertSlice.actions;

export default nearbyAlertSlice.reducer;
