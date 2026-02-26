import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePrinterStore } from '../services/printerService';
import { addLog } from './logStore';
import { incrementPrints } from './diagnosticsStore';

export interface PrintHistoryEntry {
  timestamp: number;
  prefix: string;
  leftSerial: string;
  rightSerial: string;
  labelType: string;
  cpcl: string;
  success: boolean;
}

interface PrintHistoryState {
  history: PrintHistoryEntry[];
  addEntry: (entry: PrintHistoryEntry) => void;
}

const usePrintHistoryStore = create<PrintHistoryState>()(
  persist(
    (set) => ({
      history: [],
      addEntry: (entry) =>
        set((state) => ({
          history: [entry, ...state.history].slice(0, 1000),
        })),
    }),
    {
      name: 'print-history',
    }
  )
);

export function usePrintHistory() {
  const { history } = usePrintHistoryStore();
  const printCPCL = usePrinterStore((s) => s.printCPCL);

  const reprint = async (index: number) => {
    const entry = history[index];
    if (!entry) return;

    try {
      await printCPCL(entry.cpcl);
      addLog('info', `Reprinted label: ${entry.leftSerial} / ${entry.rightSerial}`);
      incrementPrints();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      addLog('error', `Reprint failed: ${msg}`);
    }
  };

  return { history, reprint };
}

export const addPrintHistory = (entry: PrintHistoryEntry) => {
  usePrintHistoryStore.getState().addEntry(entry);
};
