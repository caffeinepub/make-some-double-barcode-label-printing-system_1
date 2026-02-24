/**
 * Lock screen password configuration
 * Default password: swh1400
 * To change: set VITE_LOCK_PASSWORD environment variable at build time
 */

const DEFAULT_PASSWORD = 'swh1400';

export function getExpectedPassword(): string {
  // Check for environment variable override (build-time only)
  if (import.meta.env.VITE_LOCK_PASSWORD) {
    return import.meta.env.VITE_LOCK_PASSWORD;
  }
  return DEFAULT_PASSWORD;
}
