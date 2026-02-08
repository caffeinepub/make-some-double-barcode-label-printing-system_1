import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
}

interface LogState {
  logs: LogEntry[];
  addLog: (level: LogLevel, message: string) => void;
}

const useLogStore = create<LogState>()(
  persist(
    (set) => ({
      logs: [],
      addLog: (level, message) => set((state) => ({
        logs: [
          { timestamp: Date.now(), level, message },
          ...state.logs
        ].slice(0, 500) // Keep last 500 logs
      })),
    }),
    {
      name: 'system-logs',
    }
  )
);

export const useLogs = () => useLogStore();
export const addLog = (level: LogLevel, message: string) => {
  useLogStore.getState().addLog(level, message);
};
