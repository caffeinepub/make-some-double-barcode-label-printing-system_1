import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createSession, getSession, clearSession, isSessionValid, validatePassword, type PasswordSession } from './passwordSession';

interface PasswordSessionContextValue {
  isLocked: boolean;
  session: PasswordSession | null;
  unlock: (password: string) => boolean;
  lock: () => void;
}

const PasswordSessionContext = createContext<PasswordSessionContextValue | undefined>(undefined);

export function PasswordSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PasswordSession | null>(null);
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    const existingSession = getSession();
    if (existingSession && isSessionValid()) {
      setSession(existingSession);
      setIsLocked(false);
    } else if (existingSession) {
      // Session exists but is invalid (wrong password), clear it
      clearSession();
    }
  }, []);

  const unlock = (password: string): boolean => {
    // Validate password against configured expected password
    if (validatePassword(password)) {
      const newSession = createSession(password);
      setSession(newSession);
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const lock = () => {
    clearSession();
    setSession(null);
    setIsLocked(true);
  };

  return (
    <PasswordSessionContext.Provider value={{ isLocked, session, unlock, lock }}>
      {children}
    </PasswordSessionContext.Provider>
  );
}

export function usePasswordSession() {
  const context = useContext(PasswordSessionContext);
  if (!context) {
    throw new Error('usePasswordSession must be used within PasswordSessionProvider');
  }
  return context;
}
