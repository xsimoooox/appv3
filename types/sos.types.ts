export type SosStatus = 'idle' | 'activating' | 'active' | 'cancelling' | 'cancelled';
export type LocationStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
export type ContactStatus = 'pending' | 'notified' | 'connected' | 'unreachable';

export interface GpsLocation {
  lat: number;
  lng: number;
  accuracy: number;
  address: string;
  timestamp: Date;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  avatarUrl?: string;
  status: ContactStatus;
  connectedAt?: Date;
}

export interface TranscriptMessage {
  id: string;
  content: string;
  sender: 'user' | 'contact';
  contactId?: string;
  timestamp: Date;
  isSign?: boolean;
}

export interface SilentOptions {
  reduceBrightness: boolean;
  disableSounds: boolean;
  visualOnly: boolean;
  silentVibrations: boolean;
}

export interface SosButtonProps {
  onActivate: () => void;
  status: SosStatus;
  disabled?: boolean;
}
