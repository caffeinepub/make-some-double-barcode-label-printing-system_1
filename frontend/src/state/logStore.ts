import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type LogLevel = 'info' | 'warn' | 'error';

interface LogMetadata {
  category?: string;
  barcodeIndex?: 1 | 2;
  reasonCode?: string;
  computedValue?: number;
  clampedValue?: number;
  [key: string]: any;
}

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
}

interface LogState {
  logs: LogEntry[];
  addLog: (level: LogLevel, message: string, metadata?: LogMetadata) => void;
}

const useLogStore = create<LogState>()(
  persist(
    (set) => ({
      logs: [],
      addLog: (level, message, metadata) => set((state) => ({
        logs: [
          { timestamp: Date.now(), level, message, metadata },
          ...state.logs,
        ].slice(0, 1000), // Keep last 1000 logs
      })),
    }),
    {
      name: 'system-logs',
    }
  )
);

export const addLog = (level: LogLevel, message: string, metadata?: LogMetadata) => {
  useLogStore.getState().addLog(level, message, metadata);
};

export const useLogs = () => {
  const logs = useLogStore((state) => state.logs);
  return { logs };
};

export default useLogStore;
