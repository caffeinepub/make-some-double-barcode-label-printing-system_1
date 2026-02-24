import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TypeCounter {
  prefix: string;
  labelType: string;
  scans: number;
  prints: number;
}

interface DiagnosticsState {
  totalScans: number;
  labelsPrinted: number;
  errors: number;
  typeCounters: Record<string, TypeCounter>;
  incrementScans: () => void;
  incrementPrints: () => void;
  incrementErrors: () => void;
  incrementTypeScans: (prefix: string, labelType: string) => void;
  incrementTypePrints: (prefix: string, labelType: string) => void;
}

const useDiagnosticsStore = create<DiagnosticsState>()(
  persist(
    (set) => ({
      totalScans: 0,
      labelsPrinted: 0,
      errors: 0,
      typeCounters: {},
      incrementScans: () => set((state) => ({ totalScans: state.totalScans + 1 })),
      incrementPrints: () => set((state) => ({ labelsPrinted: state.labelsPrinted + 1 })),
      incrementErrors: () => set((state) => ({ errors: state.errors + 1 })),
      incrementTypeScans: (prefix: string, labelType: string) => 
        set((state) => {
          const key = `${prefix}:${labelType}`;
          const existing = state.typeCounters[key] || { prefix, labelType, scans: 0, prints: 0 };
          return {
            typeCounters: {
              ...state.typeCounters,
              [key]: { ...existing, scans: existing.scans + 1 }
            }
          };
        }),
      incrementTypePrints: (prefix: string, labelType: string) => 
        set((state) => {
          const key = `${prefix}:${labelType}`;
          const existing = state.typeCounters[key] || { prefix, labelType, scans: 0, prints: 0 };
          return {
            typeCounters: {
              ...state.typeCounters,
              [key]: { ...existing, prints: existing.prints + 1 }
            }
          };
        }),
    }),
    {
      name: 'diagnostics',
    }
  )
);

export const useDiagnostics = () => useDiagnosticsStore();
export const incrementScans = () => useDiagnosticsStore.getState().incrementScans();
export const incrementPrints = () => useDiagnosticsStore.getState().incrementPrints();
export const incrementErrors = () => useDiagnosticsStore.getState().incrementErrors();
export const incrementTypeScans = (prefix: string, labelType: string) => 
  useDiagnosticsStore.getState().incrementTypeScans(prefix, labelType);
export const incrementTypePrints = (prefix: string, labelType: string) => 
  useDiagnosticsStore.getState().incrementTypePrints(prefix, labelType);
