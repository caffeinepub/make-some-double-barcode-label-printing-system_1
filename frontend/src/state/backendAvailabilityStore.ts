import { create } from 'zustand';

interface BackendAvailabilityState {
  isAvailable: boolean;
  lastError: string | null;
  lastSuccessTime: number | null;
  lastErrorTime: number | null;
  
  // Actions
  markStopped: (errorMessage: string) => void;
  markAvailable: () => void;
  reset: () => void;
}

export const useBackendAvailability = create<BackendAvailabilityState>((set) => ({
  isAvailable: true,
  lastError: null,
  lastSuccessTime: null,
  lastErrorTime: null,
  
  markStopped: (errorMessage: string) => set({
    isAvailable: false,
    lastError: errorMessage,
    lastErrorTime: Date.now(),
  }),
  
  markAvailable: () => set({
    isAvailable: true,
    lastError: null,
    lastSuccessTime: Date.now(),
  }),
  
  reset: () => set({
    isAvailable: true,
    lastError: null,
    lastSuccessTime: null,
    lastErrorTime: null,
  }),
}));
