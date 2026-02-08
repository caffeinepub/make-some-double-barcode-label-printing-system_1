import { getExpectedPassword } from '../config/lockScreenConfig';

const SESSION_KEY = 'makesomedouble_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

export interface PasswordSession {
  credential: string;
  expiresAt: number;
}

export function createSession(password: string): PasswordSession {
  const session: PasswordSession = {
    credential: password,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession(): PasswordSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    
    const session: PasswordSession = JSON.parse(stored);
    
    // Check if expired
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isSessionValid(): boolean {
  const session = getSession();
  if (!session) return false;
  
  // Validate that the stored credential matches the expected password
  const expectedPassword = getExpectedPassword();
  return session.credential === expectedPassword;
}

export function validatePassword(password: string): boolean {
  const expectedPassword = getExpectedPassword();
  return password === expectedPassword;
}
