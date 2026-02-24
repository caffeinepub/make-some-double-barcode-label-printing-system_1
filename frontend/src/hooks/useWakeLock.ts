import { useState, useEffect, useCallback } from 'react';

export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
    
    // Load saved preference
    const saved = localStorage.getItem('wake-lock-enabled');
    if (saved === 'true' && 'wakeLock' in navigator) {
      requestWakeLock();
    }
  }, []);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        const lock = await navigator.wakeLock.request('screen');
        setWakeLock(lock);
        setIsActive(true);
        localStorage.setItem('wake-lock-enabled', 'true');

        lock.addEventListener('release', () => {
          setIsActive(false);
        });
      }
    } catch (error) {
      console.warn('Wake Lock request failed:', error);
      setIsActive(false);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
        setIsActive(false);
        localStorage.setItem('wake-lock-enabled', 'false');
      } catch (error) {
        console.warn('Wake Lock release failed:', error);
      }
    }
  };

  const toggle = useCallback(() => {
    if (isActive) {
      releaseWakeLock();
    } else {
      requestWakeLock();
    }
  }, [isActive, wakeLock]);

  // Re-request wake lock when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive && !wakeLock) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, wakeLock]);

  return { isSupported, isActive, toggle };
}
