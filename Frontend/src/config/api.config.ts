/**
 * Backend API Configuration (Android Only)
 * Connected via ngrok tunnel; endpoints append onto /api
 */
export const API_BASE_URL = 'https://bouncy-ember-enlisted.ngrok-free.dev/api/v1';

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
};

export const API_ENDPOINTS = {
  HEALTH: '/health',
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    GOOGLE: '/auth/google',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
  },
  DEVICES: {
    BASE: '/devices',
    SELF: '/devices/self',
    PAIR_CODE: '/devices/pair-code',
    PAIR: '/devices/pair',
    PING: (id: string) => `/devices/${id}/ping`,
    FCM_TOKEN: (id: string) => `/devices/${id}/fcm-token`,
    SETTINGS: (id: string) => `/devices/${id}/settings`,
    PAIRED: (id: string) => `/devices/${id}/paired`,
    BY_ID: (id: string) => `/devices/${id}`,
  },
  FALLS: {
    REPORT: '/falls/report',
    HISTORY: '/falls/history',
    CANCEL: (id: string) => `/falls/${id}/cancel`,
    ACKNOWLEDGE: (id: string) => `/falls/${id}/acknowledge`,
  },
  ALERTS: {
    BASE: '/alerts',
    TRIGGER: '/alerts/trigger',
    DISMISS: (id: string) => `/alerts/${id}/dismiss`,
    CANCEL: (id: string) => `/alerts/${id}/cancel`,
    BY_ID: (id: string) => `/alerts/${id}`,
    CONTACTS: '/alerts/contacts',
    CONTACT_BY_ID: (id: string) => `/alerts/contacts/${id}`,
  },
  NOTIFICATIONS: {
    BASE: '/notifications',
    TOKEN: '/notifications/token',
    READ: (id: string) => `/notifications/${id}/read`,
    READ_ALL: '/notifications/read-all',
  },
  NEARBY: {
    UPDATE_LOCATION: '/nearby/location',
    BROADCAST_100M: '/nearby/broadcast',
    ACTIVE_COUNT: '/nearby/active-count',
  },
} as const;

export default API_CONFIG;
