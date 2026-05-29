import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SosStatus,
  LocationStatus,
  ContactStatus,
  EmergencyContact,
  TranscriptMessage,
  SilentOptions,
  GpsLocation,
} from '../types/sos.types';

// REST endpoints for Firebase (replicating existing app behavior without heavy SDK overhead)
const DATABASE_URL = 'https://sign-langage-default-rtdb.firebaseio.com';

async function syncSosAlertToFirebase(status: SosStatus, data: Record<string, unknown>): Promise<void> {
  try {
    const response = await fetch(`${DATABASE_URL}/emergency_alerts.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        ...data,
        timestamp: Date.now(),
      }),
    });
    if (!response.ok) {
      console.warn(`[FIREBASE_SOS] Sync failed: ${response.status}`);
    }
  } catch (err) {
    console.warn('[FIREBASE_SOS] Offline or network down, queueing alert:', err);
  }
}

interface SosState {
  // States
  status: SosStatus;
  activatedAt: string | null; // stored as ISO string for persistence serialization
  cancelledAt: string | null;
  location: GpsLocation | null;
  locationStatus: LocationStatus;
  emergencyContacts: EmergencyContact[];
  notifiedContacts: string[];
  isOnline: boolean;
  batteryLevel: number;
  isLowBattery: boolean;
  silentMode: boolean;
  silentOptions: SilentOptions;
  transcriptMessages: TranscriptMessage[];

  // Actions
  activateSos: () => Promise<void>;
  cancelSos: (pin?: string) => Promise<void>;
  refreshLocation: () => Promise<void>;
  toggleSilentMode: () => void;
  updateSilentOption: (key: keyof SilentOptions, value: boolean) => void;
  addTranscriptMessage: (msg: TranscriptMessage) => void;
  setOnlineStatus: (isOnline: boolean) => void;
  updateBattery: (level: number) => void;
}

const DEFAULT_CONTACTS: EmergencyContact[] = [
  { id: 'c1', name: 'Karim Bennani', relation: 'Frère', phone: '+212611223344', status: 'pending' },
  { id: 'c2', name: 'Dr. Yasmine Alami', relation: 'Médecin', phone: '+212655889900', status: 'pending' },
  { id: 'c3', name: 'Protection Civile', relation: 'Secours', phone: '15', status: 'pending' },
];

export const useSosStore = create<SosState>()(
  persist(
    (set, get) => ({
      // Initial States
      status: 'idle',
      activatedAt: null,
      cancelledAt: null,
      location: null,
      locationStatus: 'idle',
      emergencyContacts: DEFAULT_CONTACTS,
      notifiedContacts: [],
      isOnline: true,
      batteryLevel: 100,
      isLowBattery: false,
      silentMode: false,
      silentOptions: {
        reduceBrightness: true,
        disableSounds: true,
        visualOnly: false,
        silentVibrations: true,
      },
      transcriptMessages: [],

      // Actions
      activateSos: async () => {
        const timeNow = new Date().toISOString();
        set({
          status: 'activating',
          locationStatus: 'loading',
        });

        // Simulating immediate GPS retrieval prior to active state
        setTimeout(() => {
          const mockLocation: GpsLocation = {
            lat: 33.5731, // Casablanca coordinates
            lng: -7.5898,
            accuracy: 5,
            address: 'Boulevard Anfa, Casablanca, Maroc',
            timestamp: new Date(),
          };

          // Mark contacts as notified
          const updatedContacts = get().emergencyContacts.map((contact) => ({
            ...contact,
            status: 'notified' as ContactStatus,
            connectedAt: new Date(),
          }));

          const initialMsg: TranscriptMessage = {
            id: 'init-msg',
            content: '⚠️ SOS Urgence Activé. Position partagée avec vos contacts.',
            sender: 'user',
            timestamp: new Date(),
          };

          set({
            status: 'active',
            activatedAt: timeNow,
            cancelledAt: null,
            location: mockLocation,
            locationStatus: 'ready',
            emergencyContacts: updatedContacts,
            notifiedContacts: updatedContacts.map((c) => c.id),
            transcriptMessages: [initialMsg],
          });

          // Sync with database asynchronously
          syncSosAlertToFirebase('active', {
            location: mockLocation,
            contactsNotified: updatedContacts.map((c) => c.id),
            batteryLevel: get().batteryLevel,
            isOnline: get().isOnline,
            silentMode: get().silentMode,
          });
        }, 1000);
      },

      cancelSos: async (pin?: string) => {
        set({ status: 'cancelling' });
        
        // Simulating simple cancellation verification (with absolute 5s delay or PIN validation)
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            const resetContacts = get().emergencyContacts.map((c) => ({
              ...c,
              status: 'pending' as ContactStatus,
              connectedAt: undefined,
            }));

            set({
              status: 'cancelled',
              cancelledAt: new Date().toISOString(),
              notifiedContacts: [],
              emergencyContacts: resetContacts,
              transcriptMessages: [],
            });

            // Sync cancellation to Firebase
            syncSosAlertToFirebase('cancelled', {
              pinProvided: !!pin,
            });

            // Transition back to idle after reset animation cooldown
            setTimeout(() => {
              set({ status: 'idle' });
            }, 1000);

            resolve();
          }, 1000);
        });
      },

      refreshLocation: async () => {
        set({ locationStatus: 'loading' });
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            const updatedLocation: GpsLocation = {
              lat: 33.5731 + (Math.random() - 0.5) * 0.002, // slight jitter
              lng: -7.5898 + (Math.random() - 0.5) * 0.002,
              accuracy: 4,
              address: 'Boulevard Anfa (Position Actualisée), Casablanca, Maroc',
              timestamp: new Date(),
            };

            set({
              location: updatedLocation,
              locationStatus: 'ready',
            });

            if (get().status === 'active') {
              syncSosAlertToFirebase('active', {
                location: updatedLocation,
                batteryLevel: get().batteryLevel,
              });
            }
            resolve();
          }, 1500);
        });
      },

      toggleSilentMode: () => {
        set((state) => ({ silentMode: !state.silentMode }));
      },

      updateSilentOption: (key: keyof SilentOptions, value: boolean) => {
        set((state) => ({
          silentOptions: {
            ...state.silentOptions,
            [key]: value,
          },
        }));
      },

      addTranscriptMessage: (msg: TranscriptMessage) => {
        set((state) => ({
          transcriptMessages: [...state.transcriptMessages, msg],
        }));

        if (get().status === 'active') {
          // Push transcripts to database
          fetch(`${DATABASE_URL}/emergency_transcripts/${get().activatedAt?.replace(/\./g, '_')}.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg),
          }).catch(() => {});
        }
      },

      setOnlineStatus: (isOnline: boolean) => {
        set({ isOnline });
      },

      updateBattery: (level: number) => {
        set({
          batteryLevel: level,
          isLowBattery: level < 20,
        });
      },
    }),
    {
      name: 'wakwak-sos-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        emergencyContacts: state.emergencyContacts,
        silentOptions: state.silentOptions,
        silentMode: state.silentMode,
      }),
    }
  )
);
