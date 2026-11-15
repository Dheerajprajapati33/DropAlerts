import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import notificationService, {
  InboxNotificationItem,
} from '../../services/notifications';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  alertId?: string;
  readAt?: string | null;
  timestamp: string;
}

export interface NotificationState {
  fcmToken: string | null;
  pushEnabled: boolean;
  alertSoundEnabled: boolean;
  vibrationEnabled: boolean;
  notifications: NotificationItem[];
  isRegisteringToken: boolean;
}

const initialState: NotificationState = {
  fcmToken: null,
  pushEnabled: true,
  alertSoundEnabled: true,
  vibrationEnabled: true,
  notifications: [],
  isRegisteringToken: false,
};

export const registerFcmToken = createAsyncThunk<string, string>(
  'notification/registerFcmToken',
  async (token) => {
    await notificationService.registerDeviceToken(token);
    return token;
  }
);

export const fetchNotifications = createAsyncThunk<
  InboxNotificationItem[],
  void,
  { rejectValue: string }
>('notification/fetchNotifications', async (_, { rejectWithValue }) => {
  try {
    return await notificationService.getNotifications();
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to fetch notifications');
  }
});

export const markAllNotificationsRead = createAsyncThunk<void, void>(
  'notification/markAllNotificationsRead',
  async () => {
    await notificationService.markAllAsRead();
  }
);

export const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    setFcmToken: (state, action: PayloadAction<string | null>) => {
      state.fcmToken = action.payload;
    },
    setPushEnabled: (state, action: PayloadAction<boolean>) => {
      state.pushEnabled = action.payload;
    },
    setAlertSoundEnabled: (state, action: PayloadAction<boolean>) => {
      state.alertSoundEnabled = action.payload;
    },
    setVibrationEnabled: (state, action: PayloadAction<boolean>) => {
      state.vibrationEnabled = action.payload;
    },
    addNotificationItem: (
      state,
      action: PayloadAction<Omit<NotificationItem, 'id'>>
    ) => {
      state.notifications.unshift({
        id: 'n_' + Date.now(),
        ...action.payload,
      });
    },
    clearAllNotifications: (state) => {
      state.notifications = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(registerFcmToken.pending, (state) => {
      state.isRegisteringToken = true;
    });
    builder.addCase(registerFcmToken.fulfilled, (state, action) => {
      state.isRegisteringToken = false;
      state.fcmToken = action.payload;
    });
    builder.addCase(registerFcmToken.rejected, (state) => {
      state.isRegisteringToken = false;
    });

    builder.addCase(fetchNotifications.fulfilled, (state, action) => {
      state.notifications = action.payload;
    });

    builder.addCase(markAllNotificationsRead.fulfilled, (state) => {
      const now = new Date().toISOString();
      state.notifications.forEach((n) => {
        if (!n.readAt) n.readAt = now;
      });
    });
  },
});

export const {
  setFcmToken,
  setPushEnabled,
  setAlertSoundEnabled,
  setVibrationEnabled,
  addNotificationItem,
  clearAllNotifications,
} = notificationSlice.actions;

export default notificationSlice.reducer;
