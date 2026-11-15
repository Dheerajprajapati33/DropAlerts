import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  Device,
  DeviceSettings,
  PairCodeResponse,
  PairDeviceRequest,
} from '../../types/Device';
import deviceService from '../../services/deviceService';

export interface DeviceState {
  devices: Device[];
  currentDevice: Device | null;
  pairCodeData: PairCodeResponse | null;
  selectedDevice: Device | null;
  isScanning: boolean;
  isPairing: boolean;
  isGeneratingCode: boolean;
  isLoading: boolean;
  error: string | null;
  hasPairedFirstDevice: boolean;
}

const initialState: DeviceState = {
  devices: [],
  currentDevice: null,
  pairCodeData: null,
  selectedDevice: null,
  isScanning: false,
  isPairing: false,
  isGeneratingCode: false,
  isLoading: false,
  error: null,
  hasPairedFirstDevice: false,
};

export const registerSelfDevice = createAsyncThunk<
  Device,
  { name: string; fcmToken?: string | null },
  { rejectValue: string }
>('device/registerSelfDevice', async (payload, { rejectWithValue }) => {
  try {
    return await deviceService.registerCurrentDevice(payload);
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to register current device');
  }
});

export const fetchDevices = createAsyncThunk<Device[], void, { rejectValue: string }>(
  'device/fetchDevices',
  async (_, { rejectWithValue }) => {
    try {
      return await deviceService.getDevices();
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch devices');
    }
  }
);

export const generatePairCode = createAsyncThunk<
  PairCodeResponse,
  string | undefined,
  { rejectValue: string }
>('device/generatePairCode', async (deviceName, { rejectWithValue }) => {
  try {
    return await deviceService.generatePairCode(deviceName);
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to generate pairing code');
  }
});

export const pairDevice = createAsyncThunk<
  Device,
  PairDeviceRequest,
  { rejectValue: string }
>('device/pairDevice', async (payload, { rejectWithValue }) => {
  try {
    return await deviceService.pairDevice(payload);
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to pair device');
  }
});

export const unpairDevice = createAsyncThunk<string, string, { rejectValue: string }>(
  'device/unpairDevice',
  async (deviceId, { rejectWithValue }) => {
    try {
      const res = await deviceService.unpairDevice(deviceId);
      return res.id;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to unpair device');
    }
  }
);

export const updateDeviceStatus = createAsyncThunk<
  Device,
  { id: string; updates: Partial<Device> },
  { rejectValue: string }
>('device/updateDeviceStatus', async ({ id, updates }, { rejectWithValue }) => {
  try {
    return await deviceService.updateDevice(id, updates);
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to update device');
  }
});

export const updateSelfDeviceSettings = createAsyncThunk<
  DeviceSettings,
  Partial<DeviceSettings>,
  { state: { device: DeviceState }; rejectValue: string }
>('device/updateSelfDeviceSettings', async (settings, { getState, rejectWithValue }) => {
  try {
    let targetId = getState().device.currentDevice?.id;
    if (!targetId) {
      const self = await deviceService.getSelfDevice();
      targetId = self.id;
    }
    return await deviceService.updateDeviceSettings(targetId, settings);
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to update settings');
  }
});

export const deviceSlice = createSlice({
  name: 'device',
  initialState,
  reducers: {
    setScanning: (state, action: PayloadAction<boolean>) => {
      state.isScanning = action.payload;
    },
    setSelectedDevice: (state, action: PayloadAction<Device | null>) => {
      state.selectedDevice = action.payload;
    },
    clearDeviceError: (state) => {
      state.error = null;
    },
    resetDevices: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(registerSelfDevice.fulfilled, (state, action) => {
      state.currentDevice = action.payload;
    });

    builder.addCase(fetchDevices.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchDevices.fulfilled, (state, action) => {
      state.isLoading = false;
      state.devices = action.payload;
      state.hasPairedFirstDevice = action.payload.length > 0;
    });
    builder.addCase(fetchDevices.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || 'Failed to fetch devices';
    });

    builder.addCase(generatePairCode.pending, (state) => {
      state.isGeneratingCode = true;
      state.error = null;
    });
    builder.addCase(generatePairCode.fulfilled, (state, action) => {
      state.isGeneratingCode = false;
      state.pairCodeData = action.payload;
    });
    builder.addCase(generatePairCode.rejected, (state, action) => {
      state.isGeneratingCode = false;
      state.error = action.payload || 'Failed to generate pairing code';
    });

    builder.addCase(pairDevice.pending, (state) => {
      state.isPairing = true;
      state.error = null;
    });
    builder.addCase(pairDevice.fulfilled, (state, action) => {
      state.isPairing = false;
      state.hasPairedFirstDevice = true;
      const existingIndex = state.devices.findIndex((d) => d.id === action.payload.id);
      if (existingIndex >= 0) {
        state.devices[existingIndex] = action.payload;
      } else {
        state.devices.unshift(action.payload);
      }
    });
    builder.addCase(pairDevice.rejected, (state, action) => {
      state.isPairing = false;
      state.error = action.payload || 'Failed to pair device';
    });

    builder.addCase(unpairDevice.fulfilled, (state, action) => {
      state.devices = state.devices.filter((d) => d.id !== action.payload);
      state.hasPairedFirstDevice = state.devices.length > 0;
    });

    builder.addCase(updateDeviceStatus.fulfilled, (state, action) => {
      const index = state.devices.findIndex((d) => d.id === action.payload.id);
      if (index >= 0) {
        state.devices[index] = action.payload;
      }
    });

    builder.addCase(updateSelfDeviceSettings.fulfilled, (state, action) => {
      if (state.currentDevice) {
        state.currentDevice.settings = action.payload;
      }
    });

    builder.addMatcher(
      (action) =>
        action.type === 'auth/logoutUser/fulfilled' ||
        action.type === 'auth/deleteUserAccount/fulfilled',
      () => initialState
    );
  },
});

export const { setScanning, setSelectedDevice, clearDeviceError, resetDevices } =
  deviceSlice.actions;
export default deviceSlice.reducer;
