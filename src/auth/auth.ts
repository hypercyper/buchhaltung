// Auth abstraction. The rest of the app only talks to AuthProvider,
// so the mechanism (GIS popup vs. redirect) can be swapped (PLAN.md §9.1).

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export type AuthMethod = 'popup' | 'redirect';

export interface AuthProvider {
  readonly method: AuthMethod;
  /** Interactive sign-in. Popup resolves when done; redirect navigates away and never resolves. */
  signIn(): Promise<void>;
  /** Tries to get a fresh token without user interaction. Returns false if not possible. */
  trySilentRefresh(): Promise<boolean>;
  signOut(): void;
}

export interface StoredToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

const TOKEN_KEY = 'auth.token';
const METHOD_KEY = 'auth.method';
// Treat tokens as expired a bit early so a request never starts with a dying token.
const EXPIRY_MARGIN_MS = 60_000;

export function getClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
}

export function isTokenValid(token: StoredToken | null, now = Date.now()): boolean {
  return !!token && token.expiresAt - EXPIRY_MARGIN_MS > now;
}

export function saveToken(accessToken: string, expiresInSeconds: number, now = Date.now()): void {
  const token: StoredToken = { accessToken, expiresAt: now + expiresInSeconds * 1000 };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

export function loadToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** Valid access token or null. */
export function getAccessToken(): string | null {
  const token = loadToken();
  return isTokenValid(token) ? token!.accessToken : null;
}

export function getPreferredMethod(): AuthMethod {
  return localStorage.getItem(METHOD_KEY) === 'redirect' ? 'redirect' : 'popup';
}

export function setPreferredMethod(method: AuthMethod): void {
  localStorage.setItem(METHOD_KEY, method);
}
