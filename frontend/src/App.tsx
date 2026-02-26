import React, { useEffect } from 'react';
import { PasswordSessionProvider, usePasswordSession } from './auth/PasswordSessionProvider';
import ErrorBoundary from './components/ErrorBoundary';
import LockScreen from './screens/LockScreen';
import AppShell from './components/AppShell';
import { usePrinterStore } from './services/printerService';

function AppInner() {
  const { isLocked } = usePasswordSession();
  const autoReconnectPrinter = usePrinterStore((s) => s.autoReconnectPrinter);

  useEffect(() => {
    if (!isLocked) {
      // Attempt silent auto-reconnect to last connected printer
      autoReconnectPrinter();
    }
  }, [isLocked, autoReconnectPrinter]);

  if (isLocked) {
    return <LockScreen />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <PasswordSessionProvider>
        <AppInner />
      </PasswordSessionProvider>
    </ErrorBoundary>
  );
}
