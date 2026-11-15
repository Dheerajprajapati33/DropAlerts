import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Alert, TriggerAlertPayload } from '../../types/Alert';
import { EmergencyContact } from '../../types/User';
import alertService from '../../services/alertService';

export interface AlertState {
  alerts: Alert[];
  activeAlert: Alert | null;
  unreadCount: number;
  emergencyContacts: EmergencyContact[];
  isLoading: boolean;
  error: string | null;
}

const initialState: AlertState = {
  alerts: [],
  activeAlert: null,
  unreadCount: 0,
  emergencyContacts: [],
  isLoading: false,
  error: null,
};

export const fetchAlerts = createAsyncThunk<Alert[], void, { rejectValue: string }>(
  'alert/fetchAlerts',
  async (_, { rejectWithValue }) => {
    try {
      return await alertService.getAlerts();
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch alerts');
    }
  }
);

export const triggerEmergencyAlert = createAsyncThunk<
  Alert,
  TriggerAlertPayload,
  { rejectValue: string }
>('alert/triggerEmergencyAlert', async (payload, { rejectWithValue }) => {
  try {
    return await alertService.triggerAlert(payload);
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to trigger emergency alert');
  }
});

export const dismissAlert = createAsyncThunk<string, string, { rejectValue: string }>(
  'alert/dismissAlert',
  async (alertId, { rejectWithValue }) => {
    try {
      const res = await alertService.dismissAlert(alertId);
      return res.id;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to dismiss alert');
    }
  }
);

export const fetchEmergencyContacts = createAsyncThunk<
  EmergencyContact[],
  void,
  { rejectValue: string }
>('alert/fetchEmergencyContacts', async (_, { rejectWithValue }) => {
  try {
    return await alertService.getEmergencyContacts();
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to fetch contacts');
  }
});

export const addEmergencyContact = createAsyncThunk<
  EmergencyContact,
  Omit<EmergencyContact, 'id'>,
  { rejectValue: string }
>('alert/addEmergencyContact', async (contact, { rejectWithValue }) => {
  try {
    return await alertService.addEmergencyContact(contact);
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to add contact');
  }
});

export const deleteEmergencyContact = createAsyncThunk<
  string,
  string,
  { rejectValue: string }
>('alert/deleteEmergencyContact', async (id, { rejectWithValue }) => {
  try {
    const res = await alertService.deleteEmergencyContact(id);
    return res.id;
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to delete contact');
  }
});

export const alertSlice = createSlice({
  name: 'alert',
  initialState,
  reducers: {
    markAllAsRead: (state) => {
      state.unreadCount = 0;
      state.alerts.forEach((a) => {
        a.isHighlighted = false;
      });
    },
    clearActiveAlert: (state) => {
      state.activeAlert = null;
    },
    resetAlerts: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addCase(fetchAlerts.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchAlerts.fulfilled, (state, action: PayloadAction<Alert[]>) => {
      state.isLoading = false;
      state.alerts = action.payload;
      state.unreadCount = action.payload.filter((a) => a.isHighlighted).length;
    });
    builder.addCase(fetchAlerts.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload || 'Failed to load alerts';
    });

    builder.addCase(triggerEmergencyAlert.fulfilled, (state, action: PayloadAction<Alert>) => {
      state.activeAlert = action.payload;
      state.alerts.unshift(action.payload);
      state.unreadCount += 1;
    });

    builder.addCase(dismissAlert.fulfilled, (state, action: PayloadAction<string>) => {
      const alert = state.alerts.find((a) => a.id === action.payload);
      if (alert) {
        alert.status = 'dismissed';
        alert.isHighlighted = false;
      }
      if (state.activeAlert?.id === action.payload) {
        state.activeAlert = null;
      }
      state.unreadCount = state.alerts.filter((a) => a.isHighlighted).length;
    });

    builder.addCase(fetchEmergencyContacts.fulfilled, (state, action) => {
      state.emergencyContacts = action.payload;
    });
    builder.addCase(addEmergencyContact.fulfilled, (state, action) => {
      state.emergencyContacts.push(action.payload);
    });
    builder.addCase(deleteEmergencyContact.fulfilled, (state, action) => {
      state.emergencyContacts = state.emergencyContacts.filter(
        (c) => c.id !== action.payload
      );
    });
  },
});

export const { markAllAsRead, clearActiveAlert, resetAlerts } = alertSlice.actions;
export default alertSlice.reducer;
