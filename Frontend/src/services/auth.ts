import api, { setAuthToken } from './api';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api.config';
import { User, AuthResponse, EmergencyContact } from '../types/User';
import motionSensorService from './motionSensor';
import { getClientDeviceId } from './deviceIdentity';

export interface LoginCredentials {
  identifier: string; // Email or mobile number
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  emergencyContacts?: Omit<EmergencyContact, 'id'>[];
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<{ success: boolean; data: AuthResponse }>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    );
    const authData = response.data.data;
    setAuthToken(authData.token);
    motionSensorService.syncNativeConfig({
      authToken: authData.token,
      apiBaseUrl: API_BASE_URL,
      deviceId: getClientDeviceId(),
      deviceName: `${authData.user.name || 'My'}'s Phone`,
    });
    return authData;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const response = await api.post<{ success: boolean; data: AuthResponse }>(
      API_ENDPOINTS.AUTH.REGISTER,
      payload
    );
    const authData = response.data.data;
    setAuthToken(authData.token);
    motionSensorService.syncNativeConfig({
      authToken: authData.token,
      apiBaseUrl: API_BASE_URL,
      deviceId: getClientDeviceId(),
      deviceName: `${authData.user.name || 'My'}'s Phone`,
    });
    return authData;
  },

  async googleLogin(idToken: string): Promise<AuthResponse> {
    const response = await api.post<{ success: boolean; data: AuthResponse }>(
      API_ENDPOINTS.AUTH.GOOGLE,
      { idToken }
    );
    const authData = response.data.data;
    setAuthToken(authData.token);
    motionSensorService.syncNativeConfig({
      authToken: authData.token,
      apiBaseUrl: API_BASE_URL,
      deviceId: getClientDeviceId(),
      deviceName: `${authData.user.name || 'My'}'s Phone`,
    });
    return authData;
  },

  async forgotPassword(identifier: string): Promise<{ message: string; devOtp?: string }> {
    const response = await api.post<{ success: boolean; message: string; devOtp?: string }>(
      API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
      { identifier }
    );
    return response.data;
  },

  async resetPassword(
    identifier: string,
    otp: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(
      API_ENDPOINTS.AUTH.RESET_PASSWORD,
      { identifier, otp, newPassword }
    );
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch {
      // Ignore network errors during logout
    } finally {
      setAuthToken(null);
      motionSensorService.syncNativeConfig({ authToken: '' });
    }
  },

  async getProfile(): Promise<User> {
    const response = await api.get<{ success: boolean; data: User }>(API_ENDPOINTS.AUTH.ME);
    return response.data.data;
  },

  async updateProfile(updates: UpdateProfilePayload): Promise<User> {
    const response = await api.put<{ success: boolean; data: User }>(
      API_ENDPOINTS.AUTH.ME,
      updates
    );
    return response.data.data;
  },

  async deleteAccount(): Promise<void> {
    await api.delete(API_ENDPOINTS.AUTH.ME);
    setAuthToken(null);
  },
};

export default authService;
