import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePrinterService } from '../services/printerService';
import { addLog } from './logStore';
import { incrementPrints } from './diagnosticsStore';

interface PrintHistoryEntry {
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
      addEntry: (entry) => set((state) => ({ 
        history: [entry, ...state.history].slice(0, 1000) // Keep last 1000 entries
      })),
    }),
    {
      name: 'print-history',
    }
  )
);

export function usePrintHistory() {
  const { history } = usePrintHistoryStore();
  const { sendCPCL } = usePrinterService();

  const reprint = async (index: number) => {
    const entry = history[index];
    if (!entry) return;

    try {
      await sendCPCL(entry.cpcl);
      addLog('info', `Reprinted label: ${entry.leftSerial} / ${entry.rightSerial}`);
      incrementPrints();
    } catch (error: any) {
      addLog('error', `Reprint failed: ${error.message}`);
    }
  };

  return { history, reprint };
}

export const addPrintHistory = (entry: PrintHistoryEntry) => {
  usePrintHistoryStore.getState().addEntry(entry);
};
