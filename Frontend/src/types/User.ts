export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  isPrimary?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role?: 'user' | 'admin';
  emergencyContacts?: EmergencyContact[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}
