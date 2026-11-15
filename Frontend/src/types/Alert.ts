export type AlertSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type AlertType = 'fall' | 'received' | 'sent' | 'system' | 'emergency';
export type AlertStatus =
  | 'detected'
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'acknowledged'
  | 'resolved'
  | 'dismissed'
  | 'cancelled';

export interface Alert {
  id: string;
  userId?: string;
  fallEventId?: string;
  title: string;
  message?: string;
  severity: AlertSeverity;
  type: AlertType;
  status: AlertStatus;
  timestamp: string;
  device?: string;
  location?: string;
  isHighlighted?: boolean;
  contactsNotified?: string[];
}

export interface TriggerAlertPayload {
  title: string;
  message?: string;
  severity?: AlertSeverity;
  type?: AlertType;
  device?: string;
  location?: string;
}
