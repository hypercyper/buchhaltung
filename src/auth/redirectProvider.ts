// Fallback: classic OAuth 2.0 implicit flow via full-page redirect.
// Google redirects back to the app URL with the token in the URL fragment.
import { AuthProvider, DRIVE_SCOPE, clearToken, getClientId, saveToken } from './auth';

const STATE_KEY = 'auth.redirectState';

export function redirectUri(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

export interface FragmentToken {
  accessToken: string;
  expiresIn: number;
  state: string | null;
}

/** Parses "#access_token=...&expires_in=3599&state=..." */
export function parseTokenFragment(hash: string): FragmentToken | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  if (!accessToken) return null;
  return {
    accessToken,
    expiresIn: Number(params.get('expires_in') ?? 3600),
    state: params.get('state'),
  };
}

/**
 * Call once at startup, before any hash routing. Stores the token if the URL
 * carries one from a redirect and removes it from the address bar.
 * Returns true if a token was taken over.
 */
export function consumeRedirectResult(): boolean {
  const hash = window.location.hash;
  if (!hash.includes('access_token=') && !hash.includes('error=')) return false;

  const expectedState = sessionStorage.getItem(STATE_KEY) ?? localStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  localStorage.removeItem(STATE_KEY);
  history.replaceState(null, '', window.location.pathname + window.location.search);

  const result = parseTokenFragment(hash);
  if (!result || !expectedState || result.state !== expectedState) return false;
  saveToken(result.accessToken, result.expiresIn);
  return true;
}

export const redirectProvider: AuthProvider = {
  method: 'redirect',
  signIn() {
    const state = crypto.randomUUID();
    // iOS may return into a different browsing context, so keep state in both stores.
    sessionStorage.setItem(STATE_KEY, state);
    localStorage.setItem(STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: getClientId(),
      redirect_uri: redirectUri(),
      response_type: 'token',
      scope: DRIVE_SCOPE,
      include_granted_scopes: 'true',
      state,
    });
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    return new Promise<void>(() => {});
  },
  // Silent refresh would also need a redirect; not supported in this flow.
  trySilentRefresh: async () => false,
  signOut: clearToken,
};
