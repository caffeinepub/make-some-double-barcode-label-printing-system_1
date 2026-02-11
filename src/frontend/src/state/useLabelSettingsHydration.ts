import { useEffect, useState } from 'react';
import { useLabelSettings } from './labelSettingsStore';

/**
 * Hook that tracks whether the label settings store has finished hydrating from localStorage.
 * Use this to distinguish "not yet loaded" from "loaded with defaults".
 */
export function useLabelSettingsHydration() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Subscribe to the store's persist rehydration
    const unsubscribe = useLabelSettings.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    // Check if already hydrated (in case subscription happens after hydration)
    if (useLabelSettings.persist.hasHydrated()) {
      setHasHydrated(true);
    }

    return unsubscribe;
  }, []);

  return hasHydrated;
}
