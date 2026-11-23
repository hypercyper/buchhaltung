// Google Identity Services token client (popup based).
import { AuthProvider, DRIVE_SCOPE, clearToken, getAccountEmailHint, getClientId, loadToken, saveToken } from './auth';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string }) => void;
  }): TokenClient;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Google-Anmeldung konnte nicht geladen werden. Bist du online?'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function requestToken(prompt: string): Promise<void> {
  await loadGis();
  return new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? 'Anmeldung fehlgeschlagen'));
          return;
        }
        saveToken(response.access_token, response.expires_in ?? 3600);
        resolve();
      },
      error_callback: (error) => reject(new Error(error.type)),
    });
    client.requestAccessToken({ prompt, login_hint: getAccountEmailHint() || undefined });
  });
}

export const gisProvider: AuthProvider = {
  method: 'popup',
  // '' = consent only when not granted yet; otherwise just account confirmation.
  signIn: () => requestToken(''),
  async trySilentRefresh() {
    try {
      await requestToken('');
      return true;
    } catch {
      return false;
    }
  },
  signOut() {
    const token = loadToken();
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token.accessToken);
    }
    clearToken();
  },
};
