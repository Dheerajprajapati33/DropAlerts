import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  FallDetectionStage,
  FallEvent,
  FallSensitivity,
  PendingFallAlert,
  ReportFallPayload,
} from '../../types/FallEvent';
import fallDetectionService from '../../services/fallDetection';

export interface FallState {
  isMonitoring: boolean;
  sensitivity: FallSensitivity;
  detectorStage: FallDetectionStage;
  sensorAvailable: boolean;
  hasGyroscope: boolean;
  pendingFall: PendingFallAlert | null;
  recentFalls: FallEvent[];
  activeFallEvent: FallEvent | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: FallState = {
  isMonitoring: true,
  sensitivity: 'Medium',
  detectorStage: 'normal',
  sensorAvailable: false,
  hasGyroscope: false,
  pendingFall: null,
  recentFalls: [],
  activeFallEvent: null,
  isLoading: false,
  error: null,
};

export const reportFallEvent = createAsyncThunk<
  FallEvent,
  ReportFallPayload,
  { rejectValue: string }
>('fall/reportFallEvent', async (payload, { rejectWithValue }) => {
  try {
    return await fallDetectionService.reportFall(payload);
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to report fall event');
  }
});

export const fetchFallHistory = createAsyncThunk<FallEvent[], void, { rejectValue: string }>(
  'fall/fetchFallHistory',
  async (_, { rejectWithValue }) => {
    try {
      return await fallDetectionService.getFallHistory();
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch fall history');
    }
  }
);

export const cancelFalseAlarm = createAsyncThunk<string, string, { rejectValue: string }>(
  'fall/cancelFalseAlarm',
  async (fallId, { rejectWithValue }) => {
    try {
      const res = await fallDetectionService.cancelFalseAlarm(fallId);
      return res.id;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to cancel fall alarm');
    }
  }
);

export const acknowledgeFallEvent = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>('fall/acknowledgeFallEvent', async (fallId, { rejectWithValue }) => {
  try {
    const res = await fallDetectionService.acknowledgeFall(fallId);
    return res.id;
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to acknowledge fall');
  }
});

export const fallSlice = createSlice({
  name: 'fall',
  initialState,
  reducers: {
    toggleMonitoring: (state) => {
      state.isMonitoring = !state.isMonitoring;
      if (!state.isMonitoring) {
        state.detectorStage = 'normal';
      }
    },
    setMonitoring: (state, action: PayloadAction<boolean>) => {
      state.isMonitoring = action.payload;
      if (!action.payload) {
        state.detectorStage = 'normal';
      }
    },
    setSensitivity: (state, action: PayloadAction<FallSensitivity>) => {
      state.sensitivity = action.payload;
    },
    setDetectorStage: (state, action: PayloadAction<FallDetectionStage>) => {
      state.detectorStage = action.payload;
    },
    setSensorAvailability: (
      state,
      action: PayloadAction<{ accelerometer: boolean; gyroscope: boolean }>
    ) => {
      state.sensorAvailable = action.payload.accelerometer;
      state.hasGyroscope = action.payload.gyroscope;
    },
    triggerPendingFall: (state, action: PayloadAction<PendingFallAlert>) => {
      if (!state.pendingFall) {
        state.pendingFall = action.payload;
      }
    },
    clearPendingFall: (state) => {
      state.pendingFall = null;
      state.detectorStage = 'normal';
    },
    clearActiveFallEvent: (state) => {
      state.activeFallEvent = null;
    },
    resetFalls: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(reportFallEvent.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(reportFallEvent.fulfilled, (state, action) => {
      state.isLoading = false;
      state.pendingFall = null;
      state.activeFallEvent = action.payload;
      const alreadyExists = state.recentFalls.some((f) => f.id === action.payload.id);
      if (!alreadyExists) {
        state.recentFalls.unshift(action.payload);
      }
    });
    builder.addCase(reportFallEvent.rejected, (state, action) => {
      state.isLoading = false;
      state.pendingFall = null;
      state.error = action.payload || 'Failed to report fall';
    });

    builder.addCase(fetchFallHistory.fulfilled, (state, action) => {
      state.recentFalls = action.payload;
    });

    builder.addCase(cancelFalseAlarm.fulfilled, (state, action) => {
      if (state.activeFallEvent?.id === action.payload) {
        state.activeFallEvent = null;
      }
      const fall = state.recentFalls.find((f) => f.id === action.payload);
      if (fall) {
        fall.status = 'cancelled';
      }
    });

    builder.addCase(acknowledgeFallEvent.fulfilled, (state, action) => {
      const fall = state.recentFalls.find((f) => f.id === action.payload);
      if (fall) {
        fall.status = 'acknowledged';
      }
    });
  },
});

export const {
  toggleMonitoring,
  setMonitoring,
  setSensitivity,
  setDetectorStage,
  setSensorAvailability,
  triggerPendingFall,
  clearPendingFall,
  clearActiveFallEvent,
  resetFalls,
} = fallSlice.actions;
export default fallSlice.reducer;
