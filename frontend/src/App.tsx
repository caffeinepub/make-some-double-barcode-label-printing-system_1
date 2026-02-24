import { useEffect, useState } from 'react';
import { PasswordSessionProvider, usePasswordSession } from './auth/PasswordSessionProvider';
import LockScreen from './screens/LockScreen';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import PasswordSessionWiringErrorScreen from './screens/PasswordSessionWiringErrorScreen';

function AppInner() {
  const { isLocked } = usePasswordSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  if (isLocked) {
    return <LockScreen />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <ErrorBoundary
      fallback={(error) => {
        // Check if this is the password session context error
        if (error?.message?.includes('usePasswordSession must be used within PasswordSessionProvider')) {
          return <PasswordSessionWiringErrorScreen />;
        }
        // Generic error fallback
        return (
          <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-4">
              <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
              <p className="text-muted-foreground">
                An unexpected error occurred. Please refresh the page or contact support if the problem persists.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        );
      }}
    >
      <PasswordSessionProvider>
        <AppInner />
      </PasswordSessionProvider>
    </ErrorBoundary>
  );
}
