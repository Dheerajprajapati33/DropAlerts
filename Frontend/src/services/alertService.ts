import api from './api';
import { API_ENDPOINTS } from '../config/api.config';
import { Alert, TriggerAlertPayload } from '../types/Alert';
import { EmergencyContact } from '../types/User';

export const alertService = {
  async getAlerts(params?: {
    page?: number;
    limit?: number;
    type?: string;
    severity?: string;
    status?: string;
  }): Promise<Alert[]> {
    const response = await api.get<{ success: boolean; data: Alert[] }>(
      API_ENDPOINTS.ALERTS.BASE,
      { params }
    );
    return response.data.data;
  },

  async triggerAlert(payload: TriggerAlertPayload): Promise<Alert> {
    const response = await api.post<{ success: boolean; data: Alert }>(
      API_ENDPOINTS.ALERTS.TRIGGER,
      payload
    );
    return response.data.data;
  },

  async dismissAlert(alertId: string): Promise<{ success: boolean; id: string }> {
    await api.post(API_ENDPOINTS.ALERTS.DISMISS(alertId));
    return { success: true, id: alertId };
  },

  async cancelAlert(alertId: string): Promise<Alert> {
    const response = await api.patch<{ success: boolean; data: Alert }>(
      API_ENDPOINTS.ALERTS.CANCEL(alertId)
    );
    return response.data.data;
  },

  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    const response = await api.get<{ success: boolean; data: EmergencyContact[] }>(
      API_ENDPOINTS.ALERTS.CONTACTS
    );
    return response.data.data;
  },

  async addEmergencyContact(
    contact: Omit<EmergencyContact, 'id'>
  ): Promise<EmergencyContact> {
    const response = await api.post<{ success: boolean; data: EmergencyContact }>(
      API_ENDPOINTS.ALERTS.CONTACTS,
      contact
    );
    return response.data.data;
  },

  async updateEmergencyContact(
    id: string,
    updates: Partial<Omit<EmergencyContact, 'id'>>
  ): Promise<EmergencyContact> {
    const response = await api.patch<{ success: boolean; data: EmergencyContact }>(
      API_ENDPOINTS.ALERTS.CONTACT_BY_ID(id),
      updates
    );
    return response.data.data;
  },

  async deleteEmergencyContact(id: string): Promise<{ success: boolean; id: string }> {
    await api.delete(API_ENDPOINTS.ALERTS.CONTACT_BY_ID(id));
    return { success: true, id };
  },
};

export default alertService;
