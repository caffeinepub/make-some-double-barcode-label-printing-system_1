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
          ...state.logs,
        ].slice(0, 1000), // Keep last 1000 logs
      })),
    }),
    {
      name: 'system-logs',
    }
  )
);

export const addLog = (level: LogLevel, message: string) => {
  useLogStore.getState().addLog(level, message);
};

export const useLogs = () => {
  const logs = useLogStore((state) => state.logs);
  return { logs };
};

export default useLogStore;
