import api from './api';
import { API_ENDPOINTS } from '../config/api.config';
import { getClientDeviceId } from './deviceIdentity';
import { Device, DeviceSettings, PairCodeResponse, PairDeviceRequest } from '../types/Device';

export const deviceService = {
  async registerCurrentDevice(payload: {
    name: string;
    fcmToken?: string | null;
    model?: string;
    batteryLevel?: number;
  }): Promise<Device> {
    const response = await api.post<{ success: boolean; data: Device }>(
      API_ENDPOINTS.DEVICES.BASE,
      {
        deviceId: getClientDeviceId(),
        name: payload.name,
        platform: 'android',
        type: 'phone',
        ...(payload.fcmToken ? { fcmToken: payload.fcmToken } : {}),
        ...(payload.model ? { model: payload.model } : {}),
        ...(typeof payload.batteryLevel === 'number'
          ? { batteryLevel: payload.batteryLevel }
          : {}),
      }
    );
    return response.data.data;
  },

  async getSelfDevice(): Promise<Device> {
    const response = await api.get<{ success: boolean; data: Device }>(
      API_ENDPOINTS.DEVICES.SELF
    );
    return response.data.data;
  },

  async getDevices(): Promise<Device[]> {
    const response = await api.get<{ success: boolean; data: Device[] }>(
      API_ENDPOINTS.DEVICES.BASE
    );
    return response.data.data;
  },

  async generatePairCode(deviceName?: string): Promise<PairCodeResponse> {
    const response = await api.post<{ success: boolean; data: PairCodeResponse }>(
      API_ENDPOINTS.DEVICES.PAIR_CODE,
      {
        deviceId: getClientDeviceId(),
        ...(deviceName ? { deviceName } : {}),
      }
    );
    return response.data.data;
  },

  async pairDevice(payload: PairDeviceRequest): Promise<Device> {
    const response = await api.post<{ success: boolean; data: Device }>(
      API_ENDPOINTS.DEVICES.PAIR,
      {
        ...payload,
        localDeviceId: payload.localDeviceId || getClientDeviceId(),
      }
    );
    return response.data.data;
  },

  async updateDevice(id: string, updates: Partial<Device>): Promise<Device> {
    const response = await api.patch<{ success: boolean; data: Device }>(
      API_ENDPOINTS.DEVICES.BY_ID(id),
      updates
    );
    return response.data.data;
  },

  async updateDeviceSettings(
    id: string,
    settings: Partial<DeviceSettings>
  ): Promise<DeviceSettings> {
    const response = await api.patch<{ success: boolean; settings: DeviceSettings }>(
      API_ENDPOINTS.DEVICES.SETTINGS(id),
      settings
    );
    return response.data.settings;
  },

  async unpairDevice(id: string): Promise<{ success: boolean; id: string }> {
    const response = await api.delete<{ success: boolean; id: string }>(
      API_ENDPOINTS.DEVICES.BY_ID(id)
    );
    return { success: true, id: response.data.id || id };
  },

  async pingDevice(id: string): Promise<{ isOnline: boolean; latencyMs: number }> {
    const response = await api.post<{ isOnline: boolean; latencyMs: number }>(
      API_ENDPOINTS.DEVICES.PING(id)
    );
    return response.data;
  },
};

export default deviceService;
